// Türkiye'nin 81 ili: plaka, ad, il merkezi (yaklaşık, 2 ondalık) ve coğrafi bölge.
// İl ataması bir ilerleme haritası içindir, kadastro değildir: önce mekânın `city`
// (OSM addr:city) ipucu, yoksa en yakın merkez kullanılır. Kıyıdaki büyük ilçeler en yakın
// il merkezine göre yanlış ile düşebildiği için birkaç ilçe merkezi ek "işaret noktası"
// olarak kendi iline bağlanmıştır.
import { haversineKm } from "./geo";
import type { LatLng } from "./types";

export type GeoRegion =
  | "Marmara"
  | "Ege"
  | "Akdeniz"
  | "İç Anadolu"
  | "Karadeniz"
  | "Doğu Anadolu"
  | "Güneydoğu Anadolu";

export interface Province {
  plate: number;
  name: string;
  loc: LatLng;
  region: GeoRegion;
}

const R: Record<string, GeoRegion> = {
  M: "Marmara",
  E: "Ege",
  A: "Akdeniz",
  I: "İç Anadolu",
  K: "Karadeniz",
  D: "Doğu Anadolu",
  G: "Güneydoğu Anadolu",
};

// [plaka, ad, enlem, boylam, bölge]
const TABLE: ReadonlyArray<readonly [number, string, number, number, string]> = [
  [1, "Adana", 37.0, 35.32, "A"],
  [2, "Adıyaman", 37.76, 38.28, "G"],
  [3, "Afyonkarahisar", 38.76, 30.54, "E"],
  [4, "Ağrı", 39.72, 43.05, "D"],
  [5, "Amasya", 40.65, 35.83, "K"],
  [6, "Ankara", 39.93, 32.85, "I"],
  [7, "Antalya", 36.89, 30.71, "A"],
  [8, "Artvin", 41.18, 41.82, "K"],
  [9, "Aydın", 37.85, 27.84, "E"],
  [10, "Balıkesir", 39.65, 27.89, "M"],
  [11, "Bilecik", 40.14, 29.98, "M"],
  [12, "Bingöl", 38.88, 40.5, "D"],
  [13, "Bitlis", 38.4, 42.11, "D"],
  [14, "Bolu", 40.74, 31.61, "K"],
  [15, "Burdur", 37.72, 30.29, "A"],
  [16, "Bursa", 40.19, 29.06, "M"],
  [17, "Çanakkale", 40.15, 26.41, "M"],
  [18, "Çankırı", 40.6, 33.62, "I"],
  [19, "Çorum", 40.55, 34.95, "K"],
  [20, "Denizli", 37.78, 29.09, "E"],
  [21, "Diyarbakır", 37.91, 40.24, "G"],
  [22, "Edirne", 41.68, 26.56, "M"],
  [23, "Elazığ", 38.68, 39.22, "D"],
  [24, "Erzincan", 39.75, 39.49, "D"],
  [25, "Erzurum", 39.9, 41.27, "D"],
  [26, "Eskişehir", 39.78, 30.52, "I"],
  [27, "Gaziantep", 37.07, 37.38, "G"],
  [28, "Giresun", 40.91, 38.39, "K"],
  [29, "Gümüşhane", 40.46, 39.48, "K"],
  [30, "Hakkari", 37.58, 43.74, "D"],
  [31, "Hatay", 36.2, 36.16, "A"],
  [32, "Isparta", 37.76, 30.55, "A"],
  [33, "Mersin", 36.81, 34.64, "A"],
  [34, "İstanbul", 41.01, 28.98, "M"],
  [35, "İzmir", 38.42, 27.14, "E"],
  [36, "Kars", 40.6, 43.1, "D"],
  [37, "Kastamonu", 41.38, 33.78, "K"],
  [38, "Kayseri", 38.72, 35.49, "I"],
  [39, "Kırklareli", 41.73, 27.22, "M"],
  [40, "Kırşehir", 39.15, 34.16, "I"],
  [41, "Kocaeli", 40.77, 29.92, "M"],
  [42, "Konya", 37.87, 32.48, "I"],
  [43, "Kütahya", 39.42, 29.98, "E"],
  [44, "Malatya", 38.35, 38.31, "D"],
  [45, "Manisa", 38.61, 27.43, "E"],
  [46, "Kahramanmaraş", 37.58, 36.94, "A"],
  [47, "Mardin", 37.31, 40.74, "G"],
  [48, "Muğla", 37.22, 28.36, "E"],
  [49, "Muş", 38.75, 41.51, "D"],
  [50, "Nevşehir", 38.62, 34.72, "I"],
  [51, "Niğde", 37.97, 34.68, "I"],
  [52, "Ordu", 40.98, 37.88, "K"],
  [53, "Rize", 41.02, 40.52, "K"],
  [54, "Sakarya", 40.78, 30.4, "M"],
  [55, "Samsun", 41.29, 36.33, "K"],
  [56, "Siirt", 37.93, 41.94, "G"],
  [57, "Sinop", 42.03, 35.15, "K"],
  [58, "Sivas", 39.75, 37.02, "I"],
  [59, "Tekirdağ", 40.98, 27.51, "M"],
  [60, "Tokat", 40.31, 36.55, "K"],
  [61, "Trabzon", 41.0, 39.72, "K"],
  [62, "Tunceli", 39.11, 39.55, "D"],
  [63, "Şanlıurfa", 37.17, 38.79, "G"],
  [64, "Uşak", 38.68, 29.41, "E"],
  [65, "Van", 38.49, 43.38, "D"],
  [66, "Yozgat", 39.82, 34.81, "I"],
  [67, "Zonguldak", 41.45, 31.79, "K"],
  [68, "Aksaray", 38.37, 34.03, "I"],
  [69, "Bayburt", 40.26, 40.23, "K"],
  [70, "Karaman", 37.18, 33.22, "I"],
  [71, "Kırıkkale", 39.85, 33.51, "I"],
  [72, "Batman", 37.89, 41.13, "G"],
  [73, "Şırnak", 37.52, 42.46, "G"],
  [74, "Bartın", 41.64, 32.34, "K"],
  [75, "Ardahan", 41.11, 42.7, "D"],
  [76, "Iğdır", 39.92, 44.04, "D"],
  [77, "Yalova", 40.66, 29.27, "M"],
  [78, "Karabük", 41.2, 32.62, "K"],
  [79, "Kilis", 36.72, 37.12, "G"],
  [80, "Osmaniye", 37.07, 36.25, "A"],
  [81, "Düzce", 40.84, 31.16, "K"],
];

