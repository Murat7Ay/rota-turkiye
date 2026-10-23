// Gezi Wrapped: gezi sonu hikâyesi için özet istatistikler ve üç eğlenceli manşet.
// Hiç durak "yapıldı" işaretlenmemişse plan üzerinden özet çıkarılır (basis: "plan").
import { CATEGORIES } from "./catalog";
import type { PlaceIndex } from "./geo";
import { DEFAULT_FX, toTry } from "./pricing";
import { provinceOf, type GeoRegion } from "./provinces";
import {
  computeStamps,
  stampAwards,
  tripDistanceKm,
  tripEndAt,
  tripVisits,
  type StampAward,
  type TripRecord,
  type VisitBasis,
} from "./stamps";
import { fromTrWallClock, toTrWallClock } from "./time";
import { fmtInt, trLower } from "./trtext";
import type { Expense, FxRates, PlaceCategory, TripPlan } from "./types";

export interface TripWrapped {
  tripId: string;
  title: string;
  startDate: string;
  endDate: string;
  basis: VisitBasis;
  days: number;
  totalKm: number;
  /** Sayılan duraklar (konaklama hariç) */
  stopsDone: number;
  /** Plandaki bütün duraklar (konaklama hariç) */
  stopsTotal: number;
  cayCount: number;
  antikKentCount: number;
  topCategory: { cat: PlaceCategory; label: string; emoji: string; count: number } | null;
  /** Harcama varsa gerçek harcamaya, yoksa plana göre */
  mostExpensiveDay: { dayIndex: number; date: string; amountTry: number; source: "harcama" | "plan" } | null;
  spentTry: number;
  plannedTry: number;
  budgetTry: number;
  hasExpenses: boolean;
  /** Harcama kaydı yoksa null */
  withinBudget: boolean | null;
  /** En uygun esnaf/kebap durağı */
  cheapestGreatMeal: {
    placeId: string;
    name: string;
    cat: PlaceCategory;
    costTry: number;
    perPersonTry: number;
    dayIndex: number;
    date: string;
    source: "harcama" | "plan";
  } | null;
  discoveredCount: number;
  provinces: string[];
  /** En çok durak yapılan coğrafi bölge */
  region: GeoRegion | null;
  /** Gezi tarihleri içinde kazanılan damga kademeleri */
  stampsEarned: StampAward[];
  headlines: [string, string, string];
}

const CAY_CATS: readonly PlaceCategory[] = ["cay_bahcesi", "kahvehane"];
const MEAL_CATS: readonly PlaceCategory[] = ["esnaf_lokantasi", "kebapci"];

function expenseDayIndex(e: Expense, plan: TripPlan): number | undefined {
  if (e.dayIndex !== undefined && plan.days.some((d) => d.index === e.dayIndex)) return e.dayIndex;
  const date = toTrWallClock(new Date(e.at)).date;
  return plan.days.find((d) => d.date === date)?.index;
}

