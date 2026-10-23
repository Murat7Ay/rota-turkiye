import { describe, expect, it } from "vitest";
import { buildPlaceIndex, fromTrWallClock, parseHHmm, PROVINCES } from "../src";
import type { DayPlan, LatLng } from "../src";
import {
  AREA_WARNINGS,
  DISTRICT_ANCHORS,
  ETIQUETTE,
  etiquetteFor,
  generalEtiquette,
  GI_PRODUCTS,
  giLocation,
  localTipsForDay,
  provinceAt,
  tastesForProvince,
  tastesNear,
  warningsNear,
} from "../src/knowledge";
import { hstop, makeHandPlan } from "./handplan";
import { PAMUKKALE, PLACES, SELCUK, SULTANAHMET } from "./fixtures";

const GOREME: LatLng = { lat: 38.6431, lon: 34.8289 };
const KUSADASI: LatLng = { lat: 37.8597, lon: 27.2597 };
const ISTIKLAL: LatLng = { lat: 41.0336, lon: 28.9777 };
const CHECKED = "2026-10-24";
const names = (xs: Array<{ name: string }>) => xs.map((x) => x.name);

describe("bilgi katmanı — veri bütünlüğü", () => {
  const provinceNames = new Set(PROVINCES.map((p) => p.name));

  it("her coğrafi işaret kaynaklı, tarihli ve konumlanabilir", () => {
    const ids = new Set<string>();
    for (const g of GI_PRODUCTS) {
      expect(ids.has(g.id), g.id).toBe(false);
      ids.add(g.id);
      expect(g.source, g.name).toMatch(/^https:\/\/ci\.turkpatent\.gov\.tr\/cografi-isaretler\/detay\/\d+$/);
      expect(g.checkedAt).toBe(CHECKED);
      expect(g.description.length, g.name).toBeGreaterThan(20);
      expect(g.description.endsWith("."), g.name).toBe(true);
      expect(g.regNo).toBeGreaterThan(0);
      expect(g.regDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(provinceNames.has(g.province), g.province).toBe(true);
      if (g.place) {
        const anchors = DISTRICT_ANCHORS[g.province] ?? [];
        expect(anchors.some(([n]) => n === g.place), `${g.name} → ${g.place}`).toBe(true);
      }
      const loc = giLocation(g);
      expect(loc.lat).toBeGreaterThan(35.8);
      expect(loc.lat).toBeLessThan(42.2);
      expect(loc.lon).toBeGreaterThan(25.6);
      expect(loc.lon).toBeLessThan(44.9);
    }
    // ana iller dolu
    for (const p of ["Aydın", "İzmir", "Denizli", "Nevşehir", "İstanbul"]) {
      expect(tastesForProvince(p).length, p).toBeGreaterThanOrEqual(7);
    }
  });

  it("uyarılar ve görgü kuralları kaynaklı ve tarihli", () => {
    const ids = new Set<string>();
    for (const w of AREA_WARNINGS) {
      expect(ids.has(w.id)).toBe(false);
      ids.add(w.id);
      expect(w.source).toMatch(/^https:\/\//);
      for (const s of w.extraSources ?? []) expect(s).toMatch(/^https:\/\//);
      expect(w.checkedAt).toBe(CHECKED);
      expect(w.areas.length).toBeGreaterThan(0);
      for (const a of w.areas) expect(a.radiusKm).toBeGreaterThan(0);
      expect(w.text.length).toBeGreaterThan(20);
      expect(w.tip.length).toBeGreaterThan(10);
      expect(w.tip.length).toBeLessThanOrEqual(140);
    }
    for (const e of ETIQUETTE) {
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
      expect(e.source).toMatch(/^https:\/\//);
      expect(e.checkedAt).toBe(CHECKED);
      expect(e.text.length).toBeGreaterThan(20);
      expect(e.tip.length).toBeLessThanOrEqual(140);
    }
  });
});

describe("bilgi katmanı — sorgular", () => {
  it("il tespiti ilçe çapalarıyla sınıra yakın yerlerde doğru", () => {
    expect(provinceAt(SELCUK.loc)).toBe("İzmir");
    expect(provinceAt(KUSADASI)).toBe("Aydın");
    expect(provinceAt(PAMUKKALE.loc)).toBe("Denizli");
    expect(provinceAt(GOREME)).toBe("Nevşehir");
    expect(provinceAt(SULTANAHMET.loc)).toBe("İstanbul");
  });

  it("Selçuk çevresi: İzmir önce, yakın Aydın tatları da gelir", () => {
    const t = tastesNear(SELCUK.loc);
    expect(t[0]!.province).toBe("İzmir");
    expect(names(t)).toEqual(expect.arrayContaining(["İzmir Boyozu", "Ortaklar Çöp Şiş", "Aydın İnciri"]));
    expect(names(t)).not.toContain("Avanos Çömleği");
    expect(names(t)).not.toContain("Bergama Köftesi"); // ~130 km uzakta
  });

  it("Göreme: Avanos çömleği ve testi kebabı", () => {
    const t = names(tastesNear(GOREME));
    expect(t.slice(0, 3)).toEqual(expect.arrayContaining(["Avanos Çömleği", "Nevşehir Testi Kebabı"]));
    expect(t).not.toContain("İstanbul Simidi");
  });

  it("Sultanahmet: Eminönü balık ekmek en yerel", () => {
    const t = names(tastesNear(SULTANAHMET.loc));
    expect(t[0]).toBe("Eminönü Balık Ekmek");
    expect(t).toContain("İstanbul Simidi");
    expect(t).not.toContain("Şile Bezi"); // ~55 km
  });

  it("il adı Türkçe karakter ve büyük/küçük harf duyarsız", () => {
    expect(tastesForProvince("aydin")[0]!.name).toBe("Aydın İnciri");
    expect(tastesForProvince("NEVŞEHİR").map((g) => g.province)).toEqual(
      new Array(tastesForProvince("Nevşehir").length).fill("Nevşehir"),
    );
  });

  it("bölge uyarıları: Sultanahmet, Göreme, Selçuk ve saat penceresi", () => {
    const s = warningsNear({ lat: 41.0086, lon: 28.9802 }).map((w) => w.id);
    expect(s).toEqual(expect.arrayContaining(["sultanahmet-hali-rehber", "ayakkabi-boyaci-firca", "istanbul-taksimetre"]));
    expect(s.indexOf("sultanahmet-hali-rehber")).toBeLessThan(s.indexOf("istanbul-taksimetre"));
    expect(warningsNear(GOREME).map((w) => w.id)).toEqual(
      expect.arrayContaining(["kapadokya-ucuz-balon", "kapadokya-balon-hava"]),
    );
    expect(warningsNear(SELCUK.loc)).toEqual([]);
    const day = "2026-10-30";
    expect(warningsNear(ISTIKLAL, fromTrWallClock(day, parseHHmm("14:00"))).map((w) => w.id)).not.toContain("istiklal-bar-hesabi");
    expect(warningsNear(ISTIKLAL, fromTrWallClock(day, parseHHmm("23:30"))).map((w) => w.id)).toContain("istiklal-bar-hesabi");
    expect(warningsNear(ISTIKLAL).map((w) => w.id)).toContain("istiklal-bar-hesabi");
  });

  it("görgü kuralları mekân türüne göre", () => {
    expect(etiquetteFor(["cami"]).map((e) => e.id)).toContain("cami-kiyafet");
    expect(etiquetteFor(["carsi"]).map((e) => e.id)).toEqual(["carsi-pazarlik"]);
    expect(etiquetteFor(["meyhane"]).map((e) => e.id)).toEqual(
      expect.arrayContaining(["hesap-servis-kuver-yasak", "bahsis-gonullu", "balik-menu-fiyati"]),
    );
    expect(etiquetteFor(["dogal_alan"])).toEqual([]);
    expect(generalEtiquette().map((e) => e.id)).toEqual(["alkol-perakende-saat", "acil-112"]);
  });
});

describe("bilgi katmanı — sabah rehberi ipuçları", () => {
  const index = buildPlaceIndex(PLACES);

  it("yol günü: geçilen ilin coğrafi işareti önce", () => {
    const day = makeHandPlan().days[2]!; // Selçuk → Pamukkale (Aydın üzerinden)
    const tips = localTipsForDay(day, index);
    expect(tips.length).toBeLessThanOrEqual(3);
    expect(tips[0]).toBe("Bugün Aydın'dan geçiyorsun: Aydın İnciri coğrafi işaretli — yolda bir yöresel ürün dükkânında bak.");
    expect(tips).toContain("Hesapta servis, kuver ya da masa ücreti görürsen sor: 30 Ocak 2026'dan beri bunlar istenemiyor.");
    expect(tips.some((t) => t.startsWith("Denizli'desin: "))).toBe(true);
  });

  it("Sultanahmet günü: tat, uyarı ve cami ipucu; çarşıda pazarlık", () => {
    const base = makeHandPlan().days[1]!;
    const sultanahmet = { name: "Sultanahmet", loc: SULTANAHMET.loc };
    const day: DayPlan = {
      ...base,
      date: "2026-10-30",
      from: sultanahmet,
      to: sultanahmet,
      isTravelDay: false,
      route: undefined,
      stops: [
        hstop("s-ayasofya", "fx:ayasofya", "gezi", "09:30", "10:30", 0),
        hstop("s-carsi", "fx:kapalicarsi", "alisveris", "11:00", "12:30", 0),
        hstop("s-aksam", "fx:ist-rest", "aksam", "19:30", "21:00", 1500),
      ],
    };
    const tips = localTipsForDay(day, index);
    expect(tips).toEqual([
      "İstanbul'dasın: Eminönü Balık Ekmek coğrafi işaretli — yerel bir lokantada ya da fırında sor.",
      "Sultanahmet'te seni çaya ya da \"aile dükkânına\" çağıran gönüllü rehberlere kibarca hayır de.",
      "Camiye gireceksen omuz ve dizler kapalı olsun; kadınlar için yanında bir eşarp bulunsun.",
    ]);
    const carsiOnly: DayPlan = { ...day, stops: [day.stops[1]!] };
    expect(localTipsForDay(carsiOnly, index, 5).some((t) => t.startsWith("Kapalıçarşı'da pazarlık normal"))).toBe(true);
  });
});
