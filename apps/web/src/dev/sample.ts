// ⚠️ TEST VERİSİ — yalnızca geliştirme ve demo içindir.
// Gerçek bölge paketi (packs/*.json) bulunamadığında ya da çekirdek fonksiyonlar henüz
// hazır değilken arayüzün çizilebilmesi için elle hazırlanmış küçük bir paket ve plan.
// Yeme-içme ve konaklama adları uydurmadır (gerçek işletmeleri temsil etmez);
// koordinatlar yaklaşıktır. Fiyatlar kaba model tahminidir.
import {
  CATEGORIES,
  addDays,
  type DayPlan,
  type LonLat,
  type Place,
  type PlaceCategory,
  type PlaceTag,
  type PlanStop,
  type RegionPack,
  type Slot,
  type Town,
  type TripPlan,
  type TripRequest,
} from "@rota/core";

export const SAMPLE_PACK_ID = "ornek";

interface POpts {
  notability?: number;
  tags?: PlaceTag[];
  city?: string;
  visitMin?: number;
  note?: string;
  slots?: Slot[];
  hours?: string;
  priceTier?: 1 | 2 | 3 | 4;
  indoor?: boolean;
  curated?: boolean;
}

function P(id: string, name: string, cat: PlaceCategory, lat: number, lon: number, o: POpts = {}): Place {
  const info = CATEGORIES[cat];
  return {
    id,
    name,
    cat,
    loc: { lat, lon },
    slots: o.slots ?? [...info.slots],
    visitMin: o.visitMin ?? info.visitMin,
    openingHours: o.hours,
    priceTier: o.priceTier,
    indoor: o.indoor ?? info.indoor,
    notability: o.notability ?? 0.4,
    quality: 0.7,
    tags: o.tags ?? [],
    city: o.city,
    source: o.curated === false ? "osm" : "curated",
    note: o.note ?? "Örnek (test) verisi",
  };
}

const IZ = "İzmir";
const SE = "Selçuk";
const PA = "Pamukkale";

