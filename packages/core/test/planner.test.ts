import { describe, expect, it } from "vitest";
import {
  buildPlaceIndex,
  chooseHotel,
  createTravelModel,
  planTrip,
  planTripWithRoutes,
  routeKey,
  straightLine,
} from "../src";
import type { PlanContext, TripPlan, TripRequest } from "../src";
import { expectDayConsistent } from "./assertions";
import { EGE_REQUEST, IZMIR, MINI_PACK, PLACES, ROUTE_SELCUK_PAMUKKALE } from "./fixtures";

const index = buildPlaceIndex(MINI_PACK.places);
const travel = createTravelModel("araba");
const ctx: PlanContext = { index, travel, seed: 1 };
const FIXED = { id: "test-plan", now: new Date("2026-10-24T09:00:00Z") };
const byId = (id: string) => PLACES.find((p) => p.id === id)!;

const nonHotel = (plan: TripPlan) => plan.days.flatMap((d) => d.stops.filter((s) => s.slot !== "konaklama"));

describe("chooseHotel", () => {
  it("üs çevresindeki en uygun konaklamayı seçer; yakında yoksa undefined", () => {
    expect(chooseHotel(EGE_REQUEST.stays[0]!, EGE_REQUEST, ctx)?.id).toBe("fx:otel-selcuk");
    expect(chooseHotel(EGE_REQUEST.stays[1]!, EGE_REQUEST, ctx)?.id).toBe("fx:otel-pk");
    expect(chooseHotel({ id: "bos", name: "Boş", loc: { lat: 39.5, lon: 31 }, nights: 1 }, EGE_REQUEST, ctx)).toBeUndefined();
  });

  it("çok düşük bütçede pahalı olmayanı tercih eder", () => {
    const cheap = { ...byId("fx:pansiyon-sirince"), id: "t:ucuz", loc: { lat: 37.951, lon: 27.369 }, quality: 0.6 };
    const lux = { ...byId("fx:otel-selcuk"), id: "t:lux", cat: "butik_otel" as const, loc: { lat: 37.9508, lon: 27.3682 }, quality: 0.95 };
    const c2: PlanContext = { index: buildPlaceIndex([cheap, lux]), travel };
    const poor: TripRequest = { ...EGE_REQUEST, budget: { amount: 9000, currency: "TRY" } };
    expect(chooseHotel(EGE_REQUEST.stays[0]!, poor, c2)?.id).toBe("t:ucuz");
    const rich: TripRequest = { ...EGE_REQUEST, budget: { amount: 200000, currency: "TRY" } };
    expect(chooseHotel(EGE_REQUEST.stays[0]!, rich, c2)?.id).toBe("t:lux");
  });
});

