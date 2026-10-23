// MapLibre kurulumu ve harita yardımcıları. Harita kodu tembel yüklenir (React.lazy);
// bu modül yalnızca harita içeren ekranlarda paketlenir.
import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MLMap, Marker, NavigationControl, setWorkerUrl, type LngLatLike, type StyleSpecification } from "maplibre-gl";
// MapLibre v6 işçisi ayrı bir ES modülü; Vite'ın onu dağıtıma kopyalaması için URL'sini açıkça veriyoruz.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

setWorkerUrl(workerUrl);

export { MLMap, Marker, NavigationControl };
export type { LngLatLike };

/** OpenFreeMap — anahtarsız, ücretsiz vektör karolar (OpenMapTiles şeması) */
export const STYLES = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  positron: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

export function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap katkıcıları</a>';

/** Gün renkleri: kiremit, turkuaz, mor, yeşil, hardal, gül, lacivert */
export { DAY_COLORS_CSS as DAY_COLORS, dayColorCss as dayColor } from "../components/dayColor";

/**
 * 3B binalar: Stil zaten fill-extrusion katmanı içeriyorsa (OpenFreeMap liberty'de
 * "building-3d" var) onu sıcak bir tona boyar; yoksa openmaptiles "building" katmanından ekler.
 */
export function ensure3dBuildings(map: MLMap, opts: { color?: string; opacity?: number; minzoom?: number } = {}) {
  const style = map.getStyle() as StyleSpecification | undefined;
  if (!style) return;
  const color = opts.color ?? "#e7d8c6";
  const opacity = opts.opacity ?? 0.92;
  const existing = style.layers.filter((l) => l.type === "fill-extrusion");
  if (existing.length) {
    for (const l of existing) {
      try {
        map.setPaintProperty(l.id, "fill-extrusion-color", [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "render_height"], 0],
          0,
          color,
          30,
          "#d9b99b",
          80,
          "#c79a7a",
        ]);
        map.setPaintProperty(l.id, "fill-extrusion-opacity", opacity);
        if (opts.minzoom !== undefined) map.setLayerZoomRange(l.id, opts.minzoom, 24);
      } catch {
        /* stil farklıysa dokunma */
      }
    }
    return;
  }
  const src = style.sources["openmaptiles"] ? "openmaptiles" : Object.keys(style.sources).find((k) => style.sources[k]?.type === "vector");
  if (!src) return;
  const firstSymbol = style.layers.find((l) => l.type === "symbol")?.id;
  map.addLayer(
    {
      id: "rota-3d-buildings",
      type: "fill-extrusion",
      source: src,
      "source-layer": "building",
      minzoom: opts.minzoom ?? 13.5,
      paint: {
        "fill-extrusion-color": color,
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": opacity,
      },
    },
    firstSymbol,
  );
}

/** Kendi işaretlerimizle çakışmasın diye stilin POI simgelerini gizler */
export function hideStylePois(map: MLMap) {
  const style = map.getStyle() as StyleSpecification | undefined;
  for (const l of style?.layers ?? []) {
    if (l.type === "symbol" && /poi|transit|airport/i.test(l.id)) {
      try {
        map.setLayoutProperty(l.id, "visibility", "none");
      } catch {
        /* yok say */
      }
    }
  }
}

export function setGeoJSON(map: MLMap, id: string, data: unknown) {
  const src = map.getSource(id) as { setData?: (d: unknown) => unknown } | undefined;
  if (src?.setData) {
    src.setData(data);
    return true;
  }
  return false;
}

export function pinElement(opts: { emoji: string; num?: number | string; color?: string; status?: string; title?: string }): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "rota-pin";
  if (opts.color) el.style.setProperty("--pin", opts.color);
  if (opts.status) el.dataset.status = opts.status;
  if (opts.title) {
    el.title = opts.title;
    el.setAttribute("aria-label", opts.title);
  }
  const s = document.createElement("span");
  s.textContent = opts.emoji;
  el.appendChild(s);
  if (opts.num !== undefined) {
    const n = document.createElement("span");
    n.className = "rota-pin-num";
    n.textContent = String(opts.num);
    el.appendChild(n);
  }
  return el;
}

export function simpleElement(className: string, text: string, title?: string): HTMLElement {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  if (title) {
    el.title = title;
    el.setAttribute("aria-label", title);
  }
  return el;
}

export function youDotElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "you-dot";
  el.setAttribute("aria-label", "Sen buradasın");
  const h = document.createElement("div");
  h.className = "you-heading";
  el.appendChild(h);
  return el;
}
