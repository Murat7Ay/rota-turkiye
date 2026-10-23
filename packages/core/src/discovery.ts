// Keşif motoru: plan sırasında rota koridorundaki değerli yerleri (antik kent, tarihi tatlıcı,
// manzara…) bulur; yolculuk sırasında da konuma göre "ileride şu var" bildirimlerine karar verir.
import { CATEGORIES } from "./catalog";
import {
  angleDiffDeg,
  bearingDeg,
  haversineKm,
  latLngToLonLat,
  lineLengthKm,
  lonLatToLatLng,
  pointAlongLine,
  projectOnLine,
} from "./geo";
import type { PlaceIndex } from "./geo";
import { hoursSource, isOpenAt } from "./hours";
import { addDays, toTrWallClock } from "./time";
import type { TravelModel } from "./travel";
import { clamp01, fmtKm, round2, round3, trLower } from "./trtext";
import type { Interest, LatLng, LonLat, Place, PlaceCategory, PlaceTag, TransportMode } from "./types";

export interface Discovery {
  place: Place;
  /** Rotaya en kısa uzaklık, km */
  offRouteKm: number;
  /** Tahmini ek yol süresi (sapıp geri dönme, ziyaret hariç), dk */
  detourMin: number;
  /** Rota başından itibaren konumu, km */
  alongKm: number;
  /** 0..1 */
  score: number;
  /** Türkçe tek cümle, ör. "Rotadan 3 km, ~8 dk sapma · UNESCO" */
  reason: string;
}

export interface CorridorOptions {
  interests: Interest[];
  /** Varsayılan: araba 6 km, yürüyüş 0,8 km, toplu taşıma 1,5 km */
  bufferKm?: number;
  /** Varsayılan 25 dk */
  maxDetourMin?: number;
  /** Varsayılan 0,35 */
  minNotability?: number;
  /** Varsayılan: gezi grubu + tatlici + yoresel_urun + cay_bahcesi */
  categories?: PlaceCategory[];
  excludeIds?: ReadonlySet<string>;
  /** Varsayılan 12 */
  limit?: number;
  mode?: TransportMode;
  /**
   * Rotanın başlangıç/bitiş noktasına bu kadar yakın yerler "yol üstü" sayılmaz (çıkış ve varış
   * şehrinin kendi yerleri; onları günlük plan doldurur). Varsayılan: araba 3 km, diğerleri 0.
   */
  skipEndsKm?: number;
}

export interface DiscoveryContext {
  index: PlaceIndex;
  travel: TravelModel;
}

/** findCorridorDiscoveries varsayılan kategorileri */
export const DEFAULT_CORRIDOR_CATEGORIES: PlaceCategory[] = [
  "antik_kent",
  "muze",
  "tarihi_yapi",
  "cami",
  "manzara",
  "dogal_alan",
  "tatlici",
  "yoresel_urun",
  "cay_bahcesi",
];

const DEFAULT_BUFFER_KM: Record<TransportMode, number> = { araba: 6, yuruyus: 0.8, toplu: 1.5 };
const DEFAULT_SKIP_ENDS_KM: Record<TransportMode, number> = { araba: 3, yuruyus: 0, toplu: 0 };
const DEFAULT_MAX_DETOUR_MIN = 25;
/** Bu mesafedeki yerler tek küme sayılır, en iyisi kalır */
const CLUSTER_KM = 0.3;

// ---------------------------------------------------------------- puanlama

/** Kalite sinyali taşıyan etiketler (muzekart/aile/erisilebilir kalite sinyali değildir) */
const TAG_WEIGHT: Partial<Record<PlaceTag, number>> = {
  unesco: 1,
  michelin: 0.85,
  bib_gourmand: 0.75,
  gault_millau: 0.7,
  tarihi: 0.5,
  cografi_isaret: 0.45,
  wikidata: 0.35,
  yerel: 0.3,
  manzara: 0.3,
};

