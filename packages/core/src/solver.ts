// Gün çözücü: zaman pencereli, ödül toplayan TSP (orienteering problem with time windows).
// Yuvalar (kahvaltı/öğle/akşam/çay/tatlı/alışveriş) "N adaydan tam biri" grupları, gezi durakları
// isteğe bağlı ödüllü düğümlerdir. Gün sabahki noktadan başlar, gecelenecek otelde biter.
//
// Yöntem: aday ön eleme (çevre + rota koridoru) → önce zorunlu öğünler, sonra fayda − λ·ek yol
// ölçütüyle açgözlü ekleme (ileri zaman yayılımıyla fizibilite) → yerel iyileştirme (yuvada aday
// değiştirme, taşıma, 2-opt, çıkarma/ekleme) → tohumlu sarsma turları. Aynı girdi + tohum = aynı plan.
import { CATEGORIES, PACE_TEMPLATES, SLOT_LABELS, SLOT_WINDOWS } from "./catalog";
import { calendarWarnings } from "./calendar";
import { haversineKm, lineLengthKm, projectOnLine } from "./geo";
import type { LineProjection, PlaceIndex } from "./geo";
import { availableWindows, hoursSource } from "./hours";
import type { Interval } from "./hours";
import { estimatePlaceCost, fuelCostTry, indexPrice } from "./pricing";
import type { CostContext } from "./pricing";
import { hashSeed, mulberry32 } from "./rng";
import { formatHHmm } from "./time";
import { isWalkLeg, straightLine } from "./travel";
import type { TravelModel } from "./travel";
import type {
  DayPlan,
  FxRates,
  Interest,
  LatLng,
  LonLat,
  NamedPoint,
  Pace,
  Place,
  PlanStop,
  Slot,
  TransportMode,
  TripRequest,
  Visitor,
} from "./types";

export interface PlanContext {
  index: PlaceIndex;
  travel: TravelModel;
  fx?: FxRates;
  /** Deterministik sonuç için tohum (aynı girdi + tohum = aynı plan) */
  seed?: number;
}

/** Varış penceresi olan yuvalar */
export type TimedSlot = Exclude<Slot, "gezi" | "konaklama">;

export interface DayInput {
  index: number;
  /** YYYY-MM-DD */
  date: string;
  from: NamedPoint;
  to: NamedPoint;
  stayId?: string;
  hotelPlaceId?: string;
  /** Gün içi dakika */
  startMin: number;
  endMin: number;
  pace: Pace;
  interests: Interest[];
  travelers: number;
  visitor: Visitor;
  hasMuzekart?: boolean;
  diet: TripRequest["diet"];
  /** Bu güne ayrılan harcama (konaklama hariç), TRY */
  dailyBudgetTry?: number;
  /** 0..1 — bütçe aşımı baskısı; büyüdükçe ucuz seçenekler öne çıkar */
  budgetPressure?: number;
  /** Diğer günlerde kullanılmış mekânlar (tekrar önerilmez) */
  excludePlaceIds?: ReadonlySet<string>;
  /** Hiç önerilmeyecek mekânlar (kullanıcı "kapalıydı"/"istemiyorum" dedi) */
  banPlaceIds?: ReadonlySet<string>;
  /** Onarımda: yapılmış ya da sabitlenmiş duraklar; aynen korunur, çözüm bunların ardından başlar */
  locked?: PlanStop[];
  /** Onarımda istikrar primi verilecek mekânlar (plan gereksiz yere dağılmasın) */
  preferPlaceIds?: ReadonlySet<string>;
  /** Onarımda mekânın eski yuvası; verilirse istikrar primi yalnız o yuvada geçerlidir */
  preferSlots?: ReadonlyMap<string, Slot>;
  /** Yol günü koridoru; adaylar bu çizgi çevresinden de seçilir */
  route?: LonLat[];
  /** Yağış beklenen aralıklar; bu saatlerde açık hava duraklarından kaçınılır */
  rainWindows?: Interval[];
  /** Bu yuvalar bu gün planlanmaz */
  skipSlots?: Slot[];
  /** Onarımda: yalnızca bu mekânlar arasından seçilir ("güne devam" seçeneği; yeni yer eklenmez) */
  onlyPlaceIds?: ReadonlySet<string>;
  /** Bu güne özel yuva varış pencereleri (geç öğle, erken akşam yemeği gibi) */
  slotWindows?: Partial<Record<TimedSlot, [number, number]>>;
  /** Tempo şablonuna ek olarak zorunlu sayılan yuvalar (kaçan öğün yerine ara öğün gibi) */
  requireSlots?: Slot[];
  /** Tempo şablonundaki gezi üst sınırının yerine geçer */
  maxGezi?: number;
}

export interface ScoredPlace {
  place: Place;
  utility: number;
  reasons: string[];
}

// ---------------------------------------------------------------- ağırlıklar

