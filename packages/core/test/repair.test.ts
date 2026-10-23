import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  applyRepair,
  buildPlaceIndex,
  createTravelModel,
  fitsWindow,
  markStop,
  planTrip,
  repairDay,
} from "../src";
import type { DayPlan, PlanContext, PlanStop, RepairOption, TripPlan } from "../src";
import { expectDayConsistent, plannedStops } from "./assertions";
import { EGE_REQUEST, MINI_PACK } from "./fixtures";

const index = buildPlaceIndex(MINI_PACK.places);
const travel = createTravelModel("araba");
const ctx: PlanContext = { index, travel, seed: 1 };
const FIXED = { id: "onarim", now: new Date("2026-10-24T09:00:00Z") };

const base = planTrip(EGE_REQUEST, MINI_PACK, ctx, FIXED);
const D = 1; // Selçuk'ta tam gün (2026-10-28)
const breakfast = base.days[D]!.stops.find((s) => s.slot === "kahvalti")!;
const plan = markStop(base, D, breakfast.id, "done");
const lunch = plan.days[D]!.stops.find((s) => s.slot === "ogle")!;
const NOW = 12 * 60 + 10;

/** Onarılan günün "şimdi"den sonraki kısmı: yeni planlanan duraklar + otel */
function freshPart(day: DayPlan, nowMin: number): { from: number; stops: PlanStop[] } {
  const past = day.stops.filter((s) => s.slot !== "konaklama" && (s.status === "done" || (s.status === "planned" && s.arriveMin < nowMin)));
  const from = Math.max(nowMin, ...past.map((s) => s.departMin));
  const stops = day.stops.filter((s) => s.status === "planned" && (s.slot === "konaklama" || s.arriveMin >= nowMin));
  return { from, stops };
}

function expectFeasibleFrom(opt: RepairOption, nowMin: number, checkSlotWindows = true) {
  const { from, stops } = freshPart(opt.day, nowMin);
  if (checkSlotWindows) expectDayConsistent(opt.day, index, travel, { fromMin: from, onlyStops: stops });
  else {
    let prev = from;
    for (const s of stops) {
      expect(s.arriveMin).toBeGreaterThanOrEqual(prev + s.travelMin);
      if (s.slot !== "konaklama") {
        const p = index.get(s.placeId)!;
        expect(fitsWindow(p, opt.day.date, s.arriveMin, p.visitMin)).toBe(true);
      }
      prev = s.departMin;
    }
  }
  const hotel = opt.day.stops.find((s) => s.slot === "konaklama")!;
  expect(hotel.arriveMin).toBeLessThanOrEqual(opt.day.endMin);
}

function expectDoneUntouched(original: DayPlan, opt: RepairOption) {
  for (const s of original.stops.filter((x) => x.status === "done")) {
    expect(opt.day.stops.find((x) => x.id === s.id)).toEqual(s);
  }
}

function expectWellFormed(opts: RepairOption[]) {
  expect(opts.length).toBeGreaterThanOrEqual(2);
  expect(opts.length).toBeLessThanOrEqual(3);
  expect(new Set(opts.map((o) => o.id)).size).toBe(opts.length);
  expect(new Set(opts.map((o) => o.label)).size).toBe(opts.length);
  const sigs = opts.map((o) =>
    plannedStops(o.day)
      .map((s) => `${s.slot}:${s.placeId}`)
      .sort()
      .join("|"),
  );
  expect(new Set(sigs).size).toBe(opts.length);
  for (const o of opts) {
    expect(o.keptRatio).toBeGreaterThanOrEqual(0);
    expect(o.keptRatio).toBeLessThanOrEqual(1);
    expect(o.changes.length).toBeGreaterThan(0);
    expect(o.description.length).toBeGreaterThan(0);
    expect(o.day.from).toEqual(plan.days[D]!.from);
    expect(o.day.date).toBe(plan.days[D]!.date);
    expect(new Set(o.day.stops.map((s) => s.id)).size).toBe(o.day.stops.length);
  }
}