export const PROVINCES: readonly Province[] = TABLE.map(([plate, name, lat, lon, r]) => ({
  plate,
  name,
  loc: { lat, lon },
  region: R[r]!,
}));

export const PROVINCE_COUNT = PROVINCES.length;

const byPlate = new Map(PROVINCES.map((p) => [p.plate, p]));

export function provinceByPlate(plate: number): Province | undefined {
  return byPlate.get(plate);
}

// İlçe merkezi işaret noktaları: [ilçe, enlem, boylam, plaka]. Yalnız en yakın il merkezinin
// yanlış sonuç verdiği bilinen turistik ilçeler (yaklaşık koordinat).
const DISTRICT_SITES: ReadonlyArray<readonly [string, number, number, number]> = [
  ["Selçuk", 37.95, 27.37, 35],
  ["Torbalı", 38.16, 27.36, 35],
  ["Tire", 38.09, 27.73, 35],
  ["Ödemiş", 38.23, 27.97, 35],
  ["Bergama", 39.12, 27.18, 35],
  ["Dikili", 39.07, 26.89, 35],
  ["Aliağa", 38.8, 26.97, 35],
  ["Çeşme", 38.32, 26.3, 35],
  ["Urla", 38.32, 26.77, 35],
  ["Seferihisar", 38.2, 26.84, 35],
  ["Salihli", 38.48, 28.14, 45],
  ["Ayvalık", 39.32, 26.69, 10],
  ["Edremit", 39.6, 27.02, 10],
  ["Burhaniye", 39.5, 26.97, 10],
  ["Bandırma", 40.35, 27.97, 10],
  ["Ayvacık", 39.6, 26.4, 17],
  ["Gelibolu", 40.41, 26.67, 17],
  ["Kuşadası", 37.86, 27.26, 9],
  ["Didim", 37.37, 27.27, 9],
  ["Söke", 37.75, 27.41, 9],
  ["Nazilli", 37.91, 28.32, 9],
  ["Karacasu", 37.73, 28.6, 9],
  ["Bodrum", 37.03, 27.43, 48],
  ["Milas", 37.32, 27.78, 48],
  ["Marmaris", 36.85, 28.27, 48],
  ["Datça", 36.73, 27.69, 48],
  ["Dalaman", 36.77, 28.8, 48],
  ["Fethiye", 36.62, 29.12, 48],
  ["Kaş", 36.2, 29.64, 7],
  ["Kemer", 36.6, 30.56, 7],
  ["Manavgat", 36.79, 31.44, 7],
  ["Alanya", 36.54, 32.0, 7],
  ["Ağlasun", 37.65, 30.53, 15],
  ["Silifke", 36.38, 33.93, 33],
  ["Anamur", 36.08, 32.84, 33],
  ["Şile", 41.18, 29.61, 34],
  ["Silivri", 41.07, 28.25, 34],
  ["İznik", 40.43, 29.72, 16],
  ["Mudanya", 40.38, 28.88, 16],
  ["Ürgüp", 38.63, 34.91, 50],
  ["Boğazkale", 40.02, 34.61, 19],
  ["Amasra", 41.75, 32.39, 74],
  ["Maçka", 40.81, 39.61, 61],
  ["Çaykara", 40.75, 40.24, 61],
  ["Hopa", 41.39, 41.43, 8],
  ["Doğubayazıt", 39.55, 44.08, 4],
  ["Midyat", 37.42, 41.34, 47],
  ["Halfeti", 37.25, 37.87, 63],
  ["Birecik", 37.03, 37.98, 63],
];

