// Ham OSM öğeleri → tekilleştirilmiş mekânlar + kasabalar → RegionPack.
import { CATEGORIES, type Place, type PlaceCategory, type RegionPack, type Town } from "@rota/core";
import { categorize, displayName, distanceKm, elementLoc, matchesEntry, type Candidate } from "./categorize";
import type { RegionOverlay } from "./curated/types";
import type { OsmElement, RawCache } from "./overpass";
import { inBBox, type RegionDef } from "./regions";
import { fold, normName, slug } from "./text";

export const ATTRIBUTION = "© OpenStreetMap katkıcıları — ODbL 1.0 (https://www.openstreetmap.org/copyright)";

/** Aynı ad + kategori bu yarıçap içindeyse aynı mekân sayılır (metre) */
export const DEDUP_RADIUS_M = 60;
/** Aynı wikidata kimliği bu mesafe içindeyse aynı varlık (alan + nokta çift çizimi) */
const WIKIDATA_RADIUS_KM = 1.5;

function richer(a: Candidate, b: Candidate): number {
  return (
    b.richness - a.richness ||
    Number(!!b.place.openingHours) - Number(!!a.place.openingHours) ||
    (a.place.id < b.place.id ? -1 : a.place.id > b.place.id ? 1 : 0)
  );
}

/** Düşen kopyadaki eksik bilgileri tutulan kayda taşır. */
function merge(kept: Place, dropped: Place): void {
  kept.openingHours ??= dropped.openingHours;
  kept.website ??= dropped.website;
  kept.wikidata ??= dropped.wikidata;
  kept.city ??= dropped.city;
  kept.district ??= dropped.district;
  kept.lastVerified ??= dropped.lastVerified;
  kept.tags = [...new Set([...kept.tags, ...dropped.tags])];
  kept.notability = Math.max(kept.notability, dropped.notability);
  if (kept.cat === dropped.cat) kept.slots = [...new Set([...kept.slots, ...dropped.slots])];
}

/**
 * Tekilleştirme: (1) aynı ad + aynı kategori, 60 m içinde; (2) aynı wikidata, 1,5 km içinde
 * (zincir şubelerinde yanlışlıkla marka wikidata'sı olabilir, markalılar bu adımı atlar).
 * Her kümede etiket sayısı en çok olan kalır.
 */
export function dedup(cands: Candidate[], radiusM = DEDUP_RADIUS_M): Candidate[] {
  const sorted = [...cands].sort(richer);
  const byKey = new Map<string, Candidate[]>();
  const byWikidata = new Map<string, Candidate[]>();
  const kept: Candidate[] = [];
  const near = (a: Place, b: Place, km: number) => distanceKm(a.loc.lat, a.loc.lon, b.loc.lat, b.loc.lon) <= km;

  for (const c of sorted) {
    const p = c.place;
    const key = `${p.cat}|${normName(p.name)}`;
    const wd = !c.brand ? p.wikidata : undefined;
    const twin =
      (byKey.get(key) ?? []).find((k) => near(k.place, p, radiusM / 1000)) ??
      (wd ? (byWikidata.get(wd) ?? []).find((k) => near(k.place, p, WIKIDATA_RADIUS_KM)) : undefined);
    if (twin) {
      merge(twin.place, p);
      continue;
    }
    kept.push(c);
    byKey.set(key, [...(byKey.get(key) ?? []), c]);
    if (wd) byWikidata.set(wd, [...(byWikidata.get(wd) ?? []), c]);
  }
  return kept;
}

/** Büyük ören yerinin alt noktası sayılabilecek kategoriler */
const SITE_PART_CATS = new Set<PlaceCategory>(["antik_kent", "tarihi_yapi", "manzara"]);

/**
 * Büyük ören yerleri (kürasyonda siteKm): Efes'in tiyatrosu, Celsus'u, kapıları OSM'de ayrı ayrı
 * çizilidir; planlayıcı bunları ayrı duraklar gibi önermesin diye ana yer tekleştirilir, yarıçap
 * içindeki diğer gezi noktaları düşük önemli "… ören yeri içinde" alt noktalarına çevrilir.
 */
