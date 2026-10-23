// Plan doğrulama yardımcıları (testler arasında ortak). Test dosyası değildir.
import { expect } from "vitest";
import { SLOT_WINDOWS, fitsWindow } from "../src";
import type { DayPlan, PlaceIndex, PlanStop, TravelModel } from "../src";

/**
 * Günün zaman tutarlılığı: her durak çalışma penceresine ve yuva penceresine sığar,
 * varış ≥ önceki ayrılış + yol, ayrılış = varış + ziyaret süresi, otele endMin'den önce varılır.
 * `fromMin`/`onlyStops` verilirse yalnızca o duraklar (onarımın yeni kısmı) zincir olarak denetlenir.
 */
export function expectDayConsistent(
  day: DayPlan,
  index: PlaceIndex,
  travel: TravelModel,
  opts: { fromMin?: number; onlyStops?: PlanStop[] } = {},
): void {
  const chain = opts.onlyStops ?? day.stops.filter((s) => s.status === "planned" || s.status === "done");
  let prevDepart = opts.fromMin ?? day.startMin;
  let prevLoc = opts.onlyStops ? undefined : day.from.loc;
  for (const s of chain) {
    if (opts.fromMin !== undefined) expect(s.arriveMin).toBeGreaterThanOrEqual(opts.fromMin);
    expect(s.arriveMin, `${s.id} varışı`).toBeGreaterThanOrEqual(prevDepart + s.travelMin);
    if (prevLoc) {
      const loc = s.slot === "konaklama" ? day.to.loc : index.get(s.placeId)!.loc;
      expect(s.travelMin).toBe(travel.leg(prevLoc, loc).min);
    }
    if (s.slot === "konaklama") {
      expect(s.arriveMin, "otele varış").toBeLessThanOrEqual(day.endMin);
      expect(s.departMin).toBe(s.arriveMin);
      prevDepart = s.departMin;
      continue;
    }
    const p = index.get(s.placeId)!;
    expect(s.departMin, `${s.id} ayrılışı`).toBe(s.arriveMin + p.visitMin);
    expect(fitsWindow(p, day.date, s.arriveMin, p.visitMin), `${s.id} çalışma saati`).toBe(true);
    if (s.slot !== "gezi") {
      const [a, b] = SLOT_WINDOWS[s.slot];
      expect(s.arriveMin, `${s.id} yuva penceresi`).toBeGreaterThanOrEqual(a);
      expect(s.arriveMin, `${s.id} yuva penceresi`).toBeLessThanOrEqual(b);
    }
    prevDepart = s.departMin;
    prevLoc = p.loc;
  }
  const last = chain[chain.length - 1];
  if (!day.stops.some((s) => s.slot === "konaklama")) {
    const lastLoc = last ? index.get(last.placeId)!.loc : day.from.loc;
    expect(prevDepart + travel.leg(lastLoc, day.to.loc).min).toBeLessThanOrEqual(day.endMin);
  }
}

export const plannedStops = (day: DayPlan) => day.stops.filter((s) => s.status === "planned" && s.slot !== "konaklama");
