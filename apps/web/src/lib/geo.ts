import { CATEGORIES, haversineKm, type DayPlan, type LatLng, type LonLat, type PlaceIndex } from "@rota/core";

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export interface PolygonFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
}

export interface LineFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "LineString"; coordinates: LonLat[] };
}

export interface PointFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "Point"; coordinates: LonLat };
}

export interface FeatureCollection<F> {
  type: "FeatureCollection";
  features: F[];
}

export const lineFeature = (coords: LonLat[], properties: Record<string, unknown> = {}): LineFeature => ({
  type: "Feature",
  properties,
  geometry: { type: "LineString", coordinates: coords },
});

export const collection = <F>(features: F[]): FeatureCollection<F> => ({ type: "FeatureCollection", features });

/** Merkez etrafında yaklaşık daire çokgeni (GeoJSON) */
export function circlePolygon(center: LatLng, radiusKm: number, steps = 96): PolygonFeature {
  const R = 6371.0088;
  const lat1 = toRad(center.lat);
  const lon1 = toRad(center.lon);
  const d = radiusKm / R;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const brg = (i / steps) * 2 * Math.PI;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg));
    const lon2 = lon1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    ring.push([toDeg(lon2), toDeg(lat2)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

/** Günün çizilecek hattı: yol günü rotası varsa o; yoksa başlangıç → duraklar → otel düz çizgisi */
export function dayPath(day: DayPlan, index: PlaceIndex | null): { line: LonLat[]; routed: boolean } {
  if (day.route && day.route.length > 1) return { line: day.route, routed: true };
  const pts: LonLat[] = [[day.from.loc.lon, day.from.loc.lat]];
  for (const s of day.stops) {
    const p = index?.get(s.placeId);
    if (p) pts.push([p.loc.lon, p.loc.lat]);
  }
  pts.push([day.to.loc.lon, day.to.loc.lat]);
  return { line: pts, routed: false };
}

/** Simülasyon için duraklardan geçen yol: rota varsa rota, yoksa duraklar arası çizgi */
export function simulationPath(day: DayPlan, index: PlaceIndex | null): LonLat[] {
  return dayPath(day, index).line;
}

export function boundsOf(points: LonLat[]): [[number, number], [number, number]] | null {
  if (!points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

export function stopLocations(day: DayPlan, index: PlaceIndex | null): LatLng[] {
  return day.stops.map((s) => index?.get(s.placeId)?.loc).filter((x): x is LatLng => !!x);
}

export function plannedIds(day: DayPlan | undefined): Set<string> {
  const ids = new Set<string>();
  if (!day) return ids;
  for (const s of day.stops) ids.add(s.placeId);
  if (day.hotelPlaceId) ids.add(day.hotelPlaceId);
  return ids;
}

export function emojiOf(index: PlaceIndex | null, placeId: string): string {
  const p = index?.get(placeId);
  return p ? CATEGORIES[p.cat].emoji : "📍";
}

/** Google Haritalar yol tarifi bağlantısı */
export function directionsUrl(to: LatLng, from?: LatLng | null): string {
  const dest = `${to.lat.toFixed(6)},${to.lon.toFixed(6)}`;
  const origin = from ? `&origin=${from.lat.toFixed(6)},${from.lon.toFixed(6)}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}`;
}

export function nearestKm(a: LatLng, pts: LatLng[]): number {
  let best = Infinity;
  for (const p of pts) best = Math.min(best, haversineKm(a, p));
  return best;
}

/** Görüş yarıçapına uygun yakınlaştırma (512 px döşeme, eğik görünüm payı ile) */
export function zoomForRadius(radiusKm: number, lat: number, sizePx: number, pitch = 60): number {
  const metersPerPx = (radiusKm * 1000) / (sizePx * 0.42);
  const z = Math.log2((78271.517 * Math.cos(toRad(lat))) / metersPerPx);
  return z - (pitch > 40 ? 0.35 : 0);
}