const places: Place[] = [
  // İzmir
  P("cur:kemeralti", "Kemeraltı Çarşısı", "carsi", 38.4188, 27.1302, { notability: 0.8, tags: ["tarihi", "yerel"], city: IZ }),
  P("cur:saat-kulesi", "İzmir Saat Kulesi", "tarihi_yapi", 38.4189, 27.1287, { notability: 0.75, tags: ["tarihi", "manzara"], city: IZ, visitMin: 20 }),
  P("cur:yali-camii", "Konak Yalı Camii", "cami", 38.4183, 27.1279, { notability: 0.5, tags: ["tarihi"], city: IZ }),
  P("cur:agora-izmir", "İzmir Agorası", "antik_kent", 38.4187, 27.1395, { notability: 0.75, tags: ["tarihi", "muzekart"], city: IZ, visitMin: 60 }),
  P("cur:kadifekale", "Kadifekale", "tarihi_yapi", 38.4116, 27.1452, { notability: 0.6, tags: ["tarihi", "manzara"], city: IZ }),
  P("cur:asansor", "Tarihi Asansör", "tarihi_yapi", 38.4103, 27.1224, { notability: 0.65, tags: ["tarihi", "manzara"], city: IZ, visitMin: 30 }),
  P("cur:kordon", "Kordon Sahili", "manzara", 38.432, 27.1405, { notability: 0.6, tags: ["manzara"], city: IZ, visitMin: 40 }),
  P("cur:izmir-arkeoloji", "İzmir Arkeoloji Müzesi", "muze", 38.413, 27.13, { notability: 0.6, tags: ["tarihi", "muzekart"], city: IZ, hours: "Tu-Su 08:30-17:30" }),
  P("cur:kizlaragasi", "Kızlarağası Hanı", "tarihi_yapi", 38.4199, 27.134, { notability: 0.6, tags: ["tarihi", "yerel"], city: IZ }),
  P("test:iz-kahvalti", "Kordon Kahvaltı Evi", "kahvalti", 38.43, 27.1395, { city: IZ, priceTier: 2 }),
  P("test:iz-esnaf", "Çarşı Esnaf Lokantası", "esnaf_lokantasi", 38.4195, 27.132, { city: IZ, tags: ["yerel"], notability: 0.5 }),
  P("test:iz-balik", "Pasaport Balıkçısı", "balikci", 38.4275, 27.136, { city: IZ, priceTier: 3 }),
  P("test:iz-boyoz", "Alsancak Boyoz Fırını", "firin", 38.437, 27.143, { city: IZ, tags: ["yerel", "cografi_isaret"], notability: 0.55 }),
  P("test:iz-tatli", "Kemeraltı Şambalicisi", "tatlici", 38.4192, 27.131, { city: IZ, tags: ["yerel"], notability: 0.5 }),
  P("test:iz-kahve", "Han İçi Kahvehanesi", "kahvehane", 38.42, 27.1338, { city: IZ, tags: ["tarihi"] }),
  P("test:iz-meyhane", "Alsancak Meyhanesi", "meyhane", 38.438, 27.145, { city: IZ, priceTier: 3 }),
  P("test:iz-kebap", "Konak Ocakbaşı", "kebapci", 38.4175, 27.1335, { city: IZ }),
  P("test:iz-otel", "Alsancak Butik Otel", "butik_otel", 38.435, 27.144, { city: IZ }),

  // Selçuk – Efes – Şirince
  P("cur:efes", "Efes Antik Kenti", "antik_kent", 37.9395, 27.3414, { notability: 1, tags: ["unesco", "tarihi", "muzekart"], city: SE, visitMin: 120 }),
  P("cur:efes-muzesi", "Efes Müzesi", "muze", 37.9478, 27.3681, { notability: 0.75, tags: ["tarihi", "muzekart"], city: SE }),
  P("cur:isa-bey", "İsa Bey Camii", "cami", 37.9518, 27.3678, { notability: 0.6, tags: ["tarihi"], city: SE }),
  P("cur:artemis", "Artemis Tapınağı", "antik_kent", 37.9497, 27.3639, { notability: 0.8, tags: ["unesco", "tarihi"], city: SE, visitMin: 30, hours: "24/7" }),
  P("cur:ayasuluk", "Ayasuluk Kalesi ve St. Jean Bazilikası", "tarihi_yapi", 37.9531, 27.3676, { notability: 0.75, tags: ["tarihi", "muzekart", "manzara"], city: SE, visitMin: 60 }),
  P("cur:meryem-ana", "Meryem Ana Evi", "tarihi_yapi", 37.9119, 27.3335, { notability: 0.7, tags: ["tarihi"], city: SE }),
  P("cur:sirince", "Şirince Köy Çarşısı", "carsi", 37.944, 27.433, { notability: 0.7, tags: ["yerel", "manzara"], city: SE }),
  P("test:se-kahvalti", "Şirince Köy Kahvaltısı", "kahvalti", 37.9436, 27.4325, { city: SE, tags: ["yerel", "manzara"], notability: 0.55 }),
  P("test:se-cop-sis", "Selçuk Çöp Şişçisi", "kebapci", 37.9505, 27.37, { city: SE, tags: ["yerel"], notability: 0.55 }),
  P("test:se-pide", "Ayasuluk Pide Salonu", "pideci", 37.949, 27.369, { city: SE }),
  P("test:se-cay", "Kale Altı Çay Bahçesi", "cay_bahcesi", 37.9525, 27.366, { city: SE }),
  P("test:se-yoresel", "Şirince Yöresel Ürünler", "yoresel_urun", 37.9442, 27.4335, { city: SE, tags: ["yerel"] }),
  P("test:se-pansiyon", "Artemis Pansiyon", "pansiyon", 37.9488, 27.3655, { city: SE }),

  // Aydın – Denizli koridoru
  P("cur:tralleis", "Tralleis Antik Kenti", "antik_kent", 37.8622, 27.8389, { notability: 0.5, tags: ["tarihi"], city: "Aydın", visitMin: 45 }),
  P("cur:aydin-muze", "Aydın Arkeoloji Müzesi", "muze", 37.8475, 27.8434, { notability: 0.5, tags: ["tarihi", "muzekart"], city: "Aydın" }),
  P("test:ay-incir", "Köşk İncir Satış Noktası", "yoresel_urun", 37.855, 28.045, { tags: ["yerel", "cografi_isaret"], notability: 0.5, city: "Aydın" }),
  P("cur:nysa", "Nysa Antik Kenti", "antik_kent", 37.9017, 28.1453, { notability: 0.78, tags: ["tarihi", "muzekart"], city: "Sultanhisar", visitMin: 75 }),
  P("test:sh-dinlenme", "Sultanhisar Dinlenme Tesisi", "dinlenme_tesisi", 37.889, 28.15, { city: "Sultanhisar" }),
  P("test:na-pide", "Nazilli Pidecisi", "pideci", 37.913, 28.323, { city: "Nazilli", tags: ["yerel"] }),
  P("test:na-tatli", "Nazilli Şerbetli Tatlıcı", "tatlici", 37.9135, 28.3245, { city: "Nazilli", tags: ["yerel"], notability: 0.45 }),
  P("cur:afrodisias", "Afrodisias Antik Kenti", "antik_kent", 37.7086, 28.7239, { notability: 0.95, tags: ["unesco", "tarihi", "muzekart"], city: "Karacasu" }),
  P("cur:laodikeia", "Laodikeia Antik Kenti", "antik_kent", 37.8358, 29.1075, { notability: 0.7, tags: ["tarihi", "muzekart"], city: "Denizli", visitMin: 75 }),
  P("cur:buharkent-manzara", "Büyük Menderes Vadisi Seyir Noktası", "manzara", 37.958, 28.73, { notability: 0.45, tags: ["manzara"], city: "Buharkent" }),

  // Pamukkale
  P("cur:pamukkale", "Pamukkale Travertenleri", "dogal_alan", 37.9213, 29.121, { notability: 1, tags: ["unesco", "manzara"], city: PA, visitMin: 60 }),
  P("cur:hierapolis", "Hierapolis Antik Kenti", "antik_kent", 37.9257, 29.126, { notability: 0.95, tags: ["unesco", "tarihi", "muzekart"], city: PA }),
  P("cur:hierapolis-muze", "Hierapolis Arkeoloji Müzesi", "muze", 37.9253, 29.1272, { notability: 0.6, tags: ["tarihi", "muzekart"], city: PA, visitMin: 45 }),
  P("cur:antik-havuz", "Antik Havuz", "dogal_alan", 37.9262, 29.1252, { notability: 0.6, tags: ["tarihi"], city: PA, visitMin: 60 }),
  P("cur:karahayit", "Karahayıt Kırmızı Su", "dogal_alan", 37.962, 29.1, { notability: 0.45, city: PA, visitMin: 30 }),
  P("test:pa-kahvalti", "Travertin Kahvaltı", "kahvalti", 37.92, 29.118, { city: PA }),
  P("test:pa-esnaf", "Köy Lokantası", "esnaf_lokantasi", 37.919, 29.117, { city: PA, tags: ["yerel"] }),
  P("test:pa-kebap", "Denizli Kebapçısı", "kebapci", 37.921, 29.1195, { city: PA, tags: ["yerel"], notability: 0.5 }),
  P("test:pa-cay", "Gölbaşı Çay Bahçesi", "cay_bahcesi", 37.9185, 29.115, { city: PA }),
  P("test:pa-tatli", "Pamukkale Tatlıcısı", "tatlici", 37.9195, 29.1185, { city: PA }),
  P("test:pa-otel", "Traverten Otel", "otel", 37.918, 29.1165, { city: PA }),
];

