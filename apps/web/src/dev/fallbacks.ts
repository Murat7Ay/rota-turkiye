// ⚠️ GELİŞTİRME YEDEKLERİ — yalnızca @rota/core fonksiyonu hata verdiğinde (ör. henüz
// yazılmamış bir taslak) arayüz boş kalmasın diye kullanılan basit hesaplar. Gerçek mantık
// çekirdektedir; bunlar onun yerini tutmaz, arayüz kullanıldıklarında kullanıcıyı uyarır.
import {
  CATEGORIES,
  DEFAULT_FX,
  SLOT_LABELS,
  bearingDeg,
  formatHHmm,
  haversineKm,
  isOpenAt,
  projectOnLine,
  toTrWallClock,
  type Briefing,
  type BudgetStatus,
  type DayPlan,
  type Discovery,
  type Expense,
  type ExpenseCategory,
  type FxRates,
  type LatLng,
  type LonLat,
  type NearbyHighlight,
  type NewExpense,
  type Place,
  type PlaceCategory,
  type PlaceIndex,
  type ProximityInput,
  type ProximityNotification,
  type ProximitySettings,
  type ProximityState,
  type RepairOption,
  type StopStatus,
  type TripPlan,
  type WeatherDay,
} from "@rota/core";
import { fmtKm, fmtTry } from "../lib/format";

const DEFAULT_DISCOVERY_CATS: PlaceCategory[] = [
  "antik_kent", "muze", "tarihi_yapi", "cami", "dogal_alan", "manzara", "plaj", "tatlici", "yoresel_urun", "cay_bahcesi",
];

function tagNote(p: Place): string {
  if (p.tags.includes("unesco")) return "UNESCO";
  if (p.tags.includes("michelin")) return "Michelin";
  if (p.tags.includes("cografi_isaret")) return "Coğrafi işaretli";
  if (p.tags.includes("tarihi")) return "Tarihi";
  return CATEGORIES[p.cat].label;
}

