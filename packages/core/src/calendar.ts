import { CalculationMethod, Coordinates, PrayerTimes } from "adhan";
import type { LatLng } from "./types";
import { toTrWallClock, weekdayOf } from "./time";

export interface Holiday {
  date: string;
  name: string;
  kind: "resmi" | "dini";
  /** Arife: öğleden sonra resmi tatil */
  arife?: boolean;
  /** Dini bayramın ilk günü (kapalı çarşılar vb. kapanır) */
  firstDay?: boolean;
}

// Kaynak: 2026 için Diyanet takvimi; 2027 dini bayramları için Diyanet'e dayanan
// haberler (Dünya, CNN Türk: Ramazan Bayramı 9–11 Mart). Nager.Date 10–12 Mart diyor ve
// "geçici" işaretli; bu yüzden elle tutulan liste esas alınıyor. Her yıl elle kontrol edilmeli.
export const TR_HOLIDAYS: Holiday[] = [
  { date: "2026-01-01", name: "Yılbaşı", kind: "resmi" },
  { date: "2026-03-19", name: "Ramazan Bayramı arifesi", kind: "dini", arife: true },
  { date: "2026-03-20", name: "Ramazan Bayramı 1. gün", kind: "dini", firstDay: true },
  { date: "2026-03-21", name: "Ramazan Bayramı 2. gün", kind: "dini" },
  { date: "2026-03-22", name: "Ramazan Bayramı 3. gün", kind: "dini" },
  { date: "2026-04-23", name: "Ulusal Egemenlik ve Çocuk Bayramı", kind: "resmi" },
  { date: "2026-05-01", name: "Emek ve Dayanışma Günü", kind: "resmi" },
  { date: "2026-05-19", name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", kind: "resmi" },
  { date: "2026-05-26", name: "Kurban Bayramı arifesi", kind: "dini", arife: true },
  { date: "2026-05-27", name: "Kurban Bayramı 1. gün", kind: "dini", firstDay: true },
  { date: "2026-05-28", name: "Kurban Bayramı 2. gün", kind: "dini" },
  { date: "2026-05-29", name: "Kurban Bayramı 3. gün", kind: "dini" },
  { date: "2026-05-30", name: "Kurban Bayramı 4. gün", kind: "dini" },
  { date: "2026-07-15", name: "Demokrasi ve Millî Birlik Günü", kind: "resmi" },
  { date: "2026-08-30", name: "Zafer Bayramı", kind: "resmi" },
  { date: "2026-10-28", name: "Cumhuriyet Bayramı arifesi", kind: "resmi", arife: true },
  { date: "2026-10-29", name: "Cumhuriyet Bayramı", kind: "resmi" },
  { date: "2027-01-01", name: "Yılbaşı", kind: "resmi" },
  { date: "2027-03-08", name: "Ramazan Bayramı arifesi", kind: "dini", arife: true },
  { date: "2027-03-09", name: "Ramazan Bayramı 1. gün", kind: "dini", firstDay: true },
  { date: "2027-03-10", name: "Ramazan Bayramı 2. gün", kind: "dini" },
  { date: "2027-03-11", name: "Ramazan Bayramı 3. gün", kind: "dini" },
  { date: "2027-04-23", name: "Ulusal Egemenlik ve Çocuk Bayramı", kind: "resmi" },
  { date: "2027-05-01", name: "Emek ve Dayanışma Günü", kind: "resmi" },
  { date: "2027-05-15", name: "Kurban Bayramı arifesi", kind: "dini", arife: true },
  { date: "2027-05-16", name: "Kurban Bayramı 1. gün", kind: "dini", firstDay: true },
  { date: "2027-05-17", name: "Kurban Bayramı 2. gün", kind: "dini" },
  { date: "2027-05-18", name: "Kurban Bayramı 3. gün", kind: "dini" },
  { date: "2027-05-19", name: "Kurban Bayramı 4. gün; Gençlik ve Spor Bayramı", kind: "dini" },
  { date: "2027-07-15", name: "Demokrasi ve Millî Birlik Günü", kind: "resmi" },
  { date: "2027-08-30", name: "Zafer Bayramı", kind: "resmi" },
  { date: "2027-10-28", name: "Cumhuriyet Bayramı arifesi", kind: "resmi", arife: true },
  { date: "2027-10-29", name: "Cumhuriyet Bayramı", kind: "resmi" },
];

const byDate = new Map(TR_HOLIDAYS.map((h) => [h.date, h]));

export function holidayOn(date: string): Holiday | undefined {
  return byDate.get(date);
}

/** Tam gün resmi tatil mi (arife hariç) — opening_hours "PH" kuralları için */
export function isPublicHoliday(date: string): boolean {
  const h = byDate.get(date);
  return !!h && !h.arife;
}

export interface PrayerTimesMin {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

/** Diyanet yöntemine göre namaz vakitleri, Türkiye duvar saati dakikası */
export function prayerTimes(loc: LatLng, date: string): PrayerTimesMin {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const pt = new PrayerTimes(new Coordinates(loc.lat, loc.lon), new Date(y, m - 1, d), CalculationMethod.Turkey());
  const min = (t: Date) => toTrWallClock(t).min;
  return {
    fajr: min(pt.fajr),
    sunrise: min(pt.sunrise),
    dhuhr: min(pt.dhuhr),
    asr: min(pt.asr),
    maghrib: min(pt.maghrib),
    isha: min(pt.isha),
  };
}

/**
 * Camilerin turist ziyaretine kapalı olduğu aralıklar (gün içi dakika).
 * Vakitten 10 dk önce – 30 dk sonra; cuma öğle 45 dk önce – 60 dk sonra.
 */
export function mosqueBlockedIntervals(loc: LatLng, date: string): Array<[number, number]> {
  const t = prayerTimes(loc, date);
  const friday = weekdayOf(date) === 5;
  return [
    friday ? [t.dhuhr - 45, t.dhuhr + 60] : [t.dhuhr - 10, t.dhuhr + 30],
    [t.asr - 10, t.asr + 30],
    [t.maghrib - 10, t.maghrib + 30],
    [t.isha - 10, t.isha + 30],
  ];
}

/** O güne özel, kullanıcıya gösterilecek takvim uyarıları */
export function calendarWarnings(date: string): string[] {
  const out: string[] = [];
  const h = byDate.get(date);
  if (h?.arife) out.push(`${h.name}: öğleden sonra resmi tatil, şehirlerarası trafik yoğun olabilir.`);
  else if (h?.firstDay) out.push(`${h.name}: kapalı çarşılar ve birçok esnaf kapalı; müzeler genelde öğleden sonra açılır.`);
  else if (h) out.push(`${h.name}: resmi tatil, popüler yerler kalabalık olabilir.`);
  if (weekdayOf(date) === 5) out.push("Cuma: camiler cuma namazı sırasında (öğle civarı) ziyarete kapalı.");
  return out;
}
