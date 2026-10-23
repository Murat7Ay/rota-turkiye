import { decodePolyline, haversineKm } from "./geo";
import type { LatLng, LonLat, TransportMode } from "./types";

export interface Leg {
  km: number;
  min: number;
}

export interface TravelModel {
  mode: TransportMode;
  leg(a: LatLng, b: LatLng): Leg;
}

// Kuş uçuşu → yol mesafesi katsayısı ve mesafe sınıfına göre ortalama hız.
// OSRM yokken (çevrimdışı, testler) kullanılan tahmin; gerçek rotayla gelen süreler bunun yerine geçer.
const CIRCUITY = 1.35;

/**
 * Bu yol mesafesi yürünerek mi geçilir? Araçta eşik, yürüyüşün park payıyla sürüşü
 * yakaladığı ~0,5 km; böylece süre mesafeyle tekdüze artar (1,2 km'de sıçrama olmaz).
 */
export function isWalkLeg(km: number, mode: TransportMode): boolean {
  if (mode === "yuruyus") return true;
  return km < (mode === "araba" ? 0.5 : 1.2);
}

export function estimateLeg(a: LatLng, b: LatLng, mode: TransportMode): Leg {
  const crow = haversineKm(a, b);
  const km = crow * CIRCUITY;
  if (isWalkLeg(km, mode)) return { km, min: Math.max(1, Math.round((km / 4.5) * 60)) };
  if (mode === "toplu") {
    // bekleme + yavaş şehir içi
    const speed = km < 15 ? 18 : km < 80 ? 45 : 65;
    return { km, min: Math.round(15 + (km / speed) * 60) };
  }
  const speed = km < 5 ? 22 : km < 30 ? 45 : km < 120 ? 70 : 85;
  // park etme payı
  return { km, min: Math.round(5 + (km / speed) * 60) };
}

export function createTravelModel(mode: TransportMode): TravelModel {
  const cache = new Map<string, Leg>();
  return {
    mode,
    leg(a, b) {
      const key = `${a.lat.toFixed(5)},${a.lon.toFixed(5)}>${b.lat.toFixed(5)},${b.lon.toFixed(5)}`;
      let v = cache.get(key);
      if (!v) cache.set(key, (v = estimateLeg(a, b, mode)));
      return v;
    },
  };
}

export const DEFAULT_OSRM_URL = "https://router.project-osrm.org";

export interface RouteResult {
  geometry: LonLat[];
  km: number;
  min: number;
}

/**
 * OSRM'den sürüş rotası. Kendi sunucumuz (infra/osrm) ya da herkese açık demo sunucusu.
 * Hata ya da çevrimdışı durumda null döner; çağıran düz çizgi tahminine düşer.
 */
export async function fetchRoute(
  points: LatLng[],
  osrmUrl: string = DEFAULT_OSRM_URL,
  fetchFn: typeof fetch = fetch,
): Promise<RouteResult | null> {
  if (points.length < 2) return null;
  const coords = points.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  try {
    const res = await fetchFn(`${osrmUrl}/route/v1/driving/${coords}?overview=simplified&geometries=polyline`);
    if (!res.ok) return null;
    const body = (await res.json()) as { code: string; routes?: Array<{ geometry: string; distance: number; duration: number }> };
    const r = body.routes?.[0];
    if (body.code !== "Ok" || !r) return null;
    return { geometry: decodePolyline(r.geometry), km: r.distance / 1000, min: Math.round(r.duration / 60) };
  } catch {
    return null;
  }
}

/** Rota yoksa kullanılan düz çizgi geometri */
export function straightLine(points: LatLng[]): LonLat[] {
  return points.map((p) => [p.lon, p.lat]);
}
