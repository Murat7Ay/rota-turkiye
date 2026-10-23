// Çevrimdışı gezi paketi: planın rota koridorunu kaplayan OpenFreeMap vektör karolarını,
// harita stillerini, sprite/glyph dosyalarını ve bölge paketini Cache Storage'a indirir.
//
// OpenFreeMap'e karşı nazik olmak için:
//  - yalnızca günlük rotaların çevresi (varsayılan 3 km) ve durakların 2 km çevresi indirilir;
//  - en fazla 4 eşzamanlı istek, önbellekte olan karo yeniden istenmez;
//  - 429/5xx yanıtlarında bekleyip bir kez yeniden denenir, karo sayısı üst sınırla kesilir.
//
// Önbellek adı vite.config.ts'teki workbox runtimeCaching kuralıyla aynıdır ("ofm-tiles"):
// harita çevrimdışıyken servis işçisi karoları bu önbellekten verir.
import { haversineKm, type DayPlan, type LatLng, type LonLat, type Place, type TripPlan } from "@rota/core";

// ---------------------------------------------------------------- sabitler

/** vite.config.ts → workbox runtimeCaching: ^https://tiles.openfreemap.org/ → cacheName "ofm-tiles" */
export const TILE_CACHE = "ofm-tiles";
/** vite.config.ts → bölge paketleri (/packs/<id>.json) → cacheName "rota-packs" */
export const PACK_CACHE = "rota-packs";

/** map/maplibre.ts STYLES ile aynı (o modül MapLibre'yi yüklediği için buraya kopyalandı) */
export const OFM_STYLE_URLS = [
  "https://tiles.openfreemap.org/styles/liberty",
  "https://tiles.openfreemap.org/styles/positron",
  "https://tiles.openfreemap.org/styles/dark",
] as const;

/** Stillerin vektör kaynağı (TileJSON). Karo şablonu sürümlüdür, indirme anında buradan okunur. */
export const OFM_TILEJSON_URL = "https://tiles.openfreemap.org/planet";

/** Ekim 2026'da TileJSON'da gözlenen şablon; yalnızca canlı TileJSON alınamazsa tahmin/plan için. */
export const FALLBACK_TILE_TEMPLATE = "https://tiles.openfreemap.org/planet/20261018_080001_pt/{z}/{x}/{y}.pbf";

/** TileJSON maxzoom (Ekim 2026: 14). Daha yakın görünümde MapLibre z14 karolarını büyütür. */
export const OFM_MAX_ZOOM = 14;

/**
 * Türkçe için gereken glyph aralıkları: Basic Latin + Latin-1 (ç, ö, ü), Latin Extended-A
 * (ğ, ı, İ, ş) ve genel noktalama (–, ’, …). Latince dışı yazılar (ör. Yunanca adlar) indirilmez.
 */
export const GLYPH_RANGES = ["0-255", "256-511", "8192-8447"] as const;

/** Varsayılan karo üst sınırı. ofm-tiles workbox maxEntries = 4000; stil dosyalarına ve gezinmeye pay bırakılır. */
export const DEFAULT_MAX_TILES = 3500;

/**
 * Karo başına kaba ortalama boyut (bayt, açılmış). Ekim 2026'da İzmir–Selçuk koridorundan
 * alınan küçük bir örneklemden; şehir merkezlerinde daha büyük, kırsalda daha küçüktür.
 */
const AVG_TILE_BYTES: Record<number, number> = { 8: 130_000, 9: 100_000, 10: 75_000, 11: 50_000, 12: 32_000, 13: 31_000, 14: 55_000 };
/** Stiller + TileJSON + sprite (1x/2x) + glyph aralıkları, kaba toplam */
const ASSET_BYTES_EST = 1_100_000;

// ---------------------------------------------------------------- karo matematiği

export interface TileXYZ {
  z: number;
  x: number;
  y: number;
}

interface Box {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

const MAX_LAT = 85.05112878;
const toRad = (d: number) => (d * Math.PI) / 180;

export function lonToTileX(lon: number, z: number): number {
  const n = 2 ** z;
  return Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
}

export function latToTileY(lat: number, z: number): number {
  const n = 2 ** z;
  const r = toRad(Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)));
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return Math.min(n - 1, Math.max(0, y));
}

