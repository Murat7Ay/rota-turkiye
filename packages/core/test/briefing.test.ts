import { describe, expect, it } from "vitest";
import { budgetStatus, buildBriefing, buildPlaceIndex, fromTrWallClock, makeExpense, parseHHmm, rainWindowsFrom } from "../src";
import type { FxRates, Place, TripPlan, WeatherDay } from "../src";
import { fmtInt } from "../src/trtext";
import { HOTEL_COST, makeHandPlan } from "./handplan";
import { PLACES } from "./fixtures";

const index = buildPlaceIndex(PLACES);
const at = (date: string, hhmm: string) => fromTrWallClock(date, parseHHmm(hhmm));
const FX: FxRates = { date: "2026-10-23", source: "test", tryPer: { TRY: 1, EUR: 50, USD: 40 } };

function weather(date: string, rainFromHour: number | null, code = 3): WeatherDay {
  const prob = Array.from({ length: 24 }, (_, h) => (rainFromHour !== null && h >= rainFromHour ? 80 : 5));
  return {
    date,
    tMinC: 13,
    tMaxC: 21,
    hourlyPrecipProb: prob,
    hourlyTempC: new Array(24).fill(17),
    weatherCode: code,
    summary: "Kapalı, 13–21°C",
    rainWindows: rainWindowsFrom(prob, 60),
  };
}

