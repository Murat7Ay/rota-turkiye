// Türkçe metin biçimlendirme yardımcıları (iç modül, index'ten dışa açılmaz).
// Intl/ICU'ya bağlı değildir: testlerde ve her cihazda aynı çıktıyı verir.
import { formatHHmm } from "./time";

/** 2400 → "2.400"; -1250 → "-1.250" (tam sayıya yuvarlar) */
export function fmtInt(n: number): string {
  const r = Math.round(n);
  const s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return r < 0 ? `-${s}` : s;
}

/** 2.14 → "2,1"; 2.0 → "2"; 1234.5 → "1.234,5" */
export function fmtDec(n: number, digits = 1): string {
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  const abs = Math.abs(r);
  const intPart = Math.trunc(abs);
  const frac = Math.round((abs - intPart) * f);
  const sign = r < 0 ? "-" : "";
  if (frac === 0) return sign + fmtInt(intPart);
  return `${sign}${fmtInt(intPart)},${String(frac).padStart(digits, "0").replace(/0+$/, "")}`;
}

/** Mesafe: 10 km altı bir ondalık, üstü tam sayı */
export function fmtKm(km: number): string {
  return km < 10 ? fmtDec(km, 1) : fmtInt(km);
}

/** 190 → "3 sa 10 dk", 45 → "45 dk", 120 → "2 sa" */
export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h} sa ${r} dk`;
  if (h) return `${h} sa`;
  return `${r} dk`;
}

/** Türkçe küçük harf (I → ı, İ → i); toLocaleLowerCase'e bağımlı değil */
export function trLower(s: string): string {
  return s.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
}

// Sayının okunuşundaki son kelimeye göre -den/-dan/-ten/-tan eki.
// Birler: bir, iki, üç, dört, beş, altı, yedi, sekiz, dokuz
const ONES_ABLATIVE = ["", "den", "den", "ten", "ten", "ten", "dan", "den", "den", "dan"] as const;
// Onlar (birler 0 iken): sıfır, on, yirmi, otuz, kırk, elli
const TENS_ABLATIVE = ["dan", "dan", "den", "dan", "tan", "den"] as const;

function ablativeOf(n: number): string {
  const ones = n % 10;
  return ones ? ONES_ABLATIVE[ones]! : TENS_ABLATIVE[Math.floor(n / 10) % 6]!;
}

/** 900 → "15:00'ten", 720 → "12:00'den", 630 → "10:30'dan" */
export function timeAblative(min: number): string {
  const hhmm = formatHHmm(min);
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return `${hhmm}'${m === 0 ? ablativeOf(h) : ablativeOf(m)}`;
}

/** Metni en fazla `max` karaktere indirir (mümkünse kelime sınırından), kesilirse "…" ekler */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, Math.max(1, max - 1));
  const space = cut.lastIndexOf(" ");
  const base = space >= max * 0.6 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s,;:·—–(-]+$/, "") || cut}…`;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const round3 = (n: number) => Math.round(n * 1000) / 1000;
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
