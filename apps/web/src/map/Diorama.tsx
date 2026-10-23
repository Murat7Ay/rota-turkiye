// "Etrafım" dioraması: dairesel maskeli, ~60° eğik, yavaşça dönen 3B bir şehir maketi.
// MapLibre + OpenFreeMap liberty stili (3B bina katmanı), yarıçap halkası, dış alan
// vinyeti, nabız atan "sen buradasın" noktası ve emoji POI iğneleri.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CATEGORIES, type LatLng, type NearbyHighlight, type PlaceCategory } from "@rota/core";
import { circlePolygon, zoomForRadius } from "../lib/geo";
import { MLMap, Marker, STYLES, ensure3dBuildings, hideStylePois, prefersDark, reducedMotion, setGeoJSON, youDotElement } from "./maplibre";

export interface DioramaProps {
  center: LatLng;
  radiusKm: number;
  headingDeg?: number;
  highlights: NearbyHighlight[];
  activeId: string | null;
  onSelect: (placeId: string) => void;
  pickMode: boolean;
  onPick: (loc: LatLng) => void;
  autoRotate: boolean;
  onBearing?: (deg: number) => void;
}

const GROUP_COLORS: Record<string, string> = {
  gezi: "#C2410C",
  yeme: "#D97706",
  alisveris: "#7C3AED",
  konaklama: "#1C1917",
  yol: "#475569",
};

function pinColor(cat: PlaceCategory): string {
  if (cat === "dogal_alan" || cat === "manzara" || cat === "plaj") return "#0E7490";
  return GROUP_COLORS[CATEGORIES[cat].group] ?? "#C2410C";
}

/** Halkanın dışını soluklaştıran maske: dış çerçeve − yarıçap dairesi */
function maskPolygon(center: LatLng, radiusKm: number) {
  // Dış halka saat yönünün tersine, delik (daire) saat yönünde: MapLibre deliği doğru sınıflandırsın.
  const inner = circlePolygon(center, radiusKm, 120).geometry.coordinates[0]!;
  const d = Math.max(0.6, radiusKm / 40);
  const outer: [number, number][] = [
    [center.lon - d * 2, center.lat - d],
    [center.lon + d * 2, center.lat - d],
    [center.lon + d * 2, center.lat + d],
    [center.lon - d * 2, center.lat + d],
    [center.lon - d * 2, center.lat - d],
  ];
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [outer, inner] } };
}

