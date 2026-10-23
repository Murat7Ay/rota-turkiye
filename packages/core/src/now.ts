// "Şimdi ne yapsam?" — konum, saat, hava ve bütçeye göre önümüzdeki birkaç saat için birbirinden
// farklı 3 mini öneri (1–3 durak). Saf ve deterministik; ağ gerektirmez.
// Puanlama scorePlace'i, "mini rota" seçeneği kısa pencereli planDay'i yeniden kullanır; ikisinden
// biri hata verirse basit yerel puanlayıcıya düşülür ve özellik çalışmaya devam eder.
import type { BudgetStatus } from "./budget";
import { CATEGORIES, SLOT_LABELS } from "./catalog";
import { haversineKm } from "./geo";
import { availableWindows, hoursSource } from "./hours";
import type { Interval } from "./hours";
import { estimatePlaceCost } from "./pricing";
import type { CostContext } from "./pricing";
import { planDay, scorePlace } from "./solver";
import type { DayInput, PlanContext } from "./solver";
import { clockWithSuffix, goldenHourSpot, isViewSpot, sunTimes } from "./sun";
import { formatHHmm, parseHHmm, toTrWallClock } from "./time";
import { clamp01, fmtDuration, fmtInt, fmtKm, trLower, truncate } from "./trtext";
import type {
  Interest,
  LatLng,
  NamedPoint,
  Place,
  PlaceCategory,
  PlanStop,
  Slot,
  TransportMode,
  TripPlan,
  TripRequest,
  Visitor,
} from "./types";
import type { WeatherDay } from "./weather";

export interface NowInput {
  position: LatLng;
  /** YYYY-MM-DD (Türkiye saati) */
  date: string;
  /** Gün içi dakika */
  nowMin: number;
  /** Gecenin üssü; mini rota yakınsa burada biter */
  hotel?: NamedPoint;
  /** Günün bitişi (dayEnd), gün içi dakika */
  endMin?: number;
  interests: Interest[];
  travelers: number;
  visitor: Visitor;
  hasMuzekart?: boolean;
  diet: TripRequest["diet"];
  /** Bugün kalan harcama (konaklama hariç), TRY */
  remainingBudgetTry?: number;
  weather?: WeatherDay | null;
  /** Önerilmeyecek yerler (gidilmiş, kapalı bulunmuş, başka güne planlı) */
  excludePlaceIds?: ReadonlySet<string>;
  /** Öneri ufku, dk (varsayılan 180) */
  horizonMin?: number;
}

export type NowKind = "yemek" | "yagmur" | "kapanmadan" | "gun_batimi" | "yakinda" | "mini_rota" | "gezi" | "alisveris";

export interface NowStop {
  placeId: string;
  name: string;
  emoji: string;
  cat: PlaceCategory;
  loc: LatLng;
  /** Ziyaret başlangıcı (gerekirse açılış beklenir), gün içi dakika */
  arriveMin: number;
  departMin: number;
  /** Bir önceki noktadan (ilk durakta konumundan) yürüme süresi */
  walkMin?: number;
  /** Araç / toplu taşıma süresi */
  driveMin?: number;
  travelKm: number;
  /** Bütün yolcular için tahmini, TRY */
  costTry: number;
  /** "18:30'da kapanıyor · ~45 dk" */
  note: string;
}

export interface NowSuggestion {
  id: string;
  kind: NowKind;
  /** "Acıktıysan: esnaf lokantası 400 m" */
  title: string;
  /** "Selçuk Esnaf Lokantası · 18:00'e kadar açık" */
  subtitle: string;
  emoji: string;
  stops: NowStop[];
  totalCostTry: number;
  reasons: string[];
}

export const NOW_DEFAULT_HORIZON_MIN = 180;

// ---------------------------------------------------------------- iç yapı

/** estimateLeg bu yol mesafesinin altını yürüyüş sayar */
const WALK_KM = 1.2;
const POOL_LIMIT = 400;

type MealSlot = "kahvalti" | "ogle" | "aksam";

/** "Şu an öğün vakti" aralıkları (planlayıcının yuva pencerelerinden biraz geniş) */
const MEAL_NOW: ReadonlyArray<[MealSlot, number, number]> = [
  ["kahvalti", 6 * 60 + 30, 10 * 60 + 45],
  ["ogle", 11 * 60 + 30, 15 * 60],
  ["aksam", 18 * 60, 22 * 60 + 30],
];
/** Öğün penceresine bu kadar kala "yaklaşıyor" sayılır, dk */
const MEAL_SOON = 45;
/** Öğünden sonra eklenen ikinci durak */
const MEAL_FOLLOW: Record<MealSlot, Slot[]> = { kahvalti: ["gezi"], ogle: ["cay", "tatli"], aksam: ["tatli"] };

/** Kind tabanlı öncelik; aynı türün içinde puan sıralar */
const PRIO: Record<NowKind, number> = {
  yemek: 100,
  yagmur: 90,
  kapanmadan: 80,
  gun_batimi: 60,
  yakinda: 65,
  mini_rota: 62,
  gezi: 55,
  alisveris: 45,
};

