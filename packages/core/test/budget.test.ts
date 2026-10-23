import { describe, expect, it } from "vitest";
import {
  DEFAULT_FX,
  MUZEKART_PRICE_TRY,
  budgetStatus,
  buildPlaceIndex,
  categoryForPlace,
  estimatePlaceCost,
  fetchFxRates,
  fromTrWallClock,
  fuelCostTry,
  makeExpense,
  museumPassAdvice,
  parseHHmm,
} from "../src";
import type { Expense, ExpenseCategory, FxRates, Place, TripPlan } from "../src";
import { fmtInt } from "../src/trtext";
import { HOTEL_COST, hstop, makeHandPlan } from "./handplan";
import { PLACES } from "./fixtures";

const at = (date: string, hhmm: string) => fromTrWallClock(date, parseHHmm(hhmm));
const FX: FxRates = { date: "2026-10-23", source: "test", tryPer: { TRY: 1, EUR: 50, USD: 40 } };

let seq = 0;
function exp(category: ExpenseCategory, amount: number, when: Date, dayIndex?: number): Expense {
  return makeExpense({ tripId: "trip-test", amount, currency: "TRY", category, at: when, id: `e${++seq}`, ...(dayIndex !== undefined ? { dayIndex } : {}) }, FX);
}

describe("harcama kaydı", () => {
  it("kuru kayıt anında dondurur", () => {
    const fx: FxRates = { ...FX, tryPer: { ...FX.tryPer } };
    const e = makeExpense({ tripId: "t", amount: 12.5, currency: "EUR", category: "giris", at: new Date("2026-10-27T10:00:00Z"), note: "bilet" }, fx);
    expect(e.amountTry).toBe(625);
    expect(e.fxRate).toBe(50);
    expect(e.at).toBe("2026-10-27T10:00:00.000Z");
    expect(e.note).toBe("bilet");
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
    fx.tryPer.EUR = 60;
    expect(e.amountTry).toBe(625);
    expect(makeExpense({ tripId: "t", amount: 1, currency: "TRY", category: "diger", id: "sabit" }, fx).id).toBe("sabit");
    expect(() => makeExpense({ tripId: "t", amount: Number.NaN, currency: "TRY", category: "diger" }, fx)).toThrow();
  });

  it("mekân kategorisinden harcama kategorisi", () => {
    expect(categoryForPlace("esnaf_lokantasi")).toBe("yemek");
    expect(categoryForPlace("tatlici")).toBe("yemek");
    expect(categoryForPlace("cay_bahcesi")).toBe("cay_kahve");
    expect(categoryForPlace("kafe")).toBe("cay_kahve");
    expect(categoryForPlace("muze")).toBe("giris");
    expect(categoryForPlace("antik_kent")).toBe("giris");
    expect(categoryForPlace("carsi")).toBe("alisveris");
    expect(categoryForPlace("butik_otel")).toBe("konaklama");
  });
});

