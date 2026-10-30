// Mapbox karoları MapLibre ile: Mapbox GL JS (özel lisanslı) yerine mevcut MapLibre motoru,
// Mapbox'ın stilini ve karolarını kullanıcının/dağıtımın public (pk.) anahtarıyla çizer.
// mapbox:// adresleri https://api.mapbox.com'a çevrilir; stil MapLibre'nin tanımadığı
// Mapbox'a özgü alanlardan (fog, slot, emissive-strength …) arındırılır.
// Çevrimdışı karo paketi OpenFreeMap'te kalır: Mapbox şartları karoların önbelleğe alınmasına izin vermez.
import type { StyleSpecification } from "maplibre-gl";

export const MAPBOX_API = "https://api.mapbox.com";

/** Etrafım için: açık temada sokak, koyu temada koyu stil */
export const MAPBOX_STYLES = {
  light: "mapbox://styles/mapbox/streets-v12",
  dark: "mapbox://styles/mapbox/dark-v11",
} as const;

/** Mapbox public anahtarları "pk." ile başlar; gizli (sk.) anahtar tarayıcıya konmamalı */
export function isMapboxToken(t: string | undefined | null): t is string {
  return !!t && /^pk\.[\w-]+\.[\w-]+$/.test(t.trim());
}

function withToken(url: string, token: string): string {
  if (/[?&]access_token=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
}

/**
 * mapbox:// adreslerini API adreslerine çevirir; api.mapbox.com'a giden ama anahtarı olmayan
 * isteklere anahtarı ekler. Diğer adreslere dokunmaz.
 */
export function transformMapboxUrl(url: string, token: string): string {
  if (url.startsWith("mapbox://")) {
    const rest = url.slice("mapbox://".length);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^styles\/([^/]+)\/([^/?]+)/))) return withToken(`${MAPBOX_API}/styles/v1/${m[1]}/${m[2]}`, token);
    // MapLibre sprite adresine "@2x.json" / ".png" gibi bir son ek ekler
    if ((m = rest.match(/^sprites\/([^/]+)\/([^/@.?]+)([^?]*)/))) return withToken(`${MAPBOX_API}/styles/v1/${m[1]}/${m[2]}/sprite${m[3]}`, token);
    if ((m = rest.match(/^fonts\/([^/]+)\/(.+)$/))) return withToken(`${MAPBOX_API}/fonts/v1/${m[1]}/${m[2]}`, token);
    // Karo kümesi (ör. "mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2") → TileJSON
    return withToken(`${MAPBOX_API}/v4/${rest.replace(/\?.*$/, "")}.json?secure`, token);
  }
  if (url.startsWith(MAPBOX_API)) return withToken(url, token);
  return url;
}

// ---------------------------------------------------------------- stil arındırma

interface StyleSpecModule {
  latest: Record<string, Record<string, unknown>>;
  validateStyleMin: (style: unknown) => Array<{ message: string }>;
}

type Json = Record<string, unknown>;

/** Mapbox'a özgü, MapLibre'nin bilmediği kökler, katman türleri, paint/layout alanları atılır */
export function sanitizeMapboxStyle(input: unknown, spec: StyleSpecModule, token: string): StyleSpecification {
  const style = structuredClone(input) as Json;
  const root = spec.latest.$root!;
  for (const k of Object.keys(style)) if (!(k in root)) delete style[k];
  // Mapbox "projection": { name: "globe" } MapLibre'de { type: … } — düz Merkator'da kal
  delete style.projection;
  delete style.terrain;

  // Kaynak, sprite ve glif adresleri baştan çevrilir; böylece transformRequest yalnız karolarla ilgilenir
  // MapLibre sprite yolunun sonuna "@2x.json" ekler, sorgu dizgesini korur: anahtar sorguda kalabilir
  if (typeof style.sprite === "string") style.sprite = transformMapboxUrl(style.sprite, token);
  else if (Array.isArray(style.sprite)) {
    style.sprite = (style.sprite as Array<{ id: string; url: string }>).map((s) => ({ ...s, url: transformMapboxUrl(s.url, token) }));
  }
  if (typeof style.glyphs === "string" && style.glyphs.startsWith("mapbox://fonts/")) {
    style.glyphs = `${MAPBOX_API}/fonts/v1/${style.glyphs.slice("mapbox://fonts/".length)}?access_token=${encodeURIComponent(token)}`;
  }
  const sources = (style.sources ?? {}) as Record<string, Json>;
  for (const s of Object.values(sources)) {
    if (typeof s.url === "string") s.url = transformMapboxUrl(s.url, token);
  }

  const layers = Array.isArray(style.layers) ? (style.layers as Json[]) : [];
  const allowedLayerKeys = spec.latest.layer!;
  const kept: Json[] = [];
  for (const layer of layers) {
    const type = String(layer.type);
    const paintSpec = spec.latest[`paint_${type}`];
    const layoutSpec = spec.latest[`layout_${type}`];
    if (!paintSpec || !layoutSpec) continue; // model, slot, clip, raster-particle …
    for (const k of Object.keys(layer)) if (!(k in allowedLayerKeys)) delete layer[k];
    for (const [part, allowed] of [
      ["paint", paintSpec],
      ["layout", layoutSpec],
    ] as const) {
      const obj = layer[part] as Json | undefined;
      if (obj) for (const k of Object.keys(obj)) if (!(k in allowed)) delete obj[k];
    }
    kept.push(layer);
  }
  style.layers = kept;

  // Kalan uyumsuzluklar (MapLibre'de olmayan ifade işleçleri vb.): hatalı katmanı at
  const bad = new Set<number>();
  for (const e of spec.validateStyleMin(style)) {
    const m = e.message.match(/^layers\[(\d+)\]/);
    if (m) bad.add(Number(m[1]));
  }
  if (bad.size) style.layers = kept.filter((_, i) => !bad.has(i));
  return style as unknown as StyleSpecification;
}

/**
 * Mapbox stilini indirip MapLibre'ye uygun nesneye çevirir. Ağ yoksa, anahtar geçersizse ya da
 * stil okunamazsa null döner; çağıran OpenFreeMap'e düşer.
 */
export async function loadMapboxStyle(dark: boolean, token: string, signal?: AbortSignal): Promise<StyleSpecification | null> {
  if (!isMapboxToken(token)) return null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  try {
    const [res, spec] = await Promise.all([
      fetch(transformMapboxUrl(dark ? MAPBOX_STYLES.dark : MAPBOX_STYLES.light, token), { signal }),
      import("@maplibre/maplibre-gl-style-spec") as unknown as Promise<StyleSpecModule>,
    ]);
    if (!res.ok) {
      console.warn("[mapbox] stil alınamadı", res.status);
      return null;
    }
    return sanitizeMapboxStyle(await res.json(), spec, token);
  } catch (e) {
    if (!signal?.aborted) console.warn("[mapbox] stil hazırlanamadı", e);
    return null;
  }
}

/** MapLibre transformRequest: mapbox:// ve anahtarsız api.mapbox.com isteklerini çevirir */
export function mapboxTransformRequest(token: string) {
  return (url: string) => ({ url: transformMapboxUrl(url, token) });
}

export const MAPBOX_ATTRIBUTION =
  '<a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">© Mapbox</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://apps.mapbox.com/feedback/" target="_blank" rel="noopener">Haritayı iyileştir</a>';