function boxAround(p: LatLng, radiusKm: number): Box {
  const dLat = radiusKm / 110.574;
  const dLon = radiusKm / (111.32 * Math.max(0.05, Math.cos(toRad(p.lat))));
  return { minLon: p.lon - dLon, minLat: p.lat - dLat, maxLon: p.lon + dLon, maxLat: p.lat + dLat };
}

/** Kutuyla kesişen bütün z karoları */
export function tilesForBox(box: Box, z: number): TileXYZ[] {
  const x0 = lonToTileX(box.minLon, z);
  const x1 = lonToTileX(box.maxLon, z);
  const y0 = latToTileY(box.maxLat, z); // kuzey = küçük y
  const y1 = latToTileY(box.minLat, z);
  const out: TileXYZ[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ z, x, y });
  return out;
}

/** Çizgiyi en fazla `stepKm` aralıklı noktalara böler (uçlar dahil) */
function samplesAlong(line: LonLat[], stepKm: number): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < line.length; i++) {
    const [lon, lat] = line[i]!;
    const a: LatLng = { lat, lon };
    out.push(a);
    const nxt = line[i + 1];
    if (!nxt) break;
    const b: LatLng = { lat: nxt[1], lon: nxt[0] };
    const n = Math.floor(haversineKm(a, b) / stepKm);
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
    }
  }
  return out;
}

export function tileUrl(template: string, t: TileXYZ): string {
  return template.replace("{z}", String(t.z)).replace("{x}", String(t.x)).replace("{y}", String(t.y));
}

// ---------------------------------------------------------------- plan → karo listesi

/** Map<string, Place> ve PlaceIndex ikisi de uyar */
export interface PlaceLookup {
  get(id: string): Place | undefined;
}

export interface TilePlanOptions {
  minZoom: number;
  maxZoom: number;
  /** Rota çizgisinin iki yanında kaplanacak mesafe, km */
  corridorKm: number;
  /** Durak, başlangıç ve varış çevresi, km (varsayılan 2) */
  stopRadiusKm?: number;
  /** Üst sınır (varsayılan DEFAULT_MAX_TILES) */
  maxTiles?: number;
  /** Durakların konumu için (verilmezse yalnızca rota ve gün başı/sonu kullanılır) */
  places?: PlaceLookup | null;
  /** Canlı TileJSON şablonu; verilmezse FALLBACK_TILE_TEMPLATE */
  tileTemplate?: string;
}

export interface TilePlan {
  urls: string[];
  tiles: TileXYZ[];
  /** Sınırdan önceki toplam benzersiz karo */
  totalBeforeCap: number;
  capped: boolean;
  /** Sınır yüzünden atlanan karo sayısı (önce en yakın zoom'daki koridor karoları atlanır) */
  dropped: number;
  byZoom: Record<number, number>;
  /** Karolar + stil dosyaları, kaba tahmin */
  estimatedBytes: number;
  estimatedMB: number;
  tileTemplate: string;
}

/** Günün çizgisi: yol rotası varsa o, yoksa başlangıç → duraklar → varış */
export function dayLine(day: DayPlan, places?: PlaceLookup | null): LonLat[] {
  if (day.route && day.route.length > 1) return day.route;
  const pts: LonLat[] = [[day.from.loc.lon, day.from.loc.lat]];
  for (const s of day.stops) {
    const p = places?.get(s.placeId);
    if (p) pts.push([p.loc.lon, p.loc.lat]);
  }
  pts.push([day.to.loc.lon, day.to.loc.lat]);
  return pts;
}

function dayPoints(day: DayPlan, places?: PlaceLookup | null): LatLng[] {
  const pts: LatLng[] = [day.from.loc, day.to.loc];
  for (const s of day.stops) {
    const p = places?.get(s.placeId);
    if (p) pts.push(p.loc);
  }
  const hotel = day.hotelPlaceId ? places?.get(day.hotelPlaceId) : undefined;
  if (hotel) pts.push(hotel.loc);
  return pts;
}

