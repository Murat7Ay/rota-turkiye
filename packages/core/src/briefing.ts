// Sabah rehberi: günün planını tek bir Türkçe brifinge ve tek bir bildirime çevirir.
// Metin şablondan üretilir; internet ve LLM gerektirmez.
import type { BudgetStatus } from "./budget";
import { CATEGORIES } from "./catalog";
import { lineLengthKm } from "./geo";
import type { PlaceIndex } from "./geo";
import type { Interval } from "./hours";
import { hoursSource } from "./hours";
import { estimatePlaceCost } from "./pricing";
import type { CostContext } from "./pricing";
import { formatHHmm } from "./time";
import { fmtDuration, fmtInt, timeAblative, trLower, truncate } from "./trtext";
import type { WeatherDay } from "./weather";
import type { DayPlan, Place, PlanStop, Slot, TripPlan } from "./types";

export interface BriefingItem {
  stopId: string;
  slot: Slot;
  /** "12:30" */
  time: string;
  /** "Öğle: esnaf lokantası" */
  label: string;
  placeName: string;
  emoji: string;
  /** "Pazartesi kapalı", "Yağmura uygun, kapalı alan" */
  note?: string;
  costTry: number;
  costKind: "observed" | "estimate" | "free";
}

export interface Briefing {
  dayIndex: number;
  date: string;
  /** "Günaydın! 3. gün: Selçuk → Pamukkale, ~190 km" */
  title: string;
  /** Hava, ilk çıkış saati, toplam yol vb. */
  summary: string[];
  items: BriefingItem[];
  warnings: string[];
  budgetLine?: string;
  /** Tek bir B planı cümlesi */
  planB?: string;
  notification: { title: string; body: string };
}

/** Kısa yuva adları (SLOT_LABELS'ın brifing/bildirim için kısaltılmışı) */
const SLOT_SHORT: Record<Slot, string> = {
  kahvalti: "Kahvaltı",
  ogle: "Öğle",
  aksam: "Akşam",
  cay: "Çay",
  tatli: "Tatlı",
  alisveris: "Alışveriş",
  gezi: "Gezi",
  konaklama: "Gece",
};

/** Bildirime girecek yuvalar ve sığmazsa atılma sırası (küçük = önemli) */
const NOTIFY_PRIORITY: Partial<Record<Slot, number>> = { konaklama: 0, ogle: 1, kahvalti: 2, aksam: 3, cay: 4, tatli: 5, gezi: 6 };

/** B planı için yuva önemi (küçük = önemli) */
const PLAN_B_RANK: Record<Slot, number> = { gezi: 0, ogle: 1, aksam: 2, kahvalti: 3, cay: 4, tatli: 5, alisveris: 6, konaklama: 7 };

export const NOTIFICATION_MAX_CHARS = 160;
const HOTEL_ITEM_ID = "hotel";

const isIndoor = (p: Place) => p.indoor ?? CATEGORIES[p.cat].indoor;

function overlaps(windows: readonly Interval[], s: number, e: number): boolean {
  return windows.some(([ws, we]) => s < we && e > ws);
}

/** ≥100 km: en yakın 10'a; altı: tam sayı */
function approxKm(km: number): number {
  return km >= 100 ? Math.round(km / 10) * 10 : Math.round(km);
}

