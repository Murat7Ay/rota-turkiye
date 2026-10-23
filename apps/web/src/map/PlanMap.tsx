// Plan haritası: günlerin rota çizgileri (gün başına renk), numaralı durak işaretleri,
// otel işareti ve yol üstü keşif önerileri.
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, type Discovery, type PlaceIndex, type TripPlan } from "@rota/core";
import { boundsOf, collection, dayPath, lineFeature } from "../lib/geo";
import { ATTRIBUTION, MLMap, Marker, NavigationControl, STYLES, dayColor, hideStylePois, pinElement, prefersDark, setGeoJSON, simpleElement } from "./maplibre";

export interface PlanMapProps {
  plan: TripPlan;
  dayIndex: number;
  index: PlaceIndex | null;
  discoveries: Discovery[];
  activeStopId: string | null;
  onSelectStop: (stopId: string) => void;
  onSelectDiscovery: (placeId: string) => void;
}

export default function PlanMap({ plan, dayIndex, index, discoveries, activeStopId, onSelectStop, onSelectDiscovery }: PlanMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const pinEls = useRef(new Map<string, HTMLElement>());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const cb = useRef({ onSelectStop, onSelectDiscovery });
  cb.current = { onSelectStop, onSelectDiscovery };

  // Harita bir kez kurulur
  useEffect(() => {
    if (!el.current) return;
    const day = plan.days[dayIndex];
    let map: MLMap;
    try {
      map = new MLMap({
        container: el.current,
        style: prefersDark() ? STYLES.dark : STYLES.positron,
        center: day ? [day.to.loc.lon, day.to.loc.lat] : [27.5, 38],
        zoom: 9,
        attributionControl: { compact: true, customAttribution: ATTRIBUTION },
        // Mobilde sayfa kaydırmasını engellemesin: tek parmak sayfayı, iki parmak haritayı kaydırır.
        cooperativeGestures: window.innerWidth < 1024,
        locale: {
          "CooperativeGesturesHandler.WindowsHelpText": "Yakınlaştırmak için Ctrl + fare tekerleği",
          "CooperativeGesturesHandler.MacHelpText": "Yakınlaştırmak için ⌘ + fare tekerleği",
          "CooperativeGesturesHandler.MobileHelpText": "Haritayı kaydırmak için iki parmak kullan",
          "NavigationControl.ZoomIn": "Yakınlaştır",
          "NavigationControl.ZoomOut": "Uzaklaştır",
          "AttributionControl.ToggleAttribution": "Atıfları göster",
        },
        maxPitch: 0,
        dragRotate: false,
      });
    } catch (e) {
      console.warn("Harita kurulamadı", e);
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      hideStylePois(map);
      map.addSource("rota-days", { type: "geojson", data: collection([]) });
      map.addSource("rota-active", { type: "geojson", data: collection([]) });
      map.addLayer({
        id: "rota-days-line",
        type: "line",
        source: "rota-days",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 3, "line-opacity": 0.28 },
      });
      map.addLayer({
        id: "rota-active-casing",
        type: "line",
        source: "rota-active",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "rota-active-line",
        type: "line",
        source: "rota-active",
        filter: ["==", ["get", "routed"], true],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 5 },
      });
      // Rotası olmayan (şehir içi) günler: duraklar arası kesikli çizgi
      map.addLayer({
        id: "rota-active-dash",
        type: "line",
        source: "rota-active",
        filter: ["!=", ["get", "routed"], true],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 4, "line-dasharray": [1.2, 1.6] },
      });
      setReady(true);
    });
    map.on("error", (e) => {
      // Stil (ilk yükleme) alınamazsa kullanıcıya söyle; karo hataları sessiz geçilir.
      if (!map.isStyleLoaded() && !map.loaded()) {
        console.warn("Harita stili yüklenemedi", e.error);
        setFailed(true);
      }
    });
    return () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Çizgiler ve işaretler
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const day = plan.days[dayIndex];
    if (!day) return;
    const others = plan.days.filter((d) => d.index !== dayIndex).map((d) => lineFeature(dayPath(d, index).line, { color: dayColor(d.index) }));
    const active = dayPath(day, index);
    setGeoJSON(map, "rota-days", collection(others));
    setGeoJSON(map, "rota-active", collection([lineFeature(active.line, { color: dayColor(dayIndex), routed: active.routed })]));

    markers.current.forEach((m) => m.remove());
    markers.current = [];
    pinEls.current.clear();
    const color = dayColor(dayIndex);

    // Keşif önerileri (soluk, kesikli)
    for (const d of discoveries) {
      const e = simpleElement("rota-pin-ghost", CATEGORIES[d.place.cat].emoji, `Yol üstünde: ${d.place.name}`);
      e.addEventListener("click", (ev) => {
        ev.stopPropagation();
        cb.current.onSelectDiscovery(d.place.id);
      });
      markers.current.push(new Marker({ element: e }).setLngLat([d.place.loc.lon, d.place.loc.lat]).addTo(map));
    }

    // Otel
    const hotel = day.hotelPlaceId ? index?.get(day.hotelPlaceId) : undefined;
    const hotelLoc = hotel?.loc ?? day.to.loc;
    const hotelEl = simpleElement("rota-hotel", hotel ? CATEGORIES[hotel.cat].emoji : "🏁", hotel ? `Konaklama: ${hotel.name}` : `Varış: ${day.to.name}`);
    markers.current.push(new Marker({ element: hotelEl }).setLngLat([hotelLoc.lon, hotelLoc.lat]).addTo(map));

    // Duraklar
    day.stops.forEach((s, i) => {
      const p = index?.get(s.placeId);
      if (!p) return;
      const e = pinElement({ emoji: CATEGORIES[p.cat].emoji, num: i + 1, color, status: s.status, title: `${i + 1}. ${p.name}` });
      e.addEventListener("click", (ev) => {
        ev.stopPropagation();
        cb.current.onSelectStop(s.id);
      });
      pinEls.current.set(s.id, e);
      markers.current.push(new Marker({ element: e, anchor: "bottom", offset: [0, -4] }).setLngLat([p.loc.lon, p.loc.lat]).addTo(map));
    });

    const pts = [...active.line, ...day.stops.map((s) => index?.get(s.placeId)).filter((p) => !!p).map((p) => [p!.loc.lon, p!.loc.lat] as [number, number])];
    const b = boundsOf(pts);
    if (b) {
      const narrow = (el.current?.clientWidth ?? 400) < 500;
      map.fitBounds(b, { padding: narrow ? 48 : 72, maxZoom: 15, duration: 700 });
    }
  }, [ready, plan, dayIndex, index, discoveries]);

  // Seçili durak
  useEffect(() => {
    pinEls.current.forEach((e, id) => {
      e.dataset.active = id === activeStopId ? "true" : "false";
    });
    const map = mapRef.current;
    const day = plan.days[dayIndex];
    const s = day?.stops.find((x) => x.id === activeStopId);
    const p = s ? index?.get(s.placeId) : undefined;
    if (map && ready && p) map.easeTo({ center: [p.loc.lon, p.loc.lat], duration: 500 });
  }, [activeStopId, ready, plan, dayIndex, index]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-2">
      <div ref={el} className="absolute inset-0" />
      {failed && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div>
            <div className="text-3xl" aria-hidden>
              🗺️
            </div>
            <p className="mt-2 font-semibold text-ink">Harita şu an yüklenemedi</p>
            <p className="text-sm text-muted">Çevrimdışıysan daha önce açtığın bölgeler önbellekten gelir. Plan listesi her zaman çalışır.</p>
          </div>
        </div>
      )}
    </div>
  );
}
