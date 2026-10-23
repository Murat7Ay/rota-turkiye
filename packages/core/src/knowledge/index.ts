// Türkiye bilgi katmanı: coğrafi işaretli ürünler ("bu bölgenin tadı"), bölgeye bağlı
// tuzak/dolandırıcılık uyarıları ve görgü kuralları; sabah rehberi için kısa Türkçe ipuçları.
// Bütün veriler kaynaklıdır (her kayıtta source + checkedAt). İnternet gerektirmez.
import type { PlaceIndex } from "../geo";
import { haversineKm, lineLengthKm, lonLatToLatLng, pointAlongLine } from "../geo";
import { PROVINCES, trKey } from "../provinces";
import { fromTrWallClock, toTrWallClock } from "../time";
import { trLower } from "../trtext";
import type { DayPlan, LatLng, Place, PlaceCategory, PlanStop } from "../types";
import { DISTRICT_ANCHORS } from "./data/anchors";
import { ETIQUETTE } from "./data/etiquette";
import { GI_PRODUCTS } from "./data/gi-products";
import { AREA_WARNINGS } from "./data/warnings";
import type { AreaWarning, EtiquetteTip, GiKind, GiProduct, GiType, WarningKind } from "./model";

export * from "./model";
export { GI_PRODUCTS, GI_PORTAL } from "./data/gi-products";
export { AREA_WARNINGS } from "./data/warnings";
export { ETIQUETTE } from "./data/etiquette";
export { DISTRICT_ANCHORS, KNOWLEDGE_GEO_SOURCE } from "./data/anchors";

export const GI_KIND_LABEL: Record<GiKind, string> = {
  yemek: "Yemek",
  tatli: "Tatlı",
  icecek: "İçecek",
  urun: "Yöresel ürün",
  el_sanati: "El sanatı",
};

export const GI_TYPE_LABEL: Record<GiType, string> = {
  mense_adi: "Menşe adı",
  mahrec_isareti: "Mahreç işareti",
};

export const WARNING_KIND_LABEL: Record<WarningKind, string> = {
  dolandiricilik: "Dolandırıcılık",
  fiyat: "Fiyat tuzağı",
  bilgi: "Bilgi",
};

// ---------------------------------------------------------------- il tespiti

interface Anchor {
  name: string;
  province: string;
  loc: LatLng;
}

const PROVINCE_ANCHORS: Anchor[] = PROVINCES.map((p) => ({ name: p.name, province: p.name, loc: p.loc }));
const DISTRICTS: Anchor[] = Object.entries(DISTRICT_ANCHORS).flatMap(([province, rows]) =>
  rows.map(([name, lat, lon]) => ({ name, province, loc: { lat, lon } })),
);
const ALL_ANCHORS: Anchor[] = [...PROVINCE_ANCHORS, ...DISTRICTS];
const DISTRICT_BY_NAME = new Map(DISTRICTS.map((a) => [a.name, a]));
const PROVINCE_BY_KEY = new Map(PROVINCE_ANCHORS.map((a) => [trKey(a.name), a]));

