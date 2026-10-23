import OpeningHours from "opening_hours";
import { CATEGORIES } from "./catalog";
import { holidayOn, isPublicHoliday, mosqueBlockedIntervals } from "./calendar";
import type { Place } from "./types";

/** Gün içi dakika aralığı [başlangıç, bitiş); bitiş 1440'ı aşabilir (gece yarısından sonra kapanış) */
export type Interval = [number, number];

// opening_hours kütüphanesi yerel saat getter'larıyla çalışır. Burada tarihleri her zaman
// yerel kurucuyla üretip yerel getter'larla okuduğumuz için sonuç cihazın saat diliminden
// bağımsız olarak "Türkiye duvar saati" kalır.
function localDate(date: string, min = 0): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 0, min);
}

interface Parsed {
  oh: OpeningHours;
  /** Orijinal ifadede PH kuralı vardı ve kütüphane TR tatillerini bilmediği için çıkarıldı */
  phOff: boolean;
}

const cache = new Map<string, Parsed | null>();

function parse(value: string): Parsed | null {
  if (cache.has(value)) return cache.get(value)!;
  let result: Parsed | null = null;
  try {
    result = { oh: new OpeningHours(value, null, { mode: 0 } as never), phOff: false };
  } catch {
    // "PH off" / "PH 10:00-14:00" gibi kurallar ülke tatil verisi ister; onları ayıklayıp yeniden dene.
    const stripped = value
      .split(";")
      .map((r) => r.trim())
      .filter((r) => r && !/\b(PH|SH)\b/.test(r))
      .join("; ");
    try {
      if (stripped) result = { oh: new OpeningHours(stripped, null, { mode: 0 } as never), phOff: /\bPH\s+off\b/i.test(value) };
    } catch {
      result = null;
    }
  }
  cache.set(value, result);
  return result;
}

export function hoursSource(place: Place): "data" | "default" | "none" {
  if (place.openingHours && parse(place.openingHours)) return "data";
  return CATEGORIES[place.cat].defaultHours ? "default" : "none";
}

function rawIntervals(value: string, date: string): Interval[] | null {
  const parsed = parse(value);
  if (!parsed) return null;
  if (parsed.phOff && isPublicHoliday(date)) return [];
  const from = localDate(date, 0);
  const to = localDate(date, 30 * 60); // ertesi gün 06:00'ya kadar
  const base = from.getTime();
  const out: Interval[] = [];
  for (const [s, e, unknown] of parsed.oh.getOpenIntervals(from, to)) {
    if (unknown) continue;
    out.push([Math.round((s.getTime() - base) / 60_000), Math.round((e.getTime() - base) / 60_000)]);
  }
  return out;
}

function subtract(intervals: Interval[], blocks: Interval[]): Interval[] {
  let out = intervals;
  for (const [bs, be] of blocks) {
    const next: Interval[] = [];
    for (const [s, e] of out) {
      if (be <= s || bs >= e) next.push([s, e]);
      else {
        if (bs > s) next.push([s, bs]);
        if (be < e) next.push([be, e]);
      }
    }
    out = next;
  }
  return out;
}

const CLOSED_ON_BAYRAM_FIRST_DAY = new Set(["carsi", "pazar", "yoresel_urun", "esnaf_lokantasi"]);
const OPENS_AFTERNOON_ON_BAYRAM_FIRST_DAY = new Set(["muze", "antik_kent"]);

/**
 * Mekânın o gün ziyaret edilebildiği aralıklar: çalışma saati (veri ya da kategori varsayılanı)
 * + takvim kuralları (namaz vakitleri, bayramın ilk günü).
 */
export function availableWindows(place: Place, date: string): Interval[] {
  const value = place.openingHours && parse(place.openingHours) ? place.openingHours : CATEGORIES[place.cat].defaultHours;
  if (!value) return [];
  let windows = rawIntervals(value, date) ?? [];

  const holiday = holidayOn(date);
  if (holiday?.firstDay && holiday.kind === "dini") {
    if (CLOSED_ON_BAYRAM_FIRST_DAY.has(place.cat)) return [];
    if (OPENS_AFTERNOON_ON_BAYRAM_FIRST_DAY.has(place.cat)) windows = subtract(windows, [[0, 13 * 60]]);
  }
  if (place.cat === "cami") windows = subtract(windows, mosqueBlockedIntervals(place.loc, date));
  return windows.filter(([s, e]) => e - s >= 10);
}

export function isOpenAt(place: Place, date: string, min: number): boolean {
  return availableWindows(place, date).some(([s, e]) => min >= s && min < e);
}

/** [arrive, arrive+duration) tamamen açık bir aralığın içinde mi */
export function fitsWindow(place: Place, date: string, arriveMin: number, durationMin: number): boolean {
  return availableWindows(place, date).some(([s, e]) => arriveMin >= s && arriveMin + durationMin <= e);
}

/** arriveMin'den sonra ziyaretin sığabileceği en erken başlangıç; yoksa null */
export function earliestStart(place: Place, date: string, arriveMin: number, durationMin: number): number | null {
  for (const [s, e] of availableWindows(place, date)) {
    const start = Math.max(s, arriveMin);
    if (start + durationMin <= e) return start;
  }
  return null;
}
