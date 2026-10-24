// OSM opening_hours doğrulaması. Çekirdekteki hours.ts ile aynı kural: kütüphane ifadeyi
// çözemezse PH/SH (tatil) kuralları ayıklanıp yeniden denenir; ikisi de olmazsa ifade atılır.
import OpeningHours from "opening_hours";

function parses(value: string): boolean {
  try {
    new OpeningHours(value, null, { mode: 0 } as never);
    return true;
  } catch {
    return false;
  }
}

/** Geçerliyse ifadeyi (kırpılmış) döndürür, değilse undefined. */
export function validOpeningHours(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value || value.length > 255) return undefined;
  if (parses(value)) return value;
  const stripped = value
    .split(";")
    .map((r) => r.trim())
    .filter((r) => r && !/\b(PH|SH)\b/.test(r))
    .join("; ");
  return stripped && parses(stripped) ? value : undefined;
}

/** "off" / "closed" gibi kalıcı kapalılık ifadeleri: mekân büyük olasılıkla kapanmış */
export function isPermanentlyClosed(raw: string | undefined): boolean {
  return !!raw && /^\s*(off|closed)\s*$/i.test(raw);
}
