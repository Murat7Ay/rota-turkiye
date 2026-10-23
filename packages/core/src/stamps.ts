// Türkiye Pasaportu: bütün gezilerin "yapıldı" işaretli duraklarından damga ve il ilerlemesi.
// Deterministik; bir damganın kazanıldığı an, eşiği aşan durağın plan saatidir (Türkiye saati).
import type { PlaceIndex } from "./geo";
import { lineLengthKm } from "./geo";
import { DEFAULT_FX, toTry } from "./pricing";
import { provinceOf, type Province } from "./provinces";
import { isViewSpot, sunTimes } from "./sun";
import { fromTrWallClock, parseHHmm, toTrWallClock } from "./time";
import type { Expense, FxRates, Place, PlaceCategory, PlanStop, TripPlan } from "./types";

export type StampTier = "bronz" | "gumus" | "altin";
export const STAMP_TIERS: readonly StampTier[] = ["bronz", "gumus", "altin"];
export const TIER_LABELS: Record<StampTier, string> = { bronz: "Bronz", gumus: "Gümüş", altin: "Altın" };

export interface TripRecord {
  plan: TripPlan;
  /** Bu gezinin harcamaları (tripId süzgeci çağırana aittir) */
  expenses: Expense[];
}

export interface StampDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Sayaç birimi, "5 çay molası" gibi */
  unit: string;
  /** Bronz, gümüş, altın eşikleri (artan) */
  thresholds: readonly [number, number, number];
}

export interface StampProgress {
  def: StampDef;
  count: number;
  /** Ulaşılan en yüksek kademe; hiç yoksa null (kilitli) */
  tier: StampTier | null;
  /** Kademelerin kazanıldığı an (ISO), sırayla bronz/gümüş/altın */
  tierEarnedAt: [string | null, string | null, string | null];
  /** Mevcut kademenin kazanıldığı an */
  earnedAt: string | null;
  /** Sonraki kademe; altındaysa null */
  next: { tier: StampTier; target: number; remaining: number } | null;
  /** Sonraki kademeye ilerleme 0..1 (count / hedef); altında 1 */
  progress: number;
}

export interface StampAward {
  def: StampDef;
  tier: StampTier;
  at: string;
}

// ---------------------------------------------------------------- ziyaretler

/** "done": yalnız yapıldı işaretliler; "plan": atlanmayan/kapalı olmayan bütün duraklar */
export type VisitBasis = "done" | "plan";

export interface Visit {
  tripId: string;
  dayIndex: number;
  date: string;
  stop: PlanStop;
  place: Place | undefined;
  /** Varış anı, epoch ms */
  at: number;
}

const counts = (s: PlanStop, basis: VisitBasis) =>
  basis === "done" ? s.status === "done" : s.status === "done" || s.status === "planned";