/** Yol dakikası başına fayda kaybı */
const LAMBDA = 0.018;
/** Bekleme (açılışı/yuva penceresini bekleme) dakikası başına fayda kaybı */
const MU = 0.004;
/** Bu saatten sonraki bekleme akşam yemeği öncesi dinlenme sayılır, daha az cezalı */
const REST_FROM_MIN = 17 * 60;
const MU_REST = 0.001;
/** Öğün, penceresinin ilk saatinden sonra başlarsa dakika başına ceza */
const MEAL_LATE = 0.004;
/** Bu süreden uzun kesintisiz sürüş yorar; dakika başına ceza */
const FATIGUE_FROM_MIN = 100;
const FATIGUE_PER_MIN = 0.01;
/** Açık hava durağının tamamı yağmura denk gelirse ceza */
const RAIN_PENALTY = 2;
/** Zorunlu yuvalar (öğünler) her zaman gezi duraklarından önce gelir */
const REQUIRED_BONUS = 10;
const OPTIONAL_BONUS = 0.15;
/** Onarımda plandaki yerin korunma primi */
const PREFER_BONUS = 0.6;
const EPS = 1e-9;
/** Bütçe verilmemişse kişi başı günlük harcama varsayımı, TRY */
const DEFAULT_DAILY_PER_PERSON = 2500;
/** "Bütçe dostu" eşiği için kişi başı yuva referans fiyatı (TRY, Ekim 2026 modeli) */
const SLOT_REF_PRICE: Partial<Record<Slot, number>> = { kahvalti: 525, ogle: 700, aksam: 900, cay: 150, tatli: 250 };

const INTEREST_TR: Record<Interest, string> = {
  tarih: "tarih",
  yemek: "yemek",
  tatli: "tatlı",
  doga: "doğa",
  deniz: "deniz",
  alisveris: "alışveriş",
  kultur: "kültür",
  fotograf: "fotoğraf",
};

const MEALS: ReadonlySet<Slot> = new Set<Slot>(["kahvalti", "ogle", "aksam"]);

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// ---------------------------------------------------------------- yardımcılar

/** Arama yarıçapları, km */
function radii(mode: TransportMode, travelDay: boolean): { area: number; corridor: number } {
  if (mode === "yuruyus") return { area: travelDay ? 1.5 : 2.5, corridor: 0.8 };
  if (mode === "toplu") return { area: travelDay ? 5 : 10, corridor: 2 };
  return { area: travelDay ? 12 : 25, corridor: 4 };
}

/** Kaba ortalama hız, km/dk (ön eleme için sapma süresi tahmini) */
function speedKmPerMin(mode: TransportMode): number {
  return mode === "yuruyus" ? 0.075 : mode === "toplu" ? 0.3 : 0.75;
}

const WINDOW_CACHE = new Map<string, Interval[]>();

/** availableWindows, gün + saat ifadesi + kategori bazında önbellekli (camilerde konum da) */
function windowsFor(place: Place, date: string): Interval[] {
  const key =
    place.cat === "cami"
      ? `cami|${place.id}|${place.loc.lat},${place.loc.lon}|${place.openingHours ?? ""}|${date}`
      : `${place.cat}|${place.openingHours ?? ""}|${date}`;
  let w = WINDOW_CACHE.get(key);
  if (!w) {
    if (WINDOW_CACHE.size > 20_000) WINDOW_CACHE.clear();
    w = availableWindows(place, date);
    WINDOW_CACHE.set(key, w);
  }
  return w;
}

function visitOf(place: Place): number {
  return place.visitMin > 0 ? place.visitMin : CATEGORIES[place.cat].visitMin;
}

function costCtx(input: DayInput, fx: FxRates | undefined): CostContext {
  return { travelers: input.travelers, visitor: input.visitor, hasMuzekart: input.hasMuzekart, date: input.date, fx };
}

function dietAllows(place: Place, diet: TripRequest["diet"]): boolean {
  return !(diet.noAlcohol && (place.alcohol || place.cat === "meyhane"));
}

function overlapMin(ws: readonly Interval[], a: number, b: number): number {
  let o = 0;
  for (const [s, e] of ws) o += Math.max(0, Math.min(b, e) - Math.max(a, s));
  return o;
}

/** lo'dan sonra ziyaretin tamamen sığdığı en erken başlangıç (hours.earliestStart ile aynı kural); yoksa -1 */
function startIn(win: readonly Interval[], lo: number, visit: number): number {
  for (let i = 0; i < win.length; i++) {
    const w = win[i]!;
    const st = w[0] > lo ? w[0] : lo;
    if (st + visit <= w[1]) return st;
  }
  return -1;
}