function safeOpen(p: Place, at: Date): boolean | null {
  try {
    const w = toTrWallClock(at);
    return isOpenAt(p, w.date, w.min);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- brifing

export function fallbackBriefing(
  plan: TripPlan,
  dayIndex: number,
  index: PlaceIndex,
  weather?: WeatherDay | null,
  budget?: BudgetStatus | null,
): Briefing {
  const day = plan.days[dayIndex]!;
  const items = day.stops.map((s) => {
    const p = index.get(s.placeId);
    const info = p ? CATEGORIES[p.cat] : undefined;
    return {
      stopId: s.id,
      slot: s.slot,
      time: formatHHmm(s.arriveMin),
      label: `${SLOT_LABELS[s.slot]}${info ? `: ${info.label.toLocaleLowerCase("tr")}` : ""}`,
      placeName: p?.name ?? s.placeId,
      emoji: info?.emoji ?? "📍",
      note: p?.note,
      costTry: s.estCost,
      costKind: (s.estCost === 0 ? "free" : (p?.price?.kind ?? "estimate")) as "observed" | "estimate" | "free",
    };
  });
  const km = day.stops.reduce((n, s) => n + s.travelKm, 0);
  const first = items[0];
  const where = day.isTravelDay ? `${day.from.name} → ${day.to.name}` : day.to.name;
  const summary: string[] = [];
  if (weather) summary.push(weather.summary);
  if (first) summary.push(`İlk durak ${first.time}: ${first.placeName}`);
  summary.push(`${day.stops.length} durak · toplam ~${Math.round(km)} km yol`);
  const indoorAlt = Object.values(day.alternatives)
    .flat()
    .map((id) => index.get(id))
    .find((p) => p && (p.indoor ?? CATEGORIES[p.cat].indoor) && CATEGORIES[p.cat].group === "gezi");
  const title = `Günaydın! ${dayIndex + 1}. gün: ${where}`;
  return {
    dayIndex,
    date: day.date,
    title,
    summary,
    items,
    warnings: [...day.warnings],
    budgetLine: budget
      ? `Bugünkü limit ${fmtTry(budget.dailyLimitTry)} · plan ${fmtTry(day.estCost)}`
      : `Günün tahmini maliyeti ${fmtTry(day.estCost)}`,
    planB: indoorAlt ? `Hava bozarsa: ${indoorAlt.name} (kapalı alan).` : undefined,
    notification: { title, body: summary.join(" · ") },
  };
}

// ---------------------------------------------------------------- etrafım

export function fallbackNearby(
  position: LatLng,
  radiusKm: number,
  opts: { interests: string[]; limit?: number; now?: Date; categories?: PlaceCategory[] },
  index: PlaceIndex,
): NearbyHighlight[] {
  const now = opts.now ?? new Date();
  const cats = opts.categories ? new Set(opts.categories) : null;
  return index
    .near(position, radiusKm, (p) => CATEGORIES[p.cat].group !== "konaklama" && (!cats || cats.has(p.cat)))
    .map((place) => {
      const distanceKm = haversineKm(position, place.loc);
      const interestHit = CATEGORIES[place.cat].interests.some((i) => opts.interests.includes(i)) ? 1 : 0;
      const score = place.notability * 0.65 + interestHit * 0.25 + (1 - distanceKm / Math.max(radiusKm, 0.1)) * 0.1;
      return { place, distanceKm, bearingDeg: bearingDeg(position, place.loc), openNow: safeOpen(place, now), score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 20);
}

// ---------------------------------------------------------------- koridor

export function fallbackCorridor(
  route: LonLat[],
  opts: { interests: string[]; bufferKm?: number; minNotability?: number; excludeIds?: ReadonlySet<string>; limit?: number; categories?: PlaceCategory[]; mode?: string },
  index: PlaceIndex,
): Discovery[] {
  const buffer = opts.bufferKm ?? (opts.mode === "yuruyus" ? 0.8 : 6);
  const minN = opts.minNotability ?? 0.35;
  const cats = new Set(opts.categories ?? DEFAULT_DISCOVERY_CATS);
  return index
    .nearLine(route, buffer, (p) => cats.has(p.cat) && p.notability >= minN && !opts.excludeIds?.has(p.id))
    .map(({ place, proj }) => {
      const detourMin = Math.round(((proj.distanceKm * 2 * 1.35) / (opts.mode === "yuruyus" ? 4.5 : 45)) * 60);
      const interestHit = CATEGORIES[place.cat].interests.some((i) => opts.interests.includes(i));
      const score = Math.min(1, place.notability * 0.75 + (interestHit ? 0.2 : 0) + (1 - proj.distanceKm / buffer) * 0.1);
      return {
        place,
        offRouteKm: proj.distanceKm,
        detourMin,
        alongKm: proj.alongKm,
        score,
        reason: `Rotadan ${fmtKm(proj.distanceKm)}, ~${detourMin} dk sapma · ${tagNote(place)}`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 12);
}

// ---------------------------------------------------------------- yakınlık

export function fallbackProximity(
  input: ProximityInput,
  settings: ProximitySettings,
  state: ProximityState,
  index: PlaceIndex,
): { notifications: ProximityNotification[]; state: ProximityState } {
  const wall = toTrWallClock(input.now);
  let st: ProximityState = state.dayKey === wall.date ? state : { ...state, dayKey: wall.date, dayCount: 0 };
  const none = { notifications: [], state: st };
  if (!settings.enabled) return none;
  const [qs, qe] = settings.quietHours;
  const quiet = qs <= qe ? wall.min >= qs && wall.min < qe : wall.min >= qs || wall.min < qe;
  if (quiet || st.dayCount >= settings.maxPerDay) return none;
  if (st.lastAt && input.now.getTime() - Date.parse(st.lastAt) < settings.cooldownMin * 60_000) return none;
  const cats = new Set(settings.categories);
  const ok = (p: Place) => cats.has(p.cat) && !st.notified[p.id] && !input.plannedPlaceIds?.has(p.id) && p.notability >= 0.3;

  let best: { place: Place; ahead: number; off: number; along: number; score: number } | null = null;
  if (input.route && input.route.length > 1) {
    const me = projectOnLine(input.position, input.route);
    for (const { place, proj } of index.nearLine(input.route, settings.maxOffRouteKm, ok)) {
      const ahead = proj.alongKm - me.alongKm;
      if (ahead <= 0.2 || ahead > settings.lookaheadKm) continue;
      const score = place.notability * 0.8 + (1 - proj.distanceKm / settings.maxOffRouteKm) * 0.2;
      if (score >= settings.minScore * 0.9 && (!best || score > best.score)) best = { place, ahead, off: proj.distanceKm, along: proj.alongKm, score };
    }
  } else {
    for (const place of index.near(input.position, settings.radiusKm, ok)) {
      const d = haversineKm(input.position, place.loc);
      const score = place.notability * 0.8 + (1 - d / settings.radiusKm) * 0.2;
      if (score >= settings.minScore * 0.9 && (!best || score > best.score)) best = { place, ahead: d, off: d, along: 0, score };
    }
  }
  if (!best) return none;
  const at = input.now.toISOString();
  st = { ...st, notified: { ...st.notified, [best.place.id]: at }, dayCount: st.dayCount + 1, lastAt: at };
  const detourMin = Math.round(((best.off * 2 * 1.35) / 45) * 60);
  const onRoute = !!input.route;
  const n: ProximityNotification = {
    id: `${best.place.id}@${at}`,
    placeId: best.place.id,
    title: onRoute ? `İleride: ${best.place.name}` : `Yakınında: ${best.place.name}`,
    body: onRoute
      ? `${fmtKm(best.ahead)} sonra · rotadan ${fmtKm(best.off)} · ~${detourMin} dk sapma · ${tagNote(best.place)}`
      : `${fmtKm(best.off)} uzakta · ${tagNote(best.place)}`,
    discovery: {
      place: best.place,
      offRouteKm: best.off,
      detourMin,
      alongKm: best.along,
      score: best.score,
      reason: tagNote(best.place),
    },
  };
  return { notifications: [n], state: st };
}

// ---------------------------------------------------------------- bütçe

export function fallbackCategoryForPlace(cat: PlaceCategory): ExpenseCategory {
  const g = CATEGORIES[cat].group;
  if (cat === "muze" || cat === "antik_kent") return "giris";
  if (cat === "kafe" || cat === "cay_bahcesi" || cat === "kahvehane") return "cay_kahve";
  if (g === "yeme") return "yemek";
  if (g === "alisveris") return "alisveris";
  if (g === "konaklama") return "konaklama";
  if (g === "yol") return "yakit";
  return "diger";
}

export function fallbackMakeExpense(input: NewExpense, fx: FxRates): Expense {
  const rate = fx.tryPer[input.currency] ?? 1;
  const at = input.at ?? new Date();
  return {
    id: input.id ?? `e-${at.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    tripId: input.tripId,
    at: at.toISOString(),
    amount: input.amount,
    currency: input.currency,
    amountTry: Math.round(input.amount * rate * 100) / 100,
    fxRate: rate,
    category: input.category,
    note: input.note,
    placeId: input.placeId,
    dayIndex: input.dayIndex,
  };
}

const EMPTY_CATS = (): BudgetStatus["byCategory"] => ({
  yemek: { plannedTry: 0, spentTry: 0 },
  cay_kahve: { plannedTry: 0, spentTry: 0 },
  giris: { plannedTry: 0, spentTry: 0 },
  alisveris: { plannedTry: 0, spentTry: 0 },
  ulasim: { plannedTry: 0, spentTry: 0 },
  yakit: { plannedTry: 0, spentTry: 0 },
  konaklama: { plannedTry: 0, spentTry: 0 },
  diger: { plannedTry: 0, spentTry: 0 },
});

export function fallbackBudget(plan: TripPlan, expenses: Expense[], now: Date, index: PlaceIndex | null, fx: FxRates = DEFAULT_FX): BudgetStatus {
  const b = plan.request.budget;
  const totalTry = b.amount * (fx.tryPer[b.currency] ?? 1);
  const mine = expenses.filter((e) => e.tripId === plan.id);
  const spentTry = mine.reduce((n, e) => n + e.amountTry, 0);
  const today = toTrWallClock(now).date;
  const ti = plan.days.findIndex((d) => d.date === today);
  const todayIndex = ti >= 0 ? ti : null;
  const daysTotal = plan.days.length;
  const first = plan.days[0]?.date ?? today;
  const daysLeft = todayIndex !== null ? daysTotal - todayIndex : today < first ? daysTotal : 0;
  const dayOf = (e: Expense) => e.dayIndex ?? plan.days.findIndex((d) => d.date === toTrWallClock(new Date(e.at)).date);
  const todaySpentTry = todayIndex === null ? 0 : mine.filter((e) => dayOf(e) === todayIndex).reduce((n, e) => n + e.amountTry, 0);
  const spentBeforeToday = spentTry - todaySpentTry;
  const dailyLimitTry = daysLeft > 0 ? Math.max(0, (totalTry - spentBeforeToday) / daysLeft) : 0;
  const byCategory = EMPTY_CATS();
  for (const d of plan.days) {
    let stopsSum = 0;
    for (const s of d.stops) {
      const p = index?.get(s.placeId);
      const c = p ? fallbackCategoryForPlace(p.cat) : "diger";
      byCategory[c].plannedTry += s.estCost;
      stopsSum += s.estCost;
    }
    byCategory.konaklama.plannedTry += Math.max(0, d.estCost - stopsSum);
  }
  for (const e of mine) byCategory[e.category].spentTry += e.amountTry;
  const byDay = plan.days.map((d, i) => ({
    dayIndex: i,
    date: d.date,
    plannedTry: d.estCost,
    spentTry: mine.filter((e) => dayOf(e) === i).reduce((n, e) => n + e.amountTry, 0),
  }));
  const remainingTry = totalTry - spentTry;
  const elapsed = todayIndex !== null ? todayIndex + 1 : today < first ? 0 : daysTotal;
  const expected = (totalTry * elapsed) / Math.max(1, daysTotal);
  const pressure = Math.max(0, Math.min(1, (spentTry - expected) / Math.max(1, totalTry * 0.25)));
  const todayLeftTry = dailyLimitTry - todaySpentTry;
  const status: BudgetStatus["status"] = remainingTry < 0 ? "asim" : pressure > 0.15 || (todayIndex !== null && todayLeftTry < 0) ? "dikkat" : "iyi";
  const messages: string[] = [];
  if (plan.estTotal > totalTry) messages.push(`Planın tahmini maliyeti bütçeni ${fmtTry(plan.estTotal - totalTry)} aşıyor.`);
  if (status === "asim") messages.push("Bütçe aşıldı; kalan günlerde esnaf lokantası ve ücretsiz duraklar öne alınabilir.");
  else if (status === "dikkat") messages.push("Harcama planın biraz önünde; bugün daha ekonomik seçenekler iyi olur.");
  else messages.push("Bütçe yolunda.");
  return {
    totalTry,
    spentTry,
    remainingTry,
    plannedTry: plan.estTotal,
    daysTotal,
    daysLeft,
    todayIndex,
    todaySpentTry,
    dailyLimitTry,
    todayLeftTry,
    byCategory,
    byDay,
    pressure,
    status,
    messages,
  };
}

// ---------------------------------------------------------------- plan düzenleme

export function fallbackMarkStop(plan: TripPlan, dayIndex: number, stopId: string, status: StopStatus): TripPlan {
  return {
    ...plan,
    version: plan.version + 1,
    days: plan.days.map((d, i) =>
      i !== dayIndex
        ? d
        : { ...d, stops: d.stops.map((s) => (s.id === stopId ? { ...s, status, locked: status === "done" ? true : s.locked } : s)) },
    ),
  };
}

export function fallbackApplyRepair(plan: TripPlan, dayIndex: number, option: RepairOption): TripPlan {
  const day: DayPlan = { ...option.day, index: dayIndex };
  const days = plan.days.map((d, i) => (i === dayIndex ? day : d));
  return { ...plan, days, estTotal: days.reduce((n, d) => n + d.estCost, 0), version: plan.version + 1 };
}