describe("planTrip", () => {
  const plan = planTrip(EGE_REQUEST, MINI_PACK, ctx, FIXED);

  it("günleri, tarihleri ve otel zincirini kurar", () => {
    expect(plan.id).toBe("test-plan");
    expect(plan.createdAt).toBe("2026-10-24T09:00:00.000Z");
    expect(plan.version).toBe(1);
    expect(plan.packId).toBe("test");
    expect(plan.days.map((d) => d.date)).toEqual(["2026-10-27", "2026-10-28", "2026-10-29"]);
    expect(plan.days.map((d) => d.hotelPlaceId)).toEqual(["fx:otel-selcuk", "fx:otel-selcuk", "fx:otel-pk"]);
    expect(plan.days.map((d) => d.stayId)).toEqual(["selcuk", "selcuk", "pamukkale"]);
    expect(plan.days.map((d) => d.isTravelDay)).toEqual([true, false, true]);
    expect(plan.days[0]!.from).toEqual(IZMIR);
    expect(plan.days[1]!.from).toEqual(plan.days[0]!.to);
    expect(plan.days[2]!.from).toEqual(plan.days[1]!.to);
    expect(plan.days[2]!.to.loc).toEqual(byId("fx:otel-pk").loc);
    expect(plan.days[2]!.route).toEqual(straightLine([plan.days[2]!.from.loc, plan.days[2]!.to.loc]));
    expect(plan.days[1]!.route).toBeUndefined();
    expect(plan.estTotal).toBe(plan.days.reduce((a, d) => a + d.estCost, 0));
    for (const d of plan.days) {
      expect(d.startMin).toBe(8 * 60 + 30);
      expect(d.endMin).toBe(22 * 60);
      expectDayConsistent(d, index, travel);
    }
  });

  it("aynı yer iki günde tekrar etmez", () => {
    const placeIds = nonHotel(plan).map((s) => s.placeId);
    expect(new Set(placeIds).size).toBe(placeIds.length);
    const stopIds = plan.days.flatMap((d) => d.stops.map((s) => s.id));
    expect(new Set(stopIds).size).toBe(stopIds.length);
  });

  it("uygun aday varken öğünler dolu, öğle hiç boş kalmaz", () => {
    for (const d of plan.days) {
      const slots = d.stops.map((s) => s.slot);
      expect(slots, d.date).toContain("ogle");
      expect(slots, d.date).toContain("aksam");
    }
    // Selçuk'taki iki kahvaltı yeri ilk iki güne yeter; 3. gün Selçuk'ta kahvaltıcı kalmaz
    expect(plan.days[0]!.stops.map((s) => s.slot)).toContain("kahvalti");
    expect(plan.days[1]!.stops.map((s) => s.slot)).toContain("kahvalti");
  });

  it("deterministik", () => {
    expect(planTrip(EGE_REQUEST, MINI_PACK, ctx, FIXED)).toEqual(plan);
  });

  it("alkolsüz tercih bütün gezi boyunca geçerli", () => {
    const dry = planTrip({ ...EGE_REQUEST, diet: { noAlcohol: true } }, MINI_PACK, ctx, FIXED);
    for (const d of dry.days) {
      for (const id of [...d.stops.map((s) => s.placeId), ...Object.values(d.alternatives).flat()]) {
        const p = index.get(id)!;
        expect(p.alcohol === true || p.cat === "meyhane", p.name).toBe(false);
      }
    }
  });

  it("verilen rota koridoru kullanılır; bitiş noktası bir gün ekler", () => {
    const pkKey = routeKey(byId("fx:otel-selcuk").loc, byId("fx:otel-pk").loc);
    const withEnd: TripRequest = { ...EGE_REQUEST, interests: ["tarih", "tatli"], end: { name: "Denizli Havalimanı", loc: { lat: 37.7856, lon: 29.7013 } } };
    const p = planTrip(withEnd, MINI_PACK, ctx, { ...FIXED, routes: { [pkKey]: ROUTE_SELCUK_PAMUKKALE } });
    expect(p.days.length).toBe(4);
    expect(p.days[2]!.route).toEqual(ROUTE_SELCUK_PAMUKKALE);
    expect(p.days[3]!.hotelPlaceId).toBeUndefined();
    expect(p.days[3]!.stayId).toBeUndefined();
    expect(p.days[3]!.to.name).toBe("Denizli Havalimanı");
    expect(p.days[3]!.stops.some((s) => s.slot === "konaklama")).toBe(false);
    const placeIds = nonHotel(p).map((s) => s.placeId);
    expect(placeIds).not.toContain("fx:afrodisias");
    expect(new Set(placeIds).size).toBe(placeIds.length);
    for (const d of p.days) expectDayConsistent(d, index, travel);
  });
});

describe("planTripWithRoutes", () => {
  it("OSRM yanıt vermezse düz çizgiye düşer", async () => {
    const calls: string[] = [];
    const failing = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response("hata", { status: 500 });
    }) as typeof fetch;
    const p = await planTripWithRoutes(EGE_REQUEST, MINI_PACK, ctx, "http://osrm.test", failing);
    expect(calls.length).toBe(2);
    expect(calls[0]).toMatch(/^http:\/\/osrm\.test\/route\/v1\/driving\//);
    expect(p.days[0]!.route).toEqual(straightLine([p.days[0]!.from.loc, p.days[0]!.to.loc]));
    expect(p.version).toBe(1);
  });

  it("OSRM rotasını yol günlerine işler", async () => {
    const encoded = encodePolyline(ROUTE_SELCUK_PAMUKKALE);
    const ok = (async () =>
      new Response(JSON.stringify({ code: "Ok", routes: [{ geometry: encoded, distance: 205_000, duration: 9_600 }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    const p = await planTripWithRoutes(EGE_REQUEST, MINI_PACK, ctx, "http://osrm.test", ok);
    const route = p.days[2]!.route!;
    expect(route.length).toBe(ROUTE_SELCUK_PAMUKKALE.length);
    route.forEach(([lon, lat], i) => {
      expect(lon).toBeCloseTo(ROUTE_SELCUK_PAMUKKALE[i]![0], 4);
      expect(lat).toBeCloseTo(ROUTE_SELCUK_PAMUKKALE[i]![1], 4);
    });
  });
});

function encodePolyline(coords: Array<[number, number]>, precision = 5): string {
  const f = 10 ** precision;
  const enc = (v: number) => {
    let x = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (x >= 0x20) {
      s += String.fromCharCode((0x20 | (x & 0x1f)) + 63);
      x >>= 5;
    }
    return s + String.fromCharCode(x + 63);
  };
  let out = "";
  let pLat = 0;
  let pLon = 0;
  for (const [lon, lat] of coords) {
    const la = Math.round(lat * f);
    const lo = Math.round(lon * f);
    out += enc(la - pLat) + enc(lo - pLon);
    pLat = la;
    pLon = lo;
  }
  return out;
}
