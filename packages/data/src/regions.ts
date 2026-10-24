// Bölge paketleri tanımları. bbox: [minLon, minLat, maxLon, maxLat]

export type BBox = [number, number, number, number];

export interface RegionDef {
  id: string;
  name: string;
  bbox: BBox;
}

export const REGIONS: Record<string, RegionDef> = {
  ege: { id: "ege", name: "Ege: İzmir – Efes – Pamukkale", bbox: [26.2, 37.3, 29.35, 38.8] },
  kapadokya: { id: "kapadokya", name: "Kapadokya", bbox: [34.6, 38.45, 35.1, 38.8] },
  "istanbul-tarihi": {
    id: "istanbul-tarihi",
    name: "İstanbul: Tarihi Yarımada – Beyoğlu – Kadıköy – Üsküdar",
    bbox: [28.92, 40.98, 29.06, 41.05],
  },
};

export function getRegion(id: string): RegionDef {
  const r = REGIONS[id];
  if (!r) throw new Error(`Bilinmeyen bölge: ${id} (geçerli: ${Object.keys(REGIONS).join(", ")})`);
  return r;
}

export function inBBox(bbox: BBox, lat: number, lon: number): boolean {
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}