export function applySites(places: Place[], overlay: RegionOverlay): Place[] {
  const dropped = new Set<Place>();
  const parts = new Set<Place>();
  const curated = new Set(places.filter((p) => overlay.entries.some((e) => matchesEntry(p, e))));
  for (const entry of overlay.entries) {
    if (!entry.siteKm) continue;
    const matches = places
      .filter((p) => !dropped.has(p) && matchesEntry(p, entry))
      .sort((a, b) => b.notability - a.notability || a.name.length - b.name.length || (a.id < b.id ? -1 : 1));
    const main = matches[0];
    if (!main) continue;
    for (const m of matches.slice(1)) {
      merge(main, m);
      dropped.add(m);
    }
    for (const p of places) {
      if (p === main || dropped.has(p) || parts.has(p) || curated.has(p) || !SITE_PART_CATS.has(p.cat)) continue;
      if (distanceKm(main.loc.lat, main.loc.lon, p.loc.lat, p.loc.lon) > entry.siteKm) continue;
      parts.add(p);
      if (p.cat === "antik_kent") {
        const info = CATEGORIES.tarihi_yapi;
        p.cat = "tarihi_yapi";
        p.slots = [...info.slots];
        p.indoor = info.indoor;
      }
      p.visitMin = Math.min(p.visitMin, 20);
      p.notability = Math.min(p.notability, 0.2);
      p.tags = p.tags.filter((t) => t !== "unesco" && t !== "muzekart");
      p.note = `${main.name} ören yeri içinde.`;
    }
  }
  return places.filter((p) => !dropped.has(p));
}

const TOWN_RELEVANT = new Set<PlaceCategory>(["antik_kent", "muze", "tarihi_yapi", "plaj", "otel", "pansiyon", "butik_otel", "carsi"]);

/**
 * Kasabalar: il/ilçe merkezleri (city/town) hep; köy ve mahalleler yalnızca kürasyon listesinde
 * ya da (köyler için) wikidata'lı ve çevresinde (1,5 km) en az 6 gezi/konaklama mekânı varsa.
 */
export function buildTowns(elements: OsmElement[], places: Place[], overlay: RegionOverlay, bbox: RegionDef["bbox"]): Town[] {
  const relevant = places.filter((p) => TOWN_RELEVANT.has(p.cat));
  const countNear = (lat: number, lon: number, km: number) => {
    const dLat = km / 111;
    const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
    let n = 0;
    for (const p of relevant) {
      if (Math.abs(p.loc.lat - lat) > dLat || Math.abs(p.loc.lon - lon) > dLon) continue;
      if (distanceKm(lat, lon, p.loc.lat, p.loc.lon) <= km) n++;
    }
    return n;
  };
  const keep = new Set(overlay.keepTowns);
  const out: Array<Town & { osm: number }> = [];
  for (const e of elements) {
    const t = e.tags ?? {};
    const place = t.place;
    if (e.type !== "node" || !place) continue;
    const name = displayName(t);
    const loc = elementLoc(e);
    if (!name || !loc || !inBBox(bbox, loc.lat, loc.lon)) continue;
    // Aynı adlı başka köyler de olabilir (Karahayıt…): koordinatlı yedek kayıt varsa 15 km içinde olmalı
    const key = normName(name);
    const fallback = (overlay.fallbackTowns ?? []).filter((f) => normName(f.name) === key);
    const curated = fallback.length
      ? fallback.some((f) => distanceKm(f.loc.lat, f.loc.lon, loc.lat, loc.lon) < 15)
      : keep.has(key.replace(/ /g, ""));
    let kind: Town["kind"];
    if (place === "city") kind = "city";
    else if (place === "town") kind = "town";
    else if (place === "village") {
      if (!curated && !(t.wikidata && countNear(loc.lat, loc.lon, 1.5) >= 6)) continue;
      kind = "village";
    } else if (place === "suburb") {
      if (!curated) continue;
      kind = "town";
    } else continue;
    const pop = parseInt((t.population ?? "").replace(/[.,\s]/g, ""), 10);
    out.push({ id: "", name, loc, kind, population: pop > 0 ? pop : undefined, osm: e.id });
  }
  // Yerleşim sorgusu eksikse elle girilmiş merkezler; OSM'de aynı adlı yakın yerleşim varsa o kalır
  for (const f of overlay.fallbackTowns ?? []) {
    const key = normName(f.name);
    const known = out.some((t) => normName(t.name) === key && distanceKm(t.loc.lat, t.loc.lon, f.loc.lat, f.loc.lon) < 15);
    if (!known && inBBox(bbox, f.loc.lat, f.loc.lon)) out.push({ id: "", name: f.name, loc: f.loc, kind: f.kind, osm: 0 });
  }
  const rank = { city: 0, town: 1, village: 2 } as const;
  out.sort((a, b) => rank[a.kind] - rank[b.kind] || (b.population ?? 0) - (a.population ?? 0) || a.osm - b.osm);
  const used = new Set<string>();
  // Aynı ad 15 km içinde ikinci kez (ilçe merkezi + aynı adlı köy) gelirse üst sıradaki kalır
  const unique = out.filter(
    (t, i) =>
      !out
        .slice(0, i)
        .some((u) => normName(u.name) === normName(t.name) && distanceKm(u.loc.lat, u.loc.lon, t.loc.lat, t.loc.lon) < 15),
  );
  return unique.map(({ osm, ...town }) => {
    let id = slug(town.name) || `n${osm}`;
    if (used.has(id)) id = `${id}-${osm}`;
    used.add(id);
    const result: Town = { ...town, id };
    if (result.population === undefined) delete result.population;
    return result;
  });
}