/** "a", "a ve b", "a, b ve c" */
function joinTr(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} ve ${parts[parts.length - 1]}`;
}

export function tripWrapped(
  plan: TripPlan,
  expenses: Expense[],
  index: PlaceIndex,
  opts: { allTrips?: readonly TripRecord[]; now?: Date; fx?: FxRates } = {},
): TripWrapped {
  const fx = opts.fx ?? DEFAULT_FX;
  const anyDone = plan.days.some((d) => d.stops.some((s) => s.status === "done"));
  const basis: VisitBasis = anyDone ? "done" : "plan";
  const visits = tripVisits(plan, index, basis);
  const real = visits.filter((v) => v.stop.slot !== "konaklama");
  const startDate = plan.days[0]?.date ?? plan.request.startDate;
  const endDate = plan.days[plan.days.length - 1]?.date ?? startDate;

  // ---- sayılar
  const catCount = new Map<PlaceCategory, number>();
  for (const v of real) if (v.place) catCount.set(v.place.cat, (catCount.get(v.place.cat) ?? 0) + 1);
  const cayCount = real.filter((v) => v.place && CAY_CATS.includes(v.place.cat)).length;
  const antikKentCount = new Set(real.filter((v) => v.place?.cat === "antik_kent").map((v) => v.stop.placeId)).size;
  const discoveredCount = real.filter((v) => v.stop.discovered).length;
  let topCategory: TripWrapped["topCategory"] = null;
  for (const [cat, count] of catCount) {
    if (!topCategory || count > topCategory.count) {
      topCategory = { cat, label: CATEGORIES[cat].label, emoji: CATEGORIES[cat].emoji, count };
    }
  }

  // ---- para
  const budgetTry = Math.round(toTry(plan.request.budget, fx));
  const spentTry = Math.round(expenses.reduce((a, e) => a + e.amountTry, 0));
  const hasExpenses = expenses.length > 0;
  let mostExpensiveDay: TripWrapped["mostExpensiveDay"] = null;
  if (hasExpenses) {
    const byDay = new Map<number, number>();
    for (const e of expenses) {
      const di = expenseDayIndex(e, plan);
      if (di !== undefined) byDay.set(di, (byDay.get(di) ?? 0) + e.amountTry);
    }
    for (const [dayIndex, amount] of byDay) {
      if (!mostExpensiveDay || amount > mostExpensiveDay.amountTry) {
        const date = plan.days.find((d) => d.index === dayIndex)?.date ?? startDate;
        mostExpensiveDay = { dayIndex, date, amountTry: Math.round(amount), source: "harcama" };
      }
    }
  }
  if (!mostExpensiveDay) {
    for (const d of plan.days) {
      if (!mostExpensiveDay || d.estCost > mostExpensiveDay.amountTry) {
        mostExpensiveDay = { dayIndex: d.index, date: d.date, amountTry: Math.round(d.estCost), source: "plan" };
      }
    }
  }

  // ---- en uygun lezzet: harcama kaydı varsa o, yoksa planın tahmini
  const travelers = Math.max(1, plan.request.travelers);
  let cheapestGreatMeal: TripWrapped["cheapestGreatMeal"] = null;
  for (const v of real) {
    if (!v.place || !MEAL_CATS.includes(v.place.cat)) continue;
    const paid = expenses
      .filter((e) => e.placeId === v.stop.placeId && (expenseDayIndex(e, plan) ?? v.dayIndex) === v.dayIndex)
      .reduce((a, e) => a + e.amountTry, 0);
    const source = paid > 0 ? "harcama" : "plan";
    const costTry = Math.round(paid > 0 ? paid : v.stop.estCost);
    if (costTry <= 0) continue;
    if (!cheapestGreatMeal || costTry < cheapestGreatMeal.costTry) {
      cheapestGreatMeal = {
        placeId: v.stop.placeId,
        name: v.place.name,
        cat: v.place.cat,
        costTry,
        perPersonTry: Math.round(costTry / travelers),
        dayIndex: v.dayIndex,
        date: v.date,
        source,
      };
    }
  }

  // ---- iller ve bölge
  const provinceFirst = new Map<string, number>();
  const regionCount = new Map<GeoRegion, number>();
  for (const v of visits) {
    if (!v.place) continue;
    const p = provinceOf(v.place.loc, v.place.city);
    if (!provinceFirst.has(p.name)) provinceFirst.set(p.name, v.at);
    regionCount.set(p.region, (regionCount.get(p.region) ?? 0) + 1);
  }
  const provinces = [...provinceFirst.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
  let region: GeoRegion | null = null;
  let regionMax = 0;
  for (const [r, c] of regionCount) {
    if (c > regionMax) {
      region = r;
      regionMax = c;
    }
  }

  // ---- damgalar: gezi tarihleri içinde kazanılan kademeler
  const allTrips = opts.allTrips ?? [{ plan, expenses }];
  const from = fromTrWallClock(startDate, 0).getTime();
  const to = Math.max(tripEndAt(plan), fromTrWallClock(endDate, 1440).getTime());
  const stampsEarned = stampAwards(computeStamps(allTrips, index, { now: opts.now, fx })).filter((a) => {
    const t = Date.parse(a.at);
    return t >= from && t <= to;
  });

  const totalKm = tripDistanceKm(plan, basis);
  const days = plan.days.length;
  const w: Omit<TripWrapped, "headlines"> = {
    tripId: plan.id,
    title: plan.request.title,
    startDate,
    endDate,
    basis,
    days,
    totalKm,
    stopsDone: real.length,
    stopsTotal: plan.days.reduce((a, d) => a + d.stops.filter((s) => s.slot !== "konaklama").length, 0),
    cayCount,
    antikKentCount,
    topCategory,
    mostExpensiveDay,
    spentTry,
    plannedTry: Math.round(plan.estTotal),
    budgetTry,
    hasExpenses,
    withinBudget: hasExpenses ? spentTry <= budgetTry : null,
    cheapestGreatMeal,
    discoveredCount,
    provinces,
    region,
    stampsEarned,
  };
  return { ...w, headlines: headlines(w) };
}

// ---------------------------------------------------------------- manşetler

const REGION_SHORT: Record<GeoRegion, string> = {
  Marmara: "Marmara",
  Ege: "Ege",
  Akdeniz: "Akdeniz",
  "İç Anadolu": "İç Anadolu",
  Karadeniz: "Karadeniz",
  "Doğu Anadolu": "Doğu",
  "Güneydoğu Anadolu": "Güneydoğu",
};

function headlines(w: Omit<TripWrapped, "headlines">): [string, string, string] {
  // 1) Rakamlar
  const parts: string[] = [];
  if (w.cayCount > 0) parts.push(`${w.cayCount} bardak çay`);
  if (w.antikKentCount > 0) parts.push(`${w.antikKentCount} antik kent`);
  if (w.totalKm >= 1) parts.push(`${fmtInt(w.totalKm)} km`);
  if (parts.length < 2 && w.stopsDone > 0) parts.unshift(`${w.stopsDone} durak`);
  const flavor = w.region && w.provinces.length > 0 ? `tam bir ${REGION_SHORT[w.region]} klasiği` : "tam bir yol hikâyesi";
  const stats = parts.length > 0 ? `${w.days} günde ${joinTr(parts)}: ${flavor}.` : null;

  // 2) Para ve lezzet
  const money: Array<string | null> = [];
  if (w.withinBudget === true) {
    const saved = w.budgetTry - w.spentTry;
    money.push(
      saved >= 1
        ? `Bütçenin ${fmtInt(saved)} TL altında kapattın; bir sonraki gezinin çayları senden.`
        : "Bütçeyi kuruşu kuruşuna tutturdun.",
    );
  } else if (w.withinBudget === false) {
    money.push(`Bütçe ${fmtInt(w.spentTry - w.budgetTry)} TL aştı ama anılar kâr hanesinde.`);
  }
  if (w.cheapestGreatMeal) {
    const m = w.cheapestGreatMeal;
    money.push(`Gezinin en tatlı pazarlığı: ${m.name}, kişi başı ${m.source === "plan" ? "~" : ""}${fmtInt(m.perPersonTry)} TL.`);
  }

  // 3) Kimlik: damga, keşif, sevilen tür, iller
  const identity: Array<string | null> = [];
  if (w.stampsEarned.length > 0) {
    const names = [...new Set(w.stampsEarned.map((a) => a.def.name))];
    const shown = names.slice(0, 2).join(", ");
    identity.push(`Pasaportuna ${w.stampsEarned.length} yeni damga: ${shown}${names.length > 2 ? " ve dahası" : ""}.`);
  }
  if (w.discoveredCount > 0) identity.push(`Yol üstünde ${w.discoveredCount} sürpriz durak keşfettin.`);
  if (w.topCategory && w.topCategory.count >= 2) {
    identity.push(`${w.topCategory.emoji} Gezinin yıldızı ${trLower(w.topCategory.label)} oldu: tam ${w.topCategory.count} kez.`);
  }
  if (w.provinces.length >= 2) identity.push(`${w.provinces.length} il, tek pasaport: ${joinTr(w.provinces.slice(0, 3))}${w.provinces.length > 3 ? "…" : ""}.`);

  const fallback = [
    `${w.days} gün, ${w.stopsDone} durak: ${w.title} tamam.`,
    "Bir sonraki rota seni bekliyor.",
    "Rota Türkiye ile bir gezi daha deftere yazıldı.",
  ];
  const first = [stats, money.find(Boolean) ?? null, identity.find(Boolean) ?? null];
  const rest = [...money, ...identity].filter((s): s is string => !!s && !first.includes(s));
  const out: string[] = [];
  for (const s of first) if (s) out.push(s);
  for (const s of [...rest, ...fallback]) {
    if (out.length >= 3) break;
    if (!out.includes(s)) out.push(s);
  }
  return [out[0]!, out[1]!, out[2]!];
}