/** Etiketlerin ima ettiği ilgi alanları (kategori ilgi alanlarına eklenir) */
const TAG_INTERESTS: Partial<Record<PlaceTag, Interest[]>> = {
  unesco: ["tarih", "kultur"],
  tarihi: ["tarih"],
  manzara: ["fotograf"],
  michelin: ["yemek"],
  bib_gourmand: ["yemek"],
  gault_millau: ["yemek"],
  cografi_isaret: ["yemek", "alisveris"],
};

/** Yeme-içme/alışveriş yerinin "yolu değer" sayılması için gereken etiketler */
const WORTH_STOP_TAGS: PlaceTag[] = ["tarihi", "yerel", "michelin", "bib_gourmand", "gault_millau", "cografi_isaret"];

/** Gezi yerleri her zaman aday; tatlıcı/çay bahçesi/dükkân ancak öne çıkan bir sinyal taşıyorsa */
function worthStop(p: Place): boolean {
  if (CATEGORIES[p.cat].group === "gezi") return true;
  return p.notability >= 0.6 || p.tags.some((t) => WORTH_STOP_TAGS.includes(t));
}

/** 0..1; ilgi alanı verilmemişse nötr 0,5 */
function interestFit(p: Place, interests: readonly Interest[]): number {
  if (interests.length === 0) return 0.5;
  const own = new Set<Interest>(CATEGORIES[p.cat].interests);
  for (const t of p.tags) for (const i of TAG_INTERESTS[t] ?? []) own.add(i);
  const overlap = interests.filter((i) => own.has(i)).length;
  return overlap === 0 ? 0 : overlap === 1 ? 0.75 : 1;
}

/** En güçlü etiket + diğer her kalite etiketi için küçük katkı */
function tagScore(p: Place): number {
  const w = p.tags
    .map((t) => TAG_WEIGHT[t] ?? 0)
    .filter((x) => x > 0)
    .sort((a, b) => b - a);
  if (w.length === 0) return 0;
  return Math.min(1, w[0]! + 0.1 * (w.length - 1));
}

function corridorScore(p: Place, interests: readonly Interest[], detourMin: number, maxDetourMin: number): number {
  const detourRatio = maxDetourMin > 0 ? Math.min(1, detourMin / maxDetourMin) : 0;
  return round3(clamp01(0.45 * p.notability + 0.25 * interestFit(p, interests) + 0.3 * tagScore(p) - 0.2 * detourRatio));
}

/** Kullanıcıya gösterilen tek ifade: "UNESCO Dünya Mirası", "Tarihi tatlıcı", "Antik kent" */
function highlightOf(p: Place): string {
  const info = CATEGORIES[p.cat];
  const has = (t: PlaceTag) => p.tags.includes(t);
  if (has("unesco")) return "UNESCO Dünya Mirası";
  if (has("michelin")) return "Michelin Rehberi'nde";
  if (has("bib_gourmand")) return "Michelin Bib Gourmand";
  if (has("gault_millau")) return "Gault&Millau rehberinde";
  if (info.group !== "gezi" && has("tarihi")) return `Tarihi ${trLower(info.label)}`;
  if (has("cografi_isaret")) return "Coğrafi işaretli ürünler";
  if (info.group !== "gezi" && has("yerel")) return `Yerel ${trLower(info.label)}`;
  return info.label;
}

/**
 * Tek yön sapma süresi. TravelModel'in tahmini (estimateLeg) 1,2 km altındaki bacakları
 * yürüyüş sayar; arabayla sapmada bu, yakındaki yeri uzaktakinden "pahalı" gösterir.
 * Arabada süreyi yavaş şehir içi sürüşle (22 km/sa + 3 dk) sınırlıyoruz.
 */
function oneWayMin(from: LatLng, to: LatLng, travel: TravelModel, mode: TransportMode): number {
  const leg = travel.leg(from, to);
  if (mode === "araba") return Math.min(leg.min, Math.round(3 + (leg.km / 22) * 60));
  return leg.min;
}

function byScore(a: { score: number; place: Place }, b: { score: number; place: Place }, ka = 0, kb = 0): number {
  return b.score - a.score || ka - kb || (a.place.id < b.place.id ? -1 : a.place.id > b.place.id ? 1 : 0);
}

