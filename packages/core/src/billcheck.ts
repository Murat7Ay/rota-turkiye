// Hesap kontrol: restoran/kafe hesabını yasal ek ücretler, toplam tutarsızlığı ve
// uygulamanın fiyat tahminiyle karşılaştırır. Sonuç bir suçlama değil, kibar bir
// kontrol listesidir; tahmin kıyası kaba kategori modeline dayanır.
import { CATEGORIES } from "./catalog";
import { estimatePlaceCost } from "./pricing";
import { fmtDec, fmtInt, round2, trLower } from "./trtext";
import type { FxRates, Place, Visitor } from "./types";

export interface BillLine {
  label: string;
  amount: number;
}

export interface BillCheckInput {
  /** Fişteki kalemler (isteğe bağlı; boş olabilir) */
  lines: Array<{ label: string; amount: number }>;
  /** Hesabın toplamı, TRY. Verilmezse satırların toplamı kullanılır. */
  total?: number;
  place?: Place;
  travelers: number;
  /** YYYY-MM-DD — tahmin bu güne endekslenir */
  date: string;
  visitor: Visitor;
  fx?: FxRates;
}

export type BillFlagKind = "servis" | "kuver" | "masa" | "hizmet" | "bahsis" | "yuzde";

export interface BillFlag {
  lineIndex: number;
  label: string;
  amount: number;
  kind: BillFlagKind;
  /** Kısa Türkçe açıklama */
  message: string;
  /** true: 30 Ocak 2026 düzenlemesi bu satıra uygulanır (yeme-içme mekânı, zorunlu ek ücret) */
  legal: boolean;
}

export type BillLevel = "makul" | "biraz_yuksek" | "cok_yuksek";

export interface BillComparison {
  level: BillLevel;
  /** "makul" | "biraz yüksek" | "çok yüksek" */
  label: string;
  /** gerçek kişi başı / tahmini kişi başı */
  ratio: number;
  actualPerPersonTry: number;
  estimatePerPersonTry: number;
  /** observed: kaynaklı gözlem; estimate: kaba kategori modeli */
  estimateKind: "observed" | "estimate";
  observedAt?: string;
  /** Kullanıcıya gösterilecek açıklama ("tahminle kıyas, suçlama değil") */
  note: string;
}

export interface LegalNote {
  /** Yürürlük, YYYY-MM-DD */
  since: string;
  title: string;
  text: string;
  source: string;
  sourceLabel: string;
}

export interface BillCheck {
  /** Değerlendirilen toplam (verilen toplam ya da satırların toplamı), TRY */
  totalTry: number;
  linesSumTry: number;
  perPersonTry: number;
  flags: BillFlag[];
  /** Yasal kapsamdaki ek ücret satırlarının toplamı, TRY */
  flaggedTry: number;
  /** Satır toplamı ile hesap toplamı uyuşmuyorsa */
  mismatch: { linesSumTry: number; totalTry: number; diffTry: number } | null;
  comparison: BillComparison | null;
  /** Genel ton: iyi (yeşil), dikkat (sarı), sorun (kırmızı: yasak ek ücret satırı) */
  verdict: "iyi" | "dikkat" | "sorun";
  headline: string;
  advice: string[];
  /** Yeme-içme mekânlarında (ya da mekân bilinmiyorsa) gösterilir */
  legalNote: LegalNote | null;
}

export const BILL_LEGAL_SOURCE = "https://www.alomaliye.com/2026/01/30/restoranlarda-servis-kuver-ve-masa-ucreti-yasaklandi/";

/**
 * Fiyat Etiketi Yönetmeliği 8/6 değişikliği (Resmî Gazete, yayım tarihinde yürürlükte;
 * kaynak haber 30 Ocak 2026). Kapsam: restoran, lokanta, kafe, pastane ve benzeri.
 */