export function buildBriefing(
  plan: TripPlan,
  dayIndex: number,
  ctx: { index: PlaceIndex; weather?: WeatherDay | null; budget?: BudgetStatus | null },
): Briefing {
  const day = plan.days.find((d) => d.index === dayIndex) ?? plan.days[dayIndex];
  if (!day) throw new RangeError(`Planda ${dayIndex}. indeksli gün yok`);
  const n = day.index + 1;
  // Başka güne ait hava durumu kullanılmaz
  const weather = ctx.weather && ctx.weather.date === day.date ? ctx.weather : null;
  const rain = weather?.rainWindows ?? [];
  const req = plan.request;
  const costCtx = { travelers: req.travelers, visitor: req.visitor, hasMuzekart: req.hasMuzekart, date: day.date };

  const stops = day.stops
    .filter((s) => s.status !== "skipped" && s.status !== "closed")
    .sort((a, b) => a.arriveMin - b.arriveMin);
  const placeOf = (s: { placeId: string }) => ctx.index.get(s.placeId);
  const nameOf = (s: { placeId: string }) => placeOf(s)?.name ?? "Bilinmeyen yer";

  // ---- başlık
  const stopKm = stops.reduce((a, s) => a + s.travelKm, 0);
  const km = Math.max(stopKm, day.route && day.route.length > 1 ? lineLengthKm(day.route) : 0);
  const driveMin = stops.reduce((a, s) => a + s.travelMin, 0);
  const travel = day.isTravelDay && day.from.name !== day.to.name;
  const title = travel
    ? `Günaydın! ${n}. gün: ${day.from.name} → ${day.to.name}${km >= 1 ? ` · ~${fmtInt(approxKm(km))} km` : ""}`
    : `Günaydın! ${n}. gün: ${day.to.name}`;

  // ---- özet
  const summary: string[] = [];
  const first = stops[0];
  summary.push(`İlk çıkış ${formatHHmm(first ? first.arriveMin - first.travelMin : day.startMin)}`);
  if (km >= 1) {
    const verb = req.transport === "yuruyus" ? "yürüyüş" : "yolda";
    summary.push(`Toplam ~${fmtInt(approxKm(km))} km${driveMin > 0 ? ` · ~${fmtDuration(driveMin)} ${verb}` : ""}`);
  }
  if (weather) {
    summary.push(weather.summary);
    const advice = weatherAdvice(weather, day);
    if (advice) summary.push(advice);
  }
  const gezi = stops.filter((s) => s.slot === "gezi").length;
  summary.push(stops.length ? `${stops.length} durak${gezi ? ` (${gezi} gezi)` : ""}` : "Bugün planlı durak yok");

  // ---- duraklar
  const items: BriefingItem[] = stops.map((s) => stopItem(s, placeOf(s), rain, costCtx));
  if (day.hotelPlaceId && !stops.some((s) => s.slot === "konaklama")) {
    const hotel = ctx.index.get(day.hotelPlaceId);
    const lastDepart = stops.length ? Math.max(...stops.map((s) => s.departMin)) : day.endMin;
    const cost = hotel ? estimatePlaceCost(hotel, costCtx) : null;
    items.push({
      stopId: HOTEL_ITEM_ID,
      slot: "konaklama",
      time: formatHHmm(lastDepart),
      label: `${SLOT_SHORT.konaklama}: ${hotel ? CATEGORIES[hotel.cat].label : "Konaklama"}`,
      placeName: hotel?.name ?? day.to.name,
      emoji: hotel ? CATEGORIES[hotel.cat].emoji : "🛏️",
      ...(hotel?.note ? { note: hotel.note } : {}),
      costTry: cost?.amountTry ?? 0,
      costKind: cost ? (cost.amountTry === 0 ? "free" : cost.kind) : "estimate",
    });
  }

  const budgetLine = ctx.budget ? budgetLineFor(ctx.budget, day) : undefined;
  const planB = planBFor(day, stops, ctx.index, rain);

  const briefing: Briefing = {
    dayIndex: day.index,
    date: day.date,
    title,
    summary,
    items,
    warnings: [...day.warnings],
    notification: { title: `Günaydın — ${n}. gün`, body: notificationBody(items, summary) },
  };
  if (budgetLine) briefing.budgetLine = budgetLine;
  if (planB) briefing.planB = planB;
  return briefing;
}

function stopItem(
  s: PlanStop,
  place: Place | undefined,
  rain: readonly Interval[],
  costCtx: CostContext,
): BriefingItem {
  const notes: string[] = [];
  if (place) {
    const end = s.departMin > s.arriveMin ? s.departMin : s.arriveMin + 30;
    if (s.slot !== "konaklama" && overlaps(rain, s.arriveMin, end)) {
      notes.push(isIndoor(place) ? "Kapalı alan — yağmura uygun" : "Açık alan — yağmur bekleniyor");
    }
    if (s.slot !== "konaklama" && hoursSource(place) === "default") notes.push("Çalışma saati doğrulanmadı");
    if (place.note) notes.push(place.note);
  }
  if (s.discovered) notes.push("Yol üstü keşif");
  let costKind: BriefingItem["costKind"] = "free";
  if (s.estCost > 0) {
    const kind = place ? estimatePlaceCost(place, costCtx).kind : "estimate";
    costKind = kind === "free" ? "estimate" : kind;
  }
  return {
    stopId: s.id,
    slot: s.slot,
    time: formatHHmm(s.arriveMin),
    label: `${SLOT_SHORT[s.slot]}: ${place ? CATEGORIES[place.cat].label : "Durak"}`,
    placeName: place?.name ?? "Bilinmeyen yer",
    emoji: place ? CATEGORIES[place.cat].emoji : "📍",
    ...(notes.length ? { note: notes.join(" · ") } : {}),
    costTry: s.estCost,
    costKind,
  };
}

/** Gün saatleriyle kesişen yağış pencerelerinden tek cümlelik öneri */
function weatherAdvice(w: WeatherDay, day: DayPlan): string | null {
  const ws = w.rainWindows
    .map(([s, e]): Interval => [Math.max(s, day.startMin), Math.min(e, day.endMin)])
    .filter(([s, e]) => e > s);
  if (ws.length === 0) {
    if (w.tMaxC >= 33) return "Öğle sıcağında açık hava duraklarını sabaha ya da akşamüstüne bırak; su yanında olsun.";
    return null;
  }
  const rainyMin = ws.reduce((a, [s, e]) => a + (e - s), 0);
  const start = ws[0]![0];
  const end = ws[ws.length - 1]![1];
  if (start >= 12 * 60) return `${timeAblative(start)} sonra yağmur bekleniyor; açık hava durakları öğleden önce.`;
  if (rainyMin >= 6 * 60) return "Gün boyu yağmur bekleniyor; kapalı alanlar öncelikli, şemsiye al.";
  if (end <= 13 * 60) return `${formatHHmm(start)}–${formatHHmm(end)} arası yağmur bekleniyor; açık hava durakları öğleden sonra.`;
  return `${formatHHmm(start)}–${formatHHmm(end)} arası yağmur bekleniyor; o saatlerde kapalı alanları tercih et.`;
}