// ---------------------------------------------------------------- rota koridoru

/** Rota koridorundaki keşifler, puana göre sıralı (eşitlikte rota sırası) */
export function findCorridorDiscoveries(route: LonLat[], opts: CorridorOptions, ctx: DiscoveryContext): Discovery[] {
  if (route.length < 2) return [];
  const mode = opts.mode ?? ctx.travel.mode;
  const bufferKm = opts.bufferKm ?? DEFAULT_BUFFER_KM[mode];
  const maxDetour = opts.maxDetourMin ?? DEFAULT_MAX_DETOUR_MIN;
  const minNot = opts.minNotability ?? 0.35;
  const skipEnds = opts.skipEndsKm ?? DEFAULT_SKIP_ENDS_KM[mode];
  const cats = new Set(opts.categories ?? DEFAULT_CORRIDOR_CATEGORIES);
  const total = lineLengthKm(route);
  const start = lonLatToLatLng(route[0]!);
  const end = lonLatToLatLng(route[route.length - 1]!);

  const candidates = ctx.index.nearLine(
    route,
    bufferKm,
    (p) => cats.has(p.cat) && !opts.excludeIds?.has(p.id) && p.notability >= minNot && worthStop(p),
  );

  const scored: Discovery[] = [];
  for (const { place, proj } of candidates) {
    if (skipEnds > 0 && (haversineKm(place.loc, start) <= skipEnds || haversineKm(place.loc, end) <= skipEnds)) continue;
    // İzdüşümü rotanın ucuna düşen ve uzakta kalan yer rotanın "ötesinde"dir, yol üstünde değil.
    if ((proj.alongKm <= 0.05 || proj.alongKm >= total - 0.05) && proj.distanceKm > 0.5) continue;
    const detourMin = 2 * oneWayMin(proj.point, place.loc, ctx.travel, mode);
    if (detourMin > maxDetour) continue;
    scored.push({
      place,
      offRouteKm: round2(proj.distanceKm),
      detourMin,
      alongKm: round2(proj.alongKm),
      score: corridorScore(place, opts.interests, detourMin, maxDetour),
      reason: "",
    });
  }

  // Küme: ~300 m içindeki yerlerden en yüksek puanlı kalır.
  scored.sort((a, b) => byScore(a, b, a.alongKm, b.alongKm));
  const kept: Array<{ d: Discovery; extra: number }> = [];
  for (const d of scored) {
    const host = kept.find((k) => haversineKm(k.d.place.loc, d.place.loc) <= CLUSTER_KM);
    if (host) host.extra++;
    else kept.push({ d, extra: 0 });
  }

  return kept.slice(0, opts.limit ?? 12).map(({ d, extra }) => ({ ...d, reason: corridorReason(d, extra) }));
}

function offRouteText(km: number, capital: boolean): string {
  if (km < 0.25) return capital ? "Rota üzerinde" : "rota üzerinde";
  return `${capital ? "Rotadan" : "rotadan"} ${fmtKm(km)} km`;
}

function corridorReason(d: Discovery, extra: number): string {
  const parts = [offRouteText(d.offRouteKm, true), `~${d.detourMin} dk sapma`, highlightOf(d.place)];
  if (extra > 0) parts.push(`yakınında ${extra} yer daha`);
  return parts.join(" · ");
}

// ---------------------------------------------------------------- canlı yakınlık bildirimleri

export interface ProximitySettings {
  enabled: boolean;
  /** Rota boyunca ileriye bakış, km */
  lookaheadKm: number;
  /** Rotadan en fazla sapma, km */
  maxOffRouteKm: number;
  /** Rota yokken çevre yarıçapı, km */
  radiusKm: number;
  /** Günde en fazla bildirim (bildirim yorgunluğu) */
  maxPerDay: number;
  /** İki bildirim arası en az süre, dk */
  cooldownMin: number;
  /** Sessiz saatler [başlangıç, bitiş] gün içi dakika; gece yarısını aşabilir (ör. [1320, 480]) */
  quietHours: [number, number];
  categories: PlaceCategory[];
  interests: Interest[];
  /** 0..1 */
  minScore: number;
}