export const BILL_LEGAL_NOTE: LegalNote = {
  since: "2026-01-30",
  title: "Servis, kuver ve masa ücreti alınamaz",
  text:
    "30 Ocak 2026'dan bu yana restoran, lokanta, kafe, pastane ve benzeri işletmeler servis, kuver ya da masa ücretini " +
    "hangi adla olursa olsun zorunlu veya otomatik ek ücret olarak isteyemez; menüde böyle bir ücret yazamaz. " +
    "İstenmeden masaya getirilen kuver/meze de ücretlendirilemez. Ödenecek tutar sipariş edilen ürünlerin fiyatlarından oluşur; " +
    "bahşiş isteğe bağlıdır. (Fiyat Etiketi Yönetmeliği md. 8/6 değişikliği)",
  source: BILL_LEGAL_SOURCE,
  sourceLabel: "alomaliye.com, 30.01.2026",
};

/** Kıyas eşikleri: kategori tahminleri kaba olduğu için geniş tutulur. */
export const BILL_RATIO_THRESHOLDS = { makul: 1.5, birazYuksek: 2.5 } as const;

/** Satır toplamı ile toplam arasında göz ardı edilen fark (yuvarlama), TRY */
const MISMATCH_TOLERANCE_TRY = 1;

const LEVEL_LABELS: Record<BillLevel, string> = {
  makul: "makul",
  biraz_yuksek: "biraz yüksek",
  cok_yuksek: "çok yüksek",
};

// ---------------------------------------------------------------- metin eşleme

const FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u", é: "e", è: "e", ê: "e" };

/** Türkçe küçük harfe çevirip aksanları atar: "KUVER Ücreti" → "kuver ucreti", "SERVİS" → "servis" */
export function foldTr(s: string): string {
  return trLower(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[çğıöşüâîûéèê]/g, (c) => FOLD[c] ?? c)
    .replace(/\s+/g, " ")
    .trim();
}

// Sol sınır: satır başı ya da harf olmayan karakter. Sağ taraf açık (Türkçe ekler: "servisi", "kuveri").
const B = "(?:^|[^a-z0-9])";
const FEE_PATTERNS: Array<{ kind: Exclude<BillFlagKind, "yuzde">; re: RegExp }> = [
  { kind: "kuver", re: new RegExp(`${B}(kuver|couvert|cover)`) },
  { kind: "masa", re: new RegExp(`${B}masa (ucret|bedel|paras)`) },
  { kind: "hizmet", re: new RegExp(`${B}hizmet (bedel|ucret)`) },
  { kind: "servis", re: new RegExp(`${B}(servis|garsoniye|service)`) },
  { kind: "bahsis", re: new RegExp(`${B}(bahsis|tip\\b|tips\\b)`) },
];
// Yalnızca yüzde yazan satır ("%10", "10 %"): genelde servis eklentisidir, sorulmalı.
const PERCENT_ONLY = /^(%\s*\d+([.,]\d+)?|\d+([.,]\d+)?\s*%)$/;

const KIND_TEXT: Record<Exclude<BillFlagKind, "bahsis" | "yuzde">, string> = {
  servis: "Servis ücreti",
  kuver: "Kuver ücreti",
  masa: "Masa ücreti",
  hizmet: "Hizmet bedeli",
};

/** Bir fiş satırını ek ücret türüne eşler; eşleşmezse null */
export function classifyBillLine(label: string): BillFlagKind | null {
  const f = foldTr(label);
  if (!f) return null;
  if (PERCENT_ONLY.test(f)) return "yuzde";
  for (const { kind, re } of FEE_PATTERNS) if (re.test(f)) return kind;
  return null;
}

/** "1.250,50 ₺" → 1250.5; "1250,5" → 1250.5; "1.250" → 1250; "12.5" → 12.5; geçersizse NaN */
export function parseAmountTr(input: string): number {
  let s = input.replace(/[₺\s]|tl|try/gi, "");
  if (!s) return NaN;
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) s = s.replace(/\./g, "").replace(",", ".");
  else if (hasComma) s = s.replace(/\./g, "").replace(",", ".");
  else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

