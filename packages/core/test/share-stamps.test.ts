// Paylaşım bağlantısı, damgalar, il ataması ve Gezi Wrapped testleri (elle kurulmuş plan).
import { describe, expect, it } from "vitest";
import { buildPlaceIndex, fromTrWallClock, makeExpense, parseHHmm } from "../src";
import type { FxRates, TripPlan, TripRequest } from "../src";
import { provinceOf, PROVINCES } from "../src/provinces";
import { decodeShare, encodeShare, shareCodeFromHash, shareUrl, type SharePayload } from "../src/share";
import { computeStamps, visitedProvinces } from "../src/stamps";
import { tripWrapped } from "../src/wrapped";
import { EGE_REQUEST, PLACES } from "./fixtures";
import { makeHandPlan } from "./handplan";

const index = buildPlaceIndex(PLACES);
const FX: FxRates = { date: "2026-10-23", source: "test", tryPer: { TRY: 1, EUR: 50, USD: 40 } };
const AFTER = fromTrWallClock("2026-11-01", parseHHmm("12:00"));

function doneAll(plan: TripPlan): TripPlan {
  return { ...plan, days: plan.days.map((d) => ({ ...d, stops: d.stops.map((s) => ({ ...s, status: "done" as const })) })) };
}

describe("paylaşım bağlantısı", () => {
  it("varsayılan değerlerle gidip gelir ve kısa kalır", async () => {
    const payload: SharePayload = { v: 1, packId: "ege", seed: 42, request: EGE_REQUEST };
    const code = await encodeShare(payload);
    expect(code[0]).toBe("Z");
    expect(code.length).toBeLessThan(300);
    const back = await decodeShare(code);
    expect(back).toEqual({ ...payload, request: { ...EGE_REQUEST, hasMuzekart: false } });
  });

  it("varsayılan dışı alanları korur", async () => {
    const request: TripRequest = {
      ...EGE_REQUEST,
      title: "Şirince & Efes — çay molası",
      end: { name: "Adnan Menderes Havalimanı", loc: { lat: 38.2924, lon: 27.157 } },
      travelers: 1,
      pace: "yogun",
      interests: ["doga", "fotograf"],
      budget: { amount: 1200, currency: "EUR" },
      transport: "toplu",
      dayStart: "09:00",
      diet: { vegetarian: true },
      visitor: "yabanci",
      hasMuzekart: false,
    };
    const payload: SharePayload = { v: 1, packId: "ege", packVersion: "2026.10.1", seed: 7, request };
    const url = await shareUrl("https://ornek.github.io/rota/#/plan", payload);
    expect(url.startsWith("https://ornek.github.io/rota/#/paylas/")).toBe(true);
    expect(await decodeShare(url)).toEqual(payload);
    expect(shareCodeFromHash(new URL(url).hash)).toBe(url.split("#/paylas/")[1]);
  });

  it("bozuk ya da geçersiz kodu reddeder", async () => {
    expect(await decodeShare("")).toBeNull();
    expect(await decodeShare("Zbozuk-veri")).toBeNull();
    expect(await decodeShare("Xabc")).toBeNull();
    const wire = { v: 1, p: "ege", t: "x", d: "2026-13-01", a: ["A", 38, 27], st: [["s", "S", 38, 27, 1]] };
    expect(await decodeShare(`J${Buffer.from(JSON.stringify(wire)).toString("base64url")}`)).toBeNull();
    const ok = { ...wire, d: "2026-10-27" };
    expect(await decodeShare(`J${Buffer.from(JSON.stringify(ok)).toString("base64url")}`)).not.toBeNull();
    const badPace = { ...ok, pc: "kosar" };
    expect(await decodeShare(`J${Buffer.from(JSON.stringify(badPace)).toString("base64url")}`)).toBeNull();
  });
});

