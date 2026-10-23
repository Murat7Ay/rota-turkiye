// Ortak test verisi. Koordinatlar gerçeğe yakın; "(test)" ile biten adlar ve bütün çalışma
// saatleri test için uydurulmuştur, gerçek veri değildir. Bu dosyayı değiştirmeyin; ek veri
// gerekiyorsa kendi test dosyanızda bu listeyi genişletin.
import type { Place, PlaceCategory, PlaceTag, RegionPack, TripRequest } from "../src/types";
import { CATEGORIES } from "../src/catalog";

let n = 0;
function p(
  name: string,
  cat: PlaceCategory,
  lat: number,
  lon: number,
  extra: Partial<Place> & { tags?: PlaceTag[] } = {},
): Place {
  const info = CATEGORIES[cat];
  return {
    id: extra.id ?? `fx:${++n}`,
    name,
    cat,
    loc: { lat, lon },
    slots: extra.slots ?? info.slots,
    visitMin: extra.visitMin ?? info.visitMin,
    notability: extra.notability ?? 0.3,
    tags: extra.tags ?? [],
    source: "curated",
    ...extra,
  };
}

export const SELCUK = { name: "Selçuk", loc: { lat: 37.9507, lon: 27.3686 } };
export const PAMUKKALE = { name: "Pamukkale", loc: { lat: 37.9204, lon: 29.1206 } };
export const IZMIR = { name: "İzmir", loc: { lat: 38.4237, lon: 27.1428 } };
export const SULTANAHMET = { name: "Sultanahmet", loc: { lat: 41.0058, lon: 28.9768 } };