export default function Diorama(props: DioramaProps) {
  const { center, radiusKm, headingDeg, highlights, activeId, pickMode, autoRotate } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const youRef = useRef<Marker | null>(null);
  const poiMarkers = useRef(new Map<string, { m: Marker; el: HTMLElement }>());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [bearing, setBearing] = useState(0);

  // Canlandırma durumu (React render'ından bağımsız)
  const anim = useRef({
    target: center,
    cur: center,
    targetZoom: 15,
    zoom: 15,
    bearing: -20,
    rotate: autoRotate,
    pausedUntil: 0,
    dragging: false,
    lastX: 0,
    moved: 0,
  });
  const cbs = useRef(props);
  cbs.current = props;

  // ---------------------------------------------------------- kurulum
  useEffect(() => {
    if (!el.current) return;
    const size = el.current.clientWidth || 360;
    const z = zoomForRadius(radiusKm, center.lat, size);
    anim.current.zoom = anim.current.targetZoom = z;
    let map: MLMap;
    try {
      map = new MLMap({
        container: el.current,
        style: STYLES.liberty,
        center: [center.lon, center.lat],
        zoom: z,
        pitch: 60,
        bearing: anim.current.bearing,
        maxPitch: 75,
        interactive: false,
        attributionControl: false,
        fadeDuration: 150,
        canvasContextAttributes: { antialias: true },
      });
    } catch (e) {
      console.warn("Diorama kurulamadı", e);
      setFailed(true);
      return;
    }
    mapRef.current = map;

    map.on("load", () => {
      try {
        ensure3dBuildings(map, { minzoom: 13 });
      } catch (e) {
        console.warn("3B bina katmanı eklenemedi", e);
      }
      hideStylePois(map);
      try {
        map.setSky({
          "sky-color": prefersDark() ? "#1e3a8a" : "#9bd4f5",
          "horizon-color": prefersDark() ? "#4c1d95" : "#fde7c7",
          "fog-color": prefersDark() ? "#1c1917" : "#f5efe6",
          "sky-horizon-blend": 0.7,
          "horizon-fog-blend": 0.6,
          "fog-ground-blend": 0.35,
          "atmosphere-blend": 0,
        });
      } catch {
        /* eski stil sürümü */
      }
      const c = anim.current.target;
      map.addSource("around-mask", { type: "geojson", data: maskPolygon(c, radiusKm) });
      map.addSource("around-ring", { type: "geojson", data: circlePolygon(c, radiusKm) });
      map.addLayer({
        id: "around-mask",
        type: "fill",
        source: "around-mask",
        paint: { "fill-color": prefersDark() ? "#12100e" : "#fbf7f1", "fill-opacity": 0.55 },
      });
      map.addLayer({ id: "around-ring-fill", type: "fill", source: "around-ring", paint: { "fill-color": "#C2410C", "fill-opacity": 0.05 } });
      map.addLayer({
        id: "around-ring-line",
        type: "line",
        source: "around-ring",
        layout: { "line-cap": "round" },
        paint: { "line-color": "#C2410C", "line-width": 2.5, "line-dasharray": [2, 2], "line-opacity": 0.9 },
      });
      const you = new Marker({ element: youDotElement(), rotationAlignment: "map", pitchAlignment: "map" }).setLngLat([c.lon, c.lat]).addTo(map);
      youRef.current = you;
      setReady(true);
    });
    map.on("error", (e) => {
      if (!map.loaded()) {
        console.warn("Diorama stili yüklenemedi", e.error);
        setFailed(true);
      }
    });

    // Boyut değişince yeniden ölçekle
    const ro = new ResizeObserver(() => {
      map.resize();
      const s = el.current?.clientWidth || 360;
      anim.current.targetZoom = zoomForRadius(cbs.current.radiusKm, anim.current.target.lat, s);
    });
    ro.observe(el.current);

    // Döndürme döngüsü
    let raf = 0;
    let last = performance.now();
    const reduce = reducedMotion();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(64, t - last);
      last = t;
      if (document.hidden) return;
      const a = anim.current;
      let changed = false;
      if (a.rotate && !reduce && !a.dragging && t > a.pausedUntil) {
        a.bearing = (a.bearing + dt * 0.0045) % 360;
        changed = true;
      }
      const dLat = a.target.lat - a.cur.lat;
      const dLon = a.target.lon - a.cur.lon;
      if (Math.abs(dLat) > 1e-7 || Math.abs(dLon) > 1e-7) {
        const k = reduce ? 1 : 0.12;
        a.cur = { lat: a.cur.lat + dLat * k, lon: a.cur.lon + dLon * k };
        changed = true;
      }
      if (Math.abs(a.targetZoom - a.zoom) > 0.002) {
        a.zoom += (a.targetZoom - a.zoom) * (reduce ? 1 : 0.1);
        changed = true;
      }
      if (changed) map.jumpTo({ center: [a.cur.lon, a.cur.lat], zoom: a.zoom, bearing: a.bearing, pitch: 60 });
    };
    raf = requestAnimationFrame(loop);
    const bearingTimer = window.setInterval(() => setBearing(anim.current.bearing), 250);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(bearingTimer);
      ro.disconnect();
      poiMarkers.current.forEach(({ m }) => m.remove());
      poiMarkers.current.clear();
      youRef.current?.remove();
      youRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    anim.current.rotate = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    cbs.current.onBearing?.(bearing);
  }, [bearing]);

  // ---------------------------------------------------------- merkez + yarıçap
  useEffect(() => {
    const a = anim.current;
    a.target = center;
    const s = el.current?.clientWidth || 360;
    a.targetZoom = zoomForRadius(radiusKm, center.lat, s);
    const map = mapRef.current;
    if (!map || !ready) return;
    setGeoJSON(map, "around-ring", circlePolygon(center, radiusKm));
    setGeoJSON(map, "around-mask", maskPolygon(center, radiusKm));
    youRef.current?.setLngLat([center.lon, center.lat]);
  }, [center.lat, center.lon, radiusKm, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const e = youRef.current?.getElement();
    if (!e) return;
    e.classList.toggle("has-heading", headingDeg !== undefined);
    e.style.setProperty("--heading", `${headingDeg ?? 0}deg`);
    const h = e.querySelector<HTMLElement>(".you-heading");
    if (h) h.style.display = headingDeg === undefined ? "none" : "block";
  }, [headingDeg, ready]);

  // ---------------------------------------------------------- POI iğneleri
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const keep = new Set(highlights.map((h) => h.place.id));
    for (const [id, { m }] of poiMarkers.current) {
      if (!keep.has(id)) {
        m.remove();
        poiMarkers.current.delete(id);
      }
    }
    for (const h of highlights) {
      if (poiMarkers.current.has(h.place.id)) continue;
      const root = document.createElement("button");
      root.type = "button";
      root.className = "poi-pin";
      root.style.setProperty("--pin", pinColor(h.place.cat));
      root.setAttribute("aria-label", h.place.name);
      root.title = h.place.name;
      if (h.openNow === false) root.dataset.closed = "true";
      const bubble = document.createElement("span");
      bubble.className = "poi-bubble";
      bubble.textContent = CATEGORIES[h.place.cat].emoji;
      const stem = document.createElement("span");
      stem.className = "poi-stem";
      root.append(bubble, stem);
      root.addEventListener("click", (ev) => {
        ev.stopPropagation();
        cbs.current.onSelect(h.place.id);
      });
      root.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      const m = new Marker({ element: root, anchor: "bottom" }).setLngLat([h.place.loc.lon, h.place.loc.lat]).addTo(map);
      poiMarkers.current.set(h.place.id, { m, el: root });
    }
  }, [highlights, ready]);

  useEffect(() => {
    poiMarkers.current.forEach(({ el: e }, id) => {
      e.dataset.active = id === activeId ? "true" : "false";
    });
  }, [activeId, highlights]);

  // ---------------------------------------------------------- sürükleyerek döndürme / konum seçme
  function onPointerDown(e: ReactPointerEvent) {
    const a = anim.current;
    a.dragging = true;
    a.lastX = e.clientX;
    a.moved = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent) {
    const a = anim.current;
    if (!a.dragging) return;
    const dx = e.clientX - a.lastX;
    a.lastX = e.clientX;
    a.moved += Math.abs(dx);
    if (a.moved > 4) {
      a.bearing = (a.bearing - dx * 0.45 + 360) % 360;
      const map = mapRef.current;
      map?.jumpTo({ bearing: a.bearing });
    }
  }
  function onPointerUp(e: ReactPointerEvent) {
    const a = anim.current;
    a.dragging = false;
    a.pausedUntil = performance.now() + 3500;
    if (a.moved <= 4 && cbs.current.pickMode && mapRef.current && el.current) {
      const r = el.current.getBoundingClientRect();
      const ll = mapRef.current.unproject([e.clientX - r.left, e.clientY - r.top]);
      cbs.current.onPick({ lat: ll.lat, lon: ll.lng });
    }
  }

  return (
    <div ref={wrap} className="relative mx-auto aspect-square w-full max-w-[460px] select-none">
      {/* zemin gölgesi */}
      <div className="diorama-shadow pointer-events-none absolute -bottom-[7%] left-[10%] h-[14%] w-[80%] blur-md" aria-hidden />
      {/* degrade çerçeve */}
      <div className="diorama-rim absolute inset-0 rounded-full p-[7px] shadow-lift">
        <div
          className="diorama-sky relative h-full w-full overflow-hidden rounded-full"
          style={{ clipPath: "circle(50% at 50% 50%)", touchAction: "none", cursor: pickMode ? "crosshair" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            anim.current.dragging = false;
          }}
          role="application"
          aria-label="Çevrenin üç boyutlu görünümü. Sürükleyerek döndürebilirsin."
        >
          <div ref={el} className="absolute inset-0 dark:brightness-[0.88] dark:saturate-[0.9]" />
          {/* parlama ve iç gölge */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(70% 55% at 30% 18%, rgb(255 255 255 / 0.28), transparent 60%)",
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.25), inset 0 -18px 40px -10px rgb(0 0 0 / 0.25)",
            }}
            aria-hidden
          />
          {failed && (
            <div className="absolute inset-0 grid place-items-center p-10 text-center">
              <p className="text-sm font-semibold text-ink">Harita yüklenemedi. Çevrimdışıysan liste yine de çalışır.</p>
            </div>
          )}
        </div>
      </div>
      {/* pusula: kuzey işareti çerçevede döner */}
      <div className="pointer-events-none absolute inset-0" style={{ transform: `rotate(${-bearing}deg)` }} aria-hidden>
        <span className="absolute left-1/2 top-0 grid size-7 -translate-x-1/2 -translate-y-1/3 place-items-center rounded-full bg-surface text-[11px] font-black text-brand shadow-card">
          <span style={{ transform: `rotate(${bearing}deg)` }}>K</span>
        </span>
      </div>
    </div>
  );
}
