import type { Currency, FxRates, Money, Place, PlaceCategory, PriceObservation, Visitor } from "./types";
import { daysBetween } from "./time";

/** TCMB döviz satış, 23 Ekim 2026 (today.xml). Canlı kur gelmezse bu kullanılır. */
export const DEFAULT_FX: FxRates = {
  date: "2026-10-23",
  source: "https://www.tcmb.gov.tr/kurlar/today.xml",
  tryPer: { TRY: 1, USD: 49.654, EUR: 55.5997 },
};

/** Eylül 2026 aylık TÜFE %1,84 (TÜİK, Forbes TR haberi). Fiyat endekslemede kullanılır. */
export const MONTHLY_INFLATION = 0.0184;

export function toTry(m: Money, fx: FxRates = DEFAULT_FX): number {
  return m.amount * fx.tryPer[m.currency];
}

export function fromTry(amountTry: number, currency: Currency, fx: FxRates = DEFAULT_FX): number {
  return amountTry / fx.tryPer[currency];
}

/**
 * Bir fiyat gözlemini verilen tarihe taşır. TRY fiyatlar aylık enflasyonla endekslenir,
 * avro/dolar fiyatlar (yabancı müze bileti gibi) dövizde sabit kalıp günün kuruyla çevrilir.
 */
export function indexPrice(obs: PriceObservation, atDate: string, fx: FxRates = DEFAULT_FX, monthly = MONTHLY_INFLATION): number {
  if (obs.currency !== "TRY") return toTry({ amount: obs.amount, currency: obs.currency }, fx);
  const months = Math.max(0, daysBetween(obs.observedAt, atDate) / 30.44);
  return obs.amount * (1 + monthly) ** months;
}

const KARE = "https://www.karekod.org/blog/lokanta-fiyatlari-guncel-esnaf-lokantasi-ve-restoran-fiyatlari/";
const KAHV = "https://istanbul.com/blog/food-drink/best-turkish-breakfast-istanbul";

const est = (amount: number, observedAt = "2026-10-01"): PriceObservation => ({
  amount,
  currency: "TRY",
  perPerson: true,
  observedAt,
  source: "model",
  kind: "estimate",
});

/**
 * Kategori fiyat modeli (kişi başı, TRY). Kaynağı olanlar "observed", geri kalanlar kaba model
 * tahminidir ve arayüzde "tahmini" diye gösterilir. Gerçek fişler geldikçe bunların yerini alır.
 */
export const CATEGORY_PRICE: Partial<Record<PlaceCategory, PriceObservation>> = {
  esnaf_lokantasi: { amount: 525, currency: "TRY", perPerson: true, observedAt: "2026-03-15", source: KARE, kind: "observed" },
  kahvalti: { amount: 525, currency: "TRY", perPerson: true, observedAt: "2026-04-15", source: KAHV, kind: "observed" },
  restoran: est(900),
  kebapci: est(650),
  pideci: est(420),
  meyhane: est(1600),
  balikci: est(1500),
  kafe: est(200),
  cay_bahcesi: est(80),
  kahvehane: est(60),
  tatlici: est(250),
  firin: est(80),
  muze: est(300),
  antik_kent: est(450),
  dinlenme_tesisi: est(150),
};

/** Oda/gece (2 kişilik oda), TRY — model tahmini */
export const LODGING_PRICE: Partial<Record<PlaceCategory, PriceObservation>> = {
  pansiyon: { ...est(2200), perPerson: false },
  otel: { ...est(3500), perPerson: false },
  butik_otel: { ...est(5200), perPerson: false },
  kamp: { ...est(900), perPerson: false },
};

/** 20 Ekim 2026 İstanbul Avrupa yakası pompa fiyatları (Dünya). */
export const FUEL = { benzinTryPerL: 79.6, motorinTryPerL: 96.7, observedAt: "2026-10-20", litersPer100Km: 6.5 };

export interface CostContext {
  travelers: number;
  visitor: Visitor;
  hasMuzekart?: boolean;
  /** Maliyetin hesaplandığı gün, YYYY-MM-DD */
  date: string;
  fx?: FxRates;
}

export interface CostEstimate {
  /** Bütün yolcular için, TRY */
  amountTry: number;
  kind: "observed" | "estimate" | "free";
  observedAt?: string;
}

/** Bir mekân ziyaretinin bütün yolcular için tahmini maliyeti */
export function estimatePlaceCost(place: Place, ctx: CostContext): CostEstimate {
  const fx = ctx.fx ?? DEFAULT_FX;
  const isTicketed = place.cat === "muze" || place.cat === "antik_kent";
  if (isTicketed && ctx.visitor === "yerli" && ctx.hasMuzekart && place.tags.includes("muzekart")) {
    return { amountTry: 0, kind: "free" };
  }
  const obs =
    (ctx.visitor === "yabanci" && place.priceForeign) ||
    place.price ||
    (place.slots.includes("konaklama") ? LODGING_PRICE[place.cat] : CATEGORY_PRICE[place.cat]);
  if (!obs) return { amountTry: 0, kind: "free" };
  const unit = indexPrice(obs, ctx.date, fx);
  const tierFactor = place.priceTier && !place.price ? [0, 0.7, 1, 1.6, 2.6][place.priceTier]! : 1;
  const units = obs.perPerson ? ctx.travelers : Math.ceil(ctx.travelers / 2);
  return { amountTry: Math.round(unit * tierFactor * units), kind: obs.kind, observedAt: obs.observedAt };
}

/** Araçla gidilen mesafenin yakıt maliyeti (benzinli varsayım), TRY */
export function fuelCostTry(km: number): number {
  return Math.round((km / 100) * FUEL.litersPer100Km * FUEL.benzinTryPerL);
}
