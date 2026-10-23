// Çok günlü planlayıcı: geceleme üslerini günlere böler, her üs için otel seçer,
// her günü gün çözücüyle kurar ve günler arası tekrarları engeller.
import { haversineKm } from "./geo";
import { DEFAULT_FX, estimatePlaceCost, indexPrice, LODGING_PRICE, toTry } from "./pricing";
import { planDay } from "./solver";
import type { DayInput, PlanContext } from "./solver";
import { addDays, parseHHmm } from "./time";
import { fetchRoute, straightLine } from "./travel";
import type { DayPlan, LonLat, NamedPoint, Place, RegionPack, Stay, TripPlan, TripRequest } from "./types";

export interface TripPlanOptions {
  /** Yol günleri için rota çizgileri; anahtar `${from.lat},${from.lon}>${to.lat},${to.lon}` (toFixed(4)) */
  routes?: Record<string, LonLat[]>;
  /** Plan kimliği ve oluşturma zamanı (testlerde sabitlemek için) */
  id?: string;
  now?: Date;
}

export function routeKey(a: { lat: number; lon: number }, b: { lat: number; lon: number }): string {
  return `${a.lat.toFixed(4)},${a.lon.toFixed(4)}>${b.lat.toFixed(4)},${b.lon.toFixed(4)}`;
}

/** Bu mesafeden (kuş uçuşu, km) uzak başlangıç–bitiş "yol günü" sayılır */
const TRAVEL_DAY_KM = 15;
/** Toplam bütçenin konaklamaya ayrılması makul payı (otel seçiminde gecelik tavan) */
const LODGING_SHARE = 0.45;

