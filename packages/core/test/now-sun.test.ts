import { describe, expect, it } from "vitest";
import { CATEGORIES, buildPlaceIndex, createTravelModel, fromTrWallClock } from "../src";
import type { DayPlan, PlanContext, TripPlan, WeatherDay } from "../src";
import { nowInputFromTrip, suggestNow } from "../src/now";
import type { NowInput } from "../src/now";
import { clockWithSuffix, goldenHourSpot, isViewSpot, placeLocative, placeWithCase, sunLine, sunTimes } from "../src/sun";
import { EGE_REQUEST, PLACES, SELCUK } from "./fixtures";

const index = buildPlaceIndex(PLACES);
const ctx: PlanContext = { index, travel: createTravelModel("araba"), seed: 1 };
const DATE = "2026-10-28"; // çarşamba
const byId = (id: string) => PLACES.find((p) => p.id === id)!;
const isIndoor = (id: string) => byId(id).indoor ?? CATEGORIES[byId(id).cat].indoor;

function nowInput(over: Partial<NowInput> = {}): NowInput {
  return {
    position: SELCUK.loc,
    date: DATE,
    nowMin: 16 * 60 + 30,
    hotel: { name: "Selçuk Otel (test)", loc: byId("fx:otel-selcuk").loc },
    endMin: 22 * 60,
    interests: ["tarih", "yemek"],
    travelers: 2,
    visitor: "yerli",
    diet: {},
    ...over,
  };
}

function rainyDay(windows: Array<[number, number]>): WeatherDay {
  return {
    date: DATE,
    tMinC: 12,
    tMaxC: 18,
    hourlyPrecipProb: new Array(24).fill(80),
    hourlyTempC: new Array(24).fill(15),
    weatherCode: 63,
    summary: "Yağmurlu, 12–18°C",
    rainWindows: windows,
  };
}

describe("sunTimes / sunLine", () => {
  it("Selçuk'ta ekim sonu gün doğumu ~07:32, batımı ~18:16 (Türkiye saati)", () => {
    const s = sunTimes(SELCUK.loc, DATE);
    expect(s.sunriseMin).toBeGreaterThanOrEqual(7 * 60 + 25);
    expect(s.sunriseMin).toBeLessThanOrEqual(7 * 60 + 40);
    expect(s.sunsetMin).toBeGreaterThanOrEqual(18 * 60 + 8);
    expect(s.sunsetMin).toBeLessThanOrEqual(18 * 60 + 24);
    expect(s.goldenEvening).toEqual([s.sunsetMin - 50, s.sunsetMin]);
    expect(s.goldenMorning).toEqual([s.sunriseMin, s.sunriseMin + 50]);
    expect(sunTimes(SELCUK.loc, "2026-06-21").sunsetMin).toBeGreaterThan(20 * 60 + 15);
    expect(sunLine(SELCUK.loc, DATE)).toMatch(/^Gün doğumu 07:\d\d · batımı 18:\d\d$/);
  });

  it("saat ve yer adlarına doğru Türkçe ek", () => {
    expect(clockWithSuffix(17 * 60 + 30, "e")).toBe("17:30'a");
    expect(clockWithSuffix(18 * 60, "de")).toBe("18:00'de");
    expect(clockWithSuffix(17 * 60 + 40, "de")).toBe("17:40'ta");
    expect(clockWithSuffix(16 * 60, "e")).toBe("16:00'ya");
    expect(clockWithSuffix(15 * 60, "den")).toBe("15:00'ten");
    expect(placeWithCase("Selçuk", "den")).toBe("Selçuk'tan");
    expect(placeWithCase("Pamukkale", "e")).toBe("Pamukkale'ye");
    expect(placeLocative("Ayasuluk Kalesi")).toBe("Ayasuluk Kalesi'nde");
    expect(placeLocative("Topkapı Sarayı")).toBe("Topkapı Sarayı'nda");
    expect(placeLocative("Kapalıçarşı")).toBeNull();
  });
});

describe("goldenHourSpot", () => {
  it("gün batımında açık bir manzara noktası ve Türkçe satır önerir", () => {
    const spot = goldenHourSpot(null, SELCUK.loc, index, DATE);
    expect(spot).not.toBeNull();
    expect(isViewSpot(spot!.place)).toBe(true);
    expect(spot!.arriveMin).toBeLessThan(spot!.sun.sunsetMin);
    expect(spot!.leaveMin).toBe(spot!.arriveMin - spot!.travelMin);
    expect(spot!.line).toMatch(/^Gün batımı 18:\d\d — .+ (ol|orada ol) \(\d+ dk (yürüme|araçla)\)/);
  });

  it("konum şimdiden sonra yola çıkılabilen yeri seçer", () => {
    const sunset = sunTimes(SELCUK.loc, DATE).sunsetMin;
    const spot = goldenHourSpot(null, SELCUK.loc, index, DATE, { nowMin: sunset - 40 });
    if (spot) expect(spot.leaveMin).toBeGreaterThanOrEqual(sunset - 40);
  });
});

