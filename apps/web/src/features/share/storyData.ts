// Hikâye kartı verisi: plan/gezi → çizime hazır, sade bir yapı.
import { CATEGORIES, formatHHmm, lineLengthKm } from "@rota/core";
import type { DayPlan, Expense, LatLng, LonLat, PlaceIndex, PlanStop, TripPlan } from "@rota/core";
import { fmtDateLong, fmtDateShort, fmtNumber, fmtTry } from "../../lib/format";
import { tripWrapped, type TripWrapped } from "../../../../../packages/core/src/wrapped";
import type { TripRecord } from "../../../../../packages/core/src/stamps";

export interface StoryPoint {
  loc: LatLng;
  emoji?: string;
  /** Numaralı durak; yoksa küçük nokta */
  n?: number;
  /** Başlangıç/bitiş işareti */
  kind?: "start" | "end";
}

export interface StoryStat {
  value: string;
  label: string;
}

export interface StoryStopRow {
  time: string;
  emoji: string;
  name: string;
  done: boolean;
}

export interface DayStoryData {
  kicker: string;
  title: string;
  subtitle: string;
  badge: string;
  lines: LonLat[][];
  points: StoryPoint[];
  stats: StoryStat[];
  stops: StoryStopRow[];
}

export interface WrappedStoryData {
  kicker: string;
  title: string;
  subtitle: string;
  badge: string;
  lines: LonLat[][];
  points: StoryPoint[];
  stats: StoryStat[];
  headlines: string[];
  /** Kazanılan damgaların emojileri (en çok 7) */
  stampEmojis: string[];
  /** "12.400 ₺ harcandı · bütçe 30.000 ₺" */
  moneyLine: string;
}

const ll = (p: LatLng): LonLat => [p.lon, p.lat];

const visible = (s: PlanStop) => s.status !== "skipped" && s.status !== "closed";

function fmtKmShort(km: number): string {
  if (km < 10) return (Math.round(km * 10) / 10).toString().replace(".", ",");
  return fmtNumber(km);
}

function dayKm(day: DayPlan): number {
  const legs = day.stops.filter(visible).reduce((a, s) => a + s.travelKm, 0);
  const route = day.route && day.route.length >= 2 ? lineLengthKm(day.route) : 0;
  return Math.max(legs, route);
}

/** Günün çizgisi: rota varsa o, yoksa başlangıç → duraklar → bitiş */
function dayLine(day: DayPlan, index: PlaceIndex, stops: PlanStop[]): LonLat[] {
  if (day.route && day.route.length >= 2) return day.route;
  const pts: LonLat[] = [ll(day.from.loc)];
  for (const s of stops) {
    const p = index.get(s.placeId);
    if (p) pts.push(ll(p.loc));
  }
  pts.push(ll(day.to.loc));
  return pts;
}

export function dayStoryData(plan: TripPlan, dayIndex: number, index: PlaceIndex): DayStoryData {
  const pos = plan.days.findIndex((d) => d.index === dayIndex);
  const day = plan.days[pos >= 0 ? pos : 0];
  if (!day) throw new Error("Bu gün planda yok.");
  const n = pos >= 0 ? pos + 1 : 1;
  const stops = day.stops.filter((s) => visible(s) && s.slot !== "konaklama").sort((a, b) => a.arriveMin - b.arriveMin);

  const points: StoryPoint[] = [{ loc: day.from.loc, kind: "start" }];
  const rows: StoryStopRow[] = [];
  stops.forEach((s, i) => {
    const p = index.get(s.placeId);
    const emoji = p ? CATEGORIES[p.cat].emoji : "📍";
    if (p) points.push({ loc: p.loc, emoji, n: i + 1 });
    rows.push({ time: formatHHmm(s.arriveMin), emoji, name: p?.name ?? "Durak", done: s.status === "done" });
  });
  points.push({ loc: day.to.loc, kind: "end", emoji: day.hotelPlaceId ? "🏨" : "🏁" });

  const cay = stops.filter((s) => {
    const c = index.get(s.placeId)?.cat;
    return c === "cay_bahcesi" || c === "kahvehane";
  }).length;
  const first = stops[0];
  const last = stops[stops.length - 1];
  const spanH = first && last ? Math.max(0, last.departMin - first.arriveMin) / 60 : 0;

  const stats: StoryStat[] = [
    { value: fmtNumber(stops.length), label: "durak" },
    { value: fmtKmShort(dayKm(day)), label: "km" },
    cay > 0
      ? { value: fmtNumber(cay), label: "çay molası" }
      : { value: `${fmtNumber(Math.round(spanH))} sa`, label: "keşif" },
  ];

  return {
    kicker: plan.request.title,
    title: day.isTravelDay ? `${day.from.name} → ${day.to.name}` : day.to.name,
    subtitle: fmtDateLong(day.date),
    badge: `${n}. GÜN`,
    lines: [dayLine(day, index, stops)],
    points,
    stats,
    stops: rows,
  };
}

export function wrappedStoryData(
  plan: TripPlan,
  expenses: Expense[],
  index: PlaceIndex,
  opts: { wrapped?: TripWrapped; allTrips?: readonly TripRecord[] } = {},
): WrappedStoryData {
  const w = opts.wrapped ?? tripWrapped(plan, expenses, index, { allTrips: opts.allTrips });
  const counted = (s: PlanStop) => (w.basis === "done" ? s.status === "done" : visible(s)) && s.slot !== "konaklama";

  const lines: LonLat[][] = [];
  const points: StoryPoint[] = [];
  for (const day of plan.days) {
    const stops = day.stops.filter(visible).filter((s) => s.slot !== "konaklama").sort((a, b) => a.arriveMin - b.arriveMin);
    lines.push(dayLine(day, index, stops));
    for (const s of stops) {
      if (!counted(s)) continue;
      const p = index.get(s.placeId);
      if (p) points.push({ loc: p.loc, emoji: CATEGORIES[p.cat].emoji });
    }
  }
  const firstDay = plan.days[0];
  const lastDay = plan.days[plan.days.length - 1];
  if (firstDay) points.unshift({ loc: firstDay.from.loc, kind: "start" });
  if (lastDay) points.push({ loc: lastDay.to.loc, kind: "end", emoji: "🏁" });

  const year = w.endDate.slice(0, 4);
  const moneyLine = w.hasExpenses
    ? `${fmtTry(w.spentTry)} harcandı · bütçe ${fmtTry(w.budgetTry)}`
    : `Planlanan ${fmtTry(w.plannedTry)} · bütçe ${fmtTry(w.budgetTry)}`;

  return {
    kicker: w.basis === "plan" ? "Plan özeti" : "Gezi özeti",
    title: w.title,
    subtitle: `${fmtDateShort(w.startDate)} – ${fmtDateShort(w.endDate)} ${year}`,
    badge: "GEZİ WRAPPED",
    lines,
    points,
    stats: [
      { value: fmtNumber(w.days), label: "gün" },
      { value: fmtKmShort(w.totalKm), label: "km" },
      { value: fmtNumber(w.stopsDone), label: "durak" },
      { value: fmtNumber(w.cayCount), label: "bardak çay" },
      { value: fmtNumber(w.antikKentCount), label: "antik kent" },
      { value: fmtNumber(w.provinces.length), label: "il" },
    ],
    headlines: [...w.headlines],
    stampEmojis: [...new Set(w.stampsEarned.map((a) => a.def.emoji))].slice(0, 7),
    moneyLine,
  };
}