interface Visit {
  place: Place;
  legMin: number;
  legKm: number;
  walk: boolean;
  /** Ziyaret başlangıcı (bekleme dahil) */
  start: number;
  depart: number;
  wait: number;
  /** Bekleme mekânın açılmasından mı (yoksa öğün saatinden mi) */
  opening: boolean;
  /** Başlangıcı içeren açık aralığın bitişi */
  closeMin: number;
  /** Bu aralık günün son açık aralığı mı (değilse ara kapanış: ör. namaz vakti) */
  lastWindow: boolean;
}

interface Cand {
  s: NowSuggestion;
  prio: number;
}

interface Env {
  input: NowInput;
  ctx: PlanContext;
  mode: TransportMode;
  t0: number;
  tEnd: number;
  rain: Interval[];
  hot: boolean;
  day: DayInput;
  cost: CostContext;
  pool: Place[];
  radiusKm: number;
  meal: { slot: MealSlot; upcoming: boolean; lo: number } | null;
  utilCache: Map<string, { u: number; reasons: string[] }>;
  winCache: Map<string, Interval[]>;
  costCache: Map<string, number>;
}

const isIndoor = (p: Place) => p.indoor ?? CATEGORIES[p.cat].indoor;
const visitOf = (p: Place) => (p.visitMin > 0 ? p.visitMin : CATEGORIES[p.cat].visitMin);
const dietAllows = (p: Place, diet: TripRequest["diet"]) => !(diet.noAlcohol && (p.alcohol || p.cat === "meyhane"));
const round1 = (x: number) => Math.round(x * 10) / 10;
const clampScore = (x: number) => Math.max(-5, Math.min(5, x));

function windowsOf(env: Env, p: Place): Interval[] {
  // Aynı kategori + saat ifadesi aynı aralıkları verir; camide namaz vakitleri konuma bağlı
  const key = p.cat === "cami" ? `cami|${p.id}` : `${p.cat}|${p.openingHours ?? ""}`;
  let w = env.winCache.get(key);
  if (!w) env.winCache.set(key, (w = availableWindows(p, env.input.date)));
  return w;
}

function costOf(env: Env, p: Place): number {
  let c = env.costCache.get(p.id);
  if (c === undefined) env.costCache.set(p.id, (c = estimatePlaceCost(p, env.cost).amountTry));
  return c;
}

/** Bütçe cezası; kalan bütçeyi aşan yer için büyük (öğün dışı türlerde zaten elenir) */
function budgetPenalty(env: Env, p: Place): number {
  const left = env.input.remainingBudgetTry;
  if (left === undefined) return 0;
  const c = costOf(env, p);
  if (c <= 0) return 0;
  const r = c / Math.max(1, left);
  return r > 1 ? 2 + r : 0.6 * r;
}

function overBudget(env: Env, p: Place): boolean {
  const left = env.input.remainingBudgetTry;
  const c = costOf(env, p);
  return left !== undefined && c > 0 && c > left;
}

/** Açık alanda yağmura denk gelen oran (0..1) */
function rainHit(env: Env, p: Place, a: number, b: number): number {
  if (env.rain.length === 0 || isIndoor(p)) return 0;
  let o = 0;
  for (const [s, e] of env.rain) o += Math.max(0, Math.min(b, e) - Math.max(a, s));
  return Math.min(1, o / Math.max(1, b - a));
}

/** Çözücü yoksa/hata verirse: basit fayda + gerekçe */
function simpleScore(env: Env, p: Place): { utility: number; reasons: string[] } {
  const info = CATEGORIES[p.cat];
  const reasons: string[] = [];
  let u = 0.3 + 1.2 * clamp01(p.notability) + 0.5 * clamp01(p.quality ?? 0.5);
  u += 0.35 * Math.min(2, info.interests.filter((i) => env.input.interests.includes(i)).length);
  if (p.tags.includes("unesco")) {
    u += 0.6;
    reasons.push("UNESCO Dünya Mirası");
  }
  if (p.tags.includes("tarihi")) {
    u += 0.15;
    reasons.push("Tarihi");
  }
  if (p.cat === "esnaf_lokantasi" || p.tags.includes("yerel")) {
    u += 0.2;
    reasons.push("Yerel işletme");
  }
  if (p.tags.includes("manzara")) {
    u += 0.1;
    reasons.push("Manzaralı");
  }
  if (env.input.diet.vegetarian && info.group === "yeme") u += p.vegFriendly ? 0.35 : -0.15;
  if (env.rain.length > 0 && isIndoor(p)) {
    u += 0.15;
    reasons.push("Kapalı alan — yağmura uygun");
  }
  const budget = env.input.remainingBudgetTry ?? 2500 * Math.max(1, env.input.travelers);
  u -= 0.5 * Math.min(1.5, costOf(env, p) / Math.max(1, budget));
  return { utility: u, reasons: reasons.slice(0, 3) };
}

function scoreOf(env: Env, p: Place): { u: number; reasons: string[] } {
  const hit = env.utilCache.get(p.id);
  if (hit) return hit;
  let base: { utility: number; reasons: string[] };
  try {
    base = scorePlace(p, env.day);
  } catch {
    base = simpleScore(env, p);
  }
  let u = base.utility;
  const reasons = [...base.reasons];
  if (env.hot && CATEGORIES[p.cat].group === "gezi") {
    if (isIndoor(p)) {
      u += 0.15;
      reasons.unshift("Sıcakta kapalı alan");
    } else u -= 0.5;
  }
  const out = { u, reasons };
  env.utilCache.set(p.id, out);
  return out;
}

