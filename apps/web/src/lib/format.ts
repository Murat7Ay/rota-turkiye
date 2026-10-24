// Türkçe biçimlendirme yardımcıları.
import { WEEKDAY_TR } from "@rota/core";

const tryFmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const dec2 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export const fmtNumber = (n: number) => tryFmt.format(Math.round(n));

/** 12.450 ₺ */
export const fmtTry = (n: number) => `${tryFmt.format(Math.round(n))} ₺`;

export const fmtMoney = (amount: number, currency: "TRY" | "EUR" | "USD") => {
  if (currency === "TRY") return fmtTry(amount);
  const sym = currency === "EUR" ? "€" : "$";
  return `${sym}${dec2.format(amount)}`;
};

export const fmtRate = (n: number) => dec2.format(n);

/** 1,8 km · 850 m */
export function fmtKm(km: number): string {
  if (!Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 20) return `${dec1.format(km)} km`;
  return `${tryFmt.format(km)} km`;
}

/** 95 → "1 sa 35 dk" */
export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} sa ${r} dk` : `${h} sa`;
}

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y ?? 1970, m ?? 1, d ?? 1];
}

function weekday(date: string): number {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "24 Ekim Cumartesi" */
export function fmtDateLong(date: string): string {
  const [, m, d] = parts(date);
  return `${d} ${MONTHS[m - 1]} ${WEEKDAY_TR[weekday(date)]}`;
}

/** "24 Eki" */
export function fmtDateShort(date: string): string {
  const [, m, d] = parts(date);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

// İlk üç harf yetmez: Cuma/Cumartesi ve Pazar/Pazartesi çakışır
const WEEKDAY_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"] as const;

/** "Cmt" */
export function fmtWeekdayShort(date: string): string {
  return WEEKDAY_SHORT[weekday(date)] ?? "";
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${dec1.format(bytes / 1024)} KB`;
  return `${dec1.format(bytes / 1024 / 1024)} MB`;
}

const DIRS = ["K", "KD", "D", "GD", "G", "GB", "B", "KB"] as const;
const DIRS_LONG = ["kuzey", "kuzeydoğu", "doğu", "güneydoğu", "güney", "güneybatı", "batı", "kuzeybatı"] as const;

/** Pusula yönü kısaltması (K, KD, D…) */
export function compassShort(deg: number): string {
  return DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
}
export function compassLong(deg: number): string {
  return DIRS_LONG[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
}

export function pct(n: number): string {
  return `%${Math.round(n * 100)}`;
}

/** Türkçe çoğul gerektirmez; sayı + isim */
export const count = (n: number, noun: string) => `${fmtNumber(n)} ${noun}`;