describe("sabah rehberi", () => {
  const plan = makeHandPlan();

  it("yol günü başlığı, özet ve bildirim", () => {
    const b = buildBriefing(plan, 2, { index });
    expect(b.title).toBe("Günaydın! 3. gün: Selçuk → Pamukkale · ~170 km");
    expect(b.date).toBe("2026-10-29");
    expect(b.summary[0]).toBe("İlk çıkış 08:27");
    expect(b.summary).toContain("Toplam ~170 km · ~2 sa 30 dk yolda");
    expect(b.summary).toContain("5 durak (2 gezi)");
    expect(b.warnings).toEqual(plan.days[2]!.warnings);
    expect(b.warnings.join(" ")).toMatch(/Cumhuriyet Bayramı/);
    expect(b.notification.title).toBe("Günaydın — 3. gün");
    expect(b.notification.body.length).toBeLessThanOrEqual(160);
    expect(b.notification.body).toMatch(/^Kahvaltı: Selçuk Kahvaltı Evi \(test\) · /);
    expect(b.notification.body).toContain("Gece: Pamukkale Otel (test)");
    expect(b.planB).toBe("B planı: Nysa Antik Kenti olmazsa Tripolis Antik Kenti (antik kent).");
    expect(b.budgetLine).toBeUndefined();
  });

  it("durak sırası, etiketler, notlar ve otel en sonda", () => {
    const b = buildBriefing(plan, 1, { index });
    expect(b.title).toBe("Günaydın! 2. gün: Selçuk");
    expect(b.items.map((i) => i.stopId)).toEqual(["d1-kahvalti", "d1-ayasuluk", "d1-ogle", "d1-muze", "d1-cay", "d1-aksam", "hotel"]);
    expect(b.items.map((i) => i.time)).toEqual(["08:45", "10:00", "12:30", "15:00", "16:30", "19:30", "21:00"]);
    const ogle = b.items[2]!;
    expect(ogle.label).toBe("Öğle: Esnaf lokantası");
    expect(ogle.placeName).toBe("Selçuk Esnaf Lokantası (test)");
    expect(ogle.emoji).toBe("🍲");
    expect(ogle.note).toBe("Çalışma saati doğrulanmadı");
    expect(ogle.costTry).toBe(1000);
    expect(ogle.costKind).toBe("observed");
    const kale = b.items[1]!;
    expect(kale.costTry).toBe(0);
    expect(kale.costKind).toBe("free");
    const muze = b.items[3]!;
    expect(muze.note).toBeUndefined(); // çalışma saati verisi var
    const hotel = b.items[6]!;
    expect(hotel.label).toBe("Gece: Otel");
    expect(hotel.placeName).toBe("Selçuk Otel (test)");
    expect(hotel.costTry).toBeGreaterThan(0);
    // yağmursuz B planı: en önemli gezi durağının ilk alternatifi
    expect(b.planB).toBe("B planı: Ayasuluk Kalesi olmazsa Artemis Tapınağı (antik kent).");
  });

  it("yağmur: özet önerisi, kapalı alan notu, yağmur B planı", () => {
    const b = buildBriefing(plan, 1, { index, weather: weather("2026-10-28", 15) });
    expect(b.summary).toContain("Kapalı, 13–21°C");
    expect(b.summary).toContain("15:00'ten sonra yağmur bekleniyor; açık hava durakları öğleden önce.");
    const muze = b.items.find((i) => i.stopId === "d1-muze")!;
    expect(muze.note).toBe("Kapalı alan — yağmura uygun");
    const cay = b.items.find((i) => i.stopId === "d1-cay")!;
    expect(cay.note).toContain("Açık alan — yağmur bekleniyor");
    expect(b.items.find((i) => i.stopId === "d1-ayasuluk")!.note ?? "").not.toContain("yağmur");
    expect(b.planB).toBe("B planı: yağmur bastırırsa Selçuk Çay Bahçesi (test) yerine Kahvehane (test) (kapalı alan).");

    const morning = buildBriefing(plan, 1, { index, weather: { ...weather("2026-10-28", null), rainWindows: [[540, 660]] } });
    expect(morning.summary).toContain("09:00–11:00 arası yağmur bekleniyor; açık hava durakları öğleden sonra.");
    const allDay = buildBriefing(plan, 1, { index, weather: weather("2026-10-28", 8) });
    expect(allDay.summary).toContain("Gün boyu yağmur bekleniyor; kapalı alanlar öncelikli, şemsiye al.");
    // başka güne ait hava kullanılmaz
    expect(buildBriefing(plan, 1, { index, weather: weather("2026-10-29", 15) }).summary).not.toContain("Kapalı, 13–21°C");
  });

  it("bütçe satırı: bugünkü limit ve dünkü aşım", () => {
    const d0NonLodging = plan.days[0]!.estCost - HOTEL_COST[0];
    const e = (amount: number, category: "yemek" | "konaklama", hhmm: string) =>
      makeExpense({ tripId: plan.id, amount, currency: "TRY", category, at: at("2026-10-27", hhmm) }, FX);
    const budget = budgetStatus(plan, [e(6000, "yemek", "13:00"), e(3600, "konaklama", "21:00")], at("2026-10-28", "07:30"));
    const b = buildBriefing(plan, 1, { index, budget });
    expect(b.budgetLine).toBe(`Bugünkü limit: 10.200 TL · dün ${fmtInt(6000 - d0NonLodging)} TL aştın`);
  });

  it("bildirim gövdesi uzun adlarda da 160 karakteri aşmaz", () => {
    const long = (id: string) => ({ ...PLACES.find((p) => p.id === id)!, name: `${PLACES.find((p) => p.id === id)!.name} — çok uzun bir ad, gerçekten çok uzun` });
    const ids = ["fx:kahvalti2", "fx:esnaf1", "fx:cay1", "fx:rest1", "fx:otel-selcuk", "fx:ayasuluk", "fx:efes-muze"];
    const idx2 = buildPlaceIndex(PLACES.map((p): Place => (ids.includes(p.id) ? long(p.id) : p)));
    const b = buildBriefing(plan, 1, { index: idx2 });
    expect(b.notification.body.length).toBeLessThanOrEqual(160);
    expect(b.notification.body).toContain("Gece:");
    expect(b.notification.body).toContain("Öğle:");
  });

  it("olmayan gün hata verir", () => {
    const empty: TripPlan = { ...plan, days: [] };
    expect(() => buildBriefing(empty, 0, { index })).toThrow();
  });
});
