import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROXIMITY_SETTINGS,
  EMPTY_PROXIMITY_STATE,
  angleDiffDeg,
  buildPlaceIndex,
  createTravelModel,
  evaluateProximity,
  findCorridorDiscoveries,
  fromTrWallClock,
  nearbyHighlights,
  parseHHmm,
  pointAlongLine,
  projectOnLine,
} from "../src";
import type { Place, ProximityInput, ProximitySettings, ProximityState } from "../src";
import { PLACES, ROUTE_SELCUK_PAMUKKALE, SELCUK } from "./fixtures";

const ROUTE = ROUTE_SELCUK_PAMUKKALE;
const ctx = { index: buildPlaceIndex(PLACES), travel: createTravelModel("araba") };
const byId = (id: string) => PLACES.find((p) => p.id === id)!;
const at = (date: string, hhmm: string) => fromTrWallClock(date, parseHHmm(hhmm));
const alongOf = (id: string) => projectOnLine(byId(id).loc, ROUTE).alongKm;
const posAt = (km: number) => pointAlongLine(ROUTE, km);

describe("rota koridoru keşfi", () => {
  const found = findCorridorDiscoveries(ROUTE, { interests: ["tarih", "yemek"] }, ctx);
  const ids = found.map((d) => d.place.id);

  it("Nysa ve Aydın'daki tarihi tatlıcıyı bulur, Afrodisias'ı bulmaz", () => {
    expect(ids).toContain("fx:nysa");
    expect(ids).toContain("fx:aydin-tatli");
    expect(ids).not.toContain("fx:afrodisias");
  });

  it("çıkış ve varış şehrinin kendi yerlerini yol üstü saymaz", () => {
    expect(ids).not.toContain("fx:hierapolis");
    expect(ids).not.toContain("fx:efes-muze");
    expect(ids).not.toContain("fx:efes");
  });

  it("puana göre sıralı, puan 0..1", () => {
    for (let i = 1; i < found.length; i++) expect(found[i - 1]!.score).toBeGreaterThanOrEqual(found[i]!.score);
    for (const d of found) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(1);
      expect(d.detourMin).toBeLessThanOrEqual(25);
    }
  });

  it("Türkçe gerekçe: ondalık virgül, sapma süresi, öne çıkan özellik", () => {
    const nysa = found.find((d) => d.place.id === "fx:nysa")!;
    expect(nysa.offRouteKm).toBeGreaterThan(1);
    expect(nysa.offRouteKm).toBeLessThan(2);
    expect(nysa.reason).toMatch(/^Rotadan 1,\d km · ~\d+ dk sapma · Antik kent$/);
    const tatli = found.find((d) => d.place.id === "fx:aydin-tatli")!;
    expect(tatli.reason).toContain("Tarihi tatlıcı");
    expect(tatli.detourMin).toBeLessThan(nysa.detourMin);
  });

  it("geniş koridorda bile Afrodisias sapma süresi yüzünden elenir", () => {
    const wide = findCorridorDiscoveries(ROUTE, { interests: ["tarih"], bufferKm: 50 }, ctx).map((d) => d.place.id);
    expect(wide).not.toContain("fx:afrodisias");
    const lenient = findCorridorDiscoveries(ROUTE, { interests: ["tarih"], bufferKm: 50, maxDetourMin: 120 }, ctx);
    const afro = lenient.find((d) => d.place.id === "fx:afrodisias");
    expect(afro).toBeDefined();
    expect(afro!.detourMin).toBeGreaterThan(25);
    expect(afro!.reason).toContain("UNESCO Dünya Mirası");
  });

  it("sıradan tatlıcı (sinyalsiz) elenir; excludeIds ve limit uygulanır", () => {
    const plain: Place = { ...byId("fx:aydin-tatli"), id: "fx:plain-tatli", name: "Sıradan Tatlıcı (test)", tags: [], notability: 0.4, loc: posAt(100) };
    const c2 = { ...ctx, index: buildPlaceIndex([...PLACES, plain]) };
    const r = findCorridorDiscoveries(ROUTE, { interests: [], excludeIds: new Set(["fx:nysa"]) }, c2).map((d) => d.place.id);
    expect(r).not.toContain("fx:plain-tatli");
    expect(r).not.toContain("fx:nysa");
    expect(findCorridorDiscoveries(ROUTE, { interests: [], limit: 1 }, ctx)).toHaveLength(1);
    expect(findCorridorDiscoveries([[27, 38]], { interests: [] }, ctx)).toEqual([]);
  });

  it("300 m içindeki küme tek yere iner, en iyisi kalır", () => {
    const p = posAt(110);
    const a: Place = { ...byId("fx:tripolis"), id: "fx:kume-a", name: "Küme A (test)", cat: "manzara", notability: 0.9, tags: ["manzara", "tarihi"], loc: p };
    const b: Place = { ...a, id: "fx:kume-b", name: "Küme B (test)", notability: 0.5, tags: ["manzara"], loc: { lat: p.lat + 0.001, lon: p.lon } };
    const c2 = { ...ctx, index: buildPlaceIndex([...PLACES, a, b]) };
    const r = findCorridorDiscoveries(ROUTE, { interests: [] }, c2);
    expect(r.map((d) => d.place.id)).toContain("fx:kume-a");
    expect(r.map((d) => d.place.id)).not.toContain("fx:kume-b");
    expect(r.find((d) => d.place.id === "fx:kume-a")!.reason).toContain("yakınında 1 yer daha");
  });
});

