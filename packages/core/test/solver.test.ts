import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  buildPlaceIndex,
  createTravelModel,
  planDay,
  prayerTimes,
  scorePlace,
  weekdayOf,
} from "../src";
import type { DayInput, DayPlan, Place, PlaceCategory, PlanContext, PlaceTag } from "../src";
import { expectDayConsistent } from "./assertions";
import { PLACES, ROUTE_SELCUK_PAMUKKALE } from "./fixtures";

const byId = (id: string) => PLACES.find((p) => p.id === id)!;
const index = buildPlaceIndex(PLACES);
const travel = createTravelModel("araba");
const ctx: PlanContext = { index, travel, seed: 1 };

const point = (id: string) => ({ name: byId(id).name, loc: byId(id).loc });
const SELCUK_OTEL = point("fx:otel-selcuk");
const IST_OTEL = point("fx:otel-ist");
const PK_OTEL = point("fx:otel-pk");

function selcukDay(over: Partial<DayInput> = {}): DayInput {
  return {
    index: 1,
    date: "2026-10-28",
    from: SELCUK_OTEL,
    to: SELCUK_OTEL,
    stayId: "selcuk",
    hotelPlaceId: "fx:otel-selcuk",
    startMin: 8 * 60 + 30,
    endMin: 22 * 60,
    pace: "dengeli",
    interests: ["tarih", "yemek"],
    travelers: 2,
    visitor: "yerli",
    diet: {},
    dailyBudgetTry: 6000,
    ...over,
  };
}

const istDay = (date: string, over: Partial<DayInput> = {}) =>
  planDay(selcukDay({ date, from: IST_OTEL, to: IST_OTEL, stayId: "ist", hotelPlaceId: "fx:otel-ist", ...over }), ctx);

const ids = (day: DayPlan) => day.stops.map((s) => s.placeId);
const altIds = (day: DayPlan) => Object.values(day.alternatives).flat();
const slotsOf = (day: DayPlan) => day.stops.map((s) => s.slot);

describe("scorePlace", () => {
  it("kontrol edilebilir Türkçe gerekçeler üretir", () => {
    const efes = scorePlace(byId("fx:efes"), selcukDay());
    expect(efes.reasons).toContain("UNESCO Dünya Mirası");
    expect(efes.reasons).toContain("Müzekart geçerli");
    const esnaf = scorePlace(byId("fx:esnaf1"), selcukDay());
    expect(esnaf.reasons).toContain("Yerel esnaf lokantası");
    expect(efes.utility).toBeGreaterThan(scorePlace(byId("fx:kahvehane"), selcukDay()).utility);
  });

  it("bütçe baskısı pahalı yerin faydasını düşürür", () => {
    const rest = byId("fx:rest1");
    expect(scorePlace(rest, selcukDay({ budgetPressure: 1 })).utility).toBeLessThan(scorePlace(rest, selcukDay()).utility - 1);
  });

  it("yağmurda kapalı alan öne çıkar, rota üstü işaretlenir", () => {
    const muze = scorePlace(byId("fx:efes-muze"), selcukDay({ rainWindows: [[600, 900]] }));
    expect(muze.reasons).toContain("Kapalı alan — yağmura uygun");
    const nysa = scorePlace(byId("fx:nysa"), selcukDay({ route: ROUTE_SELCUK_PAMUKKALE }));
    expect(nysa.reasons).toContain("Rota üstünde");
  });
});