/** Bir geceleme üssü için en uygun konaklama yeri */
export function chooseHotel(stay: Stay, req: TripRequest, ctx: PlanContext): Place | undefined {
  const isLodging = (p: Place) => p.slots.includes("konaklama");
  let pool = ctx.index.near(stay.loc, 5, isLodging);
  if (pool.length === 0) pool = ctx.index.near(stay.loc, 15, isLodging);
  if (pool.length === 0) return undefined;

  const totalNights = Math.max(1, req.stays.reduce((n, s) => n + s.nights, 0));
  const nightlyCap = (toTry(req.budget, ctx.fx ?? DEFAULT_FX) * LODGING_SHARE) / totalNights;
  const costCtx = { travelers: req.travelers, visitor: req.visitor, hasMuzekart: req.hasMuzekart, date: req.startDate, fx: ctx.fx };
  const likesNature = req.interests.includes("doga");

  const scored = pool.map((p) => {
    const price = estimatePlaceCost(p, costCtx).amountTry;
    let score = 0.2 + 1.0 * (p.quality ?? 0.5) + 0.5 * p.notability - 0.04 * haversineKm(stay.loc, p.loc);
    if (nightlyCap > 0 && price > nightlyCap) score -= 0.3 + 1.5 * (price / nightlyCap - 1);
    if (p.cat === "kamp" && !likesNature) score -= 0.4;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score || (a.p.id < b.p.id ? -1 : a.p.id > b.p.id ? 1 : 0));
  return scored[0]?.p;
}

interface DaySkeleton {
  index: number;
  date: string;
  from: NamedPoint;
  to: NamedPoint;
  stay?: Stay;
  hotel?: Place;
  isTravelDay: boolean;
}

/** Günlerin iskeleti: tarih, nereden-nereye, hangi üs ve otel */
function skeleton(req: TripRequest, ctx: PlanContext): DaySkeleton[] {
  const out: DaySkeleton[] = [];
  let prev: NamedPoint = req.start;
  for (const stay of req.stays) {
    if (stay.nights <= 0) continue;
    const hotel = chooseHotel(stay, req, ctx);
    const to: NamedPoint = hotel ? { name: hotel.name, loc: hotel.loc } : { name: stay.name, loc: stay.loc };
    for (let n = 0; n < stay.nights; n++) {
      const index = out.length;
      out.push({
        index,
        date: addDays(req.startDate, index),
        from: prev,
        to,
        stay,
        hotel,
        isTravelDay: haversineKm(prev.loc, to.loc) > TRAVEL_DAY_KM,
      });
      prev = to;
    }
  }
  if (req.end) {
    const index = out.length;
    out.push({
      index,
      date: addDays(req.startDate, index),
      from: prev,
      to: req.end,
      isTravelDay: haversineKm(prev.loc, req.end.loc) > TRAVEL_DAY_KM,
    });
  }
  return out;
}

/** Bir gecelik konaklama tahmini; otel bulunamadıysa kategori modeli (bütçe hesabı için) */
function nightCost(d: DaySkeleton, req: TripRequest, ctx: PlanContext): number {
  if (!d.stay) return 0;
  if (d.hotel) {
    return estimatePlaceCost(d.hotel, { travelers: req.travelers, visitor: req.visitor, date: d.date, fx: ctx.fx }).amountTry;
  }
  const model = LODGING_PRICE.otel;
  return model ? Math.round(indexPrice(model, d.date, ctx.fx) * Math.ceil(req.travelers / 2)) : 0;
}

/** Bütün geziyi planlar (senkron; rotalar önceden çekilip opts.routes ile verilir) */
export function planTrip(req: TripRequest, pack: RegionPack, ctx: PlanContext, opts: TripPlanOptions = {}): TripPlan {
  const days = skeleton(req, ctx);
  const startMin = parseHHmm(req.dayStart);
  let endMin = parseHHmm(req.dayEnd);
  if (endMin <= startMin) endMin += 1440;

  const lodging = days.reduce((sum, d) => sum + nightCost(d, req, ctx), 0);
  const budgetTry = toTry(req.budget, ctx.fx ?? DEFAULT_FX);
  const dailyBudgetTry = days.length > 0 ? Math.max(0, budgetTry - lodging) / days.length : 0;

  const used = new Set<string>();
  const planned: DayPlan[] = [];
  for (const d of days) {
    const route = d.isTravelDay ? (opts.routes?.[routeKey(d.from.loc, d.to.loc)] ?? straightLine([d.from.loc, d.to.loc])) : undefined;
    const input: DayInput = {
      index: d.index,
      date: d.date,
      from: d.from,
      to: d.to,
      stayId: d.stay?.id,
      hotelPlaceId: d.hotel?.id,
      startMin,
      endMin,
      pace: req.pace,
      interests: req.interests,
      travelers: req.travelers,
      visitor: req.visitor,
      hasMuzekart: req.hasMuzekart,
      diet: req.diet,
      dailyBudgetTry,
      budgetPressure: 0,
      excludePlaceIds: new Set(used),
      route,
    };
    const day = planDay(input, ctx);
    for (const s of day.stops) if (s.slot !== "konaklama") used.add(s.placeId);
    planned.push(day);
  }

  return {
    id: opts.id ?? crypto.randomUUID(),
    createdAt: (opts.now ?? new Date()).toISOString(),
    packId: pack.id,
    request: req,
    days: planned,
    estTotal: Math.round(planned.reduce((sum, d) => sum + d.estCost, 0)),
    version: 1,
  };
}

/** Yol günlerinin rotalarını OSRM'den çekip planTrip'i çağırır; rota alınamazsa düz çizgiye düşer */
export async function planTripWithRoutes(
  req: TripRequest,
  pack: RegionPack,
  ctx: PlanContext,
  osrmUrl?: string,
  fetchFn?: typeof fetch,
): Promise<TripPlan> {
  const routes: Record<string, LonLat[]> = {};
  // Herkese açık OSRM sunucusunu yormamak için sırayla
  for (const d of skeleton(req, ctx)) {
    if (!d.isTravelDay) continue;
    const key = routeKey(d.from.loc, d.to.loc);
    if (routes[key]) continue;
    const r = await fetchRoute([d.from.loc, d.to.loc], osrmUrl, fetchFn);
    routes[key] = r && r.geometry.length >= 2 ? r.geometry : straightLine([d.from.loc, d.to.loc]);
  }
  return planTrip(req, pack, ctx, { routes });
}