describe("suggestNow", () => {
  const distinctPlaces = (list: ReturnType<typeof suggestNow>) => {
    const ids = list.flatMap((s) => s.stops.map((x) => x.placeId));
    return new Set(ids).size === ids.length;
  };

  it("öğle vaktinde ilk öneri yemek; en fazla 3, yerler tekrar etmez, deterministik", () => {
    const input = nowInput({ nowMin: 12 * 60 + 30 });
    const list = suggestNow(input, ctx);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.length).toBeLessThanOrEqual(3);
    expect(list[0]!.kind).toBe("yemek");
    expect(list[0]!.title).toMatch(/^Acıktıysan: /);
    expect(distinctPlaces(list)).toBe(true);
    for (const s of list) {
      expect(s.stops.length).toBeGreaterThanOrEqual(1);
      expect(s.stops.length).toBeLessThanOrEqual(3);
      for (const st of s.stops) expect(st.arriveMin).toBeGreaterThanOrEqual(input.nowMin);
      expect(s.totalCostTry).toBe(s.stops.reduce((a, x) => a + x.costTry, 0));
    }
    expect(suggestNow(input, ctx).map((s) => s.id)).toEqual(list.map((s) => s.id));
  });

  it("öğleden sonra kapanmak üzere olan yeri öne çıkarır", () => {
    const list = suggestNow(nowInput({ nowMin: 16 * 60 + 30 }), ctx);
    const closing = list.find((s) => s.kind === "kapanmadan");
    expect(closing).toBeDefined();
    expect(closing!.title).toMatch(/^Kapanmadan yetiş: /);
    expect(closing!.subtitle).toMatch(/\d\d:\d\d'(a|e|ya|ye) kadar açık/);
  });

  it("yağmurda kapalı alan önerisi verir; hariç tutulan yer önerilmez", () => {
    const exclude = new Set(["fx:efes-muze"]);
    const list = suggestNow(nowInput({ nowMin: 14 * 60, weather: rainyDay([[12 * 60, 20 * 60]]), excludePlaceIds: exclude }), ctx);
    const rain = list.find((s) => s.kind === "yagmur");
    expect(rain).toBeDefined();
    expect(isIndoor(rain!.stops[0]!.placeId)).toBe(true);
    expect(list.some((s) => s.stops.some((x) => exclude.has(x.placeId)))).toBe(false);
  });

  it("bütçe bittiyse yemek dışı önerilerde ücretli yer yok", () => {
    const list = suggestNow(nowInput({ nowMin: 16 * 60, remainingBudgetTry: 0 }), ctx);
    for (const s of list) {
      if (s.kind === "yemek" || s.kind === "mini_rota") continue;
      for (const st of s.stops) expect(st.costTry).toBe(0);
    }
  });

  it("boş bölgede boş liste döner, hata atmaz", () => {
    const empty: PlanContext = { index: buildPlaceIndex([]), travel: createTravelModel("araba") };
    expect(suggestNow(nowInput(), empty)).toEqual([]);
  });
});

describe("nowInputFromTrip", () => {
  it("bugünün saatini, gece üssünü ve hariç tutulacak yerleri plandan çıkarır", () => {
    const stop = (placeId: string, status: "planned" | "done") => ({
      id: `s-${placeId}`,
      placeId,
      slot: "gezi" as const,
      arriveMin: 600,
      departMin: 660,
      travelMin: 10,
      travelKm: 2,
      estCost: 0,
      reasons: [],
      status,
    });
    const day = (index: number, date: string, stops: DayPlan["stops"]): DayPlan => ({
      index,
      date,
      from: SELCUK,
      to: SELCUK,
      isTravelDay: false,
      startMin: 510,
      endMin: 1320,
      stops,
      alternatives: {},
      estCost: 0,
      warnings: [],
    });
    const plan: TripPlan = {
      id: "t",
      createdAt: "2026-10-24T00:00:00Z",
      packId: "test",
      request: EGE_REQUEST,
      days: [day(0, "2026-10-27", [stop("fx:efes", "done")]), day(1, DATE, [stop("fx:artemis", "done"), stop("fx:ayasuluk", "planned")]), day(2, "2026-10-29", [stop("fx:hierapolis", "planned")])],
      estTotal: 0,
      version: 1,
    };
    const input = nowInputFromTrip(plan, 1, SELCUK.loc, fromTrWallClock(DATE, 15 * 60 + 5));
    expect(input.date).toBe(DATE);
    expect(input.nowMin).toBe(15 * 60 + 5);
    expect(input.hotel).toEqual(SELCUK);
    expect(input.endMin).toBe(22 * 60);
    expect([...input.excludePlaceIds!].sort()).toEqual(["fx:artemis", "fx:efes", "fx:hierapolis"]);
  });
});