export function stopIdFor(dayIndex: number, slot: Slot, placeId: string): string {
  return `d${dayIndex}-${slot}-${placeId}`;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** "350 m yürüme", "1,1 km yürüme" */
function walkText(km: number): string {
  const m = Math.max(50, Math.round((km * 1000) / 50) * 50);
  return m < 1000 ? `${m} m yürüme` : `${(m / 1000).toFixed(1).replace(".", ",")} km yürüme`;
}

// ---------------------------------------------------------------- puanlama

interface Corridor {
  offKm: number;
  alongKm: number;
  routeKm: number;
  /** Rotanın uç bölgeleri dışında, koridor içinde */
  onRoute: boolean;
}

function corridorOf(proj: LineProjection, routeKm: number, bufferKm: number): Corridor {
  // Kalkış şehrinin içi "yol üstü" sayılmaz (İzmir gibi büyük şehirler rotanın ilk ~15 km'si)
  const head = Math.max(routeKm * 0.08, 15);
  const tail = Math.max(routeKm * 0.08, 5);
  const onRoute = routeKm > 30 && proj.distanceKm <= bufferKm && proj.alongKm >= head && proj.alongKm <= routeKm - tail;
  return { offKm: proj.distanceKm, alongKm: proj.alongKm, routeKm, onRoute };
}

interface Scored extends ScoredPlace {
  cost: number;
}

/** "Bütçe dostu" eşiği: yuva referans fiyatları o güne endekslenmiş, kişi başı TRY */
function slotRefPrices(date: string, fx: FxRates | undefined): Partial<Record<Slot, number>> {
  const out: Partial<Record<Slot, number>> = {};
  for (const [slot, amount] of Object.entries(SLOT_REF_PRICE) as Array<[Slot, number]>) {
    out[slot] = indexPrice({ amount, currency: "TRY", perPerson: true, observedAt: "2026-10-01", source: "model", kind: "estimate" }, date, fx);
  }
  return out;
}

function scoreInternal(
  place: Place,
  input: DayInput,
  fx: FxRates | undefined,
  corr: Corridor | undefined,
  refs: Partial<Record<Slot, number>>,
): Scored {
  const info = CATEGORIES[place.cat];
  const notes: Array<[number, string]> = [];
  let u = 0.2 + 1.2 * clamp01(place.notability) + 0.6 * clamp01(place.quality ?? 0.5);
  if ((place.quality ?? 0) >= 0.8) notes.push([0.3, "Kalite puanı yüksek"]);

  const matched = info.interests.filter((i) => input.interests.includes(i));
  if (matched.length > 0) {
    u += 0.35 * Math.min(2, matched.length);
    notes.push([0.4 + 0.05 * matched.length, `İlgi alanınız: ${matched.map((i) => INTEREST_TR[i]).join(", ")}`]);
  }

  const tags = new Set(place.tags);
  if (tags.has("unesco")) {
    u += 0.6;
    notes.push([1, "UNESCO Dünya Mirası"]);
  }
  // Bölgenin "mutlaka görülmeli" yerleri (Efes, Hierapolis…): uzun ziyaret kısa duraklara kaybetmesin
  if (info.group === "gezi" && place.notability >= 0.9) {
    u += 1 + Math.min(3, place.visitMin / 60);
    notes.push([0.98, "Bölgenin mutlaka görülmesi gereken yeri"]);
  }
  if (tags.has("michelin")) {
    u += 0.6;
    notes.push([0.95, "Michelin Rehberi'nde"]);
  } else if (tags.has("bib_gourmand")) {
    u += 0.45;
    notes.push([0.9, "Michelin Bib Gourmand"]);
  }
  if (tags.has("gault_millau")) {
    u += 0.3;
    notes.push([0.8, "Gault&Millau rehberinde"]);
  }
  if (tags.has("tarihi")) {
    u += 0.15;
    notes.push([0.45, "Tarihi"]);
  }
  if (tags.has("cografi_isaret")) {
    u += 0.2;
    notes.push([0.5, "Coğrafi işaretli ürünler"]);
  }
  if (tags.has("manzara")) {
    u += 0.1;
    notes.push([0.25, "Manzaralı"]);
  }

  // Yerel işletme eğilimi
  if (place.cat === "esnaf_lokantasi") {
    u += 0.25;
    notes.push([0.6, "Yerel esnaf lokantası"]);
  } else if (place.cat === "cay_bahcesi") {
    u += 0.15;
    if (tags.has("yerel")) notes.push([0.35, "Yerel çay bahçesi"]);
  } else if (tags.has("yerel")) {
    u += 0.2;
    notes.push([0.35, "Yerel işletme"]);
  }

  const ticketed = place.cat === "muze" || place.cat === "antik_kent";
  if (ticketed && tags.has("muzekart") && input.visitor === "yerli") {
    notes.push([0.55, "Müzekart geçerli"]);
    if (input.hasMuzekart) u += 0.2;
  }

  if (info.group === "yeme" && input.diet.vegetarian) {
    if (place.vegFriendly) {
      u += 0.35;
      notes.push([0.7, "Vejetaryen seçenekli"]);
    } else u -= place.cat === "kebapci" || place.cat === "balikci" ? 0.6 : 0.15;
  }
  if (!dietAllows(place, input.diet)) u -= 10;

  if (input.rainWindows && input.rainWindows.length > 0) {
    if (place.indoor ?? info.indoor) {
      u += 0.15;
      notes.push([0.65, "Kapalı alan — yağmura uygun"]);
    } else u -= 0.2;
  }

  // Maliyet: günlük bütçeye oranla; baskı arttıkça ucuz seçenekler öne çıkar
  const cost = estimatePlaceCost(place, costCtx(input, fx)).amountTry;
  const budget =
    input.dailyBudgetTry !== undefined ? Math.max(1, input.dailyBudgetTry) : DEFAULT_DAILY_PER_PERSON * Math.max(1, input.travelers);
  const pressure = clamp01(input.budgetPressure ?? 0);
  u -= (0.25 + 4 * pressure) * Math.min(1.5, cost / budget);
  const ref = refs[place.slots[0] ?? "gezi"];
  if (ref && cost > 0 && (cost / Math.max(1, input.travelers) <= 0.8 * ref || place.priceTier === 1)) {
    notes.push([0.5 + pressure, "Bütçe dostu"]);
  }

  if (input.preferPlaceIds?.has(place.id)) u += PREFER_BONUS;

  if (corr?.onRoute) {
    u += 0.35;
    notes.push([0.9, "Rota üstünde"]);
  }

  notes.sort((a, b) => b[0] - a[0]);
  return { place, utility: u, reasons: notes.slice(0, 4).map((n) => n[1]), cost };
}

/** Bir mekânın bu gün ve bu kullanıcı için faydası ve "neden burası" gerekçeleri */
export function scorePlace(place: Place, input: DayInput): ScoredPlace {
  let corr: Corridor | undefined;
  if (input.route && input.route.length >= 2) {
    corr = corridorOf(projectOnLine(place.loc, input.route), lineLengthKm(input.route), 4);
  }
  const { cost: _cost, ...scored } = scoreInternal(place, input, undefined, corr, slotRefPrices(input.date, undefined));
  return scored;
}

// ---------------------------------------------------------------- çözücü çekirdeği

interface Cand {
  place: Place;
  slot: Slot;
  /** Mesafe matrisindeki düğüm (her mekân bir düğüm; 0 = başlangıç, 1 = bitiş) */
  node: number;
  visit: number;
  win: Interval[];
  /** Yuva varış penceresi */
  lo: number;
  hi: number;
  util: number;
  reasons: string[];
  cost: number;
  outdoor: boolean;
  required: boolean;
  /** Kahvaltı/öğle/akşam */
  meal: boolean;
  onRoute: boolean;
}

interface Prefix {
  dep: Float64Array;
  acc: Float64Array;
  total: number;
}

interface RouteState {
  nodes: Set<number>;
  slots: Set<Slot>;
  gezi: number;
}

const START = 0;
const END = 1;

class DayEngine {
  readonly n: number;
  readonly cands: Cand[];
  readonly t0: number;
  endMin: number;
  readonly buffer: number;
  readonly firstBuffer: number;
  readonly rain: readonly Interval[];
  readonly maxGezi: number;
  readonly fatigueOn: boolean;
  readonly bySlot = new Map<Slot, number[]>();
  readonly all: number[];
  readonly requiredIdx: number[];
  private readonly locs: LatLng[];
  private readonly travel: TravelModel;
  private readonly lmin: Float64Array;
  private readonly lkm: Float64Array;
  private gain = 0;

  constructor(opts: {
    locs: LatLng[];
    travel: TravelModel;
    cands: Cand[];
    t0: number;
    endMin: number;
    buffer: number;
    firstBuffer: number;
    rain: readonly Interval[];
    maxGezi: number;
  }) {
    this.locs = opts.locs;
    this.travel = opts.travel;
    this.cands = opts.cands;
    this.t0 = opts.t0;
    this.endMin = opts.endMin;
    this.buffer = opts.buffer;
    this.firstBuffer = opts.firstBuffer;
    this.rain = opts.rain;
    this.maxGezi = opts.maxGezi;
    this.fatigueOn = opts.travel.mode !== "yuruyus";
    this.n = this.locs.length;
    this.lmin = new Float64Array(this.n * this.n).fill(-1);
    this.lkm = new Float64Array(this.n * this.n).fill(-1);
    this.cands.forEach((c, i) => {
      let list = this.bySlot.get(c.slot);
      if (!list) this.bySlot.set(c.slot, (list = []));
      list.push(i);
    });
    this.all = this.cands.map((_, i) => i);
    this.requiredIdx = this.all.filter((i) => this.cands[i]!.required);
  }

  private fillLeg(a: number, b: number): void {
    const k = a * this.n + b;
    const l = this.travel.leg(this.locs[a]!, this.locs[b]!);
    this.lmin[k] = l.min;
    this.lkm[k] = l.km;
  }

  legMin(a: number, b: number): number {
    const k = a * this.n + b;
    if (this.lmin[k]! < 0) this.fillLeg(a, b);
    return this.lmin[k]!;
  }

  legKm(a: number, b: number): number {
    const k = a * this.n + b;
    if (this.lkm[k]! < 0) this.fillLeg(a, b);
    return this.lkm[k]!;
  }

  private fatigue(tr: number): number {
    return this.fatigueOn && tr > FATIGUE_FROM_MIN ? (tr - FATIGUE_FROM_MIN) * FATIGUE_PER_MIN : 0;
  }

  /** prev düğümünden t'de çıkıp c'ye gider; ziyaret başlangıcını döner (sığmazsa -1), kazancı this.gain'e yazar */
  step(c: Cand, t: number, prev: number, buf: number): number {
    const tr = this.legMin(prev, c.node);
    const arr = t + tr + buf;
    const s = startIn(c.win, arr < c.lo ? c.lo : arr, c.visit);
    if (s < 0 || s > c.hi) return -1;
    // Akşamüstü bekleme (yemek öncesi dinlenme) gündüz boşluğundan daha az cezalı: boş vakit sabaha değil akşama kalsın
    const restWait = s > REST_FROM_MIN ? s - Math.max(arr, REST_FROM_MIN) : 0;
    let g = c.util - LAMBDA * tr - this.fatigue(tr) - MU * (s - arr - restWait) - MU_REST * restWait;
    // Öğünler pencerenin ilk saatinde tercih edilir (öğle 12:00–13:00 gibi)
    if (c.meal && s > c.lo + 60) g -= MEAL_LATE * (s - c.lo - 60);
    if (c.outdoor && this.rain.length > 0) g -= (RAIN_PENALTY * overlapMin(this.rain, s, s + c.visit)) / Math.max(1, c.visit);
    this.gain = g;
    return s;
  }

  private close(prev: number, t: number): number {
    const tr = this.legMin(prev, END);
    if (t + tr > this.endMin) return -Infinity;
    return -LAMBDA * tr - this.fatigue(tr);
  }

  /** Sıranın amaç değeri; zaman penceresi ya da gün sonu ihlalinde -Infinity */
  evaluate(seq: readonly number[], len: number = seq.length): number {
    let t = this.t0;
    let prev = START;
    let obj = 0;
    for (let i = 0; i < len; i++) {
      const c = this.cands[seq[i]!]!;
      const s = this.step(c, t, prev, i === 0 ? this.firstBuffer : this.buffer);
      if (s < 0) return -Infinity;
      obj += this.gain;
      t = s + c.visit;
      prev = c.node;
    }
    return obj + this.close(prev, t);
  }

  private prefix(route: readonly number[]): Prefix {
    const dep = new Float64Array(route.length);
    const acc = new Float64Array(route.length);
    let t = this.t0;
    let prev = START;
    let obj = 0;
    for (let i = 0; i < route.length; i++) {
      const c = this.cands[route[i]!]!;
      const s = this.step(c, t, prev, i === 0 ? this.firstBuffer : this.buffer);
      if (s < 0) return { dep, acc, total: -Infinity };
      obj += this.gain;
      t = s + c.visit;
      prev = c.node;
      dep[i] = t;
      acc[i] = obj;
    }
    return { dep, acc, total: obj + this.close(prev, t) };
  }

  /** route'un pos konumuna ci eklenirse amaç değeri (önek önbellekli, zaman aynı kalınca erken biter) */
  private insertionValue(route: readonly number[], pre: Prefix, ci: number, pos: number): number {
    let t = pos === 0 ? this.t0 : pre.dep[pos - 1]!;
    let prev = pos === 0 ? START : this.cands[route[pos - 1]!]!.node;
    let obj = pos === 0 ? 0 : pre.acc[pos - 1]!;
    const c = this.cands[ci]!;
    let s = this.step(c, t, prev, pos === 0 ? this.firstBuffer : this.buffer);
    if (s < 0) return -Infinity;
    obj += this.gain;
    t = s + c.visit;
    prev = c.node;
    for (let k = pos; k < route.length; k++) {
      const d = this.cands[route[k]!]!;
      s = this.step(d, t, prev, this.buffer);
      if (s < 0) return -Infinity;
      obj += this.gain;
      t = s + d.visit;
      prev = d.node;
      if (t === pre.dep[k]) return obj + (pre.total - pre.acc[k]!);
    }
    return obj + this.close(prev, t);
  }

  private state(route: readonly number[]): RouteState {
    const st: RouteState = { nodes: new Set(), slots: new Set(), gezi: 0 };
    for (const ci of route) {
      const c = this.cands[ci]!;
      st.nodes.add(c.node);
      if (c.slot === "gezi") st.gezi++;
      else st.slots.add(c.slot);
    }
    return st;
  }

  private canAdd(ci: number, st: RouteState, tabu?: ReadonlySet<number>): boolean {
    const c = this.cands[ci]!;
    if (st.nodes.has(c.node) || tabu?.has(ci)) return false;
    return c.slot === "gezi" ? st.gezi < this.maxGezi : !st.slots.has(c.slot);
  }

  bestInsertion(route: readonly number[], pool: readonly number[], tabu?: ReadonlySet<number>): { ci: number; pos: number; obj: number } | null {
    const pre = this.prefix(route);
    if (pre.total === -Infinity) return null;
    const st = this.state(route);
    let best: { ci: number; pos: number; obj: number } | null = null;
    let bestObj = pre.total + EPS;
    for (const ci of pool) {
      if (!this.canAdd(ci, st, tabu)) continue;
      for (let pos = 0; pos <= route.length; pos++) {
        const o = this.insertionValue(route, pre, ci, pos);
        if (o > bestObj) {
          bestObj = o;
          best = { ci, pos, obj: o };
        }
      }
    }
    return best;
  }

  /** Önce zorunlu yuvalar, sonra diğerleri: açgözlü en iyi ekleme */
  fill(route: number[], tabu?: ReadonlySet<number>): number[] {
    let r = route;
    for (const pool of [this.requiredIdx, this.all]) {
      for (;;) {
        const b = this.bestInsertion(r, pool, tabu);
        if (!b) break;
        r = [...r.slice(0, b.pos), b.ci, ...r.slice(b.pos)];
      }
    }
    return r;
  }

  /** Yerel arama: yuvada aday değiştirme, taşıma, 2-opt, çıkarma, ekleme */
  improve(route: number[]): number[] {
    let r = route;
    let cur = this.evaluate(r);
    for (let pass = 0; pass < 8; pass++) {
      let improved = false;

      for (let i = 0; i < r.length; i++) {
        const used = new Set(r.map((x) => this.cands[x]!.node));
        for (const cj of this.bySlot.get(this.cands[r[i]!]!.slot) ?? []) {
          const d = this.cands[cj]!;
          if (used.has(d.node)) continue;
          const trial = r.slice();
          const oldNode = this.cands[trial[i]!]!.node;
          trial[i] = cj;
          const o = this.evaluate(trial);
          if (o > cur + EPS) {
            r = trial;
            cur = o;
            improved = true;
            used.delete(oldNode);
            used.add(d.node);
          }
        }
      }

      for (let i = 0; i < r.length; i++) {
        for (let j = 0; j < r.length; j++) {
          if (i === j) continue;
          const trial = r.slice();
          const [x] = trial.splice(i, 1);
          trial.splice(j, 0, x!);
          const o = this.evaluate(trial);
          if (o > cur + EPS) {
            r = trial;
            cur = o;
            improved = true;
          }
        }
      }

      for (let i = 0; i < r.length - 2; i++) {
        for (let j = i + 2; j < r.length; j++) {
          const trial = [...r.slice(0, i), ...r.slice(i, j + 1).reverse(), ...r.slice(j + 1)];
          const o = this.evaluate(trial);
          if (o > cur + EPS) {
            r = trial;
            cur = o;
            improved = true;
          }
        }
      }

      for (let i = r.length - 1; i >= 0; i--) {
        if (this.cands[r[i]!]!.required) continue;
        const trial = r.slice();
        trial.splice(i, 1);
        const o = this.evaluate(trial);
        if (o > cur + EPS) {
          r = trial;
          cur = o;
          improved = true;
        }
      }

      const ins = this.bestInsertion(r, this.all);
      if (ins) {
        r = [...r.slice(0, ins.pos), ins.ci, ...r.slice(ins.pos)];
        cur = ins.obj;
        improved = true;
      }
      if (!improved) break;
    }
    return r;
  }

  /** Kurulum + iyileştirme + tohumlu sarsma turları */
  solve(rng: () => number, rounds: number): number[] {
    let best = this.improve(this.fill([]));
    let bestObj = this.evaluate(best);
    for (let round = 0; round < rounds && best.length > 0; round++) {
      const cur = best.slice();
      const tabu = new Set<number>();
      const k = 1 + Math.floor(rng() * Math.min(3, cur.length));
      for (let j = 0; j < k && cur.length > 0; j++) {
        const [removed] = cur.splice(Math.floor(rng() * cur.length), 1);
        tabu.add(removed!);
      }
      const next = this.improve(this.fill(cur, tabu));
      const o = this.evaluate(next);
      if (o > bestObj + EPS) {
        best = next;
        bestObj = o;
      }
    }
    return best;
  }

  /** Aynı konumda aynı yuvaya sığan diğer adaylar, en iyiden */
  alternatives(route: readonly number[], i: number, limit = 3): string[] {
    const c = this.cands[route[i]!]!;
    const used = new Set(route.map((x) => this.cands[x]!.node));
    const res: Array<[number, string]> = [];
    for (const cj of this.bySlot.get(c.slot) ?? []) {
      const d = this.cands[cj]!;
      if (used.has(d.node)) continue;
      const trial = route.slice();
      trial[i] = cj;
      const o = this.evaluate(trial);
      if (o > -Infinity) res.push([o, d.place.id]);
    }
    res.sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    return res.slice(0, limit).map((x) => x[1]);
  }
}

// ---------------------------------------------------------------- planDay

interface Entry {
  scored: Scored;
  slot: Slot;
  util: number;
  pre: number;
  onRoute: boolean;
}

/** Bir günü planlar. Saf ve deterministik: aynı girdi ve tohum aynı planı üretir. */
export function planDay(input: DayInput, ctx: PlanContext): DayPlan {
  const tpl = PACE_TEMPLATES[input.pace];
  const mode = ctx.travel.mode;
  const locked = (input.locked ?? []).map((s) => ({ ...s }));
  const lockedIds = new Set(locked.map((s) => s.placeId));
  const lockedSlots = new Set(locked.map((s) => s.slot));
  const lastLockedDepart = locked.reduce((m, s) => Math.max(m, s.departMin), -Infinity);
  const t0 = Math.max(input.startMin, lastLockedDepart);
  const isTravelDay = haversineKm(input.from.loc, input.to.loc) > 15;
  const R = radii(mode, isTravelDay);
  const route: LonLat[] | undefined =
    input.route && input.route.length >= 2 ? input.route : isTravelDay ? straightLine([input.from.loc, input.to.loc]) : undefined;
  const routeKm = route ? lineLengthKm(route) : 0;

  // ---- etkin yuvalar
  const win = (s: TimedSlot): [number, number] => input.slotWindows?.[s] ?? SLOT_WINDOWS[s];
  const skip = new Set(input.skipSlots ?? []);
  const usable = (s: Slot): TimedSlot | null => {
    if (s === "gezi" || s === "konaklama" || skip.has(s) || lockedSlots.has(s)) return null;
    const w = win(s);
    return w[1] >= t0 && w[0] <= input.endMin ? s : null;
  };
  const required = new Set<TimedSlot>();
  for (const s of [...tpl.required, ...(input.requireSlots ?? [])]) {
    const u = usable(s);
    if (u) required.add(u);
  }
  const optional = new Set<TimedSlot>();
  const optList: Slot[] = [...tpl.optional];
  if (input.interests.includes("tatli")) optList.push("tatli");
  if (input.interests.includes("alisveris")) optList.push("alisveris");
  for (const s of optList) {
    const u = usable(s);
    if (u && !required.has(u)) optional.add(u);
  }
  const maxGezi = Math.max(0, (input.maxGezi ?? tpl.maxGezi) - locked.filter((s) => s.slot === "gezi").length);
  const wanted = new Set<Slot>([...required, ...optional]);
  if (maxGezi > 0) wanted.add("gezi");

  // ---- aday havuzu
  const allowed = (p: Place) =>
    p.id !== input.hotelPlaceId &&
    !lockedIds.has(p.id) &&
    !input.excludePlaceIds?.has(p.id) &&
    !input.banPlaceIds?.has(p.id) &&
    (!input.onlyPlaceIds || input.onlyPlaceIds.has(p.id)) &&
    dietAllows(p, input.diet) &&
    p.slots.some((s) => wanted.has(s));
  const pool = new Map<string, { place: Place; proj?: LineProjection }>();
  if (wanted.size > 0) {
    for (const p of ctx.index.near(input.from.loc, R.area, allowed)) pool.set(p.id, { place: p });
    for (const p of ctx.index.near(input.to.loc, R.area, allowed)) if (!pool.has(p.id)) pool.set(p.id, { place: p });
    if (route) for (const { place, proj } of ctx.index.nearLine(route, R.corridor, allowed)) pool.set(place.id, { place, proj });
  }

  // ---- puanlama ve yuva başına ön sıralama
  const speed = speedKmPerMin(mode);
  const span = Math.max(1, input.endMin - t0);
  const entries = new Map<Slot, Entry[]>();
  const refs = slotRefPrices(input.date, ctx.fx);
  for (const { place, proj } of pool.values()) {
    const corr = route ? corridorOf(proj ?? projectOnLine(place.loc, route), routeKm, R.corridor) : undefined;
    const scored = scoreInternal(place, input, ctx.fx, corr, refs);
    const dKm = Math.min(
      haversineKm(place.loc, input.from.loc),
      haversineKm(place.loc, input.to.loc),
      corr ? corr.offKm : Infinity,
    );
    const detourMin = (2 * dKm * 1.35) / speed;
    for (const slot of place.slots) {
      if (!wanted.has(slot)) continue;
      let util = scored.utility;
      const oldSlot = input.preferSlots?.get(place.id);
      if (oldSlot && oldSlot !== slot && input.preferPlaceIds?.has(place.id)) util -= PREFER_BONUS;
      // Yol günü: öğün, yolcunun o saatte rotada olacağı yere yakınsa küçük prim
      if (corr && isTravelDay && MEALS.has(slot) && corr.offKm <= R.corridor) {
        const w = win(slot as TimedSlot);
        const expected = routeKm * clamp01(((w[0] + w[1]) / 2 - t0) / span);
        util += 0.3 * Math.max(0, 1 - Math.abs(corr.alongKm - expected) / Math.max(20, 0.25 * routeKm));
      }
      let list = entries.get(slot);
      if (!list) entries.set(slot, (list = []));
      list.push({ scored, slot, util, pre: util - LAMBDA * detourMin, onRoute: !!corr?.onRoute });
    }
  }

  // ---- aday listesi (çalışma saati ve yuva penceresi ön kontrolüyle)
  const nodeOf = new Map<string, number>();
  const locs: LatLng[] = [input.from.loc, input.to.loc];
  const cands: Cand[] = [];
  const slotOrder: Slot[] = ["kahvalti", "ogle", "aksam", "cay", "tatli", "alisveris", "gezi"];
  for (const slot of slotOrder) {
    const list = entries.get(slot);
    if (!list) continue;
    list.sort((a, b) => b.pre - a.pre || (a.scored.place.id < b.scored.place.id ? -1 : a.scored.place.id > b.scored.place.id ? 1 : 0));
    const cap = slot === "gezi" ? 32 : MEALS.has(slot) ? 16 : 10;
    const isReq = required.has(slot as TimedSlot);
    const [lo, hi] = slot === "gezi" ? [-Infinity, Infinity] : win(slot as TimedSlot);
    let taken = 0;
    for (const e of list) {
      if (taken >= cap) break;
      const place = e.scored.place;
      const visit = visitOf(place);
      const w = windowsFor(place, input.date);
      const a = Math.max(lo, t0);
      if (!w.some(([s, end]) => Math.max(s, a) + visit <= Math.min(end, input.endMin) && Math.max(s, a) <= hi)) continue;
      let node = nodeOf.get(place.id);
      if (node === undefined) {
        node = locs.length;
        locs.push(place.loc);
        nodeOf.set(place.id, node);
      }
      cands.push({
        place,
        slot,
        node,
        visit,
        win: w,
        lo,
        hi,
        util: e.util + (isReq ? REQUIRED_BONUS : slot === "gezi" ? 0 : OPTIONAL_BONUS),
        reasons: e.scored.reasons,
        cost: e.scored.cost,
        outdoor: !(place.indoor ?? CATEGORIES[place.cat].indoor),
        required: isReq,
        meal: MEALS.has(slot),
        onRoute: e.onRoute,
      });
      taken++;
    }
  }

  // ---- çözüm
  const engine = new DayEngine({
    locs,
    travel: ctx.travel,
    cands,
    t0,
    endMin: input.endMin,
    buffer: tpl.bufferMin,
    firstBuffer: locked.length > 0 ? tpl.bufferMin : 0,
    rain: input.rainWindows ?? [],
    maxGezi,
  });
  const warnings = [...calendarWarnings(input.date)];
  if (engine.evaluate([]) === -Infinity) {
    // Doğrudan gidiş bile gün sonuna yetişmiyor: bitişi gevşet, uyar.
    engine.endMin = t0 + engine.legMin(START, END);
  }
  const rng = mulberry32(hashSeed(ctx.seed ?? 1, input.index, input.date));
  const best = engine.solve(rng, cands.length > 0 ? 10 : 0);

  // ---- çıktı
  const cost = costCtx(input, ctx.fx);
  const stops: PlanStop[] = [...locked];
  const alternatives: Record<string, string[]> = {};
  let t = t0;
  let prev = START;
  let totalKm = locked.reduce((sum, s) => sum + s.travelKm, 0);
  best.forEach((ci, i) => {
    const c = engine.cands[ci]!;
    const tr = engine.legMin(prev, c.node);
    const km = engine.legKm(prev, c.node);
    const s = engine.step(c, t, prev, i === 0 ? engine.firstBuffer : engine.buffer);
    const id = stopIdFor(input.index, c.slot, c.place.id);
    const reasons = c.reasons.slice(0, 3);
    if (isWalkLeg(km, ctx.travel.mode)) reasons.push(walkText(km));
    if (reasons.length === 0) reasons.push(CATEGORIES[c.place.cat].label);
    stops.push({
      id,
      placeId: c.place.id,
      slot: c.slot,
      arriveMin: s,
      departMin: s + c.visit,
      travelMin: tr,
      travelKm: round1(km),
      estCost: c.cost,
      reasons,
      status: "planned",
      ...(c.onRoute ? { discovered: true } : {}),
    });
    alternatives[id] = engine.alternatives(best, i);
    totalKm += km;
    t = s + c.visit;
    prev = c.node;
  });
  const endTravel = engine.legMin(prev, END);
  const endKm = engine.legKm(prev, END);
  const arriveEnd = t + endTravel;
  totalKm += endKm;
  if (input.hotelPlaceId) {
    const hotel = ctx.index.get(input.hotelPlaceId);
    const hotelReasons = ["Bu gecenin konaklaması"];
    if (hotel && (hotel.quality ?? 0) >= 0.8) hotelReasons.push("Kalite puanı yüksek");
    if (hotel && isWalkLeg(endKm, ctx.travel.mode)) hotelReasons.push(walkText(endKm));
    stops.push({
      id: stopIdFor(input.index, "konaklama", input.hotelPlaceId),
      placeId: input.hotelPlaceId,
      slot: "konaklama",
      arriveMin: arriveEnd,
      departMin: arriveEnd,
      travelMin: endTravel,
      travelKm: round1(endKm),
      estCost: hotel ? estimatePlaceCost(hotel, cost).amountTry : 0,
      reasons: hotelReasons,
      status: "planned",
    });
  }

  // ---- uyarılar
  const covered = new Set<Slot>([...lockedSlots, ...best.map((ci) => engine.cands[ci]!.slot)]);
  for (const s of required) {
    if (!covered.has(s)) warnings.push(`${SLOT_LABELS[s]} için uygun ve açık bir yer bulunamadı.`);
  }
  const unverified: string[] = [];
  for (const ci of best) {
    const p = engine.cands[ci]!.place;
    if (hoursSource(p) === "default" && CATEGORIES[p.cat].defaultHours !== "24/7") unverified.push(p.name);
    if (p.note) warnings.push(`${p.name}: ${p.note}`);
  }
  if (unverified.length > 0) warnings.push(`Çalışma saati doğrulanmadı: ${unverified.join(", ")} — gitmeden kontrol edin.`);
  if (arriveEnd > input.endMin) {
    warnings.push(`${input.to.name} varışı ${formatHHmm(arriveEnd)}; gün sonu saatini (${formatHHmm(input.endMin)}) aşıyor.`);
  }

  const stopsCost = stops.reduce((sum, s) => sum + s.estCost, 0);
  const fuel = mode === "araba" ? fuelCostTry(totalKm) : 0;
  const outRoute = input.route && input.route.length >= 2 ? input.route : isTravelDay ? route : undefined;
  return {
    index: input.index,
    date: input.date,
    from: input.from,
    to: input.to,
    stayId: input.stayId,
    hotelPlaceId: input.hotelPlaceId,
    isTravelDay,
    startMin: input.startMin,
    endMin: input.endMin,
    stops,
    alternatives,
    estCost: Math.round(stopsCost + fuel),
    warnings,
    ...(outRoute ? { route: outRoute } : {}),
  };
}