describe("bütçe durumu", () => {
  const plan = makeHandPlan();
  const d0 = plan.days[0]!;
  const d1 = plan.days[1]!;
  const d0NonLodging = d0.estCost - HOTEL_COST[0];

  it("gezi öncesi: bugün yok, kalan gün = toplam, baskı yok", () => {
    const s = budgetStatus(plan, [], at("2026-10-26", "12:00"));
    expect(s.todayIndex).toBeNull();
    expect(s.daysTotal).toBe(3);
    expect(s.daysLeft).toBe(3);
    expect(s.totalTry).toBe(30000);
    expect(s.dailyLimitTry).toBe(10000);
    expect(s.pressure).toBe(0);
    expect(s.status).toBe("iyi");
    expect(s.plannedTry).toBe(plan.estTotal);
    expect(s.messages[0]).toBe("Gezi yarın başlıyor; günlük ortalama 10.000 TL.");
    // plan kategorileri: oteller konaklamaya, yakıt km'den
    expect(s.byCategory.konaklama.plannedTry).toBe(HOTEL_COST[0] + HOTEL_COST[1] + HOTEL_COST[2]);
    expect(s.byCategory.yakit.plannedTry).toBe(fuelCostTry(80) + fuelCostTry(7) + fuelCostTry(170));
    expect(s.byCategory.giris.plannedTry).toBe(900 + 600 + 900 + 900);
    expect(s.byCategory.cay_kahve.plannedTry).toBe(320);
    const sum = Object.values(s.byCategory).reduce((a, c) => a + c.plannedTry, 0);
    expect(sum).toBe(plan.estTotal);
  });

  it("dünkü aşım baskı üretir, durum 'dikkat' olur", () => {
    const spent = [
      exp("yemek", 4600, at("2026-10-27", "13:30")),
      exp("giris", 900, at("2026-10-27", "11:00"), 0),
      exp("cay_kahve", 100, at("2026-10-27", "16:10")),
      exp("yakit", 400, at("2026-10-27", "08:40")),
      exp("konaklama", 3600, at("2026-10-27", "21:30")),
    ];
    const s = budgetStatus(plan, spent, at("2026-10-28", "08:00"));
    expect(s.todayIndex).toBe(1);
    expect(s.daysLeft).toBe(2);
    expect(s.spentTry).toBe(9600);
    expect(s.remainingTry).toBe(20400);
    expect(s.dailyLimitTry).toBe(10200);
    expect(s.todayLeftTry).toBe(10200);
    expect(s.byDay[0]!.spentTry).toBe(9600);
    expect(s.byCategory.yemek.spentTry).toBe(4600);
    const over = 6000 - d0NonLodging;
    expect(over).toBeGreaterThan(0);
    expect(s.pressure).toBeCloseTo(Math.min(1, over / d0NonLodging / 0.4), 3);
    expect(s.pressure).toBeGreaterThan(0);
    expect(s.status).toBe("dikkat");
    expect(s.messages).toContain(`Dün planın ${fmtInt(over)} TL üstündeydin; bugünün önerileri daha uygun seçildi.`);

    // bugün de planın çok üstüne çıkılırsa baskı 1, durum aşım
    const more = [...spent, exp("yemek", 8000, at("2026-10-28", "12:45"))];
    const s2 = budgetStatus(plan, more, at("2026-10-28", "13:00"));
    expect(s2.todaySpentTry).toBe(8000);
    expect(s2.dailyLimitTry).toBe(10200);
    expect(s2.todayLeftTry).toBe(2200);
    expect(s2.pressure).toBe(1);
    expect(s2.status).toBe("asim");
  });

  it("önceden ödenen oteller baskı yaratmaz", () => {
    const spent = [
      exp("konaklama", HOTEL_COST[0] + HOTEL_COST[1] + HOTEL_COST[2], new Date("2026-10-20T10:00:00Z")),
      exp("yemek", d0NonLodging, at("2026-10-27", "13:00")),
    ];
    const s = budgetStatus(plan, spent, at("2026-10-28", "09:00"));
    expect(s.pressure).toBe(0);
    expect(s.status).toBe("iyi");
    expect(s.dailyLimitTry).toBe(Math.round((30000 - s.spentTry) / 2));
  });

  it("harcama güne Türkiye tarihiyle bağlanır", () => {
    const s = budgetStatus(
      plan,
      [exp("yemek", 100, new Date("2026-10-27T20:00:00Z")), exp("yemek", 200, new Date("2026-10-27T22:30:00Z")), exp("diger", 50, new Date("2026-10-27T22:30:00Z"), 2)],
      at("2026-10-29", "09:00"),
    );
    expect(s.byDay.map((d) => d.spentTry)).toEqual([100, 200, 50]);
    expect(s.byDay[1]!.plannedTry).toBe(d1.estCost);
    expect(s.todayIndex).toBe(2);
    expect(s.todaySpentTry).toBe(50);
  });

  it("gezi sonrası: kalan gün 0", () => {
    const s = budgetStatus(plan, [exp("yemek", 25000, at("2026-10-28", "12:00"))], at("2026-11-02", "12:00"));
    expect(s.todayIndex).toBeNull();
    expect(s.daysLeft).toBe(0);
    expect(s.dailyLimitTry).toBe(0);
    expect(s.messages[0]).toMatch(/^Gezi tamamlandı/);
  });
});