// ---------------------------------------------------------------- ana fonksiyon

const tl = (n: number) => `${fmtInt(n)} ₺`;

/** Yasal not yeme-içme mekânlarında (ya da mekân bilinmiyorsa) uygulanır */
function legalApplies(place: Place | undefined): boolean {
  if (!place) return true;
  const g = CATEGORIES[place.cat].group;
  return g === "yeme" || g === "yol";
}

const FISH_WORDS = /(balik|levrek|cipura|kalkan|lufer|barbun|hamsi|sardalya|istavrit|palamut|karides|kalamar|ahtapot|midye|kilo|\bkg\b|gram|\bgr\b)/;

export function checkBill(input: BillCheckInput): BillCheck {
  const travelers = Math.max(1, Math.round(input.travelers) || 1);
  const lines = input.lines
    .map((l, i) => ({ label: (l.label ?? "").trim(), amount: Number(l.amount), i }))
    .filter((l) => Number.isFinite(l.amount) && (l.amount !== 0 || l.label));
  const linesSumTry = round2(lines.reduce((a, l) => a + l.amount, 0));
  const hasTotal = input.total !== undefined && Number.isFinite(input.total) && input.total > 0;
  const totalTry = round2(hasTotal ? input.total! : linesSumTry);
  const perPersonTry = round2(totalTry / travelers);
  const legalCtx = legalApplies(input.place);

  // (a) ek ücret satırları
  const flags: BillFlag[] = [];
  for (const l of lines) {
    const kind = classifyBillLine(l.label);
    if (!kind) continue;
    let message: string;
    let legal = false;
    if (kind === "bahsis") {
      message = "Bahşiş isteğe bağlıdır; hesaba kendiliğinden eklenmişse çıkarılmasını isteyebilirsin.";
      legal = legalCtx;
    } else if (kind === "yuzde") {
      message = "Bu satır yüzde eklentisine benziyor; ne için alındığını sor.";
    } else if (legalCtx) {
      message = `${KIND_TEXT[kind]} gibi görünüyor: 30 Ocak 2026'dan bu yana yeme-içme işletmelerinde zorunlu ek ücret olarak alınamaz.`;
      legal = true;
    } else {
      message = `${KIND_TEXT[kind]} gibi görünüyor; ne için alındığını sor.`;
    }
    flags.push({ lineIndex: l.i, label: l.label, amount: round2(l.amount), kind, message, legal });
  }
  const flaggedTry = round2(flags.filter((f) => f.legal && f.amount > 0).reduce((a, f) => a + f.amount, 0));

  // (b) satır toplamı ↔ hesap toplamı
  let mismatch: BillCheck["mismatch"] = null;
  if (hasTotal && lines.length > 0) {
    const diff = round2(totalTry - linesSumTry);
    if (Math.abs(diff) > MISMATCH_TOLERANCE_TRY) mismatch = { linesSumTry, totalTry, diffTry: diff };
  }

  // (c) tahminle kıyas (yalnız yeme-içme ve giriş ücretli gezi; konaklama/alışveriş hariç)
  let comparison: BillComparison | null = null;
  const place = input.place;
  if (place && totalTry > 0 && !place.slots.includes("konaklama") && CATEGORIES[place.cat].group !== "alisveris") {
    const est = estimatePlaceCost(place, { travelers, visitor: input.visitor, date: input.date, ...(input.fx ? { fx: input.fx } : {}) });
    if (est.kind !== "free" && est.amountTry > 0) {
      const estPP = est.amountTry / travelers;
      const ratio = perPersonTry / estPP;
      const level: BillLevel = ratio <= BILL_RATIO_THRESHOLDS.makul ? "makul" : ratio <= BILL_RATIO_THRESHOLDS.birazYuksek ? "biraz_yuksek" : "cok_yuksek";
      const basis = est.kind === "observed" ? "kaynaklı bir fiyat gözlemine" : "kaba bir kategori ortalamasına";
      comparison = {
        level,
        label: LEVEL_LABELS[level],
        ratio: Math.round(ratio * 100) / 100,
        actualPerPersonTry: perPersonTry,
        estimatePerPersonTry: Math.round(estPP),
        estimateKind: est.kind,
        ...(est.observedAt ? { observedAt: est.observedAt } : {}),
        note:
          `Kişi başı ${tl(perPersonTry)}; uygulamanın tahmini kişi başı ~${tl(estPP)} (${fmtDec(ratio, 1)} kat). ` +
          `Bu yalnızca ${basis} dayanan bir tahmin kıyası, suçlama değil: sipariş ettiklerin, içecekler ve mekânın seviyesi farkı açıklayabilir.`,
      };
    }
  }

  // (d) öneriler
  const advice: string[] = [];
  const legalFlags = flags.filter((f) => f.legal && f.kind !== "bahsis");
  if (legalFlags.length) advice.push("Servis/kuver/masa ücreti satırını kibarca hesaptan çıkarmalarını iste.");
  if (flags.some((f) => f.kind === "bahsis")) advice.push("Bahşiş vermek istersen ayrıca, kendi isteğinle bırak.");
  if (flags.some((f) => f.kind === "yuzde" || !f.legal)) advice.push("Anlamadığın satırın ne olduğunu sor.");
  if (mismatch) {
    advice.push(
      mismatch.diffTry > 0
        ? "Toplam, girdiğin satırlardan fazla: fişi kalem kalem kontrol et, görmediğin bir kalem varsa sor."
        : "Toplam, girdiğin satırlardan az: eksik ya da indirimli bir satır olabilir, fişle karşılaştır.",
    );
  }
  advice.push("Menüde basılı fiyatları iste ve hesabı menüyle karşılaştır.");
  const fishy =
    (place && (place.cat === "balikci" || place.cat === "meyhane")) || lines.some((l) => FISH_WORDS.test(foldTr(l.label)));
  if (fishy) advice.push("Kiloyla satılan balıkta pişmeden önce kilo fiyatını ve ağırlığı sor.");
  if (legalCtx) advice.push("İstemediğin meze, çerez ya da kuver masaya gelirse ücretli olup olmadığını baştan sor.");
  if (comparison && comparison.level !== "makul") advice.push("Ödemeden önce adisyonun dökümünü iste; içecek ve ekstraları tek tek gör.");

  // genel ton ve başlık
  const verdict: BillCheck["verdict"] = legalFlags.length
    ? "sorun"
    : mismatch || flags.length || (comparison && comparison.level !== "makul")
      ? "dikkat"
      : "iyi";
  let headline: string;
  if (totalTry <= 0) headline = "Kontrol için bir toplam ya da satır gir.";
  else if (legalFlags.length) headline = `Hesapta alınamayacak bir ek ücret var gibi görünüyor (${tl(flaggedTry)}).`;
  else if (mismatch) headline = `Satırlar ile toplam arasında ${tl(Math.abs(mismatch.diffTry))} fark var.`;
  else if (comparison && comparison.level === "cok_yuksek") headline = "Hesap, tahminimizin çok üzerinde.";
  else if (comparison && comparison.level === "biraz_yuksek") headline = "Hesap, tahminimizin biraz üzerinde.";
  else if (flags.length) headline = "Sorulması gereken bir satır var.";
  else if (comparison) headline = "Hesap, tahminimize göre makul görünüyor.";
  else headline = "Hesapta yasak bir ek ücret satırı görünmüyor.";

  return {
    totalTry,
    linesSumTry,
    perPersonTry,
    flags,
    flaggedTry,
    mismatch,
    comparison,
    verdict,
    headline,
    advice,
    legalNote: legalCtx ? BILL_LEGAL_NOTE : null,
  };
}