/**
 * from'dan t anında çıkıp p'ye gider; ziyaret en az minStay dk sığmalı, bekleme maxWait'i
 * aşmamalı ve ufuk içinde başlamalı. Sığmazsa null.
 */
function reach(
  env: Env,
  p: Place,
  from: LatLng,
  t: number,
  o: { maxWait: number; minStay?: number; notBefore?: number },
): Visit | null {
  const leg = env.ctx.travel.leg(from, p.loc);
  const arr = t + leg.min;
  if (arr >= env.tEnd) return null;
  const visit = visitOf(p);
  const stay = Math.min(visit, o.minStay ?? visit);
  const lo = Math.max(arr, o.notBefore ?? -Infinity);
  const wins = windowsOf(env, p);
  for (let i = 0; i < wins.length; i++) {
    const [s, e] = wins[i]!;
    const st = Math.max(s, lo);
    if (st + stay > e) continue;
    if (st - lo > o.maxWait || st >= env.tEnd) return null;
    return {
      place: p,
      legMin: leg.min,
      legKm: leg.km,
      walk: env.mode === "yuruyus" || leg.km < WALK_KM,
      start: st,
      depart: Math.min(st + visit, e),
      wait: st - arr,
      opening: s > lo,
      closeMin: e,
      lastWindow: i === wins.length - 1,
    };
  }
  return null;
}

// ---------------------------------------------------------------- metin