/** En yakın il merkezi ya da (kapsanan illerde) ilçe/belde noktasına göre il adı. Kaba bir yaklaşımdır. */
export function provinceAt(loc: LatLng): string {
  let best = ALL_ANCHORS[0]!;
  let bestD = Infinity;
  for (const a of ALL_ANCHORS) {
    const d = haversineKm(loc, a.loc);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best.province;
}

/** Ürünün haritadaki noktası: ün bağı olan ilçe/belde, yoksa il merkezi */
export function giLocation(item: GiProduct): LatLng {
  const a = (item.place && DISTRICT_BY_NAME.get(item.place)) || PROVINCE_BY_KEY.get(trKey(item.province));
  return a ? a.loc : { lat: 0, lon: 0 };
}

// ---------------------------------------------------------------- coğrafi işaretler

/**
 * Bir noktanın çevresindeki coğrafi işaretli ürünler, en "yerel"den başlayarak.
 * - İlçeye bağlı ürünler: o ilçe `radiusKm` içindeyse (uzaklığa göre sıralı)
 * - İl geneli ürünler: noktanın ili ve yarıçap içinde ilçesi/merkezi olan komşu iller
 */
export function tastesNear(loc: LatLng, radiusKm = 25): GiProduct[] {
  const own = provinceAt(loc);
  const touched = new Set<string>([own]);
  for (const a of ALL_ANCHORS) if (haversineKm(loc, a.loc) <= radiusKm) touched.add(a.province);

  const scored: Array<{ item: GiProduct; score: number }> = [];
  for (const item of GI_PRODUCTS) {
    const anchor = item.place ? DISTRICT_BY_NAME.get(item.place) : undefined;
    let score: number;
    if (anchor) {
      const d = haversineKm(loc, anchor.loc);
      if (d > radiusKm) continue;
      score = d + (item.province === own ? 0 : 5);
    } else if (touched.has(item.province)) {
      score = item.province === own ? 10 : 22;
    } else {
      continue;
    }
    if (item.featured) score -= 6;
    scored.push({ item, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.item.regNo - b.item.regNo).map((s) => s.item);
}

/** Bir ilin coğrafi işaretleri; öne çıkanlar önce, sonra tescil sırası. İl adı büyük/küçük harf ve Türkçe karakter duyarsız. */
export function tastesForProvince(province: string): GiProduct[] {
  const key = trKey(province);
  return GI_PRODUCTS.filter((i) => trKey(i.province) === key).sort(
    (a, b) => Number(!!b.featured) - Number(!!a.featured) || a.regNo - b.regNo,
  );
}

// ---------------------------------------------------------------- bölge uyarıları

function inWindow(min: number, [start, end]: [number, number]): boolean {
  return start <= end ? min >= start && min < end : min >= start || min < end;
}

/**
 * Alanı `loc`u kapsayan uyarılar; en dar alan önce. `date` verilirse saat penceresi olan
 * uyarılar (ör. gece bar tuzağı) yalnızca o saatte döner.
 */
export function warningsNear(loc: LatLng, date?: Date): AreaWarning[] {
  const min = date ? toTrWallClock(date).min : undefined;
  const hits: Array<{ w: AreaWarning; r: number }> = [];
  for (const w of AREA_WARNINGS) {
    let r = Infinity;
    for (const a of w.areas) if (haversineKm(loc, a.center) <= a.radiusKm) r = Math.min(r, a.radiusKm);
    if (r === Infinity) continue;
    if (min !== undefined && w.activeMin && !inWindow(min, w.activeMin)) continue;
    hits.push({ w, r });
  }
  return hits.sort((a, b) => a.r - b.r).map((h) => h.w);
}

// ---------------------------------------------------------------- görgü kuralları

/** Verilen mekân türlerine uyan ipuçları (veri sırasıyla, tekrarsız) */
export function etiquetteFor(categories: readonly PlaceCategory[]): EtiquetteTip[] {
  const set = new Set(categories);
  return ETIQUETTE.filter((t) => t.categories.some((c) => set.has(c)));
}

/** Mekândan bağımsız genel kurallar (alkol satış saati, 112) */
export function generalEtiquette(): EtiquetteTip[] {
  return ETIQUETTE.filter((t) => t.categories.length === 0);
}

// ---------------------------------------------------------------- Türkçe ekler

const BACK_VOWELS = "aıou";
const FRONT_VOWELS = "eiöü";
const VOICELESS = "fstkçşhp";

/** Özel ada bulunma (-'da/-'de/-'ta/-'te) ya da ayrılma (-'dan/...) eki; "Mısır Çarşısı" → "'nda" */
function caseSuffix(name: string, kind: "loc" | "abl"): string {
  const w = trLower(name.trim());
  let back = false;
  for (let i = w.length - 1; i >= 0; i--) {
    const c = w[i]!;
    if (BACK_VOWELS.includes(c)) {
      back = true;
      break;
    }
    if (FRONT_VOWELS.includes(c)) break;
  }
  const v = back ? "a" : "e";
  const n = kind === "abl" ? "n" : "";
  const words = w.split(/\s+/);
  if (words.length > 1 && /s[ıiuü]$/.test(words[words.length - 1]!)) return `'nd${v}${n}`;
  const d = VOICELESS.includes(w[w.length - 1]!) ? "t" : "d";
  return `'${d}${v}${n}`;
}

// ---------------------------------------------------------------- sabah rehberi ipuçları

const CTA_TRANSIT: Record<GiKind, string> = {
  yemek: "bir lokantada sor",
  tatli: "bir tatlıcıda sor",
  icecek: "fırsat olursa dene",
  urun: "bir yöresel ürün dükkânında bak",
  el_sanati: "bir atölye ya da dükkânda bak",
};

const CTA_STAY: Record<GiKind, string> = {
  yemek: "yerel bir lokantada ya da fırında sor",
  tatli: "bir tatlıcıda sor",
  icecek: "fırsat olursa dene",
  urun: "yöresel ürün dükkânlarında bak",
  el_sanati: "atölye ve dükkânlarda bak",
};

/** Sabah rehberinde görgü ipucu öncelik sırası */
const ETIQUETTE_PRIORITY = ["cami-kiyafet", "carsi-pazarlik", "balik-menu-fiyati", "hesap-servis-kuver-yasak"];

interface Visit {
  stop: PlanStop;
  place: Place;
}

/** Günün geçtiği iller, sırayla: rota varsa ~5 km aralıklarla, yoksa çıkış–duraklar–varış */
function dayProvinces(day: DayPlan, stopLocs: LatLng[]): string[] {
  const pts: LatLng[] = [day.from.loc];
  if (day.route && day.route.length > 1) {
    const total = lineLengthKm(day.route);
    for (let km = 0; km < total; km += 5) pts.push(pointAlongLine(day.route, km));
    pts.push(lonLatToLatLng(day.route[day.route.length - 1]!));
  } else {
    pts.push(...stopLocs);
  }
  pts.push(day.to.loc);
  const seq: string[] = [];
  for (const p of pts) {
    const prov = provinceAt(p);
    if (!seq.includes(prov)) seq.push(prov);
  }
  return seq;
}

function centroid(locs: LatLng[]): LatLng | undefined {
  if (!locs.length) return undefined;
  return {
    lat: locs.reduce((a, l) => a + l.lat, 0) / locs.length,
    lon: locs.reduce((a, l) => a + l.lon, 0) / locs.length,
  };
}

function tasteTips(day: DayPlan, stopLocs: LatLng[]): string[] {
  const out: string[] = [];
  const used = new Set<string>();
  const start = provinceAt(day.from.loc);
  const end = provinceAt(day.to.loc);

  // Yolda geçilen il (çıkış ve varış dışındaki ilk il)
  if (day.isTravelDay) {
    for (const prov of dayProvinces(day, stopLocs)) {
      if (prov === start || prov === end) continue;
      const item = tastesForProvince(prov)[0];
      if (!item) continue;
      out.push(`Bugün ${prov}${caseSuffix(prov, "abl")} geçiyorsun: ${item.name} coğrafi işaretli — yolda ${CTA_TRANSIT[item.kind]}.`);
      used.add(item.id);
      break;
    }
  }

  // Günün geçtiği/varılan yer
  const center = day.isTravelDay ? day.to.loc : (centroid(stopLocs) ?? day.to.loc);
  const item = tastesNear(center).find((i) => !used.has(i.id));
  if (item) {
    const prov = provinceAt(center);
    const loc = caseSuffix(prov, "loc");
    const head = item.province === prov ? `${prov}${loc}${loc.endsWith("a") ? "sın" : "sin"}` : "Yakınında";
    out.push(`${head}: ${item.name} coğrafi işaretli — ${CTA_STAY[item.kind]}.`);
  }
  return out;
}

function warningTips(day: DayPlan, visits: Visit[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of visits) {
    const at = fromTrWallClock(day.date, v.stop.arriveMin);
    for (const w of warningsNear(v.place.loc, at)) {
      if (seen.has(w.id)) continue;
      seen.add(w.id);
      out.push(w.tip);
    }
  }
  return out;
}

/** Adı ek almaya uygun mu (harf ve boşluk; "(test)" gibi parantezli adlar hariç) */
const SIMPLE_NAME = /^[\p{L} ]{2,32}$/u;

function etiquetteTips(places: Place[]): string[] {
  const out: string[] = [];
  for (const id of ETIQUETTE_PRIORITY) {
    const tip = ETIQUETTE.find((t) => t.id === id);
    if (!tip) continue;
    const match = places.find((p) => tip.categories.includes(p.cat));
    if (!match) continue;
    if (tip.topic === "pazarlik" && match.cat === "carsi" && SIMPLE_NAME.test(match.name)) {
      out.push(`${match.name}${caseSuffix(match.name, "loc")} pazarlık normal: halı, takı, lamba gibi el işlerinde beklenir; gıdada ve fiyatı basılı üründe fiyat genelde sabit.`);
    } else {
      out.push(tip.tip);
    }
  }
  return out;
}

/**
 * Sabah rehberi için en fazla `max` (varsayılan 3) kısa Türkçe ipucu: sırayla bir tat
 * (coğrafi işaret), bir bölge uyarısı, bir görgü kuralı; eksik kalırsa kalanlarla doldurulur.
 */
export function localTipsForDay(day: DayPlan, index: PlaceIndex, max = 3): string[] {
  const visits: Visit[] = [];
  for (const stop of day.stops) {
    if (stop.status === "skipped") continue;
    const place = index.get(stop.placeId);
    if (place) visits.push({ stop, place });
  }
  const lists = [
    tasteTips(day, visits.map((v) => v.place.loc)),
    warningTips(day, visits),
    etiquetteTips(visits.map((v) => v.place)),
  ];
  const out: string[] = [];
  const longest = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < longest && out.length < max; i++) {
    for (const list of lists) {
      const t = list[i];
      if (t && out.length < max && !out.includes(t)) out.push(t);
    }
  }
  return out;
}