describe("canlı yakınlık bildirimleri", () => {
  const S: ProximitySettings = { ...DEFAULT_PROXIMITY_SETTINGS, interests: ["tarih", "yemek"] };
  const NOW = at("2026-10-27", "11:00");
  const beforeNysa = posAt(alongOf("fx:nysa") - 10);
  const beforeTatli = posAt(alongOf("fx:aydin-tatli") - 5);
  const input = (position = beforeNysa, now = NOW, extra: Partial<ProximityInput> = {}): ProximityInput => ({
    position,
    now,
    route: ROUTE,
    speedKmh: 80,
    ...extra,
  });

  it("ilerideki yeri bir kez bildirir", () => {
    const r1 = evaluateProximity(input(), S, EMPTY_PROXIMITY_STATE, ctx);
    expect(r1.notifications).toHaveLength(1);
    const n = r1.notifications[0]!;
    expect(n.placeId).toBe("fx:nysa");
    expect(n.title).toBe("İleride: Nysa Antik Kenti");
    expect(n.body).toMatch(/^10 km sonra · rotadan 1,\d km \(~\d+ dk sapma\) · Antik kent$/);
    expect(r1.state.dayCount).toBe(1);
    expect(r1.state.dayKey).toBe("2026-10-27");
    expect(r1.state.notified["fx:nysa"]).toBe(NOW.toISOString());
    // durum değiştirilmeden yenisi döner
    expect(EMPTY_PROXIMITY_STATE).toEqual({ notified: {}, dayKey: "", dayCount: 0 });

    const r2 = evaluateProximity(input(beforeNysa, new Date(NOW.getTime() + 60 * 60_000)), S, r1.state, ctx);
    expect(r2.notifications.map((x) => x.placeId)).not.toContain("fx:nysa");
  });

  it("geçilmiş yeri asla bildirmez", () => {
    const past = posAt(alongOf("fx:aydin-tatli") + 1);
    expect(evaluateProximity(input(past), S, EMPTY_PROXIMITY_STATE, ctx).notifications).toEqual([]);
    const far = evaluateProximity(input(past), { ...S, lookaheadKm: 40 }, EMPTY_PROXIMITY_STATE, ctx);
    expect(far.notifications.map((x) => x.placeId)).toEqual(["fx:nysa"]);
  });

  it("bekleme süresine uyar", () => {
    const r1 = evaluateProximity(input(beforeTatli), S, EMPTY_PROXIMITY_STATE, ctx);
    expect(r1.notifications.map((x) => x.placeId)).toEqual(["fx:aydin-tatli"]);
    expect(r1.notifications[0]!.body).toContain("Tarihi tatlıcı");
    const early = evaluateProximity(input(beforeNysa, new Date(NOW.getTime() + 10 * 60_000)), S, r1.state, ctx);
    expect(early.notifications).toEqual([]);
    const later = evaluateProximity(input(beforeNysa, new Date(NOW.getTime() + 25 * 60_000)), S, r1.state, ctx);
    expect(later.notifications.map((x) => x.placeId)).toEqual(["fx:nysa"]);
    expect(later.state.dayCount).toBe(2);
  });

  it("günlük üst sınır ve gün değişince sıfırlanma", () => {
    const one = { ...S, maxPerDay: 1 };
    const r1 = evaluateProximity(input(beforeTatli), one, EMPTY_PROXIMITY_STATE, ctx);
    expect(r1.notifications).toHaveLength(1);
    const r2 = evaluateProximity(input(beforeNysa, new Date(NOW.getTime() + 60 * 60_000)), one, r1.state, ctx);
    expect(r2.notifications).toEqual([]);
    const r3 = evaluateProximity(input(beforeNysa, at("2026-10-28", "11:00")), one, r2.state, ctx);
    expect(r3.notifications.map((x) => x.placeId)).toEqual(["fx:nysa"]);
    expect(r3.state.dayKey).toBe("2026-10-28");
    expect(r3.state.dayCount).toBe(1);
    // ertesi gün de aynı yer bir daha bildirilmez
    expect(r3.state.notified["fx:aydin-tatli"]).toBeDefined();
  });

  it("sessiz saatlere uyar (gece yarısını aşan aralık dahil)", () => {
    const view: Place = {
      ...byId("fx:tripolis"),
      id: "fx:seyir",
      name: "Seyir Terası (test)",
      cat: "manzara",
      notability: 0.9,
      tags: ["manzara", "tarihi"],
      loc: posAt(60),
    };
    const c2 = { ...ctx, index: buildPlaceIndex([...PLACES, view]) };
    const pos = posAt(50);
    const night = { ...S, quietHours: [22 * 60, 8 * 60] as [number, number] };
    const none = { ...S, quietHours: [0, 0] as [number, number] };
    for (const hhmm of ["23:30", "05:00"]) {
      const now = at("2026-10-27", hhmm);
      expect(evaluateProximity(input(pos, now), night, EMPTY_PROXIMITY_STATE, c2).notifications).toEqual([]);
      expect(evaluateProximity(input(pos, now), none, EMPTY_PROXIMITY_STATE, c2).notifications.map((x) => x.placeId)).toEqual(["fx:seyir"]);
    }
    // gündüz aralığı
    expect(evaluateProximity(input(), { ...S, quietHours: [600, 720] }, EMPTY_PROXIMITY_STATE, ctx).notifications).toEqual([]);
    expect(evaluateProximity(input(), { ...S, quietHours: [1200, 690] }, EMPTY_PROXIMITY_STATE, ctx).notifications).toEqual([]);
    expect(evaluateProximity(input(), night, EMPTY_PROXIMITY_STATE, ctx).notifications).toHaveLength(1);
  });

  it("plandaki yerleri ve kapalıyken varılacak yerleri atlar", () => {
    const planned = evaluateProximity(input(beforeNysa, NOW, { plannedPlaceIds: new Set(["fx:nysa"]) }), S, EMPTY_PROXIMITY_STATE, ctx);
    expect(planned.notifications).toEqual([]);
    // Ekim'de 19:00'da kapanıyor; 18:55'te 10 km geride → varışta kapalı
    expect(evaluateProximity(input(beforeNysa, at("2026-10-27", "18:55")), S, EMPTY_PROXIMITY_STATE, ctx).notifications).toEqual([]);
    expect(evaluateProximity(input(beforeNysa, at("2026-10-27", "18:30")), S, EMPTY_PROXIMITY_STATE, ctx).notifications).toHaveLength(1);
  });

  it("kapalıyken hiçbir şey yapmaz", () => {
    const state: ProximityState = { notified: {}, dayKey: "2026-10-26", dayCount: 3 };
    const r = evaluateProximity(input(), { ...S, enabled: false }, state, ctx);
    expect(r.notifications).toEqual([]);
    expect(r.state).toBe(state);
  });

  it("rota yokken yarıçap ve hareket yönü", () => {
    const south = evaluateProximity({ position: SELCUK.loc, now: NOW, headingDeg: 180, speedKmh: 30 }, S, EMPTY_PROXIMITY_STATE, ctx);
    expect(south.notifications.map((x) => x.title)).toEqual(["Yakınında: Efes Müzesi"]);
    expect(south.notifications[0]!.body).toMatch(/^0,\d km uzakta · ~\d+ dk · Müze$/);
    const north = evaluateProximity({ position: SELCUK.loc, now: NOW, headingDeg: 0, speedKmh: 30 }, S, EMPTY_PROXIMITY_STATE, ctx);
    expect(north.notifications).toHaveLength(1);
    expect(north.notifications[0]!.placeId).not.toBe("fx:efes-muze");
  });
});

