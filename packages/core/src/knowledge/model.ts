// Türkiye bilgi katmanı — veri modeli.
// Her kayıt kontrol edilebilir bir kaynak URL'si ve kontrol tarihi (checkedAt) taşır.
import type { LatLng, PlaceCategory } from "../types";

// ---------------------------------------------------------------- coğrafi işaret

/** Kullanıcıya gösterilen tür (tescildeki ürün grubundan sadeleştirildi) */
export type GiKind = "yemek" | "tatli" | "icecek" | "urun" | "el_sanati";

/** TÜRKPATENT tescil türü */
export type GiType = "mense_adi" | "mahrec_isareti";

/**
 * Açıklamanın dayanağı:
 * - "belge": TÜRKPATENT coğrafi işaret sicil belgesindeki tanımdan özetlendi
 * - "kayit": belge metni okunamadı (taranmış/eksik); yalnızca sicil kaydındaki ad, tür ve il kullanıldı
 */
export type GiBasis = "belge" | "kayit";

export interface GiProduct {
  /** "ci:<portal kaydı>" */
  id: string;
  /** Tescildeki ad, olduğu gibi */
  name: string;
  /** Tescil eden il (PROVINCE_CENTERS'taki adla aynı) */
  province: string;
  /** Ün bağı olan ilçe/belde (DISTRICT_ANCHORS'ta olmalı); yoksa il geneli sayılır */
  place?: string;
  kind: GiKind;
  giType: GiType;
  regNo: number;
  /** Tescil tarihi, YYYY-MM-DD */
  regDate: string;
  /** Tek cümle, kendi sözlerimizle */
  description: string;
  basis: GiBasis;
  /** Editoryal seçim: ilin "ilk akla gelen" ürünü (sıralamada öne alınır) */
  featured?: boolean;
  /** TÜRKPATENT Coğrafi İşaretler Portalı kayıt sayfası */
  source: string;
  checkedAt: string;
}

// ---------------------------------------------------------------- bölge uyarıları

export type WarningKind = "dolandiricilik" | "fiyat" | "bilgi";

export interface WarningArea {
  name: string;
  center: LatLng;
  radiusKm: number;
}

export interface AreaWarning {
  id: string;
  kind: WarningKind;
  title: string;
  /** Ne oluyor — kaynaktaki bilgiye sadık, kısa */
  text: string;
  /** Ne yapmalı */
  advice: string;
  /** Sabah rehberi için tek cümle */
  tip: string;
  areas: WarningArea[];
  /** Yalnızca bu saatlerde geçerli: TR duvar saati, dakika [başlangıç, bitiş); gece yarısını aşabilir */
  activeMin?: [number, number];
  /** Kaynaktaki olay/yayın tarihi (YYYY ya da YYYY-MM-DD) */
  reportedAt?: string;
  source: string;
  extraSources?: string[];
  checkedAt: string;
}

// ---------------------------------------------------------------- görgü ve pratik kurallar

export type EtiquetteTopic = "cami" | "pazarlik" | "hesap" | "bahsis" | "alkol" | "acil";

export interface EtiquetteTip {
  id: string;
  topic: EtiquetteTopic;
  /** Hangi mekân türlerinde gösterilir; boş = genel kural */
  categories: PlaceCategory[];
  title: string;
  text: string;
  /** Sabah rehberi için tek cümle */
  tip: string;
  /** Kural bu tarihten beri geçerli (YYYY-MM-DD) */
  validFrom?: string;
  source: string;
  extraSources?: string[];
  checkedAt: string;
}