const towns: Town[] = [
  { id: "izmir", name: "İzmir", loc: { lat: 38.4237, lon: 27.1428 }, kind: "city", population: 4479525 },
  { id: "selcuk", name: "Selçuk", loc: { lat: 37.951, lon: 27.368 }, kind: "town", population: 38151 },
  { id: "kusadasi", name: "Kuşadası", loc: { lat: 37.8579, lon: 27.261 }, kind: "town", population: 133177 },
  { id: "sirince", name: "Şirince", loc: { lat: 37.9437, lon: 27.4339 }, kind: "village", population: 600 },
  { id: "aydin", name: "Aydın", loc: { lat: 37.845, lon: 27.8396 }, kind: "city", population: 1161702 },
  { id: "sultanhisar", name: "Sultanhisar", loc: { lat: 37.8883, lon: 28.1565 }, kind: "town", population: 20000 },
  { id: "nazilli", name: "Nazilli", loc: { lat: 37.9125, lon: 28.3206 }, kind: "town", population: 160000 },
  { id: "karacasu", name: "Karacasu", loc: { lat: 37.7286, lon: 28.6044 }, kind: "town", population: 18000 },
  { id: "denizli", name: "Denizli", loc: { lat: 37.7765, lon: 29.0864 }, kind: "city", population: 1059082 },
  { id: "pamukkale", name: "Pamukkale", loc: { lat: 37.9203, lon: 29.1189 }, kind: "village", population: 2500 },
  { id: "urla", name: "Urla", loc: { lat: 38.3226, lon: 26.7648 }, kind: "town", population: 70000 },
  { id: "cesme", name: "Çeşme", loc: { lat: 38.3236, lon: 26.3029 }, kind: "town", population: 49000 },
];

