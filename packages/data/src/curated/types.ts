import type { PlaceCategory, PlaceTag, PriceObservation, Town } from "@rota/core";
import type { BBox } from "../regions";

export interface Near {
  lat: number;
  lon: number;
  km: number;
}

/**
 * Elle doğrulanmış bilgi katmanı. Ad (katlanmış, bkz. text.fold) + kategori + konum üçü birden
 * tutarsa uygulanır; böylece "Efes Otel" ya da başka şehirdeki "Agora AVM" etkilenmez.
 */
export interface CuratedEntry {
  id: string;
  match: RegExp;
  notMatch?: RegExp;
  cats: PlaceCategory[];
  near: Near;
  setCat?: PlaceCategory;
  /**
   * Büyük ören yeri: eşleşen kopyalardan yalnızca biri kalır, bu yarıçaptaki (km) diğer gezi
   * noktaları (tiyatro, kapı, hamam…) "… içinde" notuyla alt nokta olarak işaretlenir.
   */
  siteKm?: number;
  tags?: PlaceTag[];
  minNotability?: number;
  visitMin?: number;
  note?: string;
  /** Yalnızca kaynak URL'si olan gerçek gözlemler */
  price?: PriceObservation;
  priceForeign?: PriceObservation;
}

export interface RegionOverlay {
  entries: CuratedEntry[];
  /** Şarap satışının "yöresel ürün" sayıldığı bağ bölgeleri */
  wineAreas: Near[];
  /** Köy/mahalle olsa da kasaba listesine alınacak yerler (katlanmış ad) */
  keepTowns: string[];
  /** Kutuya giren komşu ülke toprakları (yedek eleme; asıl eleme "yabanci" sorgusu) */
  excludeBoxes?: BBox[];
  /**
   * Yerleşim sorgusu eksik kaldığında kullanılan, elle girilmiş merkez koordinatları
   * (belediye/meydan, ~1 km doğruluk). OSM'de aynı adlı yerleşim varsa OSM kaydı kullanılır.
   */
  fallbackTowns?: Array<Pick<Town, "name" | "loc" | "kind">>;
}

export const EMPTY_OVERLAY: RegionOverlay = { entries: [], wineAreas: [], keepTowns: [] };
