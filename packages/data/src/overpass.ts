// Overpass API: sorgu üretimi, nazik indirme (yeniden deneme + yedek uç) ve ham önbellek.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BBox, RegionDef } from "./regions";

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
export const USER_AGENT = "rota-turkiye/0.1 (https://github.com/Murat7Ay/rota-turkiye)";

// Overpass regex motoru Türkçe harflerde büyük/küçük harf duyarsızlığına güvenilmez; varyantlar açık yazılır.
const CARSI_RE = "Çarşı|çarşı|ÇARŞI|Bedesten|bedesten|BEDESTEN|Arasta|arasta|ARASTA| Hanı| Han$";
const YORESEL_RE = "Yöresel|yöresel|YÖRESEL|Köy Ürün|köy ürün|KÖY ÜRÜN|Zeytinyağ|zeytinyağ|ZEYTİNYAĞ";

export interface QueryGroup {
  statements: string[];
  /** Birleşimden önce çalışan ifade (ör. alan tanımı) */
  pre?: string;
  /** Çıktı biçimi; varsayılan merkez + etiketler */
  out?: string;
  /** Karolara bölmeden bütün bölge kutusuyla sorgula (küçük sonuçlu gruplar) */
  wholeBox?: boolean;
}

/** Sorgu grupları: her biri ayrı istek, böylece tek bir dev sorgu zaman aşımına düşmez. */
/**
 * Tam değer eşleşmeli ifadeler: Overpass (anahtar, değer) dizinini kullanır. Değer regex'i
 * ("natural"~"^(beach|…)$") bütün natural=* öğelerini (ağaç, orman…) taradığı için çok yavaştır.
 */
function each(kind: "nwr" | "nw" | "node", key: string, values: string[], extra = '["name"]'): string[] {
  return values.map((v) => `${kind}["${key}"="${v}"]${extra};`);
}

/** Sorgu grupları: her biri ayrı istek, böylece tek bir dev sorgu zaman aşımına düşmez. */
export const QUERY_GROUPS: Record<string, QueryGroup> = {
  gezi: {
    statements: [
      ...each("nwr", "tourism", ["museum", "attraction", "viewpoint"]),
      ...each("nwr", "historic", ["archaeological_site", "ruins", "castle", "monument", "fort", "city_gate", "aqueduct", "caravanserai", "tomb"]),
      ...each("nwr", "historic", ["church", "monastery", "synagogue", "mosque", "bridge", "building", "tower", "bath", "fountain"], '["name"]["wikidata"]'),
    ],
  },
  ibadet_carsi: {
    statements: [
      'nwr["amenity"="place_of_worship"]["name"]["wikidata"];',
      'nwr["amenity"="place_of_worship"]["religion"="muslim"]["name"]["historic"];',
      'nwr["amenity"="place_of_worship"]["religion"="muslim"]["name"]["heritage"];',
      'nwr["building"="mosque"]["name"]["historic"];',
      `nwr["historic"]["name"~"${CARSI_RE}"];`,
      `nwr["landuse"="retail"]["name"~"${CARSI_RE}"];`,
    ],
  },
  doga: {
    statements: [
      ...each("nwr", "natural", ["beach", "spring", "waterfall", "cave_entrance"]),
      ...each("nwr", "leisure", ["nature_reserve", "beach_resort"]),
      'nwr["leisure"="park"]["name"]["wikidata"];',
      'nwr["boundary"="national_park"]["name"];',
    ],
  },
  yeme: {
    statements: [
      ...each("nw", "amenity", ["restaurant", "cafe", "fast_food", "ice_cream", "marketplace"]),
      ...each("nw", "shop", ["pastry", "confectionery", "bakery", "chocolate"]),
    ],
  },
  alisveris: {
    statements: [
      ...each("nw", "shop", ["deli", "farm", "tea", "coffee", "spices", "cheese", "wine", "dairy", "nuts", "honey", "olive_oil", "souvenir"]),
      `nw["shop"]["name"~"${YORESEL_RE}"];`,
      'nw["craft"="winery"]["name"];',
      ...each("nw", "highway", ["services", "rest_area"]),
    ],
  },
  konaklama: { statements: each("nwr", "tourism", ["hotel", "guest_house", "hostel", "motel", "chalet", "camp_site"]) },
  yerlesim: { statements: each("node", "place", ["city", "town", "village", "suburb"]) },
  // Kutuya giren komşu ülke toprakları (Ege'de Yunan adaları): yalnızca kimlikler, sonra elenir
  yabanci: {
    pre: 'area["ISO3166-1"="GR"]["admin_level"="2"]->.yabanci;',
    statements: ['nwr(area.yabanci)["name"];'],
    out: "out ids qt;",
    wholeBox: true,
  },
};

export function buildQuery(group: QueryGroup, bbox: BBox, timeout = 180): string {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const pre = group.pre ? `${group.pre}\n` : "";
  const body = group.statements.join("\n  ");
  return `[out:json][timeout:${timeout}][bbox:${minLat},${minLon},${maxLat},${maxLon}];\n${pre}(\n  ${body}\n);\n${group.out ?? "out center tags qt;"}`;
}

class OverpassTimeout extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (msg: string) => process.stderr.write(`[overpass] ${msg}\n`);

/**
 * Tek sorgu; 429/5xx ve ağ hatalarında artan beklemeyle yeniden dener, uçlar arasında dönüşümlü
 * gider. splittable: zaman aşımı iki uçta da tekrarlarsa kutu bölünsün diye hata fırlatılır.
 */
