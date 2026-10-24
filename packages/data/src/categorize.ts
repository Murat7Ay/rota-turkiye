// OSM etiketleri + Türkçe ad sezgileri → Rota Türkiye mekânı.
// Kurallar katlanmış ad (bkz. text.fold) üzerinde düz ASCII regex'lerle yazılır.
import { CATEGORIES, type Place, type PlaceCategory, type PlaceTag, type Slot } from "@rota/core";
import type { CuratedEntry, Near, RegionOverlay } from "./curated/types";
import { EMPTY_OVERLAY } from "./curated/types";
import { isPermanentlyClosed, validOpeningHours } from "./opening-hours";
import type { OsmElement } from "./overpass";
import { fold } from "./text";

type Tags = Record<string, string>;

/** Tekilleştirmede "zengin olan"ı seçmek için OSM etiket sayısı da taşınır. */
export interface Candidate {
  place: Place;
  richness: number;
  brand: boolean;
}

interface Decision {
  cat: PlaceCategory;
  visitMin?: number;
  indoor?: boolean;
  alcohol?: boolean;
}

// ------------------------------------------------------------------ ad sezgileri (katlanmış)

export const RX = {
  meyhane: /meyhane|\btaverna\b/,
  cayBahcesi: /cay bahce|caybahce|cay ocag|\bcay evi\b|\bcayevi\b|semaver|tea garden/,
  kahvehane: /kiraathane|kahvehane|\bkoy kahvesi\b/,
  lokanta: /\blokanta|\bev yemek|\besnaf\b|sulu yemek|\bhazir yemek|\bcorba(ci|cisi|salonu)\b/,
  kahvalti: /kahvalti|\bserpme\b|breakfast/,
  balik: /\bbalik(ci|cisi|cilar|evi|ci kahvesi)?\b|\bbalikcilar\b|\bfish\b|seafood|deniz urunleri|\bmidye/,
  cigKofte: /cig ?kofte/,
  kebap: /kebap|kebab|ocakbasi|\bciger|\bdoner|\bkofte|kokorec|\bcop sis|\btandir|\biskender|\bmangal/,
  pide: /\bpide|lahmacun|gozleme|etli ekmek/,
  tatli: /baklava|\btatli|kunefe|muhallebi|\blokum|sekerci|sekerleme|dondurma|pastane|pastahane|patisserie|pastry|\bhelva|kadayif|sutlac|kazandibi|\blokma(ci|cisi)?\b|gelato|ice cream|\bwaffle|cikolata|chocolate/,
  firin: /\bfirin|\bsimit|\bgevrek|\bboyoz|\bborek|\bpogaca|\bunlu ?mamul|\bun mamul|bakery/,
  yoresel: /yoresel|koy urun|koy pazari|zeytin|peynir|\bbal\b|\bbalci|baharat|\baktar|kurukahve|organik|ciftlik|uretici|kooperatif|\bincir|tarhana|sabun/,
  butik: /\bbutik\b|boutique/,
  dinlenme: /dinlenme tesis|mola tesis|\bservice area\b/,
  carsi: /\b(carsi|carsisi|bedesten|bedesteni|arasta|arastasi)\b/,
  han: /\bhani?\b/,
  antikKent: /antik kent|ancient city|oren yeri|\bharabe|antik tiyatro|tapinag|\btemple\b/,
  antikKentAd: /antik kent|ancient city|oren yeri|arkeolojik alan/,
  yabanciMutfak: /^(chinese|japanese|sushi|korean|thai|vietnamese|asian|indian|italian|pizza|burger|american|mexican|tex-mex|steak_house|french|spanish|sandwich|chicken|fried_chicken|hot_dog|noodle|ramen)$/,
  yabanciMutfakAd: /\b(chinese|china|sushi|wok|noodle|ramen|pizza|pizzeria|burger|steak ?house|steakhouse|tacos?|mexican|italian|trattoria|bbq|barbeque|barbecue)\b/,
  kalintiParca: /hamam|tiyatro|agora|sarnic|nekropol|kilise|bazilika|basilica|odeon|stadyum|stadium|gymnas|cesme|kapisi|sutun|mozaik|tapinag|temple|kutuphane|library|\bbath/,
  /** OSM'de gezi etiketiyle işaretlenmiş ama açıkça işletme olan adlar (ör. "tourism=viewpoint" bir kargo şubesi) */
  isletmeAdi: /\b(kargo|market|marketi|eczane|eczanesi|ltd|sti|otopark|benzin|petrol|bankasi|atm|emlak|sigorta|noter|kuafor)\b/,
  muze: /muzesi|\bmuze\b|museum/,
  cami: /\bcamii?\b|\bcamisi\b|\bmescidi?\b|mosque/,
  plaj: /plaji|\bkoyu\b|\bbeach\b|\bplaj\b/,
  doga: /selale|kanyon|magara|\bgolu\b|traverten|milli park|tabiat park|ormani\b|\bcave\b|waterfall/,
  manzara: /seyir|manzara|panorama|\bteras/,
  tarihiYapi: /kalesi|\bkale\b|kulesi|kopru|hamam|cesmesi|\banit|kilise|church|sinagog|havra|konag|\bkosk|evi\b|saray|turbe|\bhan\b|kervansaray/,
  tarihiAd: /\btarihi\b|\bsince\s*1[89]\d\d|\best\.?\s*1[89]\d\d|\b1[89]\d\d\s*['’]?\s*(den|dan|ten|tan) beri/,
  aile: /\baile\b/,
  bahce: /bahce|garden/,
  acikHava: /acik ?hava|open[- ]air/,
};

/** Rota Türkiye'nin "yerel" önerisine hiç alınmayan uluslararası zincirler */
const GLOBAL_CHAINS =
  /\b(mc ?donald|burger king|kfc|starbucks|domino|pizza hut|popeyes|little caesars|subway|sbarro|arby|carl ?s jr|wendy|papa john|caribou|gloria jean|costa coffee|tim hortons|dunkin|taco bell|krispy kreme|cinnabon|five guys|shake shack|komagene|oses cig|tavuk dunyasi|baydoner|simit sarayi|kahve dunyasi|espressolab|usta donerci|bereket doner|burger lab|maydonoz doner)/;

/** Ad olarak işe yaramayan genel sözcükler */
const GENERIC_NAMES = new Set([
  "cafe",
  "kafe",
  "kafeterya",
  "cafeteria",
  "restaurant",
  "restoran",
  "lokanta",
  "bufe",
  "kantin",
  "market",
  "otel",
  "hotel",
  "pansiyon",
  "fast food",
  "pastane",
  "firin",
  "bakkal",
]);

const TURKISH_FAST_FOOD = new Set([
  "kebab",
  "kebap",
  "doner",
  "döner",
  "pide",
  "lahmacun",
  "kokorec",
  "kokoreç",
  "kofte",
  "köfte",
  "meatball",
  "turkish",
  "regional",
  "gozleme",
  "borek",
  "simit",
  "tantuni",
  "kumru",
  "cig_kofte",
  "turkish_pizza",
]);
const TURKISH_FAST_FOOD_NAME = /kebap|kebab|\bdoner|\bpide|lahmacun|kokorec|\bkofte|tantuni|\bkumru|gozleme|\bborek|\bboyoz|\bsimit|\bciger|\bmidye|\biskender/;

// ------------------------------------------------------------------ yardımcılar

function cuisines(t: Tags): string[] {
  return (t.cuisine ?? "")
    .toLowerCase()
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasAny(list: string[], ...wanted: string[]): boolean {
  return list.some((c) => wanted.includes(c));
}

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function within(near: Near, lat: number, lon: number): boolean {
  return distanceKm(near.lat, near.lon, lat, lon) <= near.km;
}

function startYear(t: Tags): number | undefined {
  const m = /(\d{4})/.exec(t.start_date ?? "");
  const y = m ? Number(m[1]) : NaN;
  return y > 1000 && y < 2100 ? y : undefined;
}

function isoDate(v: string | undefined): string | undefined {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : undefined;
}

function websiteOf(t: Tags): string | undefined {
  const w = (t.website ?? t["contact:website"] ?? t.url)?.trim();
  return w && /^https?:\/\/\S+$/.test(w) && w.length <= 200 ? w : undefined;
}

function starsTier(t: Tags): 1 | 2 | 3 | 4 | undefined {
  const s = parseInt(t.stars ?? "", 10);
  if (!(s >= 1 && s <= 5)) return undefined;
  return s >= 5 ? 4 : s === 4 ? 3 : s === 3 ? 2 : 1;
}

function alcoholSignal(t: Tags): boolean | undefined {
  if (t["drink:alcohol"] === "no") return false;
  for (const [k, v] of Object.entries(t)) {
    if (/^drink:(beer|wine|raki|spirits|alcohol|cocktail)$/.test(k) && /^(yes|served|retail)$/.test(v)) return true;
  }
  return undefined;
}

function vegSignal(t: Tags, cs: string[]): boolean | undefined {
  const veg = t["diet:vegetarian"] ?? t["diet:vegan"];
  if (veg && /^(yes|only)$/.test(veg)) return true;
  if (hasAny(cs, "vegetarian", "vegan")) return true;
  if (t["diet:vegetarian"] === "no") return false;
  return undefined;
}

const WEEKDAYS: Array<[RegExp, string]> = [
  [/\bpazartesi\b/, "Pazartesi"],
  [/\bsali\b/, "Salı"],
  [/\bcarsamba\b/, "Çarşamba"],
  [/\bpersembe\b/, "Perşembe"],
  [/\bcumartesi\b/, "Cumartesi"],
  [/\bcuma\b/, "Cuma"],
  [/\bpazar pazari\b/, "Pazar"],
];

// ------------------------------------------------------------------ kategori kararı

function decideLodging(t: Tags, f: string): Decision | null {
  const tourism = t.tourism;
  if (tourism === "camp_site") return { cat: "kamp" };
  if (!tourism || !/^(hotel|motel|guest_house|hostel|chalet)$/.test(tourism)) return null;
  if (RX.butik.test(f) || t.hotel === "boutique") return { cat: "butik_otel" };
  if (tourism === "hotel" || tourism === "motel") return { cat: "otel" };
  return { cat: "pansiyon" };
}

function decideGezi(t: Tags, f: string): Decision | null {
  const historic = t.historic;
  const notable = !!(t.wikidata || t.wikipedia || t.heritage || t.tourism === "attraction");
  const religion = t.religion;

  // Camiler: yalnızca tarihi/miras/wikidata olanlar sorgulanır
  if ((t.amenity === "place_of_worship" && religion === "muslim") || t.building === "mosque" || historic === "mosque") {
    return { cat: "cami" };
  }
  if (t.amenity === "place_of_worship") return { cat: "tarihi_yapi", visitMin: 30 };

  // Tarihi çarşı / bedesten / arasta / han
  if (RX.carsi.test(f) && (historic || t.heritage || t.wikidata || t.tourism)) return { cat: "carsi" };
  if (RX.han.test(f) && historic && (t.shop || t.amenity === "marketplace")) return { cat: "carsi" };

  if (historic === "archaeological_site" || (historic === "ruins" && RX.antikKent.test(f))) {
    // Tek yapı kalıntıları (hamam, tapınak, tiyatro, sarnıç…) antik kent değil; kısa ziyaretlik tarihi yapı
    if (RX.kalintiParca.test(f) && !RX.antikKentAd.test(f)) return { cat: "tarihi_yapi", visitMin: 30 };
    if (notable || t.tourism === "museum" || RX.antikKent.test(f)) return { cat: "antik_kent" };
    return { cat: "tarihi_yapi", visitMin: 30 };
  }
  if (t.tourism === "museum") return { cat: "muze", indoor: RX.acikHava.test(f) ? false : undefined };
  if (historic === "castle" || historic === "fort") return { cat: "tarihi_yapi", visitMin: 60 };
  if (historic === "monument" || historic === "tomb") {
    // Sayısız büst/anıt ve adsız mezar: yalnızca öne çıkanlar
    if (!notable && !/turbe/.test(f)) return null;
    return { cat: "tarihi_yapi", visitMin: 20 };
  }
  if (historic === "city_gate" || historic === "tower" || historic === "fountain") return { cat: "tarihi_yapi", visitMin: 20 };
  if (historic && /^(ruins|caravanserai|aqueduct|bridge|bath|building|church|monastery|synagogue)$/.test(historic)) {
    return { cat: "tarihi_yapi", visitMin: 30 };
  }

  if (t.tourism === "viewpoint") return { cat: "manzara" };
  if (t.natural === "beach" || t.leisure === "beach_resort") {
    if (t.access === "private" || t.access === "no") return null;
    return { cat: "plaj" };
  }
  if (t.natural === "waterfall" || t.natural === "cave_entrance") return { cat: "dogal_alan", visitMin: 60 };
  if (t.natural === "spring") {
    if (!(t.wikidata || t.tourism || /kaplica|ilica|termal|selale/.test(f))) return null;
    return { cat: "dogal_alan", visitMin: 30 };
  }
  if (t.leisure === "nature_reserve" || t.boundary === "national_park") return { cat: "dogal_alan", visitMin: 120 };
  if (t.leisure === "park") return { cat: "dogal_alan", visitMin: 45 };

  if (t.tourism === "attraction") {
    if (RX.antikKent.test(f)) return { cat: "antik_kent" };
    if (RX.muze.test(f)) return { cat: "muze" };
    if (RX.cami.test(f)) return { cat: "cami" };
    if (RX.plaj.test(f)) return { cat: "plaj" };
    if (RX.doga.test(f) || t.natural) return { cat: "dogal_alan", visitMin: 60 };
    if (RX.manzara.test(f)) return { cat: "manzara" };
    if (RX.tarihiYapi.test(f) || historic) return { cat: "tarihi_yapi", visitMin: 30 };
    if (t.wikidata || t.wikipedia) return { cat: "tarihi_yapi", visitMin: 30 };
    return null;
  }
  if (historic) return { cat: "tarihi_yapi", visitMin: 30 };
  return null;
}

function decideFood(t: Tags, f: string): Decision | null {
  const amenity = t.amenity;
  const shop = t.shop;
  const isFoodAmenity = amenity === "restaurant" || amenity === "cafe" || amenity === "fast_food" || amenity === "ice_cream";
  const isSweetShop = shop === "pastry" || shop === "confectionery" || shop === "chocolate";
  if (!isFoodAmenity && !isSweetShop && shop !== "bakery") return null;
  const cs = cuisines(t);

  if (isSweetShop || amenity === "ice_cream") {
    if (/kuru ?yemis/.test(f)) return null; // kuruyemişçi tatlıcı değildir
    // "Unlu mamüller" pastanesi: tatlı işareti yoksa fırın
    if (shop === "pastry" && RX.firin.test(f) && !RX.tatli.test(f)) return { cat: "firin" };
    return { cat: "tatlici" };
  }
  if (shop === "bakery") return RX.tatli.test(f) || hasAny(cs, "cake", "dessert") ? { cat: "tatlici" } : { cat: "firin" };

  if (amenity === "fast_food" && !(cs.some((c) => TURKISH_FAST_FOOD.has(c)) || TURKISH_FAST_FOOD_NAME.test(f) || RX.lokanta.test(f))) {
    return null;
  }

  if (RX.meyhane.test(f) || hasAny(cs, "meyhane", "meze")) return { cat: "meyhane", alcohol: true };
  if (RX.cayBahcesi.test(f)) return { cat: "cay_bahcesi" };
  if (RX.kahvehane.test(f)) return { cat: "kahvehane" };
  if (amenity !== "cafe" && (RX.lokanta.test(f) || hasAny(cs, "home_cooking"))) return { cat: "esnaf_lokantasi" };
  if (RX.kahvalti.test(f)) return { cat: "kahvalti" };
  if (RX.balik.test(f) || hasAny(cs, "seafood", "fish")) return { cat: "balikci" };
  if (RX.cigKofte.test(f) || hasAny(cs, "cig_kofte")) return { cat: "restoran" };
  if (RX.kebap.test(f) || hasAny(cs, "kebab", "kebap", "doner", "kokorec", "kofte", "meatball", "iskender")) return { cat: "kebapci" };
  if (RX.pide.test(f) || hasAny(cs, "pide", "lahmacun", "turkish_pizza", "gozleme")) return { cat: "pideci" };
  // cuisine=breakfast çok mutfaklı restoranlarda da var; addaki işaretlerden sonra bakılır
  if (hasAny(cs, "breakfast")) return { cat: "kahvalti" };
  const coffeeShop = amenity === "cafe" && (hasAny(cs, "coffee_shop") || /coffee|kahve/.test(f));
  if (RX.tatli.test(f) || (!coffeeShop && hasAny(cs, "ice_cream", "dessert", "cake", "baklava", "frozen_yogurt", "waffle"))) {
    return { cat: "tatlici" };
  }
  if (RX.firin.test(f) || hasAny(cs, "bakery", "simit", "borek")) return { cat: "firin" };
  if (amenity === "cafe") return { cat: "kafe" };
  return { cat: "restoran" };
}

function decideShop(t: Tags, f: string, lat: number, lon: number, overlay: RegionOverlay): Decision | null {
  const shop = t.shop;
  if (shop === "wine" || t.craft === "winery") {
    // Şarap yalnızca bağ bölgelerinde (Urla, Şirince…) yöresel ürün sayılır
    return overlay.wineAreas.some((a) => within(a, lat, lon)) ? { cat: "yoresel_urun", alcohol: true } : null;
  }
  if (!shop) return null;
  if (shop === "souvenir") return { cat: "hediyelik" };
  if (shop === "farm" || shop === "cheese" || shop === "honey" || shop === "olive_oil") return { cat: "yoresel_urun" };
  if (RX.yoresel.test(f) && /^(deli|spices|tea|coffee|nuts|dairy|greengrocer|convenience|supermarket|general|food)$/.test(shop)) {
    return { cat: "yoresel_urun" };
  }
  if (/yoresel|koy urun|zeytinyag/.test(f)) return { cat: "yoresel_urun" };
  return null;
}

/** OSM etiketlerinden kategori kararı; uygun değilse null. Sıra önemlidir. */
export function decide(t: Tags, f: string, lat: number, lon: number, overlay: RegionOverlay = EMPTY_OVERLAY): Decision | null {
  const lodging = decideLodging(t, f);
  if (lodging) return lodging;
  if (t.highway === "services" || t.highway === "rest_area" || RX.dinlenme.test(f)) return { cat: "dinlenme_tesisi" };
  if (t.amenity === "marketplace") {
    return RX.carsi.test(f) && (t.historic || t.heritage || t.wikidata) ? { cat: "carsi" } : { cat: "pazar" };
  }
  const food = decideFood(t, f);
  if (food) return food;
  const shop = decideShop(t, f, lat, lon, overlay);
  if (shop) return shop;
  // Gezi kuralları yalnızca gezi işareti taşıyan öğelere uygulanır (dükkân içindeki tarihi han gibi)
  const geziSignal =
    t.historic ||
    t.tourism ||
    t.natural ||
    t.leisure ||
    t.boundary ||
    t.amenity === "place_of_worship" ||
    t.building === "mosque" ||
    (t.landuse === "retail" && RX.carsi.test(f));
  return geziSignal ? decideGezi(t, f) : null;
}

// ------------------------------------------------------------------ mekân üretimi

const FOOD_CATS = new Set<PlaceCategory>([
  "kahvalti",
  "esnaf_lokantasi",
  "restoran",
  "kebapci",
  "pideci",
  "meyhane",
  "balikci",
  "kafe",
  "cay_bahcesi",
  "kahvehane",
  "tatlici",
  "firin",
]);
const GEZI_CATS = new Set<PlaceCategory>(["antik_kent", "muze", "tarihi_yapi", "cami", "dogal_alan", "manzara", "plaj", "carsi"]);
const YEREL_CATS = new Set<PlaceCategory>(["esnaf_lokantasi", "cay_bahcesi", "kahvehane", "pazar"]);

export function osmId(e: Pick<OsmElement, "type" | "id">): string {
  return `osm:${e.type[0]}${e.id}`;
}

export function elementLoc(e: OsmElement): { lat: number; lon: number } | undefined {
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  if (lat === undefined || lon === undefined) return undefined;
  return { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 };
}

export function displayName(t: Tags): string | undefined {
  const n = (t["name:tr"] ?? t.name)?.trim().replace(/\s+/g, " ");
  if (!n || n.length < 2 || /^\d+$/.test(n)) return undefined;
  return n;
}

function isBrand(t: Tags): boolean {
  return !!(t.brand || t["brand:wikidata"]);
}

/** Bir OSM öğesini mekâna çevirir; uygun değilse null. Kürasyon katmanı da burada uygulanır. */
export function categorize(e: OsmElement, overlay: RegionOverlay = EMPTY_OVERLAY): Candidate | null {
  const t = e.tags ?? {};
  if (t.place) return null; // yerleşimler kasaba listesine gider
  const name = displayName(t);
  const loc = elementLoc(e);
  if (!name || !loc) return null;
  const f = fold(name);
  if (GENERIC_NAMES.has(f)) return null;
  // Komşu ülke öğeleri asıl olarak "yabanci" sorgusuyla elenir; Yunan alfabeli ad yedek güvence
  if (/[Ͱ-Ͽ]/.test(name)) return null;
  if (t.disused === "yes" || t.abandoned === "yes" || t.shop === "vacant" || isPermanentlyClosed(t.opening_hours)) return null;
  if (t.tourism === "apartment") return null;
  const brand = isBrand(t);
  if (GLOBAL_CHAINS.test(f) || GLOBAL_CHAINS.test(fold(t.brand ?? ""))) return null;

  const d = decide(t, f, loc.lat, loc.lon, overlay);
  if (!d) return null;
  if (GEZI_CATS.has(d.cat) && RX.isletmeAdi.test(f)) return null;
  const info = CATEGORIES[d.cat];
  const cs = cuisines(t);
  const openingHours = validOpeningHours(t.opening_hours);
  const website = websiteOf(t);
  const wikidata = t.wikidata && /^Q\d+$/.test(t.wikidata) ? t.wikidata : undefined;

  // --- etiketler
  const tags = new Set<PlaceTag>();
  if (wikidata) tags.add("wikidata");
  // heritage=1 OSM'de yanlış da kullanılıyor (ör. geçici listedeki yerler); işletmeci whc ya da ref:whc şart
  if (/\bwhc\b/i.test(t["heritage:operator"] ?? "") || t["ref:whc"]) tags.add("unesco");
  const year = startYear(t);
  let tarihi = false;
  if (GEZI_CATS.has(d.cat) && (t.historic || t.heritage)) tarihi = true;
  if (FOOD_CATS.has(d.cat) || info.group === "alisveris") {
    if ((year !== undefined && year < 1960) || RX.tarihiAd.test(f) || t.historic) tarihi = true;
  }
  if (tarihi) tags.add("tarihi");
  if (YEREL_CATS.has(d.cat) && !brand) tags.add("yerel");
  if (d.cat === "manzara" || (FOOD_CATS.has(d.cat) && RX.manzara.test(f))) tags.add("manzara");
  if (RX.aile.test(f)) tags.add("aile");
  if (t.wheelchair === "yes") tags.add("erisilebilir");
  const foreign = FOOD_CATS.has(d.cat) && (RX.yabanciMutfakAd.test(f) || (cs.length > 0 && cs.every((c) => RX.yabanciMutfak.test(c))));
  if (foreign) {
    tags.add("yabanci_mutfak");
    tags.delete("yerel");
  }

  // --- önem
  let n = 0.1;
  if (wikidata || t.wikipedia) n += 0.35;
  if (t.heritage) n += 0.25;
  if (t.tourism === "attraction") n += 0.1;
  if (t.historic) n += 0.15;
  if (tarihi && !t.historic && !GEZI_CATS.has(d.cat)) n += 0.15;
  if (openingHours) n += 0.05;
  if (website) n += 0.03;
  if (brand) n -= 0.1;

  // --- yuvalar: kategori varsayılanı + veriden gelen ek yuvalar
  const slots = new Set<Slot>(info.slots);
  if (FOOD_CATS.has(d.cat)) {
    if (RX.kahvalti.test(f) || hasAny(cs, "breakfast") || t.breakfast === "yes") slots.add("kahvalti");
    if (RX.cayBahcesi.test(f)) slots.add("cay");
    if (d.cat !== "firin" && RX.tatli.test(f)) slots.add("tatli");
  }

  let indoor = d.indoor ?? info.indoor;
  if (FOOD_CATS.has(d.cat) && d.cat !== "cay_bahcesi" && RX.bahce.test(f)) indoor = false;

  let note: string | undefined;
  if (d.cat === "pazar" && !openingHours) {
    const day = WEEKDAYS.find(([re]) => re.test(f));
    if (day) note = `Adına göre ${day[1]} günleri kurulur; saat verisi yok.`;
  }

  const place: Place = {
    id: osmId(e),
    name,
    cat: d.cat,
    loc,
    slots: [...slots],
    visitMin: d.visitMin ?? info.visitMin,
    openingHours,
    priceTier: info.group === "konaklama" ? starsTier(t) : undefined,
    indoor,
    alcohol: d.alcohol ?? alcoholSignal(t),
    vegFriendly: FOOD_CATS.has(d.cat) ? vegSignal(t, cs) : undefined,
    notability: n,
    tags: [...tags],
    city: t["addr:city"]?.trim() || undefined,
    district: t["addr:district"]?.trim() || undefined,
    wikidata,
    website,
    source: "osm",
    lastVerified: isoDate(t.check_date) ?? isoDate(t["survey:date"]) ?? isoDate(t["check_date:opening_hours"]),
    note,
  };
  applyOverlay(place, overlay);
  place.notability = Math.round(Math.min(1, Math.max(0, place.notability)) * 100) / 100;
  return { place: stripUndefined(place), richness: Object.keys(t).length, brand };
}

export function matchesEntry(place: Place, entry: CuratedEntry): boolean {
  const f = fold(place.name);
  return (
    entry.cats.includes(place.cat) &&
    entry.match.test(f) &&
    !(entry.notMatch?.test(f) ?? false) &&
    within(entry.near, place.loc.lat, place.loc.lon)
  );
}

/** Kürasyon katmanını yerinde uygular (UNESCO, Müzekart, kategori düzeltmesi, kaynaklı fiyat). */
export function applyOverlay(place: Place, overlay: RegionOverlay): void {
  for (const entry of overlay.entries) {
    if (!matchesEntry(place, entry)) continue;
    if (entry.setCat && entry.setCat !== place.cat) {
      const info = CATEGORIES[entry.setCat];
      place.cat = entry.setCat;
      place.slots = [...info.slots];
      place.visitMin = info.visitMin;
      place.indoor = info.indoor;
    }
    const tags = new Set(place.tags);
    for (const tag of entry.tags ?? []) tags.add(tag);
    place.tags = [...tags];
    if (entry.minNotability !== undefined) place.notability = Math.max(place.notability, entry.minNotability);
    if (entry.visitMin !== undefined) place.visitMin = entry.visitMin;
    if (entry.note && !place.note) place.note = entry.note;
    if (entry.price) place.price = entry.price;
    if (entry.priceForeign) place.priceForeign = entry.priceForeign;
  }
}

/** JSON'u küçük tutmak için undefined alanları siler. */
export function stripUndefined<T extends object>(o: T): T {
  for (const k of Object.keys(o) as Array<keyof T>) if (o[k] === undefined) delete o[k];
  return o;
}
