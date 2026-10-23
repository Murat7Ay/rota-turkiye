import { describe, expect, it } from "vitest";
import {
  availableWindows,
  buildPlaceIndex,
  calendarWarnings,
  estimateLeg,
  estimatePlaceCost,
  formatHHmm,
  fromTrWallClock,
  indexPrice,
  isOpenAt,
  prayerTimes,
  projectOnLine,
  toTrWallClock,
  weekdayOf,
} from "../src";
import { PLACES, ROUTE_SELCUK_PAMUKKALE, SELCUK } from "./fixtures";

const byId = (id: string) => PLACES.find((p) => p.id === id)!;

describe("temel", () => {
  it("Türkiye duvar saati cihaz saat diliminden bağımsız", () => {
    const d = fromTrWallClock("2026-10-27", 9 * 60 + 15);
    expect(d.toISOString()).toBe("2026-10-27T06:15:00.000Z");
    expect(toTrWallClock(d)).toEqual({ date: "2026-10-27", min: 555, weekday: 2 });
    expect(formatHHmm(1500)).toBe("01:00");
    expect(weekdayOf("2026-10-27")).toBe(2);
  });

  it("Topkapı salı kapalı, çarşamba açık", () => {
    expect(availableWindows(byId("fx:topkapi"), "2026-10-27")).toEqual([]);
    expect(isOpenAt(byId("fx:topkapi"), "2026-10-28", 10 * 60)).toBe(true);
  });

  it("Kapalıçarşı pazar ve Kurban Bayramı'nın ilk günü kapalı", () => {
    expect(availableWindows(byId("fx:kapalicarsi"), "2026-11-01")).toEqual([]);
    expect(availableWindows(byId("fx:kapalicarsi"), "2027-05-16")).toEqual([]);
    expect(isOpenAt(byId("fx:kapalicarsi"), "2026-10-31", 12 * 60)).toBe(true);
  });

  it("Cami namaz vakitlerinde, cuma öğle uzun süre kapalı", () => {
    const t = prayerTimes(SELCUK.loc, "2026-10-30");
    expect(t.dhuhr).toBeGreaterThan(11 * 60);
    expect(t.dhuhr).toBeLessThan(13 * 60 + 30);
    const cami = byId("fx:isabey");
    expect(isOpenAt(cami, "2026-10-30", t.dhuhr + 20)).toBe(false);
    expect(isOpenAt(cami, "2026-10-30", 10 * 60)).toBe(true);
    expect(calendarWarnings("2026-10-30").join(" ")).toMatch(/cuma/i);
  });

  it("Pazar yeri sadece cumartesi kurulur; veri yoksa planlanmaz", () => {
    expect(availableWindows(byId("fx:pazar"), "2026-10-31").length).toBe(1);
    expect(availableWindows(byId("fx:pazar"), "2026-10-27")).toEqual([]);
    expect(availableWindows({ ...byId("fx:pazar"), openingHours: undefined }, "2026-10-31")).toEqual([]);
  });

  it("Koridor sorgusu rota yakınındakileri bulur, Afrodisias'ı (40 km güneyde) dışarıda bırakır", () => {
    const idx = buildPlaceIndex(PLACES);
    const ids = idx.nearLine(ROUTE_SELCUK_PAMUKKALE, 6).map((r) => r.place.id);
    expect(ids).toContain("fx:nysa");
    expect(ids).toContain("fx:aydin-tatli");
    expect(ids).not.toContain("fx:afrodisias");
    expect(projectOnLine(byId("fx:nysa").loc, ROUTE_SELCUK_PAMUKKALE).distanceKm).toBeLessThan(3);
    expect(idx.near(SELCUK.loc, 1).map((p) => p.id)).toContain("fx:esnaf1");
  });

  it("Yol süresi tahmini makul", () => {
    const leg = estimateLeg(SELCUK.loc, { lat: 37.9204, lon: 29.1206 }, "araba");
    expect(leg.km).toBeGreaterThan(180);
    expect(leg.min).toBeGreaterThan(120);
    expect(leg.min).toBeLessThan(240);
  });

  it("Fiyatlar endekslenir, Müzekart sahibine müze ücretsiz, yabancıya avro bilet", () => {
    const lokanta = byId("fx:esnaf1");
    const c = estimatePlaceCost(lokanta, { travelers: 2, visitor: "yerli", date: "2026-10-15" });
    expect(c.amountTry).toBeGreaterThan(1050 * 1.1);
    expect(c.kind).toBe("observed");
    expect(estimatePlaceCost(byId("fx:efes"), { travelers: 2, visitor: "yerli", hasMuzekart: true, date: "2026-10-27" }).kind).toBe("free");
    const foreign = estimatePlaceCost(byId("fx:efes"), { travelers: 1, visitor: "yabanci", date: "2026-10-27" });
    expect(foreign.amountTry).toBeCloseTo(40 * 55.5997, 0);
    expect(indexPrice({ amount: 100, currency: "TRY", perPerson: true, observedAt: "2026-01-01", source: "x", kind: "observed" }, "2027-01-01")).toBeGreaterThan(120);
  });
});