export const PLACES: Place[] = [
  // --- Selçuk / Efes
  p("Efes Antik Kenti", "antik_kent", 37.9395, 27.3417, { id: "fx:efes", notability: 1, tags: ["unesco", "muzekart", "wikidata", "tarihi"], openingHours: "Apr-Oct Mo-Su 08:00-19:00; Nov-Mar Mo-Su 08:30-17:30", priceForeign: { amount: 40, currency: "EUR", perPerson: true, observedAt: "2026-05-01", source: "test", kind: "observed" } }),
  p("Efes Müzesi", "muze", 37.9466, 27.3664, { id: "fx:efes-muze", notability: 0.75, tags: ["muzekart", "wikidata"], openingHours: "Mo-Su 08:00-18:30" }),
  p("Artemis Tapınağı", "antik_kent", 37.9497, 27.3639, { id: "fx:artemis", notability: 0.8, tags: ["tarihi", "wikidata"], visitMin: 30 }),
  p("İsa Bey Camii", "cami", 37.9512, 27.3678, { id: "fx:isabey", notability: 0.7, tags: ["tarihi", "wikidata"] }),
  p("Ayasuluk Kalesi", "tarihi_yapi", 37.9533, 27.3678, { id: "fx:ayasuluk", notability: 0.8, tags: ["tarihi", "wikidata", "manzara"] }),
  p("Meryem Ana Evi", "tarihi_yapi", 37.9119, 27.3335, { id: "fx:meryem", notability: 0.85, tags: ["wikidata"] }),
  p("Şirince Köyü Manzara (test)", "manzara", 37.944, 27.434, { id: "fx:sirince", notability: 0.7, tags: ["manzara", "tarihi"] }),
  p("Selçuk Esnaf Lokantası (test)", "esnaf_lokantasi", 37.9502, 27.3691, { id: "fx:esnaf1", notability: 0.4, tags: ["yerel"], quality: 0.8 }),
  p("Pazar Yeri Lokantası (test)", "esnaf_lokantasi", 37.9489, 27.3702, { id: "fx:esnaf2", notability: 0.3, quality: 0.7 }),
  p("Köfteci Ali (test)", "kebapci", 37.9511, 27.3699, { id: "fx:kofte", notability: 0.3, quality: 0.75 }),
  p("Kale Altı Restoran (test)", "restoran", 37.9527, 27.3671, { id: "fx:rest1", notability: 0.35, quality: 0.7, priceTier: 3, alcohol: true }),
  p("Selçuk Meyhanesi (test)", "meyhane", 37.9497, 27.3712, { id: "fx:meyhane", notability: 0.3, alcohol: true }),
  p("Şirince Köy Kahvaltısı (test)", "kahvalti", 37.9437, 27.4331, { id: "fx:kahvalti1", notability: 0.5, tags: ["yerel"], quality: 0.85 }),
  p("Selçuk Kahvaltı Evi (test)", "kahvalti", 37.9505, 27.3683, { id: "fx:kahvalti2", notability: 0.3, quality: 0.7 }),
  p("Selçuk Çay Bahçesi (test)", "cay_bahcesi", 37.9514, 27.3662, { id: "fx:cay1", notability: 0.35, tags: ["yerel"] }),
  p("Kahvehane (test)", "kahvehane", 37.9493, 27.3688, { id: "fx:kahvehane", notability: 0.2 }),
  p("Şirince Tatlıcısı (test)", "tatlici", 37.9442, 27.4336, { id: "fx:tatli1", notability: 0.35 }),
  p("Selçuk Cumartesi Pazarı (test)", "pazar", 37.9481, 27.3707, { id: "fx:pazar", notability: 0.5, openingHours: "Sa 08:00-18:00", tags: ["yerel"] }),
  p("Şirince Yöresel Ürünler (test)", "yoresel_urun", 37.9439, 27.4339, { id: "fx:yoresel", notability: 0.35, tags: ["cografi_isaret"] }),
  p("Selçuk Otel (test)", "otel", 37.9509, 27.3681, { id: "fx:otel-selcuk", notability: 0.3, quality: 0.75 }),
  p("Şirince Pansiyon (test)", "pansiyon", 37.9436, 27.4329, { id: "fx:pansiyon-sirince", notability: 0.4, quality: 0.85 }),

  // --- Selçuk → Pamukkale koridoru (E87 / D320 boyunca)
  p("Aydın Tarihi Tatlıcı (test)", "tatlici", 37.8452, 27.8414, { id: "fx:aydin-tatli", notability: 0.6, tags: ["tarihi", "yerel"] }),
  p("Nysa Antik Kenti", "antik_kent", 37.9027, 28.1485, { id: "fx:nysa", notability: 0.75, tags: ["tarihi", "wikidata", "muzekart"] }),
  p("Tripolis Antik Kenti", "antik_kent", 37.9746, 28.9566, { id: "fx:tripolis", notability: 0.6, tags: ["tarihi", "wikidata"] }),
  p("Afrodisias Antik Kenti", "antik_kent", 37.7088, 28.7238, { id: "fx:afrodisias", notability: 0.95, tags: ["unesco", "wikidata", "muzekart"] }),
  p("Yol Kenarı Dinlenme (test)", "dinlenme_tesisi", 37.87, 28.4, { id: "fx:dinlenme", notability: 0.1 }),

  // --- Pamukkale
  p("Hierapolis ve Pamukkale Travertenleri", "antik_kent", 37.9257, 29.1239, { id: "fx:hierapolis", notability: 1, tags: ["unesco", "wikidata", "muzekart", "manzara"] }),
  p("Laodikeia Antik Kenti", "antik_kent", 37.8358, 29.1075, { id: "fx:laodikeia", notability: 0.75, tags: ["wikidata", "muzekart"] }),
  p("Pamukkale Lokantası (test)", "esnaf_lokantasi", 37.9199, 29.1199, { id: "fx:pk-esnaf", notability: 0.3, quality: 0.7 }),
  p("Pamukkale Restoran (test)", "restoran", 37.9211, 29.1195, { id: "fx:pk-rest", notability: 0.3, quality: 0.7 }),
  p("Pamukkale Kahvaltı (test)", "kahvalti", 37.9207, 29.1212, { id: "fx:pk-kahvalti", notability: 0.3 }),
  p("Pamukkale Çay Bahçesi (test)", "cay_bahcesi", 37.9215, 29.1221, { id: "fx:pk-cay", notability: 0.3 }),
  p("Pamukkale Otel (test)", "otel", 37.9202, 29.1203, { id: "fx:otel-pk", notability: 0.3, quality: 0.7 }),

  // --- Sultanahmet (golden testler: Topkapı salı kapalı, Kapalıçarşı pazar kapalı)
  p("Topkapı Sarayı", "muze", 41.0115, 28.9834, { id: "fx:topkapi", notability: 1, tags: ["unesco", "wikidata"], openingHours: "Mo,We-Su 09:00-18:00", visitMin: 150 }),
  p("Ayasofya", "cami", 41.0086, 28.9802, { id: "fx:ayasofya", notability: 1, tags: ["unesco", "wikidata"] }),
  p("Sultanahmet Camii", "cami", 41.0054, 28.9768, { id: "fx:sultanahmet", notability: 0.95, tags: ["wikidata"] }),
  p("Kapalıçarşı", "carsi", 41.0107, 28.9681, { id: "fx:kapalicarsi", notability: 0.95, tags: ["wikidata", "tarihi"], openingHours: "Mo-Sa 08:30-19:00; Su off" }),
  p("İstanbul Arkeoloji Müzeleri", "muze", 41.0117, 28.9813, { id: "fx:arkeoloji", notability: 0.85, tags: ["wikidata", "muzekart"], openingHours: "Tu-Su 09:00-17:00" }),
  p("Sultanahmet Esnaf (test)", "esnaf_lokantasi", 41.0079, 28.9741, { id: "fx:ist-esnaf", notability: 0.3 }),
  p("Sultanahmet Restoran (test)", "restoran", 41.0062, 28.9735, { id: "fx:ist-rest", notability: 0.3 }),
  p("Sultanahmet Kahvaltı (test)", "kahvalti", 41.0071, 28.9752, { id: "fx:ist-kahvalti", notability: 0.3 }),
  p("Gülhane Çay Bahçesi (test)", "cay_bahcesi", 41.0128, 28.9812, { id: "fx:ist-cay", notability: 0.4 }),
  p("Sultanahmet Otel (test)", "otel", 41.0068, 28.9748, { id: "fx:otel-ist", notability: 0.3 }),
];