describe("repairDay", () => {
  it("12:10'da öğle atlanınca 2–3 seçenek; biri başka bir öğle yeri, yapılanlar dokunulmaz", () => {
    expect(lunch.arriveMin).toBeGreaterThanOrEqual(12 * 60);
    const opts = repairDay(plan, D, { type: "skip", stopId: lunch.id }, { nowMin: NOW }, ctx);
    expectWellFormed(opts);
    expect(opts.some((o) => plannedStops(o.day).some((s) => s.slot === "ogle" && s.placeId !== lunch.placeId))).toBe(true);
    for (const o of opts) {
      expectDoneUntouched(plan.days[D]!, o);
      expectFeasibleFrom(o, NOW);
      expect(plannedStops(o.day).map((s) => s.placeId)).not.toContain(lunch.placeId);
      expect(o.day.stops.find((s) => s.id === lunch.id)?.status).toBe("skipped");
      expect(o.changes[0]).toMatch(/atlandı/);
    }
    expect(opts[0]!.label).toMatch(/yerine/);
  });

  it("'kapalıydı' o yeri bütün seçeneklerden ve gezinin geri kalanından çıkarır", () => {
    const target = plan.days[D]!.stops.find((s) => s.slot === "gezi" && s.arriveMin >= NOW) ?? lunch;
    const now = target.arriveMin;
    const opts = repairDay(plan, D, { type: "closed", stopId: target.id }, { nowMin: now }, ctx);
    expectWellFormed(opts);
    for (const o of opts) {
      expect(plannedStops(o.day).map((s) => s.placeId)).not.toContain(target.placeId);
      expect(o.day.stops.find((s) => s.id === target.id)?.status).toBe("closed");
      expectDoneUntouched(plan.days[D]!, o);
      expectFeasibleFrom(o, now);
    }
    // Uygulandıktan sonraki onarımlarda da geri gelmez
    const applied = applyRepair(plan, D, opts[0]!);
    const later = repairDay(applied, D, { type: "late", minutes: 20 }, { nowMin: now + 30 }, ctx);
    for (const o of later) expect(plannedStops(o.day).map((s) => s.placeId)).not.toContain(target.placeId);
  });

  it("90 dk gecikmede otele gün sonundan önce varılır", () => {
    const opts = repairDay(plan, D, { type: "late", minutes: 90 }, { nowMin: NOW }, ctx);
    expectWellFormed(opts);
    for (const o of opts) {
      expectDoneUntouched(plan.days[D]!, o);
      expectFeasibleFrom(o, NOW);
      const hotel = o.day.stops.find((s) => s.slot === "konaklama")!;
      expect(hotel.arriveMin).toBeLessThanOrEqual(o.day.endMin);
    }
    const shift = opts.find((o) => o.id.endsWith("kaydir"))!;
    expect(shift).toBeDefined();
    const fresh = freshPart(shift.day, NOW).stops.filter((s) => s.slot !== "konaklama");
    // Kaydırma seçeneği yeni yer eklemez
    const before = new Set(plan.days[D]!.stops.map((s) => s.placeId));
    for (const s of fresh) expect(before.has(s.placeId)).toBe(true);
  });

  it("yağmurda açık hava durakları yağmur saatinden çıkar", () => {
    const rain = { fromMin: 13 * 60, toMin: 18 * 60 };
    const opts = repairDay(plan, D, { type: "rain", ...rain }, { nowMin: NOW }, ctx);
    expectWellFormed(opts);
    const wet = (d: DayPlan) =>
      d.stops
        .filter((s) => s.status === "planned" && s.slot !== "konaklama" && s.arriveMin >= NOW)
        .filter((s) => !(index.get(s.placeId)!.indoor ?? CATEGORIES[index.get(s.placeId)!.cat].indoor))
        .reduce((a, s) => a + Math.max(0, Math.min(s.departMin, rain.toMin) - Math.max(s.arriveMin, rain.fromMin)), 0);
    expect(wet(opts[0]!.day)).toBeLessThanOrEqual(wet(plan.days[D]!));
    for (const o of opts) expectFeasibleFrom(o, NOW);
  });

  it("bütçe aşımında kalan gün pahalılaşmaz", () => {
    const opts = repairDay(plan, D, { type: "overBudget", overTry: 3000 }, { nowMin: NOW }, ctx);
    expectWellFormed(opts);
    const remaining = (d: DayPlan) => freshPart(d, NOW).stops.filter((s) => s.slot !== "konaklama").reduce((a, s) => a + s.estCost, 0);
    expect(remaining(opts[0]!.day)).toBeLessThanOrEqual(remaining(plan.days[D]!));
    for (const o of opts) expectFeasibleFrom(o, NOW);
  });

  it("kaçan öğle: pencere açıksa yeniden eklenir, kapandıysa sonraki öğün önerilir", () => {
    const open = repairDay(plan, D, { type: "missedMeal", slot: "ogle" }, { nowMin: 12 * 60 + 40 }, ctx);
    expectWellFormed(open);
    expect(plannedStops(open[0]!.day).some((s) => s.slot === "ogle" && s.arriveMin >= 12 * 60 + 40)).toBe(true);
    for (const o of open) expectFeasibleFrom(o, 12 * 60 + 40);

    const late = repairDay(plan, D, { type: "missedMeal", slot: "ogle" }, { nowMin: 15 * 60 + 30 }, ctx);
    expect(late.length).toBeGreaterThanOrEqual(2);
    for (const o of late) expectFeasibleFrom(o, 15 * 60 + 30, false);
    expect(
      late.some((o) =>
        plannedStops(o.day).some(
          (s) => (s.slot === "ogle" && s.arriveMin >= 15 * 60 + 30) || (s.slot === "aksam" && s.arriveMin < 19 * 60) || s.slot === "cay",
        ),
      ),
    ).toBe(true);
  });
});

describe("markStop / applyRepair", () => {
  it("yeni nesne döner, sürümü artırır, 'done' kilitler; girdiyi değiştirmez", () => {
    const snapshot: TripPlan = structuredClone(base);
    const marked = markStop(base, D, breakfast.id, "done");
    expect(base).toEqual(snapshot);
    expect(marked).not.toBe(base);
    expect(marked.version).toBe(base.version + 1);
    const s = marked.days[D]!.stops.find((x) => x.id === breakfast.id)!;
    expect(s.status).toBe("done");
    expect(s.locked).toBe(true);
    expect(marked.days[0]).toBe(base.days[0]);

    const skipped = markStop(marked, D, breakfast.id, "skipped");
    expect(skipped.days[D]!.stops.find((x) => x.id === breakfast.id)!.locked).toBeUndefined();

    const before: TripPlan = structuredClone(plan);
    const opts = repairDay(plan, D, { type: "skip", stopId: lunch.id }, { nowMin: NOW }, ctx);
    expect(plan).toEqual(before);
    const applied = applyRepair(plan, D, opts[0]!);
    expect(plan).toEqual(before);
    expect(applied.version).toBe(plan.version + 1);
    expect(applied.days[D]).toBe(opts[0]!.day);
    expect(applied.estTotal).toBe(applied.days.reduce((a, d) => a + d.estCost, 0));
  });

  it("deterministik onarım", () => {
    const a = repairDay(plan, D, { type: "skip", stopId: lunch.id }, { nowMin: NOW }, ctx);
    const b = repairDay(plan, D, { type: "skip", stopId: lunch.id }, { nowMin: NOW }, ctx);
    expect(b).toEqual(a);
  });
});