/**
 * Planın her gününün rota koridorunu ve durak çevrelerini kaplayan XYZ karolarını hesaplar.
 * Sınır aşılırsa öncelik: z ≤ 12 her şey → duraklar (yakın zoom) → koridor z13 → koridor z14.
 */
export function planTileDownload(plan: TripPlan, opts: TilePlanOptions): TilePlan {
  const minZ = Math.max(0, Math.floor(opts.minZoom));
  const maxZ = Math.min(OFM_MAX_ZOOM, Math.floor(opts.maxZoom));
  const corridorKm = Math.max(0.2, opts.corridorKm);
  const stopKm = Math.max(0.2, opts.stopRadiusKm ?? 2);
  const maxTiles = Math.max(1, opts.maxTiles ?? DEFAULT_MAX_TILES);
  const template = opts.tileTemplate ?? FALLBACK_TILE_TEMPLATE;

  // anahtar → en düşük öncelik değeri
  const prio = new Map<string, number>();
  const add = (t: TileXYZ, p: number) => {
    const k = `${t.z}/${t.x}/${t.y}`;
    const cur = prio.get(k);
    if (cur === undefined || p < cur) prio.set(k, p);
  };

  for (const day of plan.days) {
    // Koridor: kutular arası adım koridorun yarısı; çapraz çizgilerde de boşluk kalmaz.
    const samples = samplesAlong(dayLine(day, opts.places), corridorKm * 0.5);
    const boxes = samples.map((p) => boxAround(p, corridorKm));
    const stopBoxes = dayPoints(day, opts.places).map((p) => boxAround(p, stopKm));
    for (let z = minZ; z <= maxZ; z++) {
      const corridorPrio = z <= 12 ? 0 : 1 + (z - 12);
      for (const b of boxes) for (const t of tilesForBox(b, z)) add(t, corridorPrio);
      for (const b of stopBoxes) for (const t of tilesForBox(b, z)) add(t, z <= 12 ? 0 : 1);
    }
  }

  const all = [...prio.entries()]
    .map(([k, p]) => {
      const [z, x, y] = k.split("/").map(Number) as [number, number, number];
      return { t: { z, x, y }, p };
    })
    .sort((a, b) => a.p - b.p || a.t.z - b.t.z || a.t.x - b.t.x || a.t.y - b.t.y);
  const kept = all.slice(0, maxTiles).map((e) => e.t);
  const byZoom: Record<number, number> = {};
  let bytes = ASSET_BYTES_EST;
  for (const t of kept) {
    byZoom[t.z] = (byZoom[t.z] ?? 0) + 1;
    bytes += AVG_TILE_BYTES[t.z] ?? 50_000;
  }
  return {
    urls: kept.map((t) => tileUrl(template, t)),
    tiles: kept,
    totalBeforeCap: all.length,
    capped: all.length > kept.length,
    dropped: all.length - kept.length,
    byZoom,
    estimatedBytes: bytes,
    estimatedMB: Math.round((bytes / 1_048_576) * 10) / 10,
    tileTemplate: template,
  };
}

// ---------------------------------------------------------------- stil varlıkları

export interface OfmSource {
  tileTemplate: string;
  tileJsonUrl: string;
  /** Stiller, TileJSON, sprite ve glyph URL'leri (indirilecek ek dosyalar) */
  assetUrls: string[];
}

type StyleJson = {
  sources?: Record<string, { type?: string; url?: string }>;
  sprite?: string | Array<{ id: string; url: string }>;
  glyphs?: string;
  layers?: Array<{ layout?: Record<string, unknown> }>;
};

/** MapLibre'nin istediği biçimde: boşluklar URL ayrıştırıcısıyla %20 olur, virgül korunur */
const normUrl = (u: string) => new URL(u).href;

function spriteUrls(base: string): string[] {
  const out: string[] = [];
  for (const ratio of ["", "@2x"]) {
    for (const ext of [".json", ".png"]) {
      const u = new URL(base);
      u.pathname += `${ratio}${ext}`;
      out.push(u.href);
    }
  }
  return out;
}

