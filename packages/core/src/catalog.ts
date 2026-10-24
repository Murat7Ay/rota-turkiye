import type { Interest, Pace, PlaceCategory, Slot } from "./types";

export type CategoryGroup = "gezi" | "yeme" | "alisveris" | "konaklama" | "yol";

export interface CategoryInfo {
  label: string;
  group: CategoryGroup;
  slots: Slot[];
  /** Tipik ziyaret süresi, dakika */
  visitMin: number;
  /** Mekânın kendi verisi yoksa kullanılan OSM opening_hours. Boş: veri olmadan planlanmaz. */
  defaultHours: string;
  indoor: boolean;
  interests: Interest[];
  emoji: string;
}

export const CATEGORIES: Record<PlaceCategory, CategoryInfo> = {
  antik_kent: { label: "Antik kent", group: "gezi", slots: ["gezi"], visitMin: 120, defaultHours: "Apr-Oct Mo-Su 08:00-19:00; Nov-Mar Mo-Su 08:30-17:00", indoor: false, interests: ["tarih", "fotograf", "kultur"], emoji: "🏛️" },
  muze: { label: "Müze", group: "gezi", slots: ["gezi"], visitMin: 75, defaultHours: "Mo-Su 09:00-17:00", indoor: true, interests: ["tarih", "kultur"], emoji: "🏺" },
  tarihi_yapi: { label: "Tarihi yapı", group: "gezi", slots: ["gezi"], visitMin: 40, defaultHours: "Mo-Su 09:00-18:00", indoor: false, interests: ["tarih", "kultur", "fotograf"], emoji: "🏰" },
  cami: { label: "Cami", group: "gezi", slots: ["gezi"], visitMin: 25, defaultHours: "Mo-Su 07:00-21:00", indoor: true, interests: ["kultur", "tarih"], emoji: "🕌" },
  dogal_alan: { label: "Doğal alan", group: "gezi", slots: ["gezi"], visitMin: 90, defaultHours: "Mo-Su 07:00-19:00", indoor: false, interests: ["doga", "fotograf"], emoji: "🌿" },
  manzara: { label: "Manzara noktası", group: "gezi", slots: ["gezi"], visitMin: 20, defaultHours: "24/7", indoor: false, interests: ["fotograf", "doga"], emoji: "🌄" },
  plaj: { label: "Plaj", group: "gezi", slots: ["gezi"], visitMin: 150, defaultHours: "Mo-Su 08:00-19:00", indoor: false, interests: ["deniz", "doga"], emoji: "🏖️" },

  kahvalti: { label: "Kahvaltı salonu", group: "yeme", slots: ["kahvalti"], visitMin: 60, defaultHours: "Mo-Su 07:30-14:00", indoor: true, interests: ["yemek"], emoji: "🍳" },
  esnaf_lokantasi: { label: "Esnaf lokantası", group: "yeme", slots: ["ogle"], visitMin: 45, defaultHours: "Mo-Sa 10:30-18:00", indoor: true, interests: ["yemek", "kultur"], emoji: "🍲" },
  restoran: { label: "Restoran", group: "yeme", slots: ["ogle", "aksam"], visitMin: 75, defaultHours: "Mo-Su 11:00-23:00", indoor: true, interests: ["yemek"], emoji: "🍽️" },
  kebapci: { label: "Kebapçı / ocakbaşı", group: "yeme", slots: ["ogle", "aksam"], visitMin: 60, defaultHours: "Mo-Su 11:00-23:00", indoor: true, interests: ["yemek"], emoji: "🥙" },
  pideci: { label: "Pideci", group: "yeme", slots: ["ogle", "aksam"], visitMin: 50, defaultHours: "Mo-Su 10:00-22:00", indoor: true, interests: ["yemek"], emoji: "🫓" },
  meyhane: { label: "Meyhane", group: "yeme", slots: ["aksam"], visitMin: 120, defaultHours: "Mo-Su 17:00-01:00", indoor: true, interests: ["yemek", "kultur"], emoji: "🍷" },
  balikci: { label: "Balıkçı", group: "yeme", slots: ["ogle", "aksam"], visitMin: 90, defaultHours: "Mo-Su 12:00-24:00", indoor: false, interests: ["yemek", "deniz"], emoji: "🐟" },
  kafe: { label: "Kafe", group: "yeme", slots: ["cay"], visitMin: 40, defaultHours: "Mo-Su 08:00-23:00", indoor: true, interests: [], emoji: "☕" },
  cay_bahcesi: { label: "Çay bahçesi", group: "yeme", slots: ["cay"], visitMin: 40, defaultHours: "Mo-Su 08:00-23:00", indoor: false, interests: ["kultur"], emoji: "🫖" },
  kahvehane: { label: "Kahvehane", group: "yeme", slots: ["cay"], visitMin: 30, defaultHours: "Mo-Su 07:00-23:00", indoor: true, interests: ["kultur"], emoji: "🫖" },
  tatlici: { label: "Tatlıcı", group: "yeme", slots: ["tatli"], visitMin: 30, defaultHours: "Mo-Su 09:00-23:00", indoor: true, interests: ["tatli", "yemek"], emoji: "🍯" },
  firin: { label: "Fırın", group: "yeme", slots: ["kahvalti", "tatli"], visitMin: 15, defaultHours: "Mo-Su 07:00-21:00", indoor: true, interests: ["yemek"], emoji: "🥨" },

  carsi: { label: "Tarihi çarşı", group: "alisveris", slots: ["alisveris", "gezi"], visitMin: 60, defaultHours: "Mo-Sa 09:00-19:00", indoor: false, interests: ["alisveris", "kultur", "tarih"], emoji: "🛍️" },
  pazar: { label: "Semt pazarı", group: "alisveris", slots: ["alisveris"], visitMin: 45, defaultHours: "", indoor: false, interests: ["alisveris", "kultur", "yemek"], emoji: "🧺" },
  yoresel_urun: { label: "Yöresel ürün", group: "alisveris", slots: ["alisveris"], visitMin: 25, defaultHours: "Mo-Sa 09:00-20:00", indoor: true, interests: ["alisveris", "yemek"], emoji: "🫒" },
  hediyelik: { label: "Hediyelik", group: "alisveris", slots: ["alisveris"], visitMin: 20, defaultHours: "Mo-Su 09:00-21:00", indoor: true, interests: ["alisveris"], emoji: "🎁" },

  otel: { label: "Otel", group: "konaklama", slots: ["konaklama"], visitMin: 0, defaultHours: "24/7", indoor: true, interests: [], emoji: "🏨" },
  pansiyon: { label: "Pansiyon", group: "konaklama", slots: ["konaklama"], visitMin: 0, defaultHours: "24/7", indoor: true, interests: [], emoji: "🏡" },
  butik_otel: { label: "Butik otel", group: "konaklama", slots: ["konaklama"], visitMin: 0, defaultHours: "24/7", indoor: true, interests: [], emoji: "🏩" },
  kamp: { label: "Kamp alanı", group: "konaklama", slots: ["konaklama"], visitMin: 0, defaultHours: "24/7", indoor: false, interests: ["doga"], emoji: "⛺" },

  dinlenme_tesisi: { label: "Dinlenme tesisi", group: "yol", slots: ["cay"], visitMin: 30, defaultHours: "24/7", indoor: true, interests: [], emoji: "⛽" },
};

