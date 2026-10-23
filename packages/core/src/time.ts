// Türkiye duvar saati yardımcıları. Türkiye 2016'dan beri sürekli UTC+3.

export const TR_OFFSET_MIN = 180;

export interface WallClock {
  /** YYYY-MM-DD */
  date: string;
  /** Gece yarısından itibaren dakika */
  min: number;
  /** 0 = pazar … 6 = cumartesi */
  weekday: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Gerçek bir anı (Date) Türkiye duvar saatine çevirir; cihazın saat diliminden bağımsızdır. */
export function toTrWallClock(d: Date): WallClock {
  const shifted = new Date(d.getTime() + TR_OFFSET_MIN * 60_000);
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    min: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** Türkiye duvar saatindeki tarih+dakikayı gerçek ana çevirir. */
export function fromTrWallClock(date: string, min: number): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 0, min) - TR_OFFSET_MIN * 60_000);
}

export function parseHHmm(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function formatHHmm(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = pazar … 6 = cumartesi */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const WEEKDAY_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"] as const;

/** İki tarih arasındaki gün farkı (b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromTrWallClock(b, 0).getTime() - fromTrWallClock(a, 0).getTime()) / 86_400_000);
}
