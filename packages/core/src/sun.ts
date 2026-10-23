// Gün doğumu / batımı ve altın saat. Çevrimdışı: adhan ile astronomik hesap.
// Diyanet yöntemindeki temkinler (güneş −7, akşam +7 dk) gerçek doğuş/batışı kaydırdığı için
// burada sıfırlanır; böylece "akşam" vakti değil, güneşin gerçekten battığı dakika elde edilir.
import { CalculationMethod, Coordinates, PrayerTimes } from "adhan";
import { CATEGORIES } from "./catalog";
import type { PlaceIndex } from "./geo";
import { availableWindows, hoursSource } from "./hours";
import { formatHHmm, toTrWallClock } from "./time";
import { estimateLeg } from "./travel";
import type { TravelModel } from "./travel";
import { trLower } from "./trtext";
import type { DayPlan, LatLng, Place, TransportMode } from "./types";
import type { WeatherDay } from "./weather";

export interface SunTimes {
  /** Gün içi dakika (Türkiye saati) */
  sunriseMin: number;
  sunsetMin: number;
  /** Sabah altın saati [başlangıç, bitiş] */
  goldenMorning: [number, number];
  /** Akşam altın saati [başlangıç, bitiş] — bitiş = gün batımı */
  goldenEvening: [number, number];
}

/** Altın saat süresi (yaklaşık), dk */
export const GOLDEN_HOUR_MIN = 50;

export function sunTimes(loc: LatLng, date: string): SunTimes {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const params = CalculationMethod.Turkey();
  params.methodAdjustments = { ...params.methodAdjustments, sunrise: 0, maghrib: 0 };
  const pt = new PrayerTimes(new Coordinates(loc.lat, loc.lon), new Date(y, m - 1, d), params);
  const sunriseMin = toTrWallClock(pt.sunrise).min;
  const sunsetMin = toTrWallClock(pt.maghrib).min;
  return {
    sunriseMin,
    sunsetMin,
    goldenMorning: [sunriseMin, sunriseMin + GOLDEN_HOUR_MIN],
    goldenEvening: [sunsetMin - GOLDEN_HOUR_MIN, sunsetMin],
  };
}

/** Brifing satırı: "Gün doğumu 07:31 · batımı 18:12" */
export function sunLine(loc: LatLng, date: string): string {
  const s = sunTimes(loc, date);
  return `Gün doğumu ${formatHHmm(s.sunriseMin)} · batımı ${formatHHmm(s.sunsetMin)}`;
}

/** Şu an altın saat mi? */
export function goldenPhase(loc: LatLng, date: string, nowMin: number): "sabah" | "aksam" | null {
  const s = sunTimes(loc, date);
  if (nowMin >= s.goldenMorning[0] && nowMin <= s.goldenMorning[1]) return "sabah";
  if (nowMin >= s.goldenEvening[0] && nowMin <= s.goldenEvening[1]) return "aksam";
  return null;
}

// ---------------------------------------------------------------- Türkçe ekler

export type TrCase = "e" | "de" | "den";