describe("il ataması", () => {
  it("81 il ve turistik ilçeler doğru ile düşer", () => {
    expect(PROVINCES).toHaveLength(81);
    expect(new Set(PROVINCES.map((p) => p.plate)).size).toBe(81);
    expect(provinceOf({ lat: 37.9395, lon: 27.3417 }).name).toBe("İzmir"); // Efes (Selçuk)
    expect(provinceOf({ lat: 37.9257, lon: 29.1239 }).name).toBe("Denizli"); // Hierapolis
    expect(provinceOf({ lat: 41.0058, lon: 28.9768 }).name).toBe("İstanbul");
    expect(provinceOf({ lat: 37.9, lon: 27.5 }, "Izmir").name).toBe("İzmir"); // addr:city ipucu
  });
});

describe("damgalar", () => {
  it("yapılmış duraklardan kademe ve ilerleme hesaplar", () => {
    const plan = doneAll(makeHandPlan());
    const expenses = [makeExpense({ tripId: plan.id, amount: 5000, currency: "TRY", category: "yemek", at: fromTrWallClock("2026-10-27", 800), dayIndex: 0 }, FX)];
    const stamps = computeStamps([{ plan, expenses }], index, { now: AFTER, fx: FX });
    const get = (id: string) => stamps.find((s) => s.def.id === id)!;

    expect(get("antik-kent-avcisi")).toMatchObject({ count: 3, tier: "bronz", next: { tier: "gumus", target: 5, remaining: 2 } });
    expect(get("unesco-koleksiyoncusu")).toMatchObject({ count: 2, tier: "bronz" });
    expect(get("esnaf-muduvimi")).toMatchObject({ count: 3, tier: "bronz" });
    expect(get("cay-ustasi")).toMatchObject({ count: 2, tier: null, progress: 0.4 });
    expect(get("butce-ustasi").tier).toBe("bronz");
    expect(get("erken-kus").tier).toBeNull();
    expect(get("il-avcisi")).toMatchObject({ count: 3, tier: "bronz" });
    // Bronz UNESCO, ilk UNESCO durağının (Efes, 27 Ekim 11:00) anında kazanılır
    expect(get("unesco-koleksiyoncusu").earnedAt).toBe(fromTrWallClock("2026-10-27", parseHHmm("11:00")).toISOString());
  });

  it("işaretsiz duraklar sayılmaz; 08:00 öncesi durak Erken Kuş verir", () => {
    const base = makeHandPlan();
    expect(computeStamps([{ plan: base, expenses: [] }], index, { now: AFTER }).every((s) => s.tier === null)).toBe(true);
    const plan: TripPlan = {
      ...base,
      days: base.days.map((d, i) =>
        i === 1 ? { ...d, stops: d.stops.map((s, j) => (j === 0 ? { ...s, arriveMin: parseHHmm("07:30"), status: "done" as const } : s)) } : d,
      ),
    };
    const early = computeStamps([{ plan, expenses: [] }], index, { now: AFTER }).find((s) => s.def.id === "erken-kus")!;
    expect(early.tier).toBe("bronz");
    expect(visitedProvinces([{ plan, expenses: [] }], index)).toEqual(["İzmir"]);
  });
});

describe("Gezi Wrapped", () => {
  it("istatistik ve üç manşet üretir", () => {
    const plan = doneAll(makeHandPlan());
    const w = tripWrapped(plan, [], index, { now: AFTER, fx: FX });
    expect(w.basis).toBe("done");
    expect(w.days).toBe(3);
    expect(w.cayCount).toBe(2);
    expect(w.antikKentCount).toBe(3);
    expect(w.provinces).toEqual(["İzmir", "Aydın", "Denizli"]);
    expect(w.region).toBe("Ege");
    expect(w.cheapestGreatMeal?.cat).toBe("esnaf_lokantasi");
    expect(w.withinBudget).toBeNull();
    expect(w.headlines).toHaveLength(3);
    expect(w.headlines[0]).toMatch(/^3 günde 2 bardak çay, 3 antik kent ve \d+ km: tam bir Ege klasiği\.$/);
    expect(w.stampsEarned.length).toBeGreaterThan(0);
  });
});