interface Site {
  loc: LatLng;
  province: Province;
}

const SITES: Site[] = [
  ...PROVINCES.map((p) => ({ loc: p.loc, province: p })),
  ...DISTRICT_SITES.map(([, lat, lon, plate]) => ({ loc: { lat, lon }, province: byPlate.get(plate)! })),
];

const FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Türkçe karakterleri sadeleştirip karşılaştırma anahtarı üretir ("İzmir" → "izmir") */
export function trKey(s: string): string {
  return s
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .replace(/[çğıöşüâîû]/g, (c) => FOLD[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

// addr:city ipuçları: il adları, ilçe işaret noktaları ve yaygın eski/kısa adlar
const HINTS = new Map<string, Province>();
for (const p of PROVINCES) HINTS.set(trKey(p.name), p);
for (const [name, , , plate] of DISTRICT_SITES) HINTS.set(trKey(name), byPlate.get(plate)!);
for (const [alias, plate] of [
  ["Afyon", 3],
  ["Antakya", 31],
  ["İçel", 33],
  ["İzmit", 41],
  ["Adapazarı", 54],
  ["Maraş", 46],
  ["Urfa", 63],
  ["Antep", 27],
] as const) {
  HINTS.set(trKey(alias), byPlate.get(plate)!);
}

/** İpucu ile bulunan il bu mesafeden uzaksa ipucu yok sayılır (yanlış etiket koruması), km */
const HINT_MAX_KM = 250;

/** Bir noktanın ili: önce `cityHint` (addr:city), yoksa en yakın il/ilçe merkezi */
export function provinceOf(loc: LatLng, cityHint?: string): Province {
  if (cityHint) {
    const hinted = HINTS.get(trKey(cityHint));
    if (hinted && haversineKm(loc, hinted.loc) <= HINT_MAX_KM) return hinted;
  }
  let best = SITES[0]!;
  let bestD = Infinity;
  for (const s of SITES) {
    const d = haversineKm(loc, s.loc);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best.province;
}

/** Türkiye'yi kabaca çevreleyen kutu: [minLon, minLat, maxLon, maxLat] (harita çizimi için) */
export const TURKEY_BBOX: readonly [number, number, number, number] = [25.6, 35.8, 44.85, 42.15];
