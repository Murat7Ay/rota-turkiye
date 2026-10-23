import { describe, expect, it } from "vitest";
import { checkBill, classifyBillLine, foldTr, parseAmountTr } from "../src/billcheck";
import { PLACES } from "./fixtures";

const place = (id: string) => {
  const p = PLACES.find((x) => x.id === id);
  if (!p) throw new Error(`fixture yok: ${id}`);
  return p;
};
const base = { travelers: 2, date: "2026-10-24", visitor: "yerli" as const };

describe("hesap kontrol — metin eşleme", () => {
  it("Türkçe büyük/küçük harf ve aksanları katlar", () => {
    expect(foldTr("SERVİS ÜCRETİ")).toBe("servis ucreti");
    expect(foldTr("  Masa  Ücreti ")).toBe("masa ucreti");
    expect(foldTr("Couvért")).toBe("couvert");
  });

  it("ek ücret satırlarını tanır, sıradan kalemleri tanımaz", () => {
    expect(classifyBillLine("Servis %10")).toBe("servis");
    expect(classifyBillLine("KUVER x2")).toBe("kuver");
    expect(classifyBillLine("Couvert")).toBe("kuver");
    expect(classifyBillLine("masa ücreti")).toBe("masa");
    expect(classifyBillLine("Hizmet Bedeli")).toBe("hizmet");
    expect(classifyBillLine("Service charge")).toBe("servis");
    expect(classifyBillLine("%10")).toBe("yuzde");
    expect(classifyBillLine("Adana kebap")).toBeNull();
    expect(classifyBillLine("Ayran")).toBeNull();
  });

  it("Türkçe tutar yazımını çözer", () => {
    expect(parseAmountTr("1.250,50 ₺")).toBe(1250.5);
    expect(parseAmountTr("1250,5")).toBe(1250.5);
    expect(parseAmountTr("1.250")).toBe(1250);
    expect(parseAmountTr("12.5")).toBe(12.5);
    expect(parseAmountTr("abc")).toBeNaN();
  });
});

describe("hesap kontrol — değerlendirme", () => {
  it("yeme-içme mekânında kuver satırını yasal notla işaretler", () => {
    const r = checkBill({
      ...base,
      place: place("fx:rest1"),
      lines: [
        { label: "Izgara köfte", amount: 600 },
        { label: "Kuver", amount: 150 },
      ],
    });
    expect(r.flags).toHaveLength(1);
    expect(r.flags[0]!.legal).toBe(true);
    expect(r.flaggedTry).toBe(150);
    expect(r.verdict).toBe("sorun");
    expect(r.legalNote?.since).toBe("2026-01-30");
    expect(r.legalNote?.source).toContain("alomaliye.com");
  });

  it("otelde servis satırına yasal not iliştirmez", () => {
    const r = checkBill({ ...base, place: place("fx:otel-selcuk"), lines: [{ label: "Oda servisi", amount: 300 }] });
    expect(r.flags[0]!.legal).toBe(false);
    expect(r.legalNote).toBeNull();
    expect(r.comparison).toBeNull();
  });

  it("satır toplamı ile toplam farkını yakalar, küçük yuvarlamayı yok sayar", () => {
    const lines = [
      { label: "Pide", amount: 400 },
      { label: "Ayran", amount: 60 },
    ];
    expect(checkBill({ ...base, lines, total: 560 }).mismatch?.diffTry).toBe(100);
    expect(checkBill({ ...base, lines, total: 460.5 }).mismatch).toBeNull();
  });

  it("kişi başı tutarı tahminle kıyaslar (makul / çok yüksek)", () => {
    const esnaf = place("fx:esnaf1");
    const ok = checkBill({ ...base, place: esnaf, lines: [], total: 1200 });
    expect(ok.comparison?.level).toBe("makul");
    expect(ok.verdict).toBe("iyi");
    const high = checkBill({ ...base, place: esnaf, lines: [], total: 6000 });
    expect(high.comparison?.level).toBe("cok_yuksek");
    expect(high.comparison!.ratio).toBeGreaterThan(2.5);
    expect(high.comparison!.note).toMatch(/tahmin/);
    expect(high.verdict).toBe("dikkat");
  });

  it("balıkçıda kilo fiyatı önerisini ekler", () => {
    const r = checkBill({ ...base, lines: [{ label: "Levrek 1 kg", amount: 1800 }] });
    expect(r.advice.some((a) => /kilo fiyatını/.test(a))).toBe(true);
    expect(r.advice).toContain("Menüde basılı fiyatları iste ve hesabı menüyle karşılaştır.");
  });
});
