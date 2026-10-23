import type { LatLng, LonLat, Place } from "./types";

const R = 6371.0088;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** a'dan b'ye pusula yönü, derece (0 = kuzey) */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export const lonLatToLatLng = ([lon, lat]: LonLat): LatLng => ({ lat, lon });
export const latLngToLonLat = (p: LatLng): LonLat => [p.lon, p.lat];

/** Yerel düzlem yaklaşımı: km cinsinden x/y (kısa mesafeler için yeterli) */
function project(p: LatLng, ref: LatLng): [number, number] {
  const kx = 111.32 * Math.cos(toRad(ref.lat));
  return [(p.lon - ref.lon) * kx, (p.lat - ref.lat) * 110.574];
}

export interface LineProjection {
  /** Noktanın çizgiye uzaklığı, km */
  distanceKm: number;
  /** Çizginin başından izdüşüm noktasına kadar mesafe, km */
  alongKm: number;
  /** İzdüşüm noktası */
  point: LatLng;
}

/** Bir noktayı çoklu çizgiye (polyline) izdüşürür. */
export function projectOnLine(p: LatLng, line: LonLat[]): LineProjection {
  if (line.length === 0) return { distanceKm: Infinity, alongKm: 0, point: p };
  if (line.length === 1) {
    const only = lonLatToLatLng(line[0]!);
    return { distanceKm: haversineKm(p, only), alongKm: 0, point: only };
  }
  let best: LineProjection = { distanceKm: Infinity, alongKm: 0, point: p };
  let along = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = lonLatToLatLng(line[i]!);
    const b = lonLatToLatLng(line[i + 1]!);
    const segKm = haversineKm(a, b);
    const [bx, by] = project(b, a);
    const [px, py] = project(p, a);
    const len2 = bx * bx + by * by;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
    const q: LatLng = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
    const d = haversineKm(p, q);
    if (d < best.distanceKm) best = { distanceKm: d, alongKm: along + segKm * t, point: q };
    along += segKm;
  }
  return best;
}

export function lineLengthKm(line: LonLat[]): number {
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) {
    total += haversineKm(lonLatToLatLng(line[i]!), lonLatToLatLng(line[i + 1]!));
  }
  return total;
}

/** Çizgi üzerinde baştan `km` uzaktaki nokta */
export function pointAlongLine(line: LonLat[], km: number): LatLng {
  if (line.length === 0) throw new Error("boş çizgi");
  let acc = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = lonLatToLatLng(line[i]!);
    const b = lonLatToLatLng(line[i + 1]!);
    const seg = haversineKm(a, b);
    if (acc + seg >= km && seg > 0) {
      const t = (km - acc) / seg;
      return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
    }
    acc += seg;
  }
  return lonLatToLatLng(line[line.length - 1]!);
}

/** Polyline6/5 çözücü (OSRM "polyline" geometrisi için) */
export function decodePolyline(str: string, precision = 5): LonLat[] {
  const factor = 10 ** precision;
  const out: LonLat[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < str.length) {
    for (const which of [0, 1] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lon += delta;
    }
    out.push([lon / factor, lat / factor]);
  }
  return out;
}

// ---------------------------------------------------------------- mekân indeksi

export interface PlaceIndex {
  readonly all: readonly Place[];
  byId: Map<string, Place>;
  get(id: string): Place | undefined;
  /** Merkezden yarıçap içindeki mekânlar, yakından uzağa */
  near(center: LatLng, radiusKm: number, filter?: (p: Place) => boolean): Place[];
  /** Çizgiye `bufferKm` mesafedeki mekânlar (izdüşüm bilgisiyle), çizgi boyunca sıralı */
  nearLine(
    line: LonLat[],
    bufferKm: number,
    filter?: (p: Place) => boolean,
  ): Array<{ place: Place; proj: LineProjection }>;
}

const CELL_DEG = 0.05; // ~5 km

/** Basit ızgara indeksi; bölge paketi ölçeğinde (on binlerce nokta) yeterince hızlı. */
export function buildPlaceIndex(places: readonly Place[]): PlaceIndex {
  const byId = new Map<string, Place>();
  const grid = new Map<string, Place[]>();
  const key = (lat: number, lon: number) => `${Math.floor(lat / CELL_DEG)}:${Math.floor(lon / CELL_DEG)}`;
  for (const p of places) {
    byId.set(p.id, p);
    const k = key(p.loc.lat, p.loc.lon);
    let cell = grid.get(k);
    if (!cell) grid.set(k, (cell = []));
    cell.push(p);
  }

  function cellsAround(c: LatLng, radiusKm: number): Place[] {
    const dLat = radiusKm / 110.574;
    const dLon = radiusKm / (111.32 * Math.max(0.2, Math.cos(toRad(c.lat))));
    const out: Place[] = [];
    for (let i = Math.floor((c.lat - dLat) / CELL_DEG); i <= Math.floor((c.lat + dLat) / CELL_DEG); i++) {
      for (let j = Math.floor((c.lon - dLon) / CELL_DEG); j <= Math.floor((c.lon + dLon) / CELL_DEG); j++) {
        const cell = grid.get(`${i}:${j}`);
        if (cell) out.push(...cell);
      }
    }
    return out;
  }

  return {
    all: places,
    byId,
    get: (id) => byId.get(id),
    near(center, radiusKm, filter) {
      return cellsAround(center, radiusKm)
        .map((p) => ({ p, d: haversineKm(center, p.loc) }))
        .filter(({ p, d }) => d <= radiusKm && (!filter || filter(p)))
        .sort((a, b) => a.d - b.d)
        .map(({ p }) => p);
    },
    nearLine(line, bufferKm, filter) {
      const seen = new Set<string>();
      const out: Array<{ place: Place; proj: LineProjection }> = [];
      // Çizgiyi ~buffer aralıklarla örnekle, her örneğin çevresindeki hücreleri tara.
      const total = lineLengthKm(line);
      const step = Math.max(bufferKm, CELL_DEG * 50);
      for (let km = 0; km <= total + step; km += step) {
        const c = pointAlongLine(line, Math.min(km, total));
        for (const p of cellsAround(c, bufferKm + step)) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          if (filter && !filter(p)) continue;
          const proj = projectOnLine(p.loc, line);
          if (proj.distanceKm <= bufferKm) out.push({ place: p, proj });
        }
      }
      return out.sort((a, b) => a.proj.alongKm - b.proj.alongKm);
    },
  };
}
