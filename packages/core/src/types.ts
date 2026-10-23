// Rota Türkiye — ortak alan modeli.
// Bütün saatler Türkiye duvar saatidir (UTC+3, yaz saati yok). Gün içi zaman
// "gece yarısından itibaren dakika" (0–1439, gece yarısını aşan kapanışlar için 1440+) olarak tutulur.

export interface LatLng {
  lat: number;
  lon: number;
}

/** [lon, lat] çifti; GeoJSON ve OSRM ile aynı sıra. */
export type LonLat = [number, number];

export type Currency = "TRY" | "EUR" | "USD";

export interface Money {
  amount: number;
  currency: Currency;
}

export type PlaceCategory =
  // gezi
  | "antik_kent"
  | "muze"
  | "tarihi_yapi"
  | "cami"
  | "dogal_alan"
  | "manzara"
  | "plaj"
  // yeme-içme
  | "kahvalti"
  | "esnaf_lokantasi"
  | "restoran"
  | "kebapci"
  | "pideci"
  | "meyhane"
  | "balikci"
  | "kafe"
  | "cay_bahcesi"
  | "kahvehane"
  | "tatlici"
  | "firin"
  // alışveriş
  | "carsi"
  | "pazar"
  | "yoresel_urun"
  | "hediyelik"
  // konaklama
  | "otel"
  | "pansiyon"
  | "butik_otel"
  | "kamp"
  // yol
  | "dinlenme_tesisi";

/** Günlük planın doldurduğu yuvalar. */
export type Slot =
  | "kahvalti"
  | "ogle"
  | "aksam"
  | "cay"
  | "tatli"
  | "alisveris"
  | "gezi"
  | "konaklama";

export type Interest =
  | "tarih"
  | "yemek"
  | "tatli"
  | "doga"
  | "deniz"
  | "alisveris"
  | "kultur"
  | "fotograf";

export type PlaceTag =
  | "unesco"
  | "michelin"
  | "bib_gourmand"
  | "gault_millau"
  | "tarihi"
  | "yerel"
  | "manzara"
  | "cografi_isaret"
  | "muzekart"
  | "aile"
  | "erisilebilir"
  | "wikidata";

export interface PriceObservation {
  amount: number;
  currency: Currency;
  /** true: kişi başı; false: birim başı (oda/gece, bilet paketi vb.) */
  perPerson: boolean;
  /** Gözlem tarihi, YYYY-MM-DD. Enflasyon endekslemesi buradan yapılır. */
  observedAt: string;
  /** Kaynak URL'si ya da "model" */
  source: string;
  /** observed: gerçek gözlem; estimate: kategori modeli, kullanıcıya "tahmini" diye gösterilir */
  kind: "observed" | "estimate";
}

export interface Place {
  /** "osm:n123", "osm:w456", "cur:efes" */
  id: string;
  name: string;
  cat: PlaceCategory;
  loc: LatLng;
  /** Bu mekânın doldurabileceği yuvalar (catalog varsayılanı + veri özelinde) */
  slots: Slot[];
  /** Tipik ziyaret süresi, dakika */
  visitMin: number;
  /** OSM opening_hours sözdizimi; yoksa kategori varsayılanı kullanılır */
  openingHours?: string;
  priceTier?: 1 | 2 | 3 | 4;
  price?: PriceObservation;
  /** Yabancı ziyaretçi bileti (müzeler avro fiyatlı) */
  priceForeign?: PriceObservation;
  indoor?: boolean;
  alcohol?: boolean;
  vegFriendly?: boolean;
  /** 0..1 — önem: wikidata/miras/kürasyon sinyallerinden */
  notability: number;
  /** 0..1 — güven/kalite skoru; bilinmiyorsa undefined */
  quality?: number;
  tags: PlaceTag[];
  city?: string;
  district?: string;
  wikidata?: string;
  website?: string;
  source: "osm" | "curated";
  lastVerified?: string;
  /** Kısa, kontrol edilebilir not ("Pazartesi kapalı", "Yamaç Evler ayrı bilet") */
  note?: string;
}

export interface Town {
  id: string;
  name: string;
  loc: LatLng;
  kind: "city" | "town" | "village";
  population?: number;
}