function distText(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${fmtKm(km)} km`;
}

function legText(env: Env, v: { legMin: number; legKm: number; walk: boolean }): string {
  if (v.legKm < 0.05) return "tam yanında";
  if (v.walk) return `${Math.max(1, v.legMin)} dk yürüme`;
  return `${v.legMin} dk ${env.mode === "toplu" ? "toplu taşımayla" : "araçla"}`;
}

/** Başlık sonu: yürüyüşte "400 m", araçla "· 9 dk" */
function nearText(v: Visit): string {
  if (v.legKm < 0.05) return "tam yanında";
  return v.walk ? distText(v.legKm) : `· ${v.legMin} dk`;
}

function openText(v: Visit): string {
  if (v.wait > 5) return `${clockWithSuffix(v.start, "de")} ${v.opening ? "açılıyor" : "orada ol"}`;
  // availableWindows ertesi gün 06:00'ya kadar bakar; 7/24 yerin aralığı oraya uzanır
  if (v.closeMin >= 30 * 60) return "7/24 açık";
  if (v.closeMin - v.start <= 180) return `${clockWithSuffix(v.closeMin, "e")} kadar açık`;
  return "şu an açık";
}

function unverified(p: Place): boolean {
  return hoursSource(p) === "default" && CATEGORIES[p.cat].defaultHours !== "24/7";
}

function stopNote(env: Env, v: Visit, extra?: string): string {
  const parts: string[] = [];
  if (extra) parts.push(extra);
  parts.push(`~${v.depart - v.start} dk`);
  if (v.wait > 5 && v.opening) parts.push(`${clockWithSuffix(v.start, "de")} açılıyor`);
  else if (v.closeMin - v.depart <= 60 && v.closeMin < 30 * 60) parts.push(`${clockWithSuffix(v.closeMin, "de")} kapanıyor`);
  const c = costOf(env, v.place);
  if (c > 0 && CATEGORIES[v.place.cat].group === "yeme") parts.push(`kişi başı ~${fmtInt(c / Math.max(1, env.input.travelers))} TL`);
  if (unverified(v.place)) parts.push("saatleri doğrulanmadı");
  return parts.join(" · ");
}

function stopOf(env: Env, v: Visit, note: string): NowStop {
  const p = v.place;
  return {
    placeId: p.id,
    name: p.name,
    emoji: CATEGORIES[p.cat].emoji,
    cat: p.cat,
    loc: p.loc,
    arriveMin: v.start,
    departMin: v.depart,
    ...(v.walk ? { walkMin: Math.max(v.legKm < 0.05 ? 0 : 1, v.legMin) } : { driveMin: v.legMin }),
    travelKm: round1(v.legKm),
    costTry: costOf(env, p),
    note,
  };
}

function make(kind: NowKind, title: string, subtitle: string, emoji: string, stops: NowStop[], reasons: string[]): NowSuggestion {
  const uniq = [...new Set(reasons.filter(Boolean))].slice(0, 4);
  return {
    id: `${kind}:${stops.map((s) => s.placeId).join("+")}`,
    kind,
    title,
    subtitle,
    emoji,
    stops,
    totalCostTry: stops.reduce((a, s) => a + s.costTry, 0),
    reasons: uniq,
  };
}

/** Başlıkta durak türünü anlatan tek kelime: "çay", "manzara", "müze" */
function kindWord(p: Place): string {
  if (p.cat === "cay_bahcesi" || p.cat === "kahvehane") return "çay";
  if (p.cat === "kafe") return "kahve";
  if (p.cat === "tatlici") return "tatlı";
  if (isViewSpot(p)) return "manzara";
  return trLower(CATEGORIES[p.cat].label);
}

function rainText(env: Env): string | null {
  const w = env.rain.find(([s, e]) => e > env.t0 && s < env.tEnd);
  return w ? `${formatHHmm(Math.max(w[0], env.t0))}–${formatHHmm(w[1])} arası yağmur bekleniyor` : null;
}

function top<T extends { score: number }>(list: T[], n: number, id: (x: T) => string): T[] {
  return list.sort((a, b) => b.score - a.score || (id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0)).slice(0, n);
}

// ---------------------------------------------------------------- ortam

function makeEnv(input: NowInput, ctx: PlanContext): Env {
  const t0 = Math.max(0, Math.round(input.nowMin));
  const horizon = Math.max(30, input.horizonMin ?? NOW_DEFAULT_HORIZON_MIN);
  const dayEnd = input.endMin !== undefined && input.endMin > t0 + 30 ? input.endMin : t0 + horizon;
  const tEnd = Math.min(t0 + horizon, dayEnd);
  const mode = ctx.travel.mode;
  const weather = input.weather && input.weather.date === input.date ? input.weather : null;
  const rain = (weather?.rainWindows ?? []).filter(([s, e]) => e > t0 && s < tEnd);
  const hour = Math.min(23, Math.floor(t0 / 60));
  const hot = !!weather && (weather.hourlyTempC[hour] ?? weather.tMaxC) >= 32 && t0 >= 11 * 60 && t0 < 17 * 60;

  let meal: Env["meal"] = null;
  for (const [slot, s, e] of MEAL_NOW) if (t0 >= s && t0 < e) meal = { slot, upcoming: false, lo: s };
  if (!meal) for (const [slot, s] of MEAL_NOW) if (t0 >= s - MEAL_SOON && t0 < s) meal = { slot, upcoming: true, lo: s };

  const left = input.remainingBudgetTry;
  const perPerson = left !== undefined ? left / Math.max(1, input.travelers) : undefined;
  const from: NamedPoint = { name: "Konumun", loc: input.position };
  const day: DayInput = {
    index: 0,
    date: input.date,
    from,
    to: input.hotel ?? from,
    startMin: t0,
    endMin: tEnd,
    pace: "dengeli",
    interests: input.interests,
    travelers: input.travelers,
    visitor: input.visitor,
    hasMuzekart: input.hasMuzekart,
    diet: input.diet,
    ...(left !== undefined ? { dailyBudgetTry: Math.max(1, left), budgetPressure: clamp01((1200 - (perPerson ?? 0)) / 1200) } : {}),
    excludePlaceIds: input.excludePlaceIds,
    rainWindows: rain,
    maxGezi: 2,
  };
  const radiusKm = mode === "yuruyus" ? 2 : mode === "toplu" ? 6 : 15;
  const pool = ctx.index
    .near(input.position, radiusKm, (p) => {
      const g = CATEGORIES[p.cat].group;
      return g !== "konaklama" && g !== "yol" && !input.excludePlaceIds?.has(p.id) && dietAllows(p, input.diet) && p.slots.length > 0;
    })
    .slice(0, POOL_LIMIT);

  return {
    input,
    ctx,
    mode,
    t0,
    tEnd,
    rain,
    hot,
    day,
    cost: { travelers: input.travelers, visitor: input.visitor, hasMuzekart: input.hasMuzekart, date: input.date, fx: ctx.fx },
    pool,
    radiusKm,
    meal,
    utilCache: new Map(),
    winCache: new Map(),
    costCache: new Map(),
  };
}

// ---------------------------------------------------------------- öneri türleri

/** prev'den sonra yakında, verilen yuvalardan birine uyan en iyi ikinci durak */
function followUp(env: Env, prev: Visit, slots: readonly Slot[], maxKm: number, used: ReadonlySet<string>): Visit | null {
  let best: { v: Visit; score: number } | null = null;
  for (const p of env.pool) {
    if (used.has(p.id) || p.id === prev.place.id || !p.slots.some((s) => slots.includes(s))) continue;
    if (haversineKm(prev.place.loc, p.loc) > maxKm || overBudget(env, p)) continue;
    const v = reach(env, p, prev.place.loc, prev.depart, { maxWait: 20, minStay: Math.min(visitOf(p), 30) });
    if (!v) continue;
    const sc = scoreOf(env, p);
    const score =
      sc.u - 0.05 * v.legMin - 0.01 * v.wait - 2 * rainHit(env, p, v.start, v.depart) - budgetPenalty(env, p) + (isViewSpot(p) ? 0.2 : 0);
    if (!best || score > best.score || (score === best.score && p.id < best.v.place.id)) best = { v, score };
  }
  return best?.v ?? null;
}

function mealCands(env: Env): Cand[] {
  const m = env.meal;
  if (!m) return [];
  const list: Array<{ v: Visit; score: number }> = [];
  for (const p of env.pool) {
    if (!p.slots.includes(m.slot)) continue;
    const v = reach(env, p, env.input.position, env.t0, {
      maxWait: m.upcoming ? MEAL_SOON + 15 : 25,
      minStay: Math.min(visitOf(p), 40),
      ...(m.upcoming ? { notBefore: m.lo - 10 } : {}),
    });
    if (!v) continue;
    const sc = scoreOf(env, p);
    list.push({ v, score: sc.u - 0.045 * v.legMin - 0.01 * v.wait - budgetPenalty(env, p) - 1.5 * rainHit(env, p, v.start, v.depart) });
  }
  const lead = m.upcoming ? `${SLOT_LABELS[m.slot]} yaklaşıyor` : m.slot === "kahvalti" ? "Kahvaltı vakti" : "Acıktıysan";
  return top(list, 2, (x) => x.v.place.id).map(({ v, score }) => {
    const p = v.place;
    const sc = scoreOf(env, p);
    const second = followUp(env, v, MEAL_FOLLOW[m.slot], 0.8, new Set());
    const stops = [stopOf(env, v, stopNote(env, v, SLOT_LABELS[m.slot]))];
    if (second) stops.push(stopOf(env, second, stopNote(env, second, `Sonra ${kindWord(second.place)}`)));
    const reasons = [...sc.reasons.slice(0, 2), legText(env, v)];
    if (env.input.remainingBudgetTry !== undefined && costOf(env, p) > env.input.remainingBudgetTry) reasons.push("Bugünkü bütçeni aşıyor");
    return {
      prio: (m.upcoming ? 72 : PRIO.yemek) + clampScore(score),
      s: make("yemek", `${lead}: ${trLower(CATEGORIES[p.cat].label)} ${nearText(v)}`, `${p.name} · ${openText(v)}`, CATEGORIES[p.cat].emoji, stops, reasons),
    };
  });
}

function closingCands(env: Env): Cand[] {
  const list: Array<{ v: Visit; score: number; minStay: number }> = [];
  for (const p of env.pool) {
    const g = CATEGORIES[p.cat].group;
    if ((g !== "gezi" && p.cat !== "carsi") || p.cat === "manzara" || hoursSource(p) === "none" || overBudget(env, p)) continue;
    const visit = visitOf(p);
    const minStay = Math.min(visit, Math.max(30, Math.round(visit * 0.6)));
    const v = reach(env, p, env.input.position, env.t0, { maxWait: 10, minStay });
    if (!v || !v.lastWindow || v.closeMin > env.tEnd + 30 || v.closeMin - v.start > 12 * 60) continue;
    if (rainHit(env, p, v.start, v.depart) > 0.5) continue;
    const sc = scoreOf(env, p);
    const fits = CATEGORIES[p.cat].interests.some((i) => env.input.interests.includes(i));
    if (p.notability < 0.45 && !fits) continue;
    const slack = v.closeMin - (v.start + minStay);
    const score = sc.u - 0.02 * v.legMin + (slack < 45 ? 0.3 : 0) - (unverified(p) ? 0.4 : 0) - budgetPenalty(env, p);
    list.push({ v, score, minStay });
  }
  return top(list, 2, (x) => x.v.place.id).map(({ v, score }) => {
    const p = v.place;
    const sc = scoreOf(env, p);
    const note = `${clockWithSuffix(v.closeMin, "de")} kapanıyor · ~${v.depart - v.start} dk gezersin${unverified(p) ? " · saatleri doğrulanmadı" : ""}`;
    return {
      prio: PRIO.kapanmadan + clampScore(score),
      s: make(
        "kapanmadan",
        `Kapanmadan yetiş: ${p.name}`,
        `${clockWithSuffix(v.closeMin, "e")} kadar açık · ${legText(env, v)}`,
        "⏳",
        [stopOf(env, v, note)],
        [`Kapanışa ${fmtDuration(v.closeMin - env.t0)} var`, ...sc.reasons.slice(0, 2)],
      ),
    };
  });
}

function sunsetCands(env: Env): Cand[] {
  const sun = sunTimes(env.input.position, env.input.date);
  const sunset = sun.sunsetMin;
  if (sunset < env.t0 + 15 || sunset > env.tEnd + 20) return [];
  if (env.rain.some(([s, e]) => s < sunset && e > sunset - 40)) return [];
  const spot = goldenHourSpot(null, env.input.position, env.ctx.index, env.input.date, {
    travel: env.ctx.travel,
    nowMin: env.t0,
    radiusKm: env.radiusKm,
    ...(env.input.excludePlaceIds ? { excludePlaceIds: env.input.excludePlaceIds } : {}),
  });
  if (!spot) return [];
  const p = spot.place;
  const v: Visit = {
    place: p,
    legMin: spot.travelMin,
    legKm: spot.travelKm,
    walk: spot.walk,
    start: spot.arriveMin,
    depart: Math.min(spot.closesMin ?? Infinity, sunset + 10),
    wait: 0,
    opening: false,
    closeMin: spot.closesMin ?? sunset + 120,
    lastWindow: true,
  };
  const g = sun.goldenEvening;
  const note = `Gün batımı ${formatHHmm(sunset)} · altın saat ${formatHHmm(g[0])}–${formatHHmm(g[1])}${
    spot.closesMin !== undefined ? ` · ${clockWithSuffix(spot.closesMin, "de")} kapanıyor` : ""
  }`;
  const stops = [stopOf(env, v, note)];
  const dinner = sunset >= 17 * 60 ? followUp(env, v, ["aksam"], 1.5, new Set()) : null;
  if (dinner) stops.push(stopOf(env, dinner, stopNote(env, dinner, "Sonra akşam yemeği")));
  const sc = scoreOf(env, p);
  const leaveIn = spot.leaveMin - env.t0;
  const subtitle = `Gün batımı ${formatHHmm(sunset)} · ${leaveIn > 20 ? `${clockWithSuffix(spot.leaveMin, "de")} çık, ` : ""}${legText(env, v)}`;
  const reasons = [
    leaveIn <= 15 ? "Hemen çıkman gerek" : `Altın saat ${clockWithSuffix(g[0], "den")} itibaren`,
    ...sc.reasons.slice(0, 2),
  ];
  return [
    {
      prio: (sunset - env.t0 <= 100 ? 86 : PRIO.gun_batimi) + clampScore(sc.u - 0.02 * spot.travelMin),
      s: make("gun_batimi", `Gün batımına yetiş: ${p.name}`, subtitle, "🌅", stops, reasons),
    },
  ];
}

function rainCands(env: Env): Cand[] {
  if (!env.rain.some(([s, e]) => s < env.t0 + 120 && e > env.t0)) return [];
  const list: Array<{ v: Visit; score: number }> = [];
  for (const p of env.pool) {
    const g = CATEGORIES[p.cat].group;
    if (!isIndoor(p) || (g !== "gezi" && g !== "alisveris") || overBudget(env, p)) continue;
    const v = reach(env, p, env.input.position, env.t0, { maxWait: 20, minStay: Math.min(visitOf(p), 40) });
    if (!v) continue;
    const sc = scoreOf(env, p);
    list.push({ v, score: sc.u - 0.03 * v.legMin - budgetPenalty(env, p) + (g === "gezi" ? 0.3 : 0) });
  }
  const rt = rainText(env);
  return top(list, 2, (x) => x.v.place.id).map(({ v, score }) => {
    const p = v.place;
    const stops = [stopOf(env, v, stopNote(env, v, "Kapalı alan"))];
    const cozy = followUp(env, v, ["cay", "tatli"], 0.8, new Set());
    if (cozy && isIndoor(cozy.place)) stops.push(stopOf(env, cozy, stopNote(env, cozy, `Sonra ${kindWord(cozy.place)}`)));
    return {
      prio: PRIO.yagmur + clampScore(score),
      s: make("yagmur", `Yağmurdan kaçış: ${p.name}`, `Kapalı alan · ${legText(env, v)}`, "☔", stops, [
        rt ?? "Yağmur bekleniyor",
        ...scoreOf(env, p).reasons.filter((r) => !r.startsWith("Kapalı alan")).slice(0, 2),
      ]),
    };
  });
}

function nearbyCands(env: Env): Cand[] {
  const maxLeg = env.mode === "yuruyus" ? 15 : 12;
  const here = env.input.position;
  const teas: Array<{ v: Visit; score: number }> = [];
  for (const p of env.pool) {
    if (!p.slots.includes("cay") || overBudget(env, p)) continue;
    const v = reach(env, p, here, env.t0, { maxWait: 10, minStay: Math.min(visitOf(p), 25) });
    if (!v || v.legMin > maxLeg) continue;
    const sc = scoreOf(env, p);
    teas.push({
      v,
      score: sc.u - 0.06 * v.legMin + (p.tags.includes("manzara") ? 0.3 : 0) - 2 * rainHit(env, p, v.start, v.depart) - budgetPenalty(env, p),
    });
  }
  const words = (vs: Visit[]) => vs.map((v) => kindWord(v.place)).join(" + ");
  const out: Cand[] = [];
  // En iyi iki çay noktası: biri başka öneride kullanılırsa diğeri devreye girer
  for (const [rank, tea] of top(teas, 2, (x) => x.v.place.id).entries()) {
    const pair = teaPair(env, tea.v, maxLeg);
    if (pair) {
      const { a, b } = pair;
      out.push({
        prio: PRIO.yakinda - 2 * rank + clampScore(pair.score * 0.5 + tea.score * 0.5),
        s: make(
          "yakinda",
          `Hemen yakında: ${words([a, b])}`,
          truncate(`${a.place.name} → ${b.place.name}`, 80),
          a.place.cat === "tatlici" || b.place.cat === "tatlici" ? "🍯" : "🫖",
          [a, b].map((v) => stopOf(env, v, stopNote(env, v))),
          [legText(env, a), ...scoreOf(env, a.place).reasons.slice(0, 1), ...scoreOf(env, b.place).reasons.slice(0, 1)],
        ),
      });
    }
    // Tek duraklı yedek: gezi yeri başka bir öneride kullanılırsa bu seçilir
    const v = tea.v;
    out.push({
      prio: PRIO.yakinda - 8 - 2 * rank + clampScore(tea.score),
      s: make(
        "yakinda",
        `Hemen yakında: ${kindWord(v.place)} ${nearText(v)}`,
        `${v.place.name} · ${openText(v)}`,
        CATEGORIES[v.place.cat].emoji,
        [stopOf(env, v, stopNote(env, v))],
        [legText(env, v), ...scoreOf(env, v.place).reasons.slice(0, 2)],
      ),
    });
  }
  return out;
}

/** Çay noktasının ~1 km çevresindeki en iyi gezi/manzara; iki sıra da denenir */
function teaPair(env: Env, tea: Visit, maxLeg: number): { a: Visit; b: Visit; score: number } | null {
  const here = env.input.position;
  let pair: { a: Visit; b: Visit; lost: number; score: number } | null = null;
  for (const p of env.pool) {
    if (CATEGORIES[p.cat].group !== "gezi" || p.cat === "plaj" || haversineKm(tea.place.loc, p.loc) > 1) continue;
    if (overBudget(env, p)) continue;
    const sc = scoreOf(env, p);
    const minStay = Math.min(visitOf(p), 30);
    const options: Array<[Visit, Visit] | null> = [];
    const g1 = reach(env, p, here, env.t0, { maxWait: 15, minStay });
    const t1 = g1 ? reach(env, tea.place, p.loc, g1.depart, { maxWait: 15, minStay: 20 }) : null;
    options.push(g1 && t1 && g1.legMin <= maxLeg ? [g1, t1] : null);
    const g2 = reach(env, p, tea.place.loc, tea.depart, { maxWait: 15, minStay });
    options.push(g2 ? [tea, g2] : null);
    for (const o of options) {
      if (!o) continue;
      const [a, b] = o;
      const lost = a.legMin + b.legMin + a.wait + b.wait;
      const gezi = a.place.id === p.id ? a : b;
      const score = sc.u + (isViewSpot(p) ? 0.6 : 0) - 0.04 * lost - 2 * rainHit(env, p, gezi.start, gezi.depart) - budgetPenalty(env, p);
      if (!pair || score > pair.score + 1e-9 || (Math.abs(score - pair.score) <= 1e-9 && lost < pair.lost)) pair = { a, b, lost, score };
    }
  }
  return pair;
}

/** Çözücüyle kısa pencerede 2–3 duraklı akış */
function miniRouteCands(env: Env): Cand[] {
  if (env.tEnd - env.t0 < 75) return [];
  const { input } = env;
  const from: NamedPoint = { name: "Konumun", loc: input.position };
  const hotelNear =
    !!input.hotel && (haversineKm(input.position, input.hotel.loc) <= 5 || (input.endMin !== undefined && env.tEnd >= input.endMin - 5));
  const to = hotelNear && input.hotel ? input.hotel : from;
  let stops: PlanStop[];
  try {
    stops = planDay({ ...env.day, from, to, startMin: env.t0, endMin: env.tEnd }, env.ctx).stops;
  } catch {
    return [];
  }
  const live = stops.filter((s) => s.slot !== "konaklama" && s.arriveMin < env.tEnd).slice(0, 3);
  if (live.length < 2) return [];
  const out: NowStop[] = [];
  const reasons: string[] = [];
  let util = 0;
  for (const s of live) {
    const p = env.ctx.index.get(s.placeId);
    if (!p) return [];
    const walk = env.mode === "yuruyus" || s.travelKm < WALK_KM;
    const extra = s.slot === "gezi" ? CATEGORIES[p.cat].label : SLOT_LABELS[s.slot];
    out.push({
      placeId: p.id,
      name: p.name,
      emoji: CATEGORIES[p.cat].emoji,
      cat: p.cat,
      loc: p.loc,
      arriveMin: s.arriveMin,
      departMin: s.departMin,
      ...(walk ? { walkMin: s.travelMin } : { driveMin: s.travelMin }),
      travelKm: s.travelKm,
      costTry: s.estCost,
      note: [extra, `~${s.departMin - s.arriveMin} dk`, ...(unverified(p) ? ["saatleri doğrulanmadı"] : [])].join(" · "),
    });
    const r = s.reasons.find((x) => !/yürüme$/.test(x));
    if (r) reasons.push(r);
    util += scoreOf(env, p).u;
  }
  const hours = Math.max(1, Math.round((env.tEnd - env.t0) / 60));
  return [
    {
      prio: PRIO.mini_rota + clampScore(util / out.length),
      s: make(
        "mini_rota",
        `Akışına bırak: ${out.length} duraklı mini rota`,
        truncate(out.map((s) => s.name).join(" → "), 90),
        "🧭",
        out,
        [`Sonraki ${hours} saat için sıralı plan`, ...reasons],
      ),
    },
  ];
}

function geziCands(env: Env): Cand[] {
  const list: Array<{ v: Visit; score: number }> = [];
  for (const p of env.pool) {
    if (CATEGORIES[p.cat].group !== "gezi" || overBudget(env, p)) continue;
    if (p.notability < 0.5 && !p.tags.includes("unesco")) continue;
    const v = reach(env, p, env.input.position, env.t0, { maxWait: 20, minStay: Math.min(visitOf(p), 45) });
    if (!v) continue;
    const r = rainHit(env, p, v.start, v.depart);
    if (r > 0.5) continue;
    const sc = scoreOf(env, p);
    list.push({ v, score: sc.u - 0.02 * v.legMin - 2 * r - budgetPenalty(env, p) - (unverified(p) ? 0.1 : 0) });
  }
  return top(list, 2, (x) => x.v.place.id).map(({ v, score }) => {
    const p = v.place;
    const sc = scoreOf(env, p);
    return {
      prio: PRIO.gezi + clampScore(score),
      s: make(
        "gezi",
        `Kaçırma: ${p.name}`,
        `${sc.reasons[0] ?? CATEGORIES[p.cat].label} · ${legText(env, v)}`,
        CATEGORIES[p.cat].emoji,
        [stopOf(env, v, stopNote(env, v, openText(v)))],
        [...sc.reasons.slice(0, 3), legText(env, v)],
      ),
    };
  });
}

function shoppingCands(env: Env): Cand[] {
  if (!env.input.interests.includes("alisveris")) return [];
  const list: Array<{ v: Visit; score: number }> = [];
  for (const p of env.pool) {
    if (CATEGORIES[p.cat].group !== "alisveris" || overBudget(env, p)) continue;
    const v = reach(env, p, env.input.position, env.t0, { maxWait: 15, minStay: Math.min(visitOf(p), 25) });
    if (!v) continue;
    const sc = scoreOf(env, p);
    list.push({ v, score: sc.u - 0.03 * v.legMin - 1.5 * rainHit(env, p, v.start, v.depart) });
  }
  return top(list, 1, (x) => x.v.place.id).map(({ v, score }) => ({
    prio: PRIO.alisveris + clampScore(score),
    s: make(
      "alisveris",
      `Alışveriş molası: ${v.place.name}`,
      `${CATEGORIES[v.place.cat].label} · ${openText(v)} · ${legText(env, v)}`,
      CATEGORIES[v.place.cat].emoji,
      [stopOf(env, v, stopNote(env, v))],
      [...scoreOf(env, v.place).reasons.slice(0, 2), legText(env, v)],
    ),
  }));
}

/** Başlığı ilk duraktan gelen türler: sonraki duraklar başka öneriyle çakışırsa kesilebilir */
const TRIMMABLE: ReadonlySet<NowKind> = new Set<NowKind>(["yemek", "yagmur", "gun_batimi", "kapanmadan", "gezi", "alisveris"]);

/** Önce her türden bir tane, hiçbir yer iki öneride tekrar etmeden; eksik kalırsa ikinci tur */
function pick(cands: Cand[], n: number): NowSuggestion[] {
  const sorted = [...cands].sort((a, b) => b.prio - a.prio || (a.s.id < b.s.id ? -1 : a.s.id > b.s.id ? 1 : 0));
  const out: NowSuggestion[] = [];
  const kinds = new Set<NowKind>();
  const used = new Set<string>();
  const taken = new Set<NowSuggestion>();
  for (const pass of [0, 1]) {
    for (const c of sorted) {
      if (out.length >= n) break;
      if (taken.has(c.s) || (pass === 0 && kinds.has(c.s.kind))) continue;
      let s = c.s;
      const clash = s.stops.findIndex((x) => used.has(x.placeId));
      if (clash === 0 || (clash > 0 && !TRIMMABLE.has(s.kind))) continue;
      if (clash > 0) {
        const stops = s.stops.slice(0, clash);
        s = { ...s, id: `${s.kind}:${stops.map((x) => x.placeId).join("+")}`, stops, totalCostTry: stops.reduce((a, x) => a + x.costTry, 0) };
      }
      taken.add(c.s);
      out.push(s);
      kinds.add(s.kind);
      for (const x of s.stops) used.add(x.placeId);
    }
  }
  return out;
}

// ---------------------------------------------------------------- dış API

/**
 * "Şimdi ne yapsam?" — en fazla 3, birbirinden farklı öneri. Öğün vaktinde yemek önerisi başta;
 * yağmurda kapalı alanlar, kapanmak üzere olan yerler ve gün batımı zamana duyarlı olarak öne çıkar.
 * Uygun hiçbir yer yoksa boş liste.
 */
export function suggestNow(input: NowInput, ctx: PlanContext): NowSuggestion[] {
  const env = makeEnv(input, ctx);
  if (env.tEnd - env.t0 < 20) return [];
  const cands: Cand[] = [];
  const generators = [mealCands, rainCands, closingCands, sunsetCands, nearbyCands, miniRouteCands, geziCands, shoppingCands];
  for (const gen of generators) {
    try {
      cands.push(...gen(env));
    } catch {
      // Bir öneri türü hata verirse diğerleri yine gösterilir.
    }
  }
  return pick(cands, 3);
}

/**
 * Gezi planından NowInput üretir: tarih/saat Türkiye duvar saatinden, gece üssü günün varış
 * noktasından, kalan bütçe BudgetStatus'tan. Yapılmış/atlanmış/kapalı duraklar ve başka günlere
 * planlı yerler önerilmez.
 */
export function nowInputFromTrip(
  plan: TripPlan,
  dayIndex: number,
  position: LatLng,
  now: Date,
  extra: { weather?: WeatherDay | null; budget?: BudgetStatus | null; horizonMin?: number } = {},
): NowInput {
  const wall = toTrWallClock(now);
  const req = plan.request;
  const day = plan.days.find((d) => d.index === dayIndex) ?? plan.days[dayIndex];
  const exclude = new Set<string>();
  for (const d of plan.days) {
    if (d.hotelPlaceId) exclude.add(d.hotelPlaceId);
    for (const s of d.stops) {
      if (s.slot === "konaklama") continue;
      if (d !== day || s.status === "done" || s.status === "skipped" || s.status === "closed") exclude.add(s.placeId);
    }
  }
  return {
    position,
    date: wall.date,
    nowMin: wall.min,
    ...(day ? { hotel: day.to } : {}),
    endMin: parseHHmm(req.dayEnd),
    interests: req.interests,
    travelers: req.travelers,
    visitor: req.visitor,
    ...(req.hasMuzekart !== undefined ? { hasMuzekart: req.hasMuzekart } : {}),
    diet: req.diet,
    ...(extra.budget ? { remainingBudgetTry: Math.max(0, extra.budget.todayLeftTry) } : {}),
    ...(extra.weather !== undefined ? { weather: extra.weather } : {}),
    excludePlaceIds: exclude,
    ...(extra.horizonMin !== undefined ? { horizonMin: extra.horizonMin } : {}),
  };
}