export const SAMPLE_PACK: RegionPack = {
  id: SAMPLE_PACK_ID,
  name: "Örnek veri — İzmir · Efes · Pamukkale (test)",
  version: "0.0.0-ornek",
  generatedAt: "2026-10-24T00:00:00Z",
  bbox: [26.2, 37.6, 29.5, 38.6],
  attribution: "Örnek test verisi · konumlar © OpenStreetMap katkıcıları (ODbL)",
  towns,
  places,
};

export const SAMPLE_PACK_META = {
  id: SAMPLE_PACK_ID,
  name: "Örnek veri (test)",
  bbox: SAMPLE_PACK.bbox,
  places: places.length,
  towns: towns.length,
  generatedAt: SAMPLE_PACK.generatedAt,
  bytes: 0,
  sample: true,
};

// ---------------------------------------------------------------- örnek plan

const ROUTE_IZMIR_SELCUK: LonLat[] = [
  [27.144, 38.435], [27.129, 38.418], [27.139, 38.39], [27.15, 38.32], [27.19, 38.27], [27.27, 38.21],
  [27.36, 38.16], [27.41, 38.09], [27.46, 38.02], [27.42, 37.985], [27.368, 37.951],
];

const ROUTE_SELCUK_PAMUKKALE: LonLat[] = [
  [27.3655, 37.9488], [27.4, 37.935], [27.45, 37.905], [27.505, 37.884], [27.555, 37.877], [27.605, 37.871],
  [27.69, 37.862], [27.77, 37.855], [27.84, 37.845], [27.9, 37.85], [27.965, 37.854], [28.05, 37.855],
  [28.1, 37.872], [28.1565, 37.8883], [28.22, 37.887], [28.27, 37.9], [28.3206, 37.9125], [28.39, 37.913],
  [28.46, 37.913], [28.55, 37.933], [28.63, 37.947], [28.743, 37.962], [28.83, 37.945], [28.925, 37.927],
  [28.99, 37.915], [29.04, 37.91], [29.08, 37.914], [29.1165, 37.918],
];

const place = (id: string) => places.find((p) => p.id === id)!;

interface S {
  id: string;
  placeId: string;
  slot: Slot;
  at: string;
  dur: number;
  travelMin: number;
  travelKm: number;
  cost: number;
  reasons: string[];
}

const hm = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

function stops(list: S[]): PlanStop[] {
  return list.map((s) => ({
    id: s.id,
    placeId: s.placeId,
    slot: s.slot,
    arriveMin: hm(s.at),
    departMin: hm(s.at) + s.dur,
    travelMin: s.travelMin,
    travelKm: s.travelKm,
    estCost: s.cost,
    reasons: s.reasons,
    status: "planned",
  }));
}

export function makeSampleRequest(startDate: string): TripRequest {
  return {
    title: "Ege'de üç gün (örnek)",
    startDate,
    start: { name: "İzmir", loc: towns[0]!.loc },
    stays: [
      { id: "izmir", name: "İzmir", loc: towns[0]!.loc, nights: 1 },
      { id: "selcuk", name: "Selçuk", loc: towns[1]!.loc, nights: 1 },
      { id: "pamukkale", name: "Pamukkale", loc: towns[9]!.loc, nights: 1 },
    ],
    travelers: 2,
    pace: "dengeli",
    interests: ["tarih", "yemek", "tatli", "fotograf"],
    budget: { amount: 25000, currency: "TRY" },
    transport: "araba",
    dayStart: "08:30",
    dayEnd: "22:00",
    diet: {},
    visitor: "yerli",
    hasMuzekart: false,
  };
}