const VOWELS = "aeıioöuü";
const ONES = ["sıfır", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"] as const;
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli"] as const;

/** Kelimenin sonuna gelecek yönelme/bulunma/ayrılma eki (ünlü uyumu, sertleşme, y kaynaştırması) */
export function trCaseSuffix(word: string, c: TrCase): string {
  const w = trLower(word.trim());
  let v = "e";
  for (let i = w.length - 1; i >= 0; i--) {
    if (VOWELS.includes(w[i]!)) {
      v = w[i]!;
      break;
    }
  }
  const a = "aıou".includes(v) ? "a" : "e";
  const last = w[w.length - 1] ?? "";
  if (c === "e") return (VOWELS.includes(last) ? "y" : "") + a;
  const d = "fstkçşhp".includes(last) ? "t" : "d";
  return c === "de" ? d + a : `${d}${a}n`;
}

/** 0–59 arası sayının okunuşundaki son kelime */
function lastNumberWord(n: number): string {
  const k = Math.abs(Math.round(n)) % 60;
  if (k === 0) return ONES[0];
  return k % 10 ? ONES[k % 10]! : TENS[Math.floor(k / 10)]!;
}

/** 1050 → "17:30'a" (e), "17:30'da" (de), "17:30'dan" (den) */
export function clockWithSuffix(min: number, c: TrCase): string {
  const hhmm = formatHHmm(min);
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return `${hhmm}'${trCaseSuffix(lastNumberWord(m === 0 ? h : m), c)}`;
}

// İyelik almış (tamlama) yer adlarının son kelimeleri: "Kalesi'nde", "Kenti'nde", "Sarayı'nda".
// Ünlü + "si/sı/su/sü" ve "-leri/-ları" ile bitenler ayrıca kuralla yakalanır.
const POSSESSIVE_HEADS = new Set([
  "kenti", "evi", "sarayı", "camii", "parkı", "plajı", "hamamı", "köyü", "tapınağı", "kanyonu",
  "gölü", "koyu", "limanı", "anıtı", "hanı", "burnu", "ormanı", "bedesteni", "kervansarayı", "mabedi",
  "sarnıcı", "meydanı", "köşkü", "pazarı", "hisarı", "barajı", "konağı", "manastırı", "yeri", "çayı",
  "ırmağı", "sokağı", "feneri", "mezarlığı", "akropolü", "stadyumu", "rıhtımı",
]);

function isPossessiveName(lastWord: string): boolean {
  const w = lastWord;
  return (
    POSSESSIVE_HEADS.has(w) ||
    /(leri|ları)$/.test(w) ||
    (["si", "sı", "su", "sü"].includes(w.slice(-2)) && VOWELS.includes(w[w.length - 3] ?? ""))
  );
}

/**
 * Yer adına hâl eki: "Selçuk" → "Selçuk'tan", "Pamukkale" → "Pamukkale'ye",
 * "Ayasuluk Kalesi" → "Ayasuluk Kalesi'nde". Ad harfle bitmiyorsa null.
 * strict: tamlama (iyelikli) olduğundan emin olunamayan adlar için de null (ör. mekân adları).
 */
export function placeWithCase(name: string, c: TrCase, strict = false): string | null {
  const clean = name.trim();
  const last = trLower(clean.split(/\s+/).pop() ?? "");
  if (!/^[a-zçğıöşüâîû]+$/.test(last) || last.length < 2) return null;
  if (last.length >= 3 && isPossessiveName(last)) {
    // Zamir n'si: Kalesi'ne / Kalesi'nde / Kalesi'nden
    const a = trCaseSuffix(last, "de").slice(-1);
    return `${clean}'n${c === "e" ? a : c === "de" ? `d${a}` : `d${a}n`}`;
  }
  if (strict) return null;
  return `${clean}'${trCaseSuffix(last, c)}`;
}

/** "Ayasuluk Kalesi" → "Ayasuluk Kalesi'nde"; emin olunamazsa null (çağıran ek almayan kalıp kullanır) */
export function placeLocative(name: string): string | null {
  return placeWithCase(name, "de", true);
}

// ---------------------------------------------------------------- altın saat noktası

export interface GoldenHourSpot {
  place: Place;
  sun: SunTimes;
  /** Önerilen varış, gün içi dakika */
  arriveMin: number;
  /** Yola çıkış */
  leaveMin: number;
  travelMin: number;
  travelKm: number;
  walk: boolean;
  /** Yer altın saat içinde kapanıyorsa kapanış dakikası */
  closesMin?: number;
  /** Nereden gidileceği: "Konumun", son durak adı ya da otel */
  fromLabel: string;
  /** Gün batımı saatinde yağmur bekleniyor */
  rainy: boolean;
  /** "Gün batımı 18:12 — Ayasuluk Kalesi'nde 17:40'ta ol (12 dk yürüme)" */
  line: string;
}

export interface GoldenHourOptions {
  /** Varsayılan: tahmini yol modeli (mode) */
  travel?: TravelModel;
  /** Varsayılan "araba" (1,2 km altı yine yürüyüş sayılır) */
  mode?: TransportMode;
  /** Arama yarıçapı, km. Varsayılan: araba 15, toplu 6, yürüyüş 2,5 */
  radiusKm?: number;
  /** Konumdan bu saatten önce yola çıkılamaz (şimdiki saat) */
  nowMin?: number;
  weather?: WeatherDay | null;
  excludePlaceIds?: ReadonlySet<string>;
}

interface Anchor {
  loc: LatLng;
  label: string;
  /** Buradan en erken ayrılış */
  free: number;
}

const floor5 = (m: number) => Math.floor(m / 5) * 5;
const ceil5 = (m: number) => Math.ceil(m / 5) * 5;

export function isViewSpot(p: Place): boolean {
  return (p.cat === "manzara" || p.tags.includes("manzara")) && CATEGORIES[p.cat].group !== "konaklama";
}

/**
 * Akşam altın saati için en iyi manzara noktası: konuma, günün gün batımından önceki son
 * durağına ya da otele yakın; gün batımında açık; yol süresi kısa. Uygun yer yoksa null.
 */
export function goldenHourSpot(
  day: DayPlan | null,
  position: LatLng,
  index: PlaceIndex,
  date: string,
  opts: GoldenHourOptions = {},
): GoldenHourSpot | null {
  const sun = sunTimes(position, date);
  const sunset = sun.sunsetMin;
  const mode = opts.travel?.mode ?? opts.mode ?? "araba";
  const radius = opts.radiusKm ?? (mode === "yuruyus" ? 2.5 : mode === "toplu" ? 6 : 15);
  const leg = (a: LatLng, b: LatLng) => (opts.travel ? opts.travel.leg(a, b) : estimateLeg(a, b, mode));

  const anchors: Anchor[] = [{ loc: position, label: "Konumun", free: opts.nowMin ?? -Infinity }];
  if (day) {
    const live = day.stops
      .filter((s) => s.slot !== "konaklama" && s.status !== "skipped" && s.status !== "closed")
      .sort((a, b) => a.arriveMin - b.arriveMin);
    const last = live.filter((s) => s.departMin <= sunset - 15).pop();
    const lastPlace = last ? index.get(last.placeId) : undefined;
    if (last && lastPlace) anchors.push({ loc: lastPlace.loc, label: lastPlace.name, free: last.departMin });
    const hotel = day.hotelPlaceId ? index.get(day.hotelPlaceId) : undefined;
    anchors.push({ loc: hotel?.loc ?? day.to.loc, label: hotel?.name ?? day.to.name, free: -Infinity });
  }

  const ok = (p: Place) => isViewSpot(p) && !opts.excludePlaceIds?.has(p.id);
  const seen = new Set<string>();
  let best: { spot: Omit<GoldenHourSpot, "line" | "rainy">; score: number } | null = null;

  for (const anchor of anchors) {
    for (const place of index.near(anchor.loc, radius, ok)) {
      const key = `${place.id}|${anchor.label}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Varış: gün batımından ~30 dk önce; yer daha erken kapanıyorsa kapanıştan 30 dk önce
      const windows = availableWindows(place, date);
      let arrive = floor5(sunset - 30);
      const w =
        windows.find(([s, e]) => s <= arrive && e > arrive + 15) ??
        windows.find(([s, e]) => s < sunset - 15 && e >= Math.max(s, sun.goldenEvening[0] - 20) + 25);
      if (!w) continue;
      if (w[0] > arrive) arrive = ceil5(w[0]);
      const closesMin = w[1] < sunset + 10 ? w[1] : undefined;
      if (closesMin !== undefined) arrive = Math.min(arrive, floor5(closesMin - 30));
      if (arrive < w[0]) arrive = ceil5(w[0]);

      const l = leg(anchor.loc, place.loc);
      let leave = arrive - l.min;
      if (leave < anchor.free) {
        leave = anchor.free;
        arrive = anchor.free + l.min;
      }
      const onSite = (closesMin ?? sunset + 10) - arrive;
      if (onSite < 20 || arrive > sunset - 5) continue;

      const unverified = hoursSource(place) === "default" && CATEGORIES[place.cat].defaultHours !== "24/7";
      const score =
        place.notability +
        (place.cat === "manzara" ? 0.3 : 0) +
        (place.tags.includes("manzara") ? 0.4 : 0) +
        0.2 * (place.quality ?? 0.5) -
        0.02 * l.min -
        (closesMin !== undefined ? 0.4 : 0) -
        (unverified ? 0.1 : 0);
      if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && place.id < best.spot.place.id)) {
        best = {
          score,
          spot: {
            place,
            sun,
            arriveMin: arrive,
            leaveMin: leave,
            travelMin: l.min,
            travelKm: Math.round(l.km * 10) / 10,
            walk: mode === "yuruyus" || l.km < 1.2,
            ...(closesMin !== undefined ? { closesMin } : {}),
            fromLabel: anchor.label,
          },
        };
      }
    }
  }
  if (!best) return null;

  const s = best.spot;
  const weather = opts.weather && opts.weather.date === date ? opts.weather : null;
  const rainy = !!weather?.rainWindows.some(([a, b]) => a < sunset && b > sunset - GOLDEN_HOUR_MIN);
  const travelText =
    s.travelMin <= 0 ? "zaten oradasın" : s.walk ? `${s.travelMin} dk yürüme` : `${s.travelMin} dk ${mode === "toplu" ? "toplu taşımayla" : "araçla"}`;
  const at = clockWithSuffix(s.arriveMin, "de");
  const loc = placeLocative(s.place.name);
  let line = `Gün batımı ${formatHHmm(sunset)} — ${loc ? `${loc} ${at} ol` : `${s.place.name}: ${at} orada ol`} (${travelText})`;
  if (s.closesMin !== undefined) line += ` · ${clockWithSuffix(s.closesMin, "de")} kapanıyor`;
  if (rainy) line += " · yağmur bekleniyor";
  return { ...s, rainy, line };
}