export interface ProximityState {
  /** placeId -> bildirim zamanı (ISO) — aynı yer bir daha bildirilmez */
  notified: Record<string, string>;
  /** YYYY-MM-DD; gün değişince sayaç sıfırlanır */
  dayKey: string;
  dayCount: number;
  lastAt?: string;
}

export interface ProximityInput {
  position: LatLng;
  /** Hareket yönü, derece; rota yokken "önümdeki" yerleri seçmek için */
  headingDeg?: number;
  speedKmh?: number;
  /** Günün rota çizgisi (varsa) */
  route?: LonLat[];
  now: Date;
  /** Zaten planda olan yerler bildirilmez */
  plannedPlaceIds?: ReadonlySet<string>;
}

export interface ProximityNotification {
  id: string;
  placeId: string;
  /** "İleride: Nysa Antik Kenti" */
  title: string;
  /** "12 km sonra, rotadan 2 km · ~6 dk sapma. UNESCO adayı." */
  body: string;
  discovery: Discovery;
}

export const DEFAULT_PROXIMITY_SETTINGS: ProximitySettings = {
  enabled: true,
  lookaheadKm: 20,
  maxOffRouteKm: 4,
  radiusKm: 2,
  maxPerDay: 4,
  cooldownMin: 20,
  quietHours: [22 * 60, 8 * 60],
  categories: ["antik_kent", "muze", "tarihi_yapi", "manzara", "dogal_alan", "tatlici", "yoresel_urun", "cay_bahcesi"],
  interests: [],
  minScore: 0.45,
};

export const EMPTY_PROXIMITY_STATE: ProximityState = { notified: {}, dayKey: "", dayCount: 0 };

/** Sessiz saat mi? [s, e) aralığı; s > e ise gece yarısını aşar, s === e ise sessiz saat yok. */
function inQuietHours(min: number, [s, e]: [number, number]): boolean {
  if (s === e) return false;
  return s < e ? min >= s && min < e : min >= s || min < e;
}

/** Gece yarısını aşan açılışları da (ör. 17:00-01:00) hesaba katan açık mı kontrolü */
function openAtEta(place: Place, date: string, nowMin: number, etaMin: number): boolean {
  const t = nowMin + Math.max(0, Math.round(etaMin));
  const d = addDays(date, Math.floor(t / 1440));
  const m = t % 1440;
  return isOpenAt(place, d, m) || isOpenAt(place, addDays(d, -1), m + 1440);
}

/** Rotanın [fromKm, toKm] parçası */
function sliceLine(line: LonLat[], fromKm: number, toKm: number): LonLat[] {
  const out: LonLat[] = [latLngToLonLat(pointAlongLine(line, fromKm))];
  let acc = 0;
  for (let i = 0; i < line.length - 1; i++) {
    acc += haversineKm(lonLatToLatLng(line[i]!), lonLatToLatLng(line[i + 1]!));
    if (acc > fromKm && acc < toKm) out.push(line[i + 1]!);
  }
  out.push(latLngToLonLat(pointAlongLine(line, toKm)));
  return out;
}

interface ProximityCandidate {
  discovery: Discovery;
  /** Rota boyunca kalan mesafe (rota modunda) ya da kuş uçuşu uzaklık, km */
  distKm: number;
  oneWayMin: number;
  etaMin: number;
}

function hasOwn(o: object, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}