export const MINI_PACK: RegionPack = {
  id: "test",
  name: "Test paketi",
  version: "0",
  generatedAt: "2026-10-24T00:00:00Z",
  bbox: [27, 37.5, 29.3, 41.1],
  attribution: "test",
  towns: [
    { id: "selcuk", name: "Selçuk", loc: SELCUK.loc, kind: "town" },
    { id: "pamukkale", name: "Pamukkale", loc: PAMUKKALE.loc, kind: "town" },
    { id: "sultanahmet", name: "Sultanahmet", loc: SULTANAHMET.loc, kind: "town" },
  ],
  places: PLACES,
};

/** 2026-10-27 salı. Selçuk'ta 2 gece, Pamukkale'de 1 gece. */
export const EGE_REQUEST: TripRequest = {
  title: "Ege test gezisi",
  startDate: "2026-10-27",
  start: IZMIR,
  stays: [
    { id: "selcuk", name: "Selçuk", loc: SELCUK.loc, nights: 2 },
    { id: "pamukkale", name: "Pamukkale", loc: PAMUKKALE.loc, nights: 1 },
  ],
  travelers: 2,
  pace: "dengeli",
  interests: ["tarih", "yemek"],
  budget: { amount: 30000, currency: "TRY" },
  transport: "araba",
  dayStart: "08:30",
  dayEnd: "22:00",
  diet: {},
  visitor: "yerli",
};

/** Selçuk → Pamukkale yolunu kabaca izleyen çizgi (Aydın, Nazilli, Sarayköy üzerinden) */
export const ROUTE_SELCUK_PAMUKKALE: Array<[number, number]> = [
  [27.3686, 37.9507],
  [27.6, 37.86],
  [27.8414, 37.8452],
  [28.15, 37.89],
  [28.36, 37.91],
  [28.75, 37.95],
  [28.96, 37.97],
  [29.1206, 37.9204],
];