export interface RegionPack {
  id: string;
  name: string;
  version: string;
  generatedAt: string;
  /** [minLon, minLat, maxLon, maxLat] */
  bbox: [number, number, number, number];
  attribution: string;
  towns: Town[];
  places: Place[];
}

// ---------------------------------------------------------------- gezi isteği

export type Pace = "sakin" | "dengeli" | "yogun";
export type TransportMode = "araba" | "yuruyus" | "toplu";
export type Visitor = "yerli" | "yabanci";

export interface NamedPoint {
  name: string;
  loc: LatLng;
}

export interface Stay {
  /** Town id ya da serbest bir kimlik */
  id: string;
  name: string;
  loc: LatLng;
  nights: number;
}

export interface TripRequest {
  title: string;
  /** İlk gün, YYYY-MM-DD */
  startDate: string;
  /** 1. günün başladığı yer */
  start: NamedPoint;
  /** Sıralı geceleme üsleri. Gün sayısı = toplam gece (+ end varsa 1). */
  stays: Stay[];
  /** Verilirse son gün otelden buraya gidilir (havalimanı, ev) */
  end?: NamedPoint;
  travelers: number;
  pace: Pace;
  interests: Interest[];
  /** Bütün gezi ve bütün yolcular için toplam bütçe */
  budget: Money;
  transport: TransportMode;
  /** "HH:mm" */
  dayStart: string;
  dayEnd: string;
  diet: { vegetarian?: boolean; noAlcohol?: boolean };
  visitor: Visitor;
  hasMuzekart?: boolean;
}

// ---------------------------------------------------------------- plan

export type StopStatus = "planned" | "done" | "skipped" | "closed";

export interface PlanStop {
  /** Plan içinde benzersiz */
  id: string;
  placeId: string;
  slot: Slot;
  /** Varış ve ayrılış, gün içi dakika */
  arriveMin: number;
  departMin: number;
  /** Bir önceki noktadan yol süresi ve mesafesi */
  travelMin: number;
  travelKm: number;
  /** Bütün yolcular için tahmini maliyet, TRY */
  estCost: number;
  /** "Neden burası" — kontrol edilebilir kısa sinyaller */
  reasons: string[];
  status: StopStatus;
  /** Onarımda dokunulmaz (yapıldı ya da kullanıcı sabitledi) */
  locked?: boolean;
  /** Yol koridoru keşfinden geldi */
  discovered?: boolean;
}

export interface DayPlan {
  index: number;
  /** YYYY-MM-DD */
  date: string;
  from: NamedPoint;
  to: NamedPoint;
  /** Bu gecenin üssü; son gün (end) için undefined */
  stayId?: string;
  hotelPlaceId?: string;
  isTravelDay: boolean;
  startMin: number;
  endMin: number;
  stops: PlanStop[];
  /** stopId -> o yuvaya uyan, sıralı yedek placeId listesi */
  alternatives: Record<string, string[]>;
  /** Günün toplam tahmini maliyeti (konaklama + yemek + giriş + yakıt), TRY */
  estCost: number;
  /** Takvim ve kapanış uyarıları, Türkçe */
  warnings: string[];
  /** Yol günleri için rota çizgisi */
  route?: LonLat[];
}

export interface TripPlan {
  id: string;
  createdAt: string;
  packId: string;
  request: TripRequest;
  days: DayPlan[];
  /** TRY */
  estTotal: number;
  version: number;
}

// ---------------------------------------------------------------- bütçe

export type ExpenseCategory =
  | "yemek"
  | "cay_kahve"
  | "giris"
  | "alisveris"
  | "ulasim"
  | "yakit"
  | "konaklama"
  | "diger";

export interface Expense {
  id: string;
  tripId: string;
  /** ISO tarih-saat */
  at: string;
  amount: number;
  currency: Currency;
  /** Kayıt anında dondurulmuş TRY karşılığı */
  amountTry: number;
  fxRate: number;
  category: ExpenseCategory;
  note?: string;
  placeId?: string;
  dayIndex?: number;
}

export interface FxRates {
  /** YYYY-MM-DD */
  date: string;
  source: string;
  /** 1 birim döviz kaç TRY */
  tryPer: Record<Currency, number>;
}