/** Saf fonksiyon: bu konumda bildirim gönderilmeli mi? Yeni durumu da döndürür. */
export function evaluateProximity(
  input: ProximityInput,
  settings: ProximitySettings,
  state: ProximityState,
  ctx: DiscoveryContext,
): { notifications: ProximityNotification[]; state: ProximityState } {
  if (!settings.enabled) return { notifications: [], state };

  const wall = toTrWallClock(input.now);
  const next: ProximityState = state.dayKey === wall.date ? state : { ...state, dayKey: wall.date, dayCount: 0 };
  const idle = { notifications: [] as ProximityNotification[], state: next };

  if (inQuietHours(wall.min, settings.quietHours)) return idle;
  if (next.dayCount >= settings.maxPerDay) return idle;
  if (next.lastAt) {
    const sinceMin = (input.now.getTime() - Date.parse(next.lastAt)) / 60_000;
    // Saat geri alınmışsa (negatif fark) bekleme uygulanmaz.
    if (sinceMin >= 0 && sinceMin < settings.cooldownMin) return idle;
  }

  const cats = new Set(settings.categories);
  const eligible = (p: Place) =>
    cats.has(p.cat) && !hasOwn(next.notified, p.id) && !input.plannedPlaceIds?.has(p.id) && worthStop(p);
  const mode = ctx.travel.mode;
  const speed = input.speedKmh ?? 0;

  const onRoute = input.route && input.route.length >= 2 ? routeCandidates(input, input.route, settings, ctx, eligible) : null;
  const withRoute = onRoute !== null;
  const candidates = onRoute ?? aroundCandidates(input, settings, ctx, eligible, mode, speed);

  candidates.sort((a, b) => byScore(a.discovery, b.discovery, a.distKm, b.distKm));
  const best = candidates.find(
    (c) => c.discovery.score >= settings.minScore && openAtEta(c.discovery.place, wall.date, wall.min, c.etaMin),
  );
  if (!best) return idle;

  const d = best.discovery;
  const highlight = highlightOf(d.place);
  const body = withRoute
    ? `${fmtKm(best.distKm)} km sonra · ${offRouteText(d.offRouteKm, false)} (~${d.detourMin} dk sapma) · ${highlight}`
    : `${fmtKm(best.distKm)} km uzakta · ~${best.oneWayMin} dk · ${highlight}`;
  const nowIso = input.now.toISOString();
  const notification: ProximityNotification = {
    id: `prox:${d.place.id}:${input.now.getTime()}`,
    placeId: d.place.id,
    title: `${withRoute ? "İleride" : "Yakınında"}: ${d.place.name}`,
    body,
    discovery: { ...d, reason: body },
  };
  return {
    notifications: [notification],
    state: {
      notified: { ...next.notified, [d.place.id]: nowIso },
      dayKey: wall.date,
      dayCount: next.dayCount + 1,
      lastAt: nowIso,
    },
  };
}

/**
 * Rota modu: yalnız ileride (alongNow, alongNow + lookahead] aralığındaki ve rotadan en fazla
 * maxOffRouteKm uzaktaki yerler. Konum rotadan çok uzaksa null (çevre moduna düşülür).
 */
function routeCandidates(
  input: ProximityInput,
  route: LonLat[],
  settings: ProximitySettings,
  ctx: DiscoveryContext,
  eligible: (p: Place) => boolean,
): ProximityCandidate[] | null {
  const here = projectOnLine(input.position, route);
  if (here.distanceKm > Math.max(5, settings.maxOffRouteKm + 1)) return null;
  const total = lineLengthKm(route);
  const fromKm = here.alongKm;
  const toKm = Math.min(total, fromKm + settings.lookaheadKm);
  if (toKm - fromKm < 0.05) return [];

  const mode = ctx.travel.mode;
  const speed = input.speedKmh ?? 0;
  const out: ProximityCandidate[] = [];
  // Hız için yalnız ileri parçayı tara; karar ise tam rotaya izdüşümle verilir (geçilen yer asla seçilmez).
  for (const { place } of ctx.index.nearLine(sliceLine(route, fromKm, toKm), settings.maxOffRouteKm, eligible)) {
    const proj = projectOnLine(place.loc, route);
    if (proj.alongKm <= fromKm || proj.alongKm > toKm) continue;
    if (proj.distanceKm > settings.maxOffRouteKm) continue;
    const aheadKm = proj.alongKm - fromKm;
    const oneWay = oneWayMin(proj.point, place.loc, ctx.travel, mode);
    const detourMin = 2 * oneWay;
    const toTurnMin = speed > 10 ? (aheadKm / speed) * 60 : ctx.travel.leg(input.position, proj.point).min;
    out.push({
      discovery: {
        place,
        offRouteKm: round2(proj.distanceKm),
        detourMin,
        alongKm: round2(proj.alongKm),
        score: corridorScore(place, settings.interests, detourMin, DEFAULT_MAX_DETOUR_MIN),
        reason: "",
      },
      distKm: aheadKm,
      oneWayMin: oneWay,
      etaMin: toTurnMin + oneWay,
    });
  }
  return out;
}

