// @rota/core için güvenli cephe. Her çağrı sarılır: çekirdek hata verirse (ör. henüz
// yazılmamış bir taslak ya da bir uç durum) beyaz ekran yerine bir uyarı kartı çıkar ve
// mümkünse basit bir yedek hesapla devam edilir.
import * as core from "@rota/core";
import type {
  Briefing,
  BudgetStatus,
  Discovery,
  Expense,
  FxRates,
  Interest,
  LatLng,
  LonLat,
  MuzekartAdvice,
  NearbyHighlight,
  NewExpense,
  PlaceCategory,
  PlaceIndex,
  PlanContext,
  ProximityInput,
  ProximityNotification,
  ProximitySettings,
  ProximityState,
  RegionPack,
  RepairEvent,
  RepairOption,
  RepairState,
  StopStatus,
  TransportMode,
  TripPlan,
  TripRequest,
  WeatherDay,
} from "@rota/core";
import * as fb from "../dev/fallbacks";
import { toast } from "../state/ui";

const reported = new Set<string>();

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "Bilinmeyen hata";
}

/** Çekirdek hatasını bir kez (oturum başına) kullanıcıya gösterir */
export function reportCoreError(fn: string, err: unknown, opts: { fallback?: boolean; silent?: boolean } = {}) {
  const msg = errorMessage(err);
  console.warn(`[@rota/core] ${fn}:`, err);
  const key = `${fn}|${msg}`;
  if (opts.silent || reported.has(key)) return;
  reported.add(key);
  const notReady = /henüz yazılmadı/i.test(msg);
  // Render sırasında çağrılabilir; durum güncellemesini bir sonraki tura bırak.
  window.setTimeout(() =>
    toast({
      kind: notReady ? "info" : "error",
      title: notReady ? `${fn} henüz hazır değil` : `${fn} çalışırken bir sorun çıktı`,
      body: opts.fallback ? `${notReady ? "" : `${msg} — `}Basit bir yedek hesap gösteriliyor.` : msg,
    }),
  );
}

function attempt<T>(fn: string, run: () => T, fallback: () => T, silent = false): T {
  try {
    return run();
  } catch (err) {
    reportCoreError(fn, err, { fallback: true, silent });
    try {
      return fallback();
    } catch (err2) {
      console.warn(`[yedek] ${fn}:`, err2);
      throw err;
    }
  }
}

// ---------------------------------------------------------------- bağlam

const travelCache = new Map<TransportMode, core.TravelModel>();
export function travelModel(mode: TransportMode): core.TravelModel {
  let t = travelCache.get(mode);
  if (!t) travelCache.set(mode, (t = core.createTravelModel(mode)));
  return t;
}

export function planContext(index: PlaceIndex, mode: TransportMode, seed?: number, fx?: FxRates | null): PlanContext {
  return { index, travel: travelModel(mode), seed, fx: fx ?? undefined };
}

// ---------------------------------------------------------------- planlama

export async function planTrip(req: TripRequest, pack: RegionPack, index: PlaceIndex, seed: number, osrmUrl: string, fx?: FxRates | null): Promise<TripPlan> {
  const ctx = planContext(index, req.transport, seed, fx);
  try {
    const plan = await core.planTripWithRoutes(req, pack, ctx, osrmUrl);
    if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) throw new Error("Planlayıcı boş bir plan döndürdü.");
    return plan;
  } catch (err) {
    console.warn("[@rota/core] planTripWithRoutes:", err);
    const msg = errorMessage(err);
    if (/henüz yazılmadı/i.test(msg)) throw new Error("Planlayıcı (planTripWithRoutes) henüz hazır değil. Şimdilik örnek planla devam edebilirsin.");
    throw new Error(msg);
  }
}

// ---------------------------------------------------------------- günlük kullanım

export function briefing(plan: TripPlan, dayIndex: number, index: PlaceIndex, weather?: WeatherDay | null, budget?: BudgetStatus | null): Briefing {
  return attempt(
    "Sabah rehberi",
    () => core.buildBriefing(plan, dayIndex, { index, weather, budget }),
    () => fb.fallbackBriefing(plan, dayIndex, index, weather, budget),
  );
}