describe("Etrafım", () => {
  const NOW = at("2026-10-27", "11:00");

  it("Selçuk çevresinde öne çıkanlar; mesafe, yön ve açık mı", () => {
    const r = nearbyHighlights(SELCUK.loc, 1.5, { interests: ["tarih"], now: NOW }, ctx);
    const ids = r.map((h) => h.place.id);
    for (const id of ["fx:efes-muze", "fx:ayasuluk", "fx:isabey", "fx:artemis"]) expect(ids).toContain(id);
    expect(ids).not.toContain("fx:otel-selcuk");
    expect(ids).not.toContain("fx:efes"); // 2,6 km
    for (let i = 1; i < r.length; i++) expect(r[i - 1]!.score).toBeGreaterThanOrEqual(r[i]!.score);

    const kale = r.find((h) => h.place.id === "fx:ayasuluk")!;
    expect(kale.distanceKm).toBeLessThan(0.5);
    expect(angleDiffDeg(kale.bearingDeg, 0)).toBeLessThan(30);
    const muze = r.find((h) => h.place.id === "fx:efes-muze")!;
    expect(muze.distanceKm).toBeGreaterThan(0.3);
    expect(muze.distanceKm).toBeLessThan(0.7);
    expect(angleDiffDeg(muze.bearingDeg, 200)).toBeLessThan(30);
    expect(muze.openNow).toBe(true);
    expect(r.find((h) => h.place.id === "fx:pazar")!.openNow).toBe(false); // yalnız cumartesi
  });

  it("akşam kapalı; saat verisi hiç yoksa null; limit", () => {
    const evening = nearbyHighlights(SELCUK.loc, 1.5, { interests: [], now: at("2026-10-27", "20:00") }, ctx);
    expect(evening.find((h) => h.place.id === "fx:efes-muze")!.openNow).toBe(false);
    const noHours: Place = { ...byId("fx:pazar"), id: "fx:pazar-saatsiz", openingHours: undefined };
    const c2 = { ...ctx, index: buildPlaceIndex([...PLACES, noHours]) };
    const r = nearbyHighlights(SELCUK.loc, 1.5, { interests: [], now: NOW }, c2);
    expect(r.find((h) => h.place.id === "fx:pazar-saatsiz")!.openNow).toBeNull();
    expect(nearbyHighlights(SELCUK.loc, 1.5, { interests: [], now: NOW, limit: 3 }, ctx)).toHaveLength(3);
  });
});