export async function runQuery(query: string, splittable = false, maxAttempts = 6): Promise<OsmElement[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length]!;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(300_000),
      });
      if (res.status === 400) throw new Error(`Overpass 400 (sorgu hatası): ${(await res.text()).slice(0, 500)}`);
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      const json = (await res.json()) as { elements?: OsmElement[]; remark?: string };
      // Zaman aşımında Overpass 200 + "runtime error" notuyla yarım veri döner; kabul etmiyoruz.
      if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) {
        throw new OverpassTimeout(json.remark);
      }
      return json.elements ?? [];
    } catch (err) {
      lastErr = err;
      if (err instanceof Error && err.message.startsWith("Overpass 400")) throw err;
      if (err instanceof OverpassTimeout && splittable && attempt >= 1) throw err;
      const wait = Math.min(120_000, 15_000 * 2 ** attempt);
      log(`deneme ${attempt + 1}/${maxAttempts} başarısız (${endpoint}): ${String(err).slice(0, 160)}; ${wait / 1000} sn bekleniyor`);
      await sleep(wait);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function splitBBox([minLon, minLat, maxLon, maxLat]: BBox): BBox[] {
  const midLon = (minLon + maxLon) / 2;
  const midLat = (minLat + maxLat) / 2;
  return [
    [minLon, minLat, midLon, midLat],
    [midLon, minLat, maxLon, midLat],
    [minLon, midLat, midLon, maxLat],
    [midLon, midLat, maxLon, maxLat],
  ];
}

/** Bölge kutusunu en çok span derece genişliğinde sabit karolara böler (önbellek birimi). */
export function gridTiles([minLon, minLat, maxLon, maxLat]: BBox, span: number): BBox[] {
  const nx = Math.max(1, Math.ceil((maxLon - minLon) / span - 1e-9));
  const ny = Math.max(1, Math.ceil((maxLat - minLat) / span - 1e-9));
  const dx = (maxLon - minLon) / nx;
  const dy = (maxLat - minLat) / ny;
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  const out: BBox[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      out.push([r(minLon + i * dx), r(minLat + j * dy), r(minLon + (i + 1) * dx), r(minLat + (j + 1) * dy)]);
    }
  }
  return out;
}

/** Bir karoyu indirir; zaman aşımında kutuyu dörde bölüp parça parça yeniden dener. */
export async function fetchGroup(group: QueryGroup, bbox: BBox, depth = 0, maxDepth = 3): Promise<OsmElement[]> {
  try {
    return await runQuery(buildQuery(group, bbox), depth < maxDepth);
  } catch (err) {
    if (!(err instanceof OverpassTimeout) || depth >= maxDepth) throw err;
    log(`zaman aşımı, kutu bölünüyor (derinlik ${depth + 1})`);
    const out: OsmElement[] = [];
    for (const part of splitBBox(bbox)) {
      out.push(...(await fetchGroup(group, part, depth + 1, maxDepth)));
      await sleep(3_000);
    }
    return uniqueElements(out);
  }
}

export function uniqueElements(elements: OsmElement[]): OsmElement[] {
  const seen = new Map<string, OsmElement>();
  for (const e of elements) seen.set(`${e.type[0]}${e.id}`, e);
  return [...seen.values()];
}

export interface RawCache {
  region: string;
  bbox: BBox;
  fetchedAt: string;
  /** Tamamlanmış gruplar */
  groups: Record<string, OsmElement[]>;
  /** Yarım kalmış grupların bitmiş karoları ("grup:i/n") */
  tiles?: Record<string, OsmElement[]>;
}

export const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", ".cache");
/** Önbellek karosu, derece. Overpass yoğunken büyük kutular zaman aşımına düşüyor. */
export const TILE_SPAN = 0.5;

/**
 * Bölgenin ham verisini önbellekten okur, eksik grupları karo karo indirir. Her karo bitince
 * önbellek yazılır; yarıda kalan çalıştırma kaldığı yerden sürer. refresh: hepsini yeniden indir.
 */
export async function loadRegionElements(region: RegionDef, refresh = false): Promise<RawCache> {
  const file = join(CACHE_DIR, `${region.id}.json`);
  let cache: RawCache = { region: region.id, bbox: region.bbox, fetchedAt: new Date().toISOString(), groups: {}, tiles: {} };
  if (!refresh && existsSync(file)) {
    const old = JSON.parse(readFileSync(file, "utf8")) as RawCache;
    if (JSON.stringify(old.bbox) === JSON.stringify(region.bbox)) cache = old;
  }
  const tiles = (cache.tiles ??= {});
  mkdirSync(CACHE_DIR, { recursive: true });
  const save = () => writeFileSync(file, JSON.stringify(cache));
  for (const [name, group] of Object.entries(QUERY_GROUPS)) {
    const done = cache.groups[name];
    if (done) {
      log(`${region.id}/${name}: önbellekten (${done.length} öğe)`);
      continue;
    }
    const t0 = Date.now();
    const grid = group.wholeBox ? [region.bbox] : gridTiles(region.bbox, TILE_SPAN);
    const parts: OsmElement[] = [];
    for (let i = 0; i < grid.length; i++) {
      const key = `${name}:${i + 1}/${grid.length}`;
      let els = tiles[key];
      if (!els) {
        els = await fetchGroup(group, grid[i]!);
        tiles[key] = els;
        save();
        log(`${region.id}/${key}: ${els.length} öğe`);
        await sleep(3_000);
      }
      parts.push(...els);
    }
    const elements = uniqueElements(parts);
    cache.groups[name] = elements;
    for (const k of Object.keys(tiles)) if (k.startsWith(`${name}:`)) delete tiles[k];
    cache.fetchedAt = new Date().toISOString();
    save();
    log(`${region.id}/${name}: ${elements.length} öğe, ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
  }
  return cache;
}