export const SLOT_LABELS: Record<Slot, string> = {
  kahvalti: "Kahvaltı",
  ogle: "Öğle yemeği",
  aksam: "Akşam yemeği",
  cay: "Çay molası",
  tatli: "Tatlı molası",
  alisveris: "Alışveriş",
  gezi: "Gezi",
  konaklama: "Konaklama",
};

/** Yuvaya varış penceresi (gün içi dakika). Gezi yuvası günün tamamına açıktır. */
export const SLOT_WINDOWS: Record<Exclude<Slot, "gezi" | "konaklama">, [number, number]> = {
  kahvalti: [7 * 60 + 30, 10 * 60 + 30],
  ogle: [12 * 60, 14 * 60 + 30],
  aksam: [19 * 60, 21 * 60 + 30],
  cay: [15 * 60, 18 * 60 + 30],
  tatli: [14 * 60 + 30, 21 * 60 + 30],
  alisveris: [10 * 60, 19 * 60],
};

export interface PaceTemplate {
  /** Mutlaka doldurulmaya çalışılan yuvalar (yemekler) */
  required: Slot[];
  /** Varsa eklenen yuvalar */
  optional: Slot[];
  /** En fazla gezi durağı */
  maxGezi: number;
  /** Duraklar arası nefes payı, dakika */
  bufferMin: number;
}

export const PACE_TEMPLATES: Record<Pace, PaceTemplate> = {
  sakin: { required: ["kahvalti", "ogle", "aksam"], optional: ["cay"], maxGezi: 2, bufferMin: 20 },
  dengeli: { required: ["kahvalti", "ogle", "aksam"], optional: ["cay", "alisveris"], maxGezi: 4, bufferMin: 10 },
  yogun: { required: ["kahvalti", "ogle", "aksam"], optional: ["cay", "tatli", "alisveris"], maxGezi: 6, bufferMin: 5 },
};

export function categoryInfo(cat: PlaceCategory): CategoryInfo {
  return CATEGORIES[cat];
}