describe("Müzekart / Museum Pass", () => {
  const index = buildPlaceIndex(PLACES);
  const plan = makeHandPlan();
  const covered = [
    ["fx:efes", "2026-10-27"],
    ["fx:efes-muze", "2026-10-28"],
    ["fx:nysa", "2026-10-29"],
    ["fx:hierapolis", "2026-10-29"],
  ] as const;

  it("yerli: Müzekart başabaş", () => {
    const sum = covered.reduce(
      (a, [id, date]) => a + estimatePlaceCost(index.get(id)!, { travelers: 1, visitor: "yerli", date }).amountTry,
      0,
    );
    const a = museumPassAdvice(plan, index, { visitor: "yerli" })!;
    expect(a.visits).toBe(4);
    expect(a.worth).toBe(sum > MUZEKART_PRICE_TRY);
    expect(a.worth).toBe(true);
    expect(a.savingTry).toBe(Math.round((sum - MUZEKART_PRICE_TRY) * 2));
    expect(a.message).toMatch(/^Müzekart al: 4 müze\/ören yeri/);

    const owned = museumPassAdvice({ ...plan, request: { ...plan.request, hasMuzekart: true } }, index, { visitor: "yerli" })!;
    expect(owned.message).toMatch(/^Müzekart'ın var/);
  });

  it("yabancı: Museum Pass Türkiye fiyatı tarihe göre, kârlılık", () => {
    const a = museumPassAdvice(plan, index, { visitor: "yabanci", fx: DEFAULT_FX })!;
    expect(a.worth).toBe(false);
    expect(a.message).toContain("€165");
    expect(a.message).toContain("kârlı değil");

    const pricey: Place[] = [1, 2, 3, 4, 5].map((i) => ({
      ...PLACES.find((p) => p.id === "fx:nysa")!,
      id: `fx:pahali-${i}`,
      name: `Pahalı Müze ${i} (test)`,
      cat: "muze",
      priceForeign: { amount: 50, currency: "EUR", perPerson: true, observedAt: "2027-01-01", source: "test", kind: "observed" },
    }));
    const idx2 = buildPlaceIndex([...PLACES, ...pricey]);
    const plan2: TripPlan = {
      ...plan,
      days: [
        {
          ...plan.days[1]!,
          date: "2027-04-05",
          stops: pricey.map((p, i) => hstop(`m${i}`, p.id, "gezi", `${String(9 + i).padStart(2, "0")}:00`, `${String(9 + i).padStart(2, "0")}:50`, 0)),
        },
      ],
    };
    const b = museumPassAdvice(plan2, idx2, { visitor: "yabanci", fx: FX })!;
    expect(b.visits).toBe(5);
    expect(b.worth).toBe(true);
    expect(b.message).toContain("€185");
    expect(b.savingTry).toBe(Math.round((5 * 50 * 50 - 185 * 50) * 2));
  });

  it("biletli durak yoksa null", () => {
    const meals: TripPlan = { ...plan, days: [{ ...plan.days[0]!, stops: plan.days[0]!.stops.filter((s) => s.slot !== "gezi") }] };
    expect(museumPassAdvice(meals, index, { visitor: "yerli" })).toBeNull();
  });
});

describe("canlı kur", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  function mock(...responses: Array<() => Response>) {
    const calls: string[] = [];
    const fn = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      const r = responses.shift();
      if (!r) throw new Error("ağ yok");
      return r();
    }) as typeof fetch;
    return { fn, calls };
  }

  it("Frankfurter v2 yanıtından TRY/EUR ve TRY/USD", async () => {
    const m = mock(() =>
      json([
        { date: "2026-10-23", base: "EUR", quote: "TRY", rate: 55.6715 },
        { date: "2026-10-23", base: "EUR", quote: "USD", rate: 1.1193 },
      ]),
    );
    const fx = await fetchFxRates(m.fn);
    expect(m.calls[0]).toContain("api.frankfurter.dev/v2/rates");
    expect(fx).toEqual({
      date: "2026-10-23",
      source: m.calls[0],
      tryPer: { TRY: 1, EUR: 55.6715, USD: Math.round((55.6715 / 1.1193) * 10_000) / 10_000 },
    });
  });

  it("v2 olmazsa v1'e düşer; hepsi olmazsa null", async () => {
    const m = mock(
      () => json({ message: "x" }, 500),
      () => json({ amount: 1, base: "EUR", date: "2026-10-23", rates: { TRY: 55.6715, USD: 1.1193 } }),
    );
    const fx = await fetchFxRates(m.fn);
    expect(m.calls[1]).toContain("/v1/latest");
    expect(fx?.tryPer.EUR).toBe(55.6715);
    expect(await fetchFxRates(mock().fn)).toBeNull();
    expect(await fetchFxRates(mock(() => json({ foo: 1 }), () => json([])).fn)).toBeNull();
    expect(await fetchFxRates(mock(() => json([{ date: "2026-10-23", base: "EUR", quote: "TRY", rate: -1 }])).fn)).toBeNull();
  });
});