/** Örnek plan; tarihler verilen günden başlar ki "Bugün" ekranı demo edilebilsin. */
export function makeSamplePlan(startDate: string): TripPlan {
  const req = makeSampleRequest(startDate);
  const hotelIz = place("test:iz-otel");
  const hotelSe = place("test:se-pansiyon");
  const hotelPa = place("test:pa-otel");
  const np = (p: Place) => ({ name: p.name, loc: p.loc });

  const d0: DayPlan = {
    index: 0,
    date: startDate,
    from: req.start,
    to: np(hotelIz),
    stayId: "izmir",
    hotelPlaceId: hotelIz.id,
    isTravelDay: false,
    startMin: hm("08:30"),
    endMin: hm("22:00"),
    stops: stops([
      { id: "d0s1", placeId: "test:iz-kahvalti", slot: "kahvalti", at: "09:00", dur: 60, travelMin: 12, travelKm: 2.1, cost: 1050, reasons: ["Kordon manzarası", "Serpme kahvaltı"] },
      { id: "d0s2", placeId: "cur:agora-izmir", slot: "gezi", at: "10:20", dur: 60, travelMin: 14, travelKm: 2.6, cost: 900, reasons: ["Roma dönemi agora", "Müzekart geçerli"] },
      { id: "d0s3", placeId: "cur:kizlaragasi", slot: "gezi", at: "11:35", dur: 40, travelMin: 9, travelKm: 0.6, cost: 0, reasons: ["Osmanlı hanı", "Yürüme mesafesi"] },
      { id: "d0s4", placeId: "test:iz-esnaf", slot: "ogle", at: "12:30", dur: 45, travelMin: 5, travelKm: 0.3, cost: 1050, reasons: ["Esnaf lokantası", "Bütçe dostu"] },
      { id: "d0s5", placeId: "cur:kemeralti", slot: "alisveris", at: "13:30", dur: 60, travelMin: 4, travelKm: 0.2, cost: 0, reasons: ["Tarihi çarşı", "Yerel ürün"] },
      { id: "d0s6", placeId: "test:iz-tatli", slot: "tatli", at: "14:40", dur: 25, travelMin: 3, travelKm: 0.1, cost: 500, reasons: ["Şambali", "İlgi alanın: tatlı"] },
      { id: "d0s7", placeId: "cur:saat-kulesi", slot: "gezi", at: "15:15", dur: 20, travelMin: 6, travelKm: 0.3, cost: 0, reasons: ["İzmir'in simgesi", "Fotoğraf"] },
      { id: "d0s8", placeId: "cur:asansor", slot: "gezi", at: "16:00", dur: 30, travelMin: 18, travelKm: 2.4, cost: 0, reasons: ["Körfez manzarası", "Gün batımına yakın"] },
      { id: "d0s9", placeId: "test:iz-balik", slot: "aksam", at: "19:30", dur: 90, travelMin: 15, travelKm: 3.4, cost: 3000, reasons: ["Deniz ürünleri", "Kordon'a yakın"] },
    ]),
    alternatives: {
      d0s1: ["test:iz-boyoz"],
      d0s2: ["cur:izmir-arkeoloji", "cur:kadifekale"],
      d0s4: ["test:iz-kebap"],
      d0s9: ["test:iz-meyhane", "test:iz-kebap"],
    },
    estCost: 1050 + 900 + 1050 + 500 + 3000 + 5200,
    warnings: [],
  };

  const d1: DayPlan = {
    index: 1,
    date: addDays(startDate, 1),
    from: np(hotelIz),
    to: np(hotelSe),
    stayId: "selcuk",
    hotelPlaceId: hotelSe.id,
    isTravelDay: true,
    startMin: hm("08:30"),
    endMin: hm("22:00"),
    stops: stops([
      { id: "d1s1", placeId: "test:iz-boyoz", slot: "kahvalti", at: "08:45", dur: 25, travelMin: 6, travelKm: 0.8, cost: 160, reasons: ["Boyoz + yumurta", "İzmir'e özgü"] },
      { id: "d1s2", placeId: "cur:efes", slot: "gezi", at: "10:30", dur: 120, travelMin: 70, travelKm: 82, cost: 900, reasons: ["UNESCO Dünya Mirası", "Sabah serinliği"] },
      { id: "d1s3", placeId: "test:se-cop-sis", slot: "ogle", at: "12:50", dur: 45, travelMin: 10, travelKm: 3.5, cost: 1300, reasons: ["Selçuk çöp şiş", "Yerel lezzet"] },
      { id: "d1s4", placeId: "cur:efes-muzesi", slot: "gezi", at: "13:50", dur: 70, travelMin: 4, travelKm: 0.5, cost: 600, reasons: ["Artemis heykelleri", "Kapalı alan"] },
      { id: "d1s5", placeId: "cur:artemis", slot: "gezi", at: "15:10", dur: 30, travelMin: 5, travelKm: 0.6, cost: 0, reasons: ["Antik dünyanın 7 harikasından", "Ücretsiz"] },
      { id: "d1s6", placeId: "test:se-cay", slot: "cay", at: "15:55", dur: 40, travelMin: 6, travelKm: 0.5, cost: 160, reasons: ["Kale manzarası"] },
      { id: "d1s7", placeId: "test:se-pide", slot: "aksam", at: "19:30", dur: 50, travelMin: 5, travelKm: 0.4, cost: 840, reasons: ["Hafif akşam", "Pansiyona yakın"] },
    ]),
    alternatives: {
      d1s2: ["cur:meryem-ana"],
      d1s4: ["cur:ayasuluk", "cur:isa-bey"],
      d1s7: ["test:se-cop-sis"],
    },
    estCost: 160 + 900 + 1300 + 600 + 160 + 840 + 2200 + 420,
    warnings: [],
    route: ROUTE_IZMIR_SELCUK,
  };

  const d2: DayPlan = {
    index: 2,
    date: addDays(startDate, 2),
    from: np(hotelSe),
    to: np(hotelPa),
    stayId: "pamukkale",
    hotelPlaceId: hotelPa.id,
    isTravelDay: true,
    startMin: hm("08:30"),
    endMin: hm("22:00"),
    stops: stops([
      { id: "d2s1", placeId: "test:se-kahvalti", slot: "kahvalti", at: "08:45", dur: 60, travelMin: 15, travelKm: 8, cost: 1100, reasons: ["Köy kahvaltısı", "Şirince manzarası"] },
      { id: "d2s2", placeId: "test:ay-incir", slot: "alisveris", at: "11:05", dur: 20, travelMin: 75, travelKm: 70, cost: 300, reasons: ["Aydın inciri (coğrafi işaret)", "Yol üstünde"] },
      { id: "d2s3", placeId: "test:na-pide", slot: "ogle", at: "12:15", dur: 50, travelMin: 25, travelKm: 28, cost: 840, reasons: ["Yol molası", "Bütçe dostu"] },
      { id: "d2s4", placeId: "cur:hierapolis", slot: "gezi", at: "15:00", dur: 120, travelMin: 75, travelKm: 85, cost: 1400, reasons: ["UNESCO Dünya Mirası", "Gün batımı travertenlerde"] },
      { id: "d2s5", placeId: "cur:pamukkale", slot: "gezi", at: "17:00", dur: 60, travelMin: 5, travelKm: 0.4, cost: 0, reasons: ["Hierapolis biletine dahil", "Fotoğraf"] },
      { id: "d2s6", placeId: "test:pa-kebap", slot: "aksam", at: "19:30", dur: 60, travelMin: 10, travelKm: 1.2, cost: 1300, reasons: ["Denizli kebabı", "Otele yakın"] },
    ]),
    alternatives: {
      d2s3: ["test:na-tatli"],
      d2s4: ["cur:laodikeia"],
      d2s6: ["test:pa-esnaf"],
    },
    estCost: 1100 + 300 + 840 + 1400 + 1300 + 3500 + 1150,
    warnings: ["Hierapolis'te son giriş saatine dikkat (örnek uyarı)."],
    route: ROUTE_SELCUK_PAMUKKALE,
  };

  const days = [d0, d1, d2];
  return {
    id: `ornek-${startDate}`,
    createdAt: new Date().toISOString(),
    packId: SAMPLE_PACK_ID,
    request: req,
    days,
    estTotal: days.reduce((n, d) => n + d.estCost, 0),
    version: 1,
  };
}