export interface BuildStats {
  elements: number;
  excluded: number;
  candidates: number;
  places: number;
  towns: number;
  byCategory: Partial<Record<PlaceCategory, number>>;
}

/** Bütün öğeleri işler; yabancı (komşu ülke) öğeleri ve kutu dışını eler. */
export function buildPlaces(elements: OsmElement[], overlay: RegionOverlay, bbox: RegionDef["bbox"]): { places: Place[]; candidates: number } {
  const cands: Candidate[] = [];
  for (const e of elements) {
    const c = categorize(e, overlay);
    if (c && inBBox(bbox, c.place.loc.lat, c.place.loc.lon)) cands.push(c);
  }
  const catOrder = Object.keys(CATEGORIES);
  const places = applySites(
    dedup(cands).map((c) => c.place),
    overlay,
  ).sort(
      (a, b) =>
        catOrder.indexOf(a.cat) - catOrder.indexOf(b.cat) || b.notability - a.notability || fold(a.name).localeCompare(fold(b.name)),
    );
  return { places, candidates: cands.length };
}

export function packVersion(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
}

export function assemblePack(region: RegionDef, raw: RawCache, overlay: RegionOverlay, now = new Date()): { pack: RegionPack; stats: BuildStats } {
  const foreign = new Set((raw.groups.yabanci ?? []).map((e) => `${e.type[0]}${e.id}`));
  const boxes = overlay.excludeBoxes ?? [];
  const seen = new Set<string>();
  const elements: OsmElement[] = [];
  let excluded = 0;
  // Tamamlanmış gruplar + yarım kalmış grupların bitmiş karoları
  const sources = [...Object.entries(raw.groups), ...Object.entries(raw.tiles ?? {})];
  for (const [group, list] of sources) {
    if (group === "yabanci") continue;
    for (const e of list) {
      const key = `${e.type[0]}${e.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const loc = elementLoc(e);
      if (foreign.has(key) || (loc && boxes.some((b) => inBBox(b, loc.lat, loc.lon)))) {
        excluded++;
        continue;
      }
      elements.push(e);
    }
  }
  const { places, candidates } = buildPlaces(elements, overlay, region.bbox);
  const towns = buildTowns(elements, places, overlay, region.bbox);
  const byCategory: BuildStats["byCategory"] = {};
  for (const p of places) byCategory[p.cat] = (byCategory[p.cat] ?? 0) + 1;
  const pack: RegionPack = {
    id: region.id,
    name: region.name,
    version: packVersion(now),
    generatedAt: now.toISOString(),
    bbox: region.bbox,
    attribution: ATTRIBUTION,
    towns,
    places,
  };
  return { pack, stats: { elements: elements.length, excluded, candidates, places: places.length, towns: towns.length, byCategory } };
}