export function tripVisits(plan: TripPlan, index: PlaceIndex, basis: VisitBasis = "done"): Visit[] {
  const out: Visit[] = [];
  for (const day of plan.days) {
    for (const stop of day.stops) {
      if (!counts(stop, basis)) continue;
      out.push({
        tripId: plan.id,
        dayIndex: day.index,
        date: day.date,
        stop,
        place: index.get(stop.placeId),
        at: fromTrWallClock(day.date, stop.arriveMin).getTime(),
      });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Gezide gidilen yol, km. Sayılan her gün için max(durakların yol km'si, rota çizgisi):
 * yol günlerinde durak bacakları rotayı zaten izlediği için ikisi toplanmaz.
 * "done" tabanında yalnız en az bir durağı yapılmış günler sayılır.
 */
export function tripDistanceKm(plan: TripPlan, basis: VisitBasis = "done"): number {
  let total = 0;
  for (const day of plan.days) {
    if (basis === "done" && !day.stops.some((s) => s.status === "done")) continue;
    const legs = day.stops.reduce((a, s) => a + (s.status === "skipped" || s.status === "closed" ? 0 : s.travelKm), 0);
    const route = day.route && day.route.length >= 2 ? lineLengthKm(day.route) : 0;
    total += Math.max(legs, route);
  }
  return Math.round(total);
}

/** Gezi bitti mi: son gün geçti ya da bütün duraklar sonuçlandı (en az biri yapıldı) */
export function isTripFinished(plan: TripPlan, now: Date = new Date()): boolean {
  const last = plan.days[plan.days.length - 1];
  if (!last) return false;
  if (last.date < toTrWallClock(now).date) return true;
  const stops = plan.days.flatMap((d) => d.stops).filter((s) => s.slot !== "konaklama");
  return stops.length > 0 && stops.every((s) => s.status !== "planned") && stops.some((s) => s.status === "done");
}

/** Gezinin bittiği an (son günün bitiş saati), epoch ms */
export function tripEndAt(plan: TripPlan): number {
  const last = plan.days[plan.days.length - 1];
  return last ? fromTrWallClock(last.date, last.endMin).getTime() : Date.parse(plan.createdAt);
}

// ---------------------------------------------------------------- iller

export interface ProvinceVisit {
  province: Province;
  /** İlk ziyaret (ISO) */
  firstAt: string;
  visits: number;
}

function visitProvince(v: Visit): Province | null {
  return v.place ? provinceOf(v.place.loc, v.place.city) : null;
}

/** Ziyaret edilen iller, ilk ziyaret sırasıyla */
export function provinceVisits(trips: readonly TripRecord[], index: PlaceIndex, basis: VisitBasis = "done"): ProvinceVisit[] {
  const map = new Map<number, { province: Province; first: number; visits: number }>();
  for (const t of uniqueTrips(trips)) {
    for (const v of tripVisits(t.plan, index, basis)) {
      const p = visitProvince(v);
      if (!p) continue;
      const cur = map.get(p.plate);
      if (cur) {
        cur.visits++;
        cur.first = Math.min(cur.first, v.at);
      } else map.set(p.plate, { province: p, first: v.at, visits: 1 });
    }
  }
  return [...map.values()]
    .sort((a, b) => a.first - b.first || a.province.plate - b.province.plate)
    .map((x) => ({ province: x.province, firstAt: new Date(x.first).toISOString(), visits: x.visits }));
}

/** Ziyaret edilen il adları (ilk ziyaret sırasıyla) */
export function visitedProvinces(trips: readonly TripRecord[], index: PlaceIndex, basis: VisitBasis = "done"): string[] {
  return provinceVisits(trips, index, basis).map((v) => v.province.name);
}

// ---------------------------------------------------------------- damga kuralları

interface TripFacts {
  plan: TripPlan;
  expenses: Expense[];
  visits: Visit[];
  finished: boolean;
  km: number;
  endAt: number;
  budgetTry: number;
}

interface StampEvent {
  at: number;
  /** Verilirse aynı anahtar bir kez sayılır (farklı mekân) */
  key?: string;
}

interface StampRule extends StampDef {
  events(trips: readonly TripFacts[]): StampEvent[];
}

const isCat = (v: Visit, cats: readonly PlaceCategory[]) => !!v.place && cats.includes(v.place.cat);

function byCategory(cats: readonly PlaceCategory[], distinct: boolean) {
  return (trips: readonly TripFacts[]): StampEvent[] =>
    trips.flatMap((t) =>
      t.visits.filter((v) => isCat(v, cats)).map((v) => (distinct ? { at: v.at, key: v.stop.placeId } : { at: v.at })),
    );
}

/** Manzara durağı gün batımından önceki son saatte mi; güneş hesabı yapılamazsa 17:00–21:00 */
function atSunset(v: Visit): boolean {
  const p = v.place;
  if (!p || !isViewSpot(p)) return false;
  let sunset: number | null = null;
  try {
    sunset = sunTimes(p.loc, v.date).sunsetMin;
  } catch {
    sunset = null;
  }
  const a = v.stop.arriveMin;
  const d = Math.max(a, v.stop.departMin);
  if (sunset === null || !Number.isFinite(sunset)) return a >= parseHHmm("17:00") && a <= parseHHmm("21:00");
  return a <= sunset + 10 && d >= sunset - 60;
}

const RULES: readonly StampRule[] = [
  {
    id: "cay-ustasi",
    name: "Çay Ustası",
    emoji: "🫖",
    description: "Çay bahçesi ve kahvehanede demli molalar.",
    unit: "çay molası",
    thresholds: [5, 10, 25],
    events: byCategory(["cay_bahcesi", "kahvehane"], false),
  },
  {
    id: "antik-kent-avcisi",
    name: "Antik Kent Avcısı",
    emoji: "🏛️",
    description: "Ören yerlerinde taş taş üstünde tarih.",
    unit: "antik kent",
    thresholds: [1, 5, 12],
    events: byCategory(["antik_kent"], true),
  },
  {
    id: "esnaf-muduvimi",
    name: "Esnaf Lokantası Müdavimi",
    emoji: "🍲",
    description: "Tencere yemeği, ev usulü, esnaf hesabı.",
    unit: "esnaf lokantası",
    thresholds: [3, 8, 20],
    events: byCategory(["esnaf_lokantasi"], false),
  },
  {
    id: "unesco-koleksiyoncusu",
    name: "UNESCO Koleksiyoncusu",
    emoji: "🌍",
    description: "UNESCO Dünya Mirası etiketli yerler.",
    unit: "UNESCO yeri",
    thresholds: [1, 3, 6],
    events: (trips) =>
      trips.flatMap((t) => t.visits.filter((v) => v.place?.tags.includes("unesco")).map((v) => ({ at: v.at, key: v.stop.placeId }))),
  },
  {
    id: "tatli-krizi",
    name: "Tatlı Krizi",
    emoji: "🍯",
    description: "Şerbetli mi sütlü mü, fark etmez: tatlıcı molaları.",
    unit: "tatlıcı molası",
    thresholds: [3, 8, 20],
    events: byCategory(["tatlici"], false),
  },
  {
    id: "pazar-kurdu",
    name: "Pazar Kurdu",
    emoji: "🧺",
    description: "Semt pazarlarında tezgâh tezgâh gezinti.",
    unit: "pazar",
    thresholds: [1, 3, 8],
    events: byCategory(["pazar"], false),
  },
  {
    id: "erken-kus",
    name: "Erken Kuş",
    emoji: "🌅",
    description: "Saat 08:00'den önce varılan duraklar.",
    unit: "erken durak",
    thresholds: [1, 5, 15],
    events: (trips) =>
      trips.flatMap((t) => t.visits.filter((v) => v.stop.slot !== "konaklama" && v.stop.arriveMin < 8 * 60).map((v) => ({ at: v.at }))),
  },
  {
    id: "gun-batimi-avcisi",
    name: "Gün Batımı Avcısı",
    emoji: "🌇",
    description: "Gün batımından önceki son saatte bir manzara noktasında.",
    unit: "gün batımı",
    thresholds: [1, 3, 8],
    events: (trips) => trips.flatMap((t) => t.visits.filter(atSunset).map((v) => ({ at: v.at }))),
  },
  {
    id: "yol-ustu-kasifi",
    name: "Yol Üstü Kâşifi",
    emoji: "🧭",
    description: "Rotanın kıyısında keşfedilen sürpriz duraklar.",
    unit: "keşif",
    thresholds: [1, 5, 12],
    events: (trips) => trips.flatMap((t) => t.visits.filter((v) => v.stop.discovered).map((v) => ({ at: v.at }))),
  },
  {
    id: "yerli-gibi",
    name: "Yerli Gibi",
    emoji: "🧿",
    description: "Yerel etiketli, mahallelinin gittiği adresler.",
    unit: "yerel mekân",
    thresholds: [3, 10, 25],
    events: (trips) =>
      trips.flatMap((t) => t.visits.filter((v) => v.place?.tags.includes("yerel")).map((v) => ({ at: v.at, key: v.stop.placeId }))),
  },
  {
    id: "butce-ustasi",
    name: "Bütçe Ustası",
    emoji: "💰",
    description: "Harcamalarını kaydedip geziyi bütçe içinde bitir.",
    unit: "gezi",
    thresholds: [1, 3, 5],
    events: (trips) =>
      trips
        .filter((t) => {
          if (!t.finished || t.expenses.length === 0 || t.visits.length === 0) return false;
          const spent = t.expenses.reduce((a, e) => a + e.amountTry, 0);
          return spent <= t.budgetTry;
        })
        .map((t) => ({ at: t.endAt })),
  },
  {
    id: "kervan",
    name: "Kervan",
    emoji: "🐪",
    description: "Tek gezide 500 km ve üstü yol.",
    unit: "uzun yol gezisi",
    thresholds: [1, 3, 6],
    events: (trips) => trips.filter((t) => t.km >= 500).map((t) => ({ at: t.endAt })),
  },
  {
    id: "muze-kurdu",
    name: "Müze Kurdu",
    emoji: "🏺",
    description: "Vitrin vitrin, salon salon müzeler.",
    unit: "müze",
    thresholds: [2, 6, 15],
    events: byCategory(["muze"], true),
  },
  {
    id: "kubbe-alti",
    name: "Kubbe Altı",
    emoji: "🕌",
    description: "Camilerin serin avlularında bir soluk.",
    unit: "cami",
    thresholds: [2, 6, 15],
    events: byCategory(["cami"], true),
  },
  {
    id: "kahvalti-sefasi",
    name: "Kahvaltı Sefası",
    emoji: "🍳",
    description: "Güne kahvaltı salonunda, keyifle başlamak.",
    unit: "kahvaltı",
    thresholds: [3, 10, 25],
    events: byCategory(["kahvalti"], false),
  },
  {
    id: "ocakbasi-muduvimi",
    name: "Ocakbaşı Müdavimi",
    emoji: "🥙",
    description: "Kebapçıda, pidecide köz başında.",
    unit: "kebap/pide",
    thresholds: [2, 6, 15],
    events: byCategory(["kebapci", "pideci"], false),
  },
  {
    id: "deniz-tutkunu",
    name: "Deniz Tutkunu",
    emoji: "🏖️",
    description: "Havlunun serildiği plaj günleri.",
    unit: "plaj",
    thresholds: [1, 4, 10],
    events: byCategory(["plaj"], false),
  },
  {
    id: "doga-yuruyuscusu",
    name: "Doğa Yürüyüşçüsü",
    emoji: "🌿",
    description: "Kanyon, şelale, yayla: doğal alanlar.",
    unit: "doğal alan",
    thresholds: [1, 4, 10],
    events: byCategory(["dogal_alan"], true),
  },
  {
    id: "carsi-gezgini",
    name: "Çarşı Gezgini",
    emoji: "🛍️",
    description: "Tarihi çarşı ve bedestenlerde dolaşmak.",
    unit: "çarşı",
    thresholds: [1, 4, 10],
    events: byCategory(["carsi"], true),
  },
  {
    id: "il-avcisi",
    name: "İl Avcısı",
    emoji: "🗺️",
    description: "Pasaportuna yeni iller ekle.",
    unit: "il",
    thresholds: [3, 10, 25],
    events: (trips) =>
      trips.flatMap((t) =>
        t.visits.flatMap((v) => {
          const p = visitProvince(v);
          return p ? [{ at: v.at, key: `il:${p.plate}` }] : [];
        }),
      ),
  },
];

/** Bütün damga tanımları (görüntüleme sırası) */
export const STAMPS: readonly StampDef[] = RULES.map(({ events: _events, ...def }) => def);

// ---------------------------------------------------------------- hesap

/** Aynı plan kimliği birden çok kez gelirse sonuncusu kullanılır */
function uniqueTrips(trips: readonly TripRecord[]): TripRecord[] {
  const m = new Map<string, TripRecord>();
  for (const t of trips) m.set(t.plan.id, t);
  return [...m.values()];
}

function facts(t: TripRecord, index: PlaceIndex, now: Date, fx: FxRates): TripFacts {
  return {
    plan: t.plan,
    expenses: t.expenses,
    visits: tripVisits(t.plan, index, "done"),
    finished: isTripFinished(t.plan, now),
    km: tripDistanceKm(t.plan, "done"),
    endAt: tripEndAt(t.plan),
    budgetTry: toTry(t.plan.request.budget, fx),
  };
}

function progressOf(def: StampDef, events: StampEvent[]): StampProgress {
  const seen = new Set<string>();
  const times: number[] = [];
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    if (e.key !== undefined) {
      if (seen.has(e.key)) continue;
      seen.add(e.key);
    }
    times.push(e.at);
  }
  const count = times.length;
  const tierEarnedAt = def.thresholds.map((th) => {
    const t = times[th - 1];
    return t !== undefined ? new Date(t).toISOString() : null;
  }) as StampProgress["tierEarnedAt"];
  let k = -1;
  for (let i = 0; i < 3; i++) if (count >= def.thresholds[i]!) k = i;
  const nextIdx = k + 1;
  const next =
    nextIdx < 3
      ? { tier: STAMP_TIERS[nextIdx]!, target: def.thresholds[nextIdx]!, remaining: def.thresholds[nextIdx]! - count }
      : null;
  return {
    def,
    count,
    tier: k >= 0 ? STAMP_TIERS[k]! : null,
    tierEarnedAt,
    earnedAt: k >= 0 ? tierEarnedAt[k] ?? null : null,
    next,
    progress: next ? Math.min(1, count / next.target) : 1,
  };
}

/**
 * Bütün damgaların durumu (kazanılmış ve kilitli), tanım sırasıyla. Yalnız "yapıldı"
 * işaretli duraklar sayılır; aynı plan kimliği bir kez sayılır.
 */
export function computeStamps(
  trips: readonly TripRecord[],
  index: PlaceIndex,
  opts: { now?: Date; fx?: FxRates } = {},
): StampProgress[] {
  const now = opts.now ?? new Date();
  const fx = opts.fx ?? DEFAULT_FX;
  const all = uniqueTrips(trips).map((t) => facts(t, index, now, fx));
  return RULES.map((rule, i) => progressOf(STAMPS[i]!, rule.events(all)));
}

/** Kazanılan bütün kademeler, zaman sırasıyla */
export function stampAwards(progress: readonly StampProgress[]): StampAward[] {
  const out: StampAward[] = [];
  for (const p of progress) {
    p.tierEarnedAt.forEach((at, i) => {
      if (at) out.push({ def: p.def, tier: STAMP_TIERS[i]!, at });
    });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export function earnedStamps(progress: readonly StampProgress[]): StampProgress[] {
  return progress.filter((p) => p.tier !== null);
}