describe("planDay", () => {
  it("Selçuk günü: üç öğün, tutarlı saatler, gün otelde biter", () => {
    const day = planDay(selcukDay(), ctx);
    const slots = slotsOf(day);
    expect(slots).toContain("kahvalti");
    expect(slots).toContain("ogle");
    expect(slots).toContain("aksam");
    expect(slots.filter((s) => s === "gezi").length).toBeGreaterThan(0);
    expect(slots.filter((s) => s === "gezi").length).toBeLessThanOrEqual(4);
    expect(day.stops[day.stops.length - 1]!.slot).toBe("konaklama");
    expect(day.stops[day.stops.length - 1]!.placeId).toBe("fx:otel-selcuk");
    expectDayConsistent(day, index, travel);
    expect(new Set(ids(day)).size).toBe(day.stops.length);
    for (const s of day.stops) {
      expect(s.status).toBe("planned");
      expect(s.reasons.length).toBeGreaterThan(0);
    }
    const lunch = day.stops.find((s) => s.slot === "ogle")!;
    expect(day.alternatives[lunch.id]!.length).toBeGreaterThan(0);
    expect(day.alternatives[lunch.id]).not.toContain(lunch.placeId);
    // Konaklama + yemek + giriş + yakıt
    const hotel = day.stops.find((s) => s.slot === "konaklama")!;
    expect(hotel.estCost).toBeGreaterThan(3000);
    expect(day.estCost).toBeGreaterThanOrEqual(day.stops.reduce((a, s) => a + s.estCost, 0));
    expect(day.isTravelDay).toBe(false);
    expect(day.route).toBeUndefined();
  });

  it("gün 11:00'de başlarsa kahvaltı atlanır, öğle ve akşam yine planlanır", () => {
    const day = planDay(selcukDay({ startMin: 11 * 60 }), ctx);
    const slots = slotsOf(day);
    expect(slots).not.toContain("kahvalti");
    expect(slots).toContain("ogle");
    expect(slots).toContain("aksam");
    expectDayConsistent(day, index, travel);
  });

  it("Topkapı Sarayı salı (2026-10-27) planlanmaz, çarşamba planlanabilir", () => {
    const tue = istDay("2026-10-27");
    expect(ids(tue)).not.toContain("fx:topkapi");
    expect(altIds(tue)).not.toContain("fx:topkapi");
    expectDayConsistent(tue, index, travel);
    const wed = istDay("2026-10-28");
    expect(ids(wed)).toContain("fx:topkapi");
    expectDayConsistent(wed, index, travel);
    for (const day of [tue, wed]) {
      expect(slotsOf(day)).toContain("ogle");
      expect(slotsOf(day)).toContain("aksam");
    }
  });

  it("cuma namazı sırasında cami ziyareti yok", () => {
    for (const day of [istDay("2026-10-30"), planDay(selcukDay({ date: "2026-10-30" }), ctx)]) {
      expect(weekdayOf(day.date)).toBe(5);
      expect(day.warnings.join(" ")).toMatch(/Cuma/);
      expectDayConsistent(day, index, travel);
      for (const s of day.stops) {
        const p = index.get(s.placeId)!;
        if (p.cat !== "cami") continue;
        const { dhuhr } = prayerTimes(p.loc, day.date);
        const overlaps = s.arriveMin < dhuhr + 60 && s.departMin > dhuhr - 45;
        expect(overlaps, `${p.name} ${s.arriveMin}-${s.departMin}`).toBe(false);
      }
    }
  });

  it("alkolsüz tercihte meyhane ve alkollü yerler hiç önerilmez", () => {
    const plain = planDay(selcukDay(), ctx);
    const alcoholic = (id: string) => {
      const p = index.get(id)!;
      return p.alcohol === true || p.cat === "meyhane";
    };
    // Kısıt yokken alkollü yerler en azından aday
    expect([...ids(plain), ...altIds(plain)].some(alcoholic)).toBe(true);
    const day = planDay(selcukDay({ diet: { noAlcohol: true } }), ctx);
    expect([...ids(day), ...altIds(day)].some(alcoholic)).toBe(false);
    expect(slotsOf(day)).toContain("aksam");
    expectDayConsistent(day, index, travel);
  });

  it("semt pazarı yalnızca cumartesi planlanır", () => {
    for (const date of ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]) {
      const day = planDay(selcukDay({ date, interests: ["alisveris", "yemek", "tarih"] }), ctx);
      const seen = [...ids(day), ...altIds(day)].includes("fx:pazar");
      expect(seen, date).toBe(weekdayOf(date) === 6);
      expectDayConsistent(day, index, travel);
    }
  });

  it("yol günü Selçuk→Pamukkale: koridordaki yerler, Afrodisias asla", () => {
    const input = selcukDay({
      index: 2,
      date: "2026-10-29",
      to: PK_OTEL,
      stayId: "pamukkale",
      hotelPlaceId: "fx:otel-pk",
      interests: ["tarih", "tatli"],
      route: ROUTE_SELCUK_PAMUKKALE,
    });
    const day = planDay(input, ctx);
    expect(day.isTravelDay).toBe(true);
    expect(day.route).toEqual(ROUTE_SELCUK_PAMUKKALE);
    const all = ids(day);
    expect(all.some((id) => id === "fx:nysa" || id === "fx:aydin-tatli")).toBe(true);
    expect(all).not.toContain("fx:afrodisias");
    expect(altIds(day)).not.toContain("fx:afrodisias");
    const corridor = day.stops.find((s) => s.placeId === "fx:nysa" || s.placeId === "fx:aydin-tatli")!;
    expect(corridor.reasons).toContain("Rota üstünde");
    expect(corridor.discovered).toBe(true);
    expect(day.stops[day.stops.length - 1]!.placeId).toBe("fx:otel-pk");
    expectDayConsistent(day, index, travel);
  });

  it("yüksek bütçe baskısı daha ucuz akşam yemeği seçer", () => {
    const extra: Place[] = [
      { id: "t:fine", name: "Ege Mutfağı (test)", cat: "restoran", loc: { lat: 37.9516, lon: 27.3675 }, slots: ["aksam"], visitMin: 90, notability: 0.8, quality: 0.95, tags: ["michelin"], priceTier: 4, source: "curated" },
      { id: "t:pide", name: "Mahalle Pidecisi (test)", cat: "pideci", loc: { lat: 37.95, lon: 27.369 }, slots: ["ogle", "aksam"], visitMin: 50, notability: 0.2, quality: 0.6, tags: [], priceTier: 1, source: "curated" },
    ];
    const ctx2: PlanContext = { index: buildPlaceIndex([...PLACES, ...extra]), travel, seed: 1 };
    const relaxed = planDay(selcukDay({ budgetPressure: 0 }), ctx2);
    const tight = planDay(selcukDay({ budgetPressure: 1 }), ctx2);
    const dinner = (d: DayPlan) => d.stops.find((s) => s.slot === "aksam")!;
    expect(dinner(relaxed).placeId).toBe("t:fine");
    expect(dinner(tight).estCost).toBeLessThan(dinner(relaxed).estCost);
    expect(tight.estCost).toBeLessThan(relaxed.estCost);
  });

  it("vejetaryen tercihinde vejetaryen dostu yer seçilir", () => {
    const veg: Place = { id: "t:veg", name: "Zeytinyağlı Ev Yemekleri (test)", cat: "restoran", loc: { lat: 37.9508, lon: 27.3694 }, slots: ["ogle", "aksam"], visitMin: 60, notability: 0.3, quality: 0.7, tags: [], vegFriendly: true, source: "curated" };
    const ctx2: PlanContext = { index: buildPlaceIndex([...PLACES, veg]), travel, seed: 1 };
    const day = planDay(selcukDay({ diet: { vegetarian: true } }), ctx2);
    const stop = day.stops.find((s) => s.placeId === "t:veg");
    expect(stop).toBeDefined();
    expect(stop!.reasons).toContain("Vejetaryen seçenekli");
  });

  it("yağmur saatlerinde açık hava durakları azalır", () => {
    const rain: [number, number] = [9 * 60, 17 * 60];
    const outdoorRain = (d: DayPlan) =>
      d.stops
        .filter((s) => s.slot === "gezi")
        .filter((s) => !(index.get(s.placeId)!.indoor ?? CATEGORIES[index.get(s.placeId)!.cat].indoor))
        .reduce((a, s) => a + Math.max(0, Math.min(s.departMin, rain[1]) - Math.max(s.arriveMin, rain[0])), 0);
    const dry = planDay(selcukDay(), ctx);
    const wet = planDay(selcukDay({ rainWindows: [rain] }), ctx);
    expect(outdoorRain(dry)).toBeGreaterThan(0);
    expect(outdoorRain(wet)).toBeLessThan(outdoorRain(dry));
    expectDayConsistent(wet, index, travel);
  });

  it("kilitli duraklar aynen korunur, çözüm onlardan sonra başlar", () => {
    const first = planDay(selcukDay(), ctx);
    const breakfast = { ...first.stops.find((s) => s.slot === "kahvalti")!, status: "done" as const, locked: true };
    const day = planDay(selcukDay({ locked: [breakfast], startMin: 11 * 60 }), ctx);
    expect(day.stops[0]).toEqual(breakfast);
    expect(slotsOf(day).filter((s) => s === "kahvalti").length).toBe(1);
    for (const s of day.stops.slice(1)) expect(s.arriveMin).toBeGreaterThanOrEqual(11 * 60);
  });

  it("deterministik: aynı girdi + tohum aynı plan", () => {
    const a = planDay(selcukDay({ interests: ["tarih", "tatli", "alisveris"] }), { ...ctx, seed: 7 });
    const b = planDay(selcukDay({ interests: ["tarih", "tatli", "alisveris"] }), { ...ctx, seed: 7 });
    expect(b).toEqual(a);
  });

  it("~2.000 adaylı bölgede planDay 300 ms'nin altında", () => {
    const places = synthPlaces(2000, { lat: 39.925, lon: 32.85 }, 11);
    const idx = buildPlaceIndex(places);
    const synthCtx: PlanContext = { index: idx, travel, seed: 3 };
    const center = { name: "Merkez", loc: { lat: 39.925, lon: 32.85 } };
    const input = (date: string) =>
      selcukDay({ date, from: center, to: center, hotelPlaceId: undefined, stayId: "ankara", interests: ["tarih", "yemek", "tatli"] });
    planDay(input("2026-11-03"), synthCtx); // JIT ısınması
    const t0 = performance.now();
    const day = planDay(input("2026-11-04"), synthCtx);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(300);
    expect(slotsOf(day)).toContain("ogle");
    expect(slotsOf(day)).toContain("aksam");
    expectDayConsistent(day, idx, travel);
  });
});