/** Rotasız mod: yarıçap içinde; hareket hâlindeyse (>10 km/sa) yalnız yönün ±60° önündekiler */
function aroundCandidates(
  input: ProximityInput,
  settings: ProximitySettings,
  ctx: DiscoveryContext,
  eligible: (p: Place) => boolean,
  mode: TransportMode,
  speed: number,
): ProximityCandidate[] {
  const useHeading = input.headingDeg !== undefined && speed > 10;
  const out: ProximityCandidate[] = [];
  for (const place of ctx.index.near(input.position, settings.radiusKm, eligible)) {
    const dist = haversineKm(input.position, place.loc);
    if (useHeading && dist > 0.05 && angleDiffDeg(bearingDeg(input.position, place.loc), input.headingDeg!) > 60) continue;
    const leg = ctx.travel.leg(input.position, place.loc);
    const oneWay = oneWayMin(input.position, place.loc, ctx.travel, mode);
    const detourMin = 2 * oneWay;
    out.push({
      discovery: {
        place,
        offRouteKm: round2(dist),
        detourMin,
        alongKm: 0,
        score: corridorScore(place, settings.interests, detourMin, DEFAULT_MAX_DETOUR_MIN),
        reason: "",
      },
      distKm: dist,
      oneWayMin: oneWay,
      etaMin: speed > 10 ? (leg.km / speed) * 60 : oneWay,
    });
  }
  return out;
}

// ---------------------------------------------------------------- "Etrafım"

export interface NearbyHighlight {
  place: Place;
  distanceKm: number;
  bearingDeg: number;
  /** null: çalışma saati bilinmiyor */
  openNow: boolean | null;
  score: number;
}

/** Varsayılan: konaklama ve yol tesisleri dışındaki bütün kategoriler */
const NEARBY_DEFAULT_CATEGORIES = (Object.keys(CATEGORIES) as PlaceCategory[]).filter(
  (c) => CATEGORIES[c].group !== "konaklama" && CATEGORIES[c].group !== "yol",
);

/** "Etrafım" görünümü için konum çevresindeki öne çıkan yerler */
export function nearbyHighlights(
  position: LatLng,
  radiusKm: number,
  opts: { interests: Interest[]; limit?: number; now?: Date; categories?: PlaceCategory[] },
  ctx: DiscoveryContext,
): NearbyHighlight[] {
  const wall = toTrWallClock(opts.now ?? new Date());
  const cats = new Set(opts.categories ?? NEARBY_DEFAULT_CATEGORIES);
  return ctx.index
    .near(position, radiusKm, (p) => cats.has(p.cat))
    .map((place) => {
      const d = haversineKm(position, place.loc);
      const closeness = radiusKm > 0 ? 1 - Math.min(1, d / radiusKm) : 1;
      return {
        place,
        distanceKm: round3(d),
        bearingDeg: Math.round(bearingDeg(position, place.loc)) % 360,
        openNow: hoursSource(place) === "none" ? null : openAtEta(place, wall.date, wall.min, 0),
        score: round3(
          clamp01(0.5 * place.notability + 0.2 * interestFit(place, opts.interests) + 0.15 * tagScore(place) + 0.15 * closeness),
        ),
      };
    })
    .sort((a, b) => byScore(a, b, a.distanceKm, b.distanceKm))
    .slice(0, opts.limit ?? 20);
}