function budgetLineFor(b: BudgetStatus, day: DayPlan): string {
  const parts = [`Bugünkü limit: ${fmtInt(b.dailyLimitTry)} TL`];
  const pos = b.byDay.findIndex((d) => d.dayIndex === day.index);
  const y = pos > 0 ? b.byDay[pos - 1] : undefined;
  if (y && y.spentTry > 0) {
    // Konaklama ayrı tutulur: önceden ödenen otel "dün aştın" diye görünmesin
    const diff = y.spentTry - (y.lodgingSpentTry ?? 0) - (y.plannedTry - (y.lodgingPlannedTry ?? 0));
    if (diff >= 1) parts.push(`dün ${fmtInt(diff)} TL aştın`);
    else if (diff <= -1) parts.push(`dün plandan ${fmtInt(-diff)} TL az harcadın`);
  }
  if (b.remainingTry < 0) parts.push(`bütçe ${fmtInt(-b.remainingTry)} TL aşıldı`);
  return parts.join(" · ");
}

function planBFor(day: DayPlan, stops: PlanStop[], index: PlaceIndex, rain: readonly Interval[]): string | undefined {
  const altPlaces = (s: PlanStop) =>
    (day.alternatives[s.id] ?? []).map((id) => index.get(id)).filter((p): p is Place => !!p && p.id !== s.placeId);

  // 1) Yağmur: açık alandaki durağa kapalı bir alternatif
  if (rain.length) {
    for (const s of stops) {
      const place = index.get(s.placeId);
      if (!place || isIndoor(place) || s.slot === "konaklama") continue;
      const end = s.departMin > s.arriveMin ? s.departMin : s.arriveMin + 30;
      if (!overlaps(rain, s.arriveMin, end)) continue;
      const alt = altPlaces(s).find(isIndoor);
      if (alt) return `B planı: yağmur bastırırsa ${place.name} yerine ${alt.name} (kapalı alan).`;
    }
  }

  // 2) En önemli yuvanın ilk alternatifi (gezi: en önemli yer; sonra öğle, akşam…)
  const ranked = stops
    .filter((s) => altPlaces(s).length > 0)
    .sort(
      (a, b) =>
        PLAN_B_RANK[a.slot] - PLAN_B_RANK[b.slot] ||
        (index.get(b.placeId)?.notability ?? 0) - (index.get(a.placeId)?.notability ?? 0) ||
        a.arriveMin - b.arriveMin,
    );
  const s = ranked[0];
  if (!s) return undefined;
  const alt = altPlaces(s)[0]!;
  const name = index.get(s.placeId)?.name ?? "Bu durak";
  return `B planı: ${name} olmazsa ${alt.name} (${trLower(CATEGORIES[alt.cat].label)}).`;
}

/** "Kahvaltı: X · Öğle: Y · Çay: Z · Gece: Otel" — en fazla 160 karakter */
function notificationBody(items: BriefingItem[], summary: string[]): string {
  let parts = items
    .filter((i) => NOTIFY_PRIORITY[i.slot] !== undefined)
    // gezi duraklarından yalnız ilki
    .filter((i, k, all) => i.slot !== "gezi" || all.findIndex((x) => x.slot === "gezi") === k)
    .map((i) => ({ text: `${SLOT_SHORT[i.slot]}: ${i.placeName}`, prio: NOTIFY_PRIORITY[i.slot]!, name: i.placeName, slot: i.slot }));
  const join = () => parts.map((p) => p.text).join(" · ");
  if (parts.length === 0) return truncate(summary.join(" · ") || "Bugünün planı hazır.", NOTIFICATION_MAX_CHARS);
  if (join().length <= NOTIFICATION_MAX_CHARS) return join();
  // Önce uzun adları kısalt, sonra önemsiz parçaları at
  parts = parts.map((p) => ({ ...p, text: `${SLOT_SHORT[p.slot]}: ${truncate(p.name, 26)}` }));
  while (join().length > NOTIFICATION_MAX_CHARS && parts.length > 1) {
    const worst = parts.reduce((w, p, i) => (p.prio > parts[w]!.prio ? i : w), 0);
    parts = parts.filter((_, i) => i !== worst);
  }
  return truncate(join(), NOTIFICATION_MAX_CHARS);
}