function fontStacks(style: StyleJson): string[] {
  const out = new Set<string>();
  for (const l of style.layers ?? []) {
    const f = l.layout?.["text-font"];
    // Yalnızca düz dizi yazımı; ifade (expression) kullanan stiller atlanır.
    if (Array.isArray(f) && f.every((x) => typeof x === "string")) out.add((f as string[]).join(","));
  }
  return [...out];
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<{ data: T; res: Response }> {
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok) throw new Error(`${url} alınamadı (HTTP ${res.status})`);
  const data = (await res.clone().json()) as T;
  return { data, res };
}

/**
 * Stilleri ve TileJSON'ı ağdan okuyup önbelleğe koyar; güncel karo şablonunu ve
 * indirilecek sprite/glyph URL'lerini döndürür.
 */
export async function resolveOfmSource(opts: { cacheName?: string; signal?: AbortSignal } = {}): Promise<OfmSource> {
  const cache = await caches.open(opts.cacheName ?? TILE_CACHE);
  const assets = new Set<string>();
  const tileJsonUrls = new Set<string>();
  for (const styleUrl of OFM_STYLE_URLS) {
    const { data: style, res } = await fetchJson<StyleJson>(styleUrl, opts.signal);
    await cache.put(styleUrl, res);
    for (const s of Object.values(style.sources ?? {})) if (s.type === "vector" && s.url) tileJsonUrls.add(s.url);
    const sprites = typeof style.sprite === "string" ? [style.sprite] : (style.sprite ?? []).map((s) => s.url);
    for (const sp of sprites) for (const u of spriteUrls(sp)) assets.add(u);
    if (style.glyphs) {
      for (const fs of fontStacks(style)) {
        for (const r of GLYPH_RANGES) assets.add(normUrl(style.glyphs.replace("{fontstack}", fs).replace("{range}", r)));
      }
    }
  }
  const tileJsonUrl = tileJsonUrls.has(OFM_TILEJSON_URL) ? OFM_TILEJSON_URL : ([...tileJsonUrls][0] ?? OFM_TILEJSON_URL);
  const { data: tj, res } = await fetchJson<{ tiles?: string[] }>(tileJsonUrl, opts.signal);
  await cache.put(tileJsonUrl, res);
  const tileTemplate = tj.tiles?.[0];
  if (!tileTemplate) throw new Error("Harita karo adresi okunamadı");
  return { tileTemplate, tileJsonUrl, assetUrls: [...assets] };
}

/** Önbellekteki TileJSON'ın karo şablonu (paket güncel mi kontrolü için); yoksa null */
export async function cachedTileTemplate(cacheName = TILE_CACHE): Promise<string | null> {
  try {
    if (typeof caches === "undefined") return null;
    const cache = await caches.open(cacheName);
    const res = await cache.match(OFM_TILEJSON_URL);
    if (!res) return null;
    const tj = (await res.json()) as { tiles?: string[] };
    return tj.tiles?.[0] ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- indirici

export interface DownloadProgress {
  done: number;
  total: number;
  /** Zaten önbellekte olduğu için atlanan */
  cached: number;
  failed: number;
  /** Bu oturumda indirilen bayt */
  bytes: number;
}

export interface DownloadOptions {
  cacheName?: string;
  /** Eşzamanlı istek (1–6, varsayılan 4) */
  concurrency?: number;
  onProgress?: (p: DownloadProgress) => void;
  signal?: AbortSignal;
  /** Önbellekte olanı yeniden indirme (varsayılan true) */
  skipCached?: boolean;
}

export interface DownloadResult extends DownloadProgress {
  failedUrls: string[];
  aborted: boolean;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("İptal edildi", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("İptal edildi", "AbortError"));
      },
      { once: true },
    );
  });

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/**
 * URL listesini sınırlı eşzamanlılıkla indirip Cache Storage'a yazar. Servis işçisi
 * etkinse istekler onun üzerinden de geçer (aynı önbelleğe yazar); tekrar yazmak zararsızdır.
 */