export async function weather(loc: LatLng, date: string): Promise<WeatherDay | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  try {
    return await core.fetchWeather(loc, date);
  } catch (err) {
    reportCoreError("Hava durumu", err, { silent: /henüz yazılmadı/i.test(errorMessage(err)) });
    return null;
  }
}

export function markStop(plan: TripPlan, dayIndex: number, stopId: string, status: StopStatus): TripPlan {
  return attempt(
    "Durak işaretleme",
    () => core.markStop(plan, dayIndex, stopId, status),
    () => fb.fallbackMarkStop(plan, dayIndex, stopId, status),
  );
}

export function repairDay(plan: TripPlan, dayIndex: number, event: RepairEvent, state: RepairState, ctx: PlanContext): RepairOption[] {
  try {
    return core.repairDay(plan, dayIndex, event, state, ctx) ?? [];
  } catch (err) {
    reportCoreError("Plan onarımı", err);
    return [];
  }
}

export function applyRepair(plan: TripPlan, dayIndex: number, option: RepairOption): TripPlan {
  return attempt(
    "Onarımı uygulama",
    () => core.applyRepair(plan, dayIndex, option),
    () => fb.fallbackApplyRepair(plan, dayIndex, option),
  );
}

// ---------------------------------------------------------------- keşif

export function corridor(
  route: LonLat[],
  opts: { interests: Interest[]; mode: TransportMode; excludeIds?: ReadonlySet<string>; limit?: number },
  index: PlaceIndex,
): Discovery[] {
  return attempt(
    "Yol üstü keşifler",
    () => core.findCorridorDiscoveries(route, opts, { index, travel: travelModel(opts.mode) }),
    () => fb.fallbackCorridor(route, opts, index),
  );
}

export function proximity(
  input: ProximityInput,
  settings: ProximitySettings,
  state: ProximityState,
  index: PlaceIndex,
  mode: TransportMode,
): { notifications: ProximityNotification[]; state: ProximityState } {
  return attempt(
    "Yakınlık bildirimi",
    () => core.evaluateProximity(input, settings, state, { index, travel: travelModel(mode) }),
    () => fb.fallbackProximity(input, settings, state, index),
  );
}

export function nearby(
  position: LatLng,
  radiusKm: number,
  opts: { interests: Interest[]; limit?: number; categories?: PlaceCategory[] },
  index: PlaceIndex,
): NearbyHighlight[] {
  return attempt(
    "Etrafım",
    () => core.nearbyHighlights(position, radiusKm, opts, { index, travel: travelModel("yuruyus") }),
    () => fb.fallbackNearby(position, radiusKm, opts, index),
  );
}

// ---------------------------------------------------------------- bütçe

export function makeExpense(input: NewExpense, fx: FxRates): Expense {
  return attempt(
    "Harcama kaydı",
    () => core.makeExpense(input, fx),
    () => fb.fallbackMakeExpense(input, fx),
  );
}

export function budget(plan: TripPlan, expenses: Expense[], now: Date, index: PlaceIndex | null, fx?: FxRates | null): BudgetStatus {
  return attempt(
    "Bütçe durumu",
    () => core.budgetStatus(plan, expenses, now, fx ?? core.DEFAULT_FX),
    () => fb.fallbackBudget(plan, expenses, now, index, fx ?? core.DEFAULT_FX),
  );
}

export function museumPass(plan: TripPlan, index: PlaceIndex, visitor: core.Visitor, fx?: FxRates | null): MuzekartAdvice | null {
  try {
    return core.museumPassAdvice(plan, index, { visitor, fx: fx ?? undefined });
  } catch (err) {
    reportCoreError("Müzekart önerisi", err);
    return null;
  }
}

export function categoryForPlace(cat: PlaceCategory) {
  try {
    return core.categoryForPlace(cat);
  } catch {
    return fb.fallbackCategoryForPlace(cat);
  }
}

export async function fxRates(): Promise<FxRates | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  try {
    return await core.fetchFxRates();
  } catch (err) {
    reportCoreError("Döviz kuru", err, { silent: true });
    return null;
  }
}