function synthPlaces(n: number, c: { lat: number; lon: number }, seed: number): Place[] {
  let a = seed;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  const cats: PlaceCategory[] = [
    "muze", "antik_kent", "tarihi_yapi", "cami", "manzara", "dogal_alan", "kahvalti", "esnaf_lokantasi", "restoran",
    "kebapci", "pideci", "balikci", "kafe", "cay_bahcesi", "kahvehane", "tatlici", "firin", "carsi", "yoresel_urun", "hediyelik", "otel",
  ];
  const hours = [undefined, undefined, "Mo-Su 09:00-18:00", "Tu-Su 10:00-19:00", "Mo-Sa 08:00-22:00", "Mo-Fr 09:00-17:00; Sa 10:00-14:00"];
  const tagPool: PlaceTag[] = ["tarihi", "yerel", "unesco", "wikidata", "muzekart", "manzara"];
  const out: Place[] = [];
  for (let i = 0; i < n; i++) {
    const cat = cats[i % cats.length]!;
    const tags = tagPool.filter(() => rnd() < 0.12);
    out.push({
      id: `syn:${i}`,
      name: `Yer ${i}`,
      cat,
      loc: { lat: c.lat + (rnd() - 0.5) * 0.14, lon: c.lon + (rnd() - 0.5) * 0.18 },
      slots: CATEGORIES[cat].slots,
      visitMin: CATEGORIES[cat].visitMin,
      openingHours: hours[Math.floor(rnd() * hours.length)],
      notability: rnd(),
      quality: rnd() < 0.7 ? rnd() : undefined,
      tags,
      source: "osm",
    });
  }
  return out;
}

