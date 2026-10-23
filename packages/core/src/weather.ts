// Open-Meteo (reklamsız/aboneliksiz uygulamalar için ücretsiz, CC BY 4.0).
import type { Interval } from "./hours";
import { resolveFetch, timeoutInit } from "./net";
import { daysBetween, toTrWallClock } from "./time";
import type { LatLng } from "./types";

export interface WeatherDay {
  date: string;
  tMinC: number;
  tMaxC: number;
  /** 24 saatlik yağış olasılığı, % */
  hourlyPrecipProb: number[];
  hourlyTempC: number[];
  weatherCode: number;
  /** "Parçalı bulutlu, 14–22°C" */
  summary: string;
  /** Yağış olasılığı eşiği aşan saat aralıkları, gün içi dakika */
  rainWindows: Interval[];
}

export const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
/** Arayüzde gösterilmesi gereken atıf (CC BY 4.0) */
export const OPEN_METEO_ATTRIBUTION = "Hava durumu: Open-Meteo.com (CC BY 4.0)";
/** Tahmin ufku: bugün + 15 gün (forecast_days en fazla 16) */
export const FORECAST_HORIZON_DAYS = 16;

/** WMO hava durumu kodları (Open-Meteo "weather_code") */
const WMO_TR: Record<number, string> = {
  0: "Açık",
  1: "Az bulutlu",
  2: "Parçalı bulutlu",
  3: "Kapalı",
  45: "Sisli",
  48: "Kırağılı sis",
  51: "Hafif çisenti",
  53: "Çisenti",
  55: "Yoğun çisenti",
  56: "Hafif donan çisenti",
  57: "Yoğun donan çisenti",
  61: "Hafif yağmurlu",
  63: "Yağmurlu",
  65: "Şiddetli yağmurlu",
  66: "Hafif donan yağmur",
  67: "Şiddetli donan yağmur",
  71: "Hafif kar yağışlı",
  73: "Kar yağışlı",
  75: "Yoğun kar yağışlı",
  77: "Kar taneli",
  80: "Hafif sağanak yağışlı",
  81: "Sağanak yağışlı",
  82: "Şiddetli sağanak yağışlı",
  85: "Hafif kar sağanaklı",
  86: "Yoğun kar sağanaklı",
  95: "Gök gürültülü fırtına",
  96: "Hafif dolulu fırtına",
  99: "Şiddetli dolulu fırtına",
};

export function weatherCodeTr(code: number): string {
  return WMO_TR[code] ?? "Hava durumu bilinmiyor";
}

/**
 * Olasılığı eşiğe eşit ya da üstünde olan saatleri birleştirir: [başlangıç, bitiş) gün içi dakika.
 * Ör. 15–17 arası %70 → [[900, 1020]]
 */
export function rainWindowsFrom(hourlyPrecipProb: number[], threshold = 60): Interval[] {
  const out: Interval[] = [];
  let start: number | null = null;
  for (let h = 0; h <= hourlyPrecipProb.length; h++) {
    const wet = h < hourlyPrecipProb.length && (hourlyPrecipProb[h] ?? 0) >= threshold;
    if (wet && start === null) start = h;
    if (!wet && start !== null) {
      out.push([start * 60, h * 60]);
      start = null;
    }
  }
  return out;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

interface OpenMeteoBody {
  error?: boolean;
  hourly?: { time?: string[]; precipitation_probability?: Array<number | null>; temperature_2m?: Array<number | null> };
  daily?: { weather_code?: Array<number | null>; temperature_2m_max?: Array<number | null>; temperature_2m_min?: Array<number | null> };
}

/** Open-Meteo yanıtını WeatherDay'e çevirir; eksik/bozuk yanıtta null */
export function weatherDayFromOpenMeteo(body: unknown, date: string): WeatherDay | null {
  const b = body as OpenMeteoBody | null;
  if (!b || typeof b !== "object" || b.error) return null;
  const times = b.hourly?.time ?? [];
  const probs = b.hourly?.precipitation_probability ?? [];
  const temps = b.hourly?.temperature_2m ?? [];
  const prob = new Array<number>(24).fill(0);
  const temp = new Array<number | null>(24).fill(null);
  let found = 0;
  times.forEach((t, i) => {
    if (typeof t !== "string" || !t.startsWith(`${date}T`)) return;
    const h = Number(t.slice(11, 13));
    if (!(h >= 0 && h < 24)) return;
    found++;
    const p = probs[i];
    prob[h] = typeof p === "number" && Number.isFinite(p) ? p : 0;
    const c = temps[i];
    temp[h] = typeof c === "number" && Number.isFinite(c) ? r1(c) : null;
  });
  if (found === 0) return null;

  const known = temp.filter((x): x is number => x !== null);
  const dMax = b.daily?.temperature_2m_max?.[0];
  const dMin = b.daily?.temperature_2m_min?.[0];
  const tMaxC = typeof dMax === "number" ? r1(dMax) : known.length ? Math.max(...known) : null;
  const tMinC = typeof dMin === "number" ? r1(dMin) : known.length ? Math.min(...known) : null;
  if (tMaxC === null || tMinC === null) return null;
  // Eksik saatlik sıcaklıkları bir önceki değerle (yoksa günün en düşüğüyle) doldur
  let last = tMinC;
  const hourlyTempC = temp.map((x) => (x === null ? last : (last = x)));

  const code = b.daily?.weather_code?.[0];
  const weatherCode = typeof code === "number" ? code : -1;
  return {
    date,
    tMinC,
    tMaxC,
    hourlyPrecipProb: prob,
    hourlyTempC,
    weatherCode,
    summary: `${weatherCodeTr(weatherCode)}, ${Math.round(tMinC)}–${Math.round(tMaxC)}°C`,
    rainWindows: rainWindowsFrom(prob, 60),
  };
}

/**
 * Bir günün saatlik tahmini. Hata, çevrimdışı ya da tarih tahmin ufkunun dışındaysa null.
 * `now` yalnız ufuk kontrolü içindir (testlerde sabitlenir).
 */
export async function fetchWeather(
  loc: LatLng,
  date: string,
  fetchFn?: typeof fetch,
  now: Date = new Date(),
): Promise<WeatherDay | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ahead = daysBetween(toTrWallClock(now).date, date);
  if (!Number.isFinite(ahead) || ahead >= FORECAST_HORIZON_DAYS) return null;
  const params = new URLSearchParams({
    latitude: loc.lat.toFixed(4),
    longitude: loc.lon.toFixed(4),
    hourly: "precipitation_probability,temperature_2m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "Europe/Istanbul",
    start_date: date,
    end_date: date,
  });
  try {
    const res = await resolveFetch(fetchFn)(`${OPEN_METEO_FORECAST_URL}?${params.toString()}`, timeoutInit(10_000));
    if (!res.ok) return null;
    return weatherDayFromOpenMeteo(await res.json(), date);
  } catch {
    return null;
  }
}