export async function downloadTiles(urls: string[], opts: DownloadOptions = {}): Promise<DownloadResult> {
  if (typeof caches === "undefined") throw new Error("Bu tarayıcı çevrimdışı önbelleği desteklemiyor");
  const cache = await caches.open(opts.cacheName ?? TILE_CACHE);
  const queue = [...new Set(urls)];
  const total = queue.length;
  const conc = Math.max(1, Math.min(6, Math.floor(opts.concurrency ?? 4)));
  const skipCached = opts.skipCached ?? true;
  const p: DownloadProgress = { done: 0, total, cached: 0, failed: 0, bytes: 0 };
  const failedUrls: string[] = [];
  let next = 0;
  let lastEmit = 0;
  const emit = (force = false) => {
    const now = Date.now();
    if (!force && now - lastEmit < 120) return;
    lastEmit = now;
    opts.onProgress?.({ ...p });
  };

  async function fetchOne(url: string): Promise<void> {
    if (skipCached && (await cache.match(url))) {
      p.cached++;
      return;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, opts.signal ? { signal: opts.signal } : {});
        if (res.ok) {
          await cache.put(url, res.clone());
          p.bytes += (await res.arrayBuffer()).byteLength;
          return;
        }
        // 404: sunucuda böyle bir dosya yok; yeniden denemek anlamsız
        if (res.status === 404) break;
        if (res.status === 429 || res.status >= 500) {
          const ra = Number(res.headers.get("retry-after"));
          await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(30, ra) * 1000 : 1500 * (attempt + 1), opts.signal);
          continue;
        }
        break;
      } catch (e) {
        if (isAbort(e) || opts.signal?.aborted) throw e;
        await sleep(1500, opts.signal);
      }
    }
    p.failed++;
    failedUrls.push(url);
  }

  async function worker() {
    while (next < queue.length) {
      if (opts.signal?.aborted) throw new DOMException("İptal edildi", "AbortError");
      const url = queue[next++]!;
      await fetchOne(url);
      p.done++;
      emit();
    }
  }

  emit(true);
  try {
    await Promise.all(Array.from({ length: Math.min(conc, Math.max(1, total)) }, () => worker()));
  } catch (e) {
    if (!isAbort(e)) throw e;
    emit(true);
    return { ...p, failedUrls, aborted: true };
  }
  emit(true);
  return { ...p, failedUrls, aborted: false };
}

// ---------------------------------------------------------------- bütün paket

export interface TripPackOptions extends Omit<TilePlanOptions, "tileTemplate">, Omit<DownloadOptions, "cacheName"> {
  /** Bölge paketinin uygulamanın kullandığı URL'si (?v=… dahil); "rota-packs" önbelleğine konur */
  packUrl?: string;
}

export interface TripPackResult extends DownloadResult {
  tileTemplate: string;
  tiles: number;
  capped: boolean;
  packCached: boolean;
}

/** Stil varlıkları + koridor karoları + bölge paketi */
export async function downloadTripPack(plan: TripPlan, opts: TripPackOptions): Promise<TripPackResult> {
  const { signal } = opts;
  // Kalıcı depolama iste: tarayıcı yer darlığında önbelleği silmesin (izin verilmezse sorun değil).
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* yok say */
  }
  const src = await resolveOfmSource(signal ? { signal } : {});
  const tp = planTileDownload(plan, { ...opts, tileTemplate: src.tileTemplate });

  let packCached = false;
  if (opts.packUrl) {
    try {
      const pc = await caches.open(PACK_CACHE);
      if (await pc.match(opts.packUrl)) packCached = true;
      else {
        const res = await fetch(opts.packUrl, signal ? { signal } : {});
        const ct = res.headers.get("content-type") ?? "";
        if (res.ok && !ct.includes("text/html")) {
          await pc.put(opts.packUrl, res);
          packCached = true;
        }
      }
    } catch (e) {
      if (isAbort(e)) throw e;
    }
  }

  const r = await downloadTiles([...src.assetUrls, ...tp.urls], {
    cacheName: TILE_CACHE,
    concurrency: opts.concurrency ?? 4,
    ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
    ...(signal ? { signal } : {}),
    ...(opts.skipCached !== undefined ? { skipCached: opts.skipCached } : {}),
  });
  return { ...r, tileTemplate: src.tileTemplate, tiles: tp.tiles.length, capped: tp.capped, packCached };
}
