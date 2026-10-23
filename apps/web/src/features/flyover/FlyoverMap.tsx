// Kendi başına çalışan "Uçuş" haritası: günün rotasını ve emoji durak işaretlerini çizer,
// alttaki düğmeyle rota uçuşunu başlatır. Tam ekran bir pencerede (FlyoverModal) ya da
// herhangi bir kapsayıcıda (yükseklik verilmiş) kullanılabilir. Tembel yüklenmesi önerilir.
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, type DayPlan, type LonLat, type Place, type PlaceIndex, type PlanStop } from "@rota/core";
import { cx } from "../../components/ui";
import { boundsOf, collection, lineFeature } from "../../lib/geo";
import { ATTRIBUTION, MLMap, Marker, STYLES, dayColor, ensure3dBuildings, hideStylePois, pinElement, setGeoJSON, simpleElement } from "../../map/maplibre";
import { dayLine } from "../offline/tiles";
import FlyoverButton, { type FlyoverButtonProps, type FlyoverState } from "./FlyoverButton";
import { prefersReducedMotion } from "./flyover";

export interface FlyoverMapProps {
  day: DayPlan;
  places: Map<string, Place> | PlaceIndex;
  /** Rota rengi (varsayılan günün rengi) */
  color?: string;
  /** Harita hazır olunca uçuşu kendiliğinden başlat */
  autoPlay?: boolean;
  onChromeHiddenChange?: (hidden: boolean) => void;
  onStateChange?: (s: FlyoverState) => void;
  /** Tam ekran yapılacak öğe; verilmezse haritanın kendi kapsayıcısı */
  fullscreenTarget?: () => HTMLElement | null;
  options?: FlyoverButtonProps["options"];
  className?: string;
}

export default function FlyoverMap({ day, places, color, autoPlay, onChromeHiddenChange, onStateChange, fullscreenTarget, options, className }: FlyoverMapProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MLMap | null>(null);
  const [failed, setFailed] = useState(false);
  const markers = useRef<Marker[]>([]);
  const pinEls = useRef<HTMLElement[]>([]);
  const routeColor = color ?? dayColor(day.index);

  const line = useMemo(() => dayLine(day, places), [day, places]);
  const stopEntries = useMemo(
    () =>
      day.stops
        .map((s, i) => ({ s, n: i + 1, p: places.get(s.placeId) }))
        .filter((e): e is { s: PlanStop; n: number; p: Place } => !!e.p),
    [day, places],
  );
  const stopPts = useMemo<LonLat[]>(() => stopEntries.map((e) => [e.p.loc.lon, e.p.loc.lat]), [stopEntries]);

  const overview = (m: MLMap, pitch: number, duration: number) => {
    const b = boundsOf([...line, ...stopPts]);
    if (!b) return;
    const narrow = (el.current?.clientWidth ?? 400) < 500;
    const cam = m.cameraForBounds(b, { padding: narrow ? 56 : 96, maxZoom: 15.5 });
    if (!cam) return;
    if (duration > 0 && !prefersReducedMotion()) m.easeTo({ ...cam, pitch, bearing: 0, duration });
    else m.jumpTo({ ...cam, pitch, bearing: 0 });
  };

  // Harita bir kez kurulur
  useEffect(() => {
    if (!el.current) return;
    const first = line[0] ?? [day.to.loc.lon, day.to.loc.lat];
    let m: MLMap;
    try {
      m = new MLMap({
        container: el.current,
        style: STYLES.liberty,
        center: first,
        zoom: 11,
        pitch: 0,
        maxPitch: 75,
        attributionControl: { compact: true, customAttribution: ATTRIBUTION },
        fadeDuration: 150,
        canvasContextAttributes: { antialias: true },
      });
    } catch (e) {
      console.warn("Uçuş haritası kurulamadı", e);
      setFailed(true);
      return;
    }
    m.on("load", () => {
      try {
        ensure3dBuildings(m, { minzoom: 14 });
      } catch {
        /* stil farklı */
      }
      hideStylePois(m);
      try {
        m.setSky({
          "sky-color": "#9bd4f5",
          "horizon-color": "#fde7c7",
          "fog-color": "#f5efe6",
          "sky-horizon-blend": 0.7,
          "horizon-fog-blend": 0.6,
          "fog-ground-blend": 0.35,
          "atmosphere-blend": 0,
        });
      } catch {
        /* eski stil sürümü */
      }
      m.addSource("flyover-route", { type: "geojson", data: collection([]) });
      m.addLayer({
        id: "flyover-route-casing",
        type: "line",
        source: "flyover-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 10, "line-opacity": 0.95 },
      });
      m.addLayer({
        id: "flyover-route-line",
        type: "line",
        source: "flyover-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 5.5 },
      });
      setMap(m);
    });
    m.on("error", (e) => {
      if (!m.isStyleLoaded() && !m.loaded()) {
        console.warn("Uçuş haritası stili yüklenemedi", e.error);
        setFailed(true);
      }
    });
    return () => {
      markers.current.forEach((x) => x.remove());
      markers.current = [];
      m.remove();
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rota ve işaretler
  useEffect(() => {
    if (!map) return;
    setGeoJSON(map, "flyover-route", collection([lineFeature(line, { color: routeColor })]));
    markers.current.forEach((x) => x.remove());
    markers.current = [];
    pinEls.current = [];

    const start = line[0];
    if (start) {
      const s = simpleElement("rota-hotel", "🚩", `Başlangıç: ${day.from.name}`);
      markers.current.push(new Marker({ element: s }).setLngLat(start).addTo(map));
    }
    const hotel = day.hotelPlaceId ? places.get(day.hotelPlaceId) : undefined;
    const end: LonLat = hotel ? [hotel.loc.lon, hotel.loc.lat] : [day.to.loc.lon, day.to.loc.lat];
    const h = simpleElement("rota-hotel", hotel ? CATEGORIES[hotel.cat].emoji : "🏁", hotel ? `Konaklama: ${hotel.name}` : `Varış: ${day.to.name}`);
    markers.current.push(new Marker({ element: h }).setLngLat(end).addTo(map));

    for (const e of stopEntries) {
      const pin = pinElement({ emoji: CATEGORIES[e.p.cat].emoji, num: e.n, color: routeColor, status: e.s.status, title: `${e.n}. ${e.p.name}` });
      pinEls.current.push(pin);
      markers.current.push(new Marker({ element: pin, anchor: "bottom", offset: [0, -4] }).setLngLat([e.p.loc.lon, e.p.loc.lat]).addTo(map));
    }
    overview(map, 40, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, line, stopEntries, routeColor, day, places]);

  const highlight = (i: number | null) => {
    pinEls.current.forEach((p, k) => {
      p.dataset.active = k === i ? "true" : "false";
    });
  };

  return (
    <div ref={wrap} className={cx("relative h-full w-full overflow-hidden bg-surface-2", className)}>
      <div ref={el} className="absolute inset-0" />
      {failed ? (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div>
            <div className="text-3xl" aria-hidden>
              🗺️
            </div>
            <p className="mt-2 font-semibold text-ink">Harita şu an yüklenemedi</p>
            <p className="text-sm text-muted">Çevrimdışıysan önce "Gezi paketini indir" ile rotanın haritasını kaydet.</p>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto">
            <FlyoverButton
              map={map}
              line={line}
              stops={stopPts}
              {...(options ? { options } : {})}
              {...(autoPlay ? { autoStart: true } : {})}
              fullscreenTarget={fullscreenTarget ?? (() => wrap.current)}
              {...(onChromeHiddenChange ? { onChromeHiddenChange } : {})}
              onStateChange={(s) => {
                if (s === "idle") highlight(null);
                onStateChange?.(s);
              }}
              onStop={(i) => highlight(i)}
              onEnd={(end) => {
                highlight(null);
                if (map && end === "done") overview(map, 0, 1800);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
