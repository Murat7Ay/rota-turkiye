// Deterministik çözümleyiciler: yer adı → paket kasabası, tarih ifadesi → YYYY-MM-DD.
// Modelin verdiği koordinata ya da hesapladığı tarihe asla güvenilmez; burada çözülür.
import { haversineKm } from "../geo";
import { addDays, weekdayOf, WEEKDAY_TR } from "../time";
import type { Place, RegionPack, Town } from "../types";

// ---------------------------------------------------------------- Türkçe normalleştirme

/**
 * Türkçeye duyarlı karşılaştırma anahtarı: İ/I doğru küçültülür, ı/ş/ğ/ü/ö/ç ve diğer
 * aksanlar ASCII'ye katlanır, noktalama boşluğa çevrilir. "İzmir'de" → "izmir de".
 */
export function normalizeTr(s: string): string {
  return s
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Yer adlarında anlam taşımayan genel kelimeler ("Selçuk ilçesi", "Şirince köyü") */
const GENERIC_WORDS = new Set([
  "il", "ili", "ilce", "ilcesi", "sehir", "sehri", "merkez", "merkezi", "koy", "koyu",
  "kasaba", "kasabasi", "belde", "beldesi", "turkiye", "turkey",
]);

/** Kesme işaretsiz yazılmış hâl ekleri ("Selcukta", "Kusadasinda"); uzundan kısaya */
const CASE_SUFFIXES = ["ndan", "nden", "nda", "nde", "dan", "den", "tan", "ten", "da", "de", "ta", "te", "ya", "ye", "yi", "yu", "a", "e", "i", "u"];

/** Yer adı anahtarı: kesme işaretinden sonrası atılır ("Selçuk'ta" → "selcuk"), genel kelimeler çıkarılır */
export function placeKey(name: string): string {
  const base = name.split(/['’‘`´]/)[0] ?? name;
  return normalizeTr(base)
    .split(" ")
    .filter((w) => w && !GENERIC_WORDS.has(w))
    .join(" ");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

// ---------------------------------------------------------------- kasaba çözümleme

export interface TownMatch {
  town: Town;
  /** exact: birebir; suffix: ek atılarak; prefix: kısaltma; fuzzy: yazım hatası; place: mekân adından en yakın yerleşim */
  how: "exact" | "suffix" | "prefix" | "fuzzy" | "place";
  /** 0..1 */
  score: number;
  /** how = "place" ise eşleşen mekânın adı */
  placeName?: string;
}

const KIND_RANK: Record<Town["kind"], number> = { city: 0, town: 1, village: 2 };

const keyCache = new WeakMap<readonly Town[], Array<{ town: Town; key: string }>>();
function townKeys(towns: readonly Town[]): Array<{ town: Town; key: string }> {
  let k = keyCache.get(towns);
  if (!k) {
    k = towns.map((town) => ({ town, key: placeKey(town.name) })).filter((e) => e.key);
    keyCache.set(towns, k);
  }
  return k;
}

/** Aynı puanda: şehir > ilçe > köy, sonra nüfus */
function better(a: Town, b: Town): boolean {
  return KIND_RANK[a.kind] - KIND_RANK[b.kind] < 0 || (a.kind === b.kind && (a.population ?? 0) > (b.population ?? 0));
}

function bestOf(list: Array<{ town: Town }>): Town | undefined {
  let best: Town | undefined;
  for (const { town } of list) if (!best || better(town, best)) best = town;
  return best;
}

/** Fuzzy eşik: kısa adlarda daha az hata payı */
function maxEdits(len: number): number {
  if (len < 5) return 0;
  if (len < 7) return 1;
  if (len < 11) return 2;
  return 3;
}

/**
 * Serbest yazılmış yer adını paketteki bir kasabaya çözer. Sıra: birebir → ek atma →
 * önek → yazım hatası (Levenshtein) → mekân adı (en yakın yerleşim). Bulunamazsa null.
 */
export function resolveTownName(name: string, pack: Pick<RegionPack, "towns"> & Partial<Pick<RegionPack, "places">>): TownMatch | null {
  const q = placeKey(name);
  if (q.length < 2) return null;
  const entries = townKeys(pack.towns);

  // 1) birebir
  const exact = bestOf(entries.filter((e) => e.key === q));
  if (exact) return { town: exact, how: "exact", score: 1 };

  // 2) kesmesiz hâl eki ("selcukta", "kusadasinda")
  for (const suf of CASE_SUFFIXES) {
    if (q.endsWith(suf) && q.length - suf.length >= 3) {
      const stem = q.slice(0, -suf.length);
      const t = bestOf(entries.filter((e) => e.key === stem));
      if (t) return { town: t, how: "suffix", score: 0.95 };
    }
  }

  // 3) önek ("pamuk" → "pamukkale"); çok kısa sorgular belirsiz olur
  if (q.length >= 4) {
    const t = bestOf(entries.filter((e) => e.key.startsWith(q)));
    if (t) return { town: t, how: "prefix", score: 0.85 };
  }

  // 4) yazım hatası
  const edits = maxEdits(q.length);
  if (edits > 0) {
    let best: { town: Town; d: number } | undefined;
    for (const e of entries) {
      if (Math.abs(e.key.length - q.length) > edits) continue;
      const d = levenshtein(q, e.key);
      if (d <= edits && (!best || d < best.d || (d === best.d && better(e.town, best.town)))) best = { town: e.town, d };
    }
    if (best) return { town: best.town, how: "fuzzy", score: Math.max(0.5, 1 - best.d / Math.max(q.length, 1)) };
  }

  // 5) mekân adı ("Efes" → Efes Antik Kenti → en yakın yerleşim)
  if (q.length >= 4 && pack.places?.length && pack.towns.length) {
    let hit: Place | undefined;
    for (const p of pack.places) {
      const pk = ` ${normalizeTr(p.name)} `;
      if (pk.includes(` ${q} `) && (!hit || p.notability > hit.notability)) hit = p;
    }
    if (hit) {
      let near: Town | undefined;
      let nearKm = Infinity;
      for (const t of pack.towns) {
        const d = haversineKm(hit.loc, t.loc);
        if (d < nearKm) {
          nearKm = d;
          near = t;
        }
      }
      if (near && nearKm <= 40) return { town: near, how: "place", score: 0.7, placeName: hit.name };
    }
  }
  return null;
}

// ---------------------------------------------------------------- tarih çözümleme

const MONTH_KEYS = ["ocak", "subat", "mart", "nisan", "mayis", "haziran", "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik"] as const;
export const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"] as const;
const MONTH_RE = MONTH_KEYS.join("|");
/** Pazartesi Pazar'dan, Cumartesi Cuma'dan önce denenmeli */
const WEEKDAY_KEYS: Array<[string, number]> = [
  ["pazartesi", 1],
  ["sali", 2],
  ["carsamba", 3],
  ["persembe", 4],
  ["cumartesi", 6],
  ["cuma", 5],
  ["pazar", 0],
];

const pad = (n: number) => String(n).padStart(2, "0");

export function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10)) === s;
}

/** Geçerli bir takvim günü ise YYYY-MM-DD, değilse null (31 Şubat gibi) */
export function ymd(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** "7 Kasım 2026 Cumartesi" */
export function fmtDateTr(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS_TR[m - 1] ?? ""} ${y} ${WEEKDAY_TR[weekdayOf(date)]}`;
}

/** Yıl verilmemiş gün/ay için bugünden sonraki ilk geçerli tarih */
export function nextOccurrence(month: number, day: number, today: string): string | null {
  const y = Number(today.slice(0, 4));
  const d = ymd(y, month, day);
  if (!d) return ymd(y + 1, month, day);
  return d < today ? ymd(y + 1, month, day) : d;
}

/** Bir ayın belirli günü (1, 15, 22); içinde bulunulan ay geçmişte kalıyorsa yarın */
export function monthDate(month: number, today: string, day = 1, year?: number): { date: string; note?: string } | null {
  if (year) {
    const d = ymd(year, month, day);
    return d ? { date: d } : null;
  }
  const y = Number(today.slice(0, 4));
  const thisYear = ymd(y, month, day);
  if (!thisYear) return null;
  if (thisYear >= today) return { date: thisYear };
  if (Number(today.slice(5, 7)) === month) return { date: addDays(today, 1), note: "ayın içindeyiz, yarından başlatıldı" };
  const next = ymd(y + 1, month, day);
  return next ? { date: next } : null;
}

type WeekMode = "this" | "next" | "nextWeek";

/** this: bugün dahil ilk; next: bugünden sonraki ilk; nextWeek: gelecek haftanın (Pazartesi başlangıçlı) günü */
function upcomingWeekday(today: string, wd: number, mode: WeekMode): string {
  const cur = weekdayOf(today);
  let delta = (wd - cur + 7) % 7;
  if (mode !== "this" && delta === 0) delta = 7;
  if (mode === "nextWeek" && delta < 7 && (wd + 6) % 7 > (cur + 6) % 7) delta += 7;
  return addDays(today, delta);
}

export interface ResolvedDate {
  date: string;
  /** Kullanıcıya gösterilecek kısa varsayım notu */
  note?: string;
}

/**
 * Türkçe tarih ifadesini `today`'e (YYYY-MM-DD, Türkiye günü) göre çözer:
 * "2026-11-15", "15.11.2026", "15/11", "15 Kasım", "bugün", "yarın", "öbür gün",
 * "(bu/önümüzdeki/haftaya) hafta sonu", "(bu/önümüzdeki/gelecek/haftaya) cuma",
 * "gelecek hafta", "gelecek ay", "kasımda", "kasım ortası", "kasım sonu".
 */
export function resolveDateExpression(text: string, today: string): ResolvedDate | null {
  const raw = text.trim();
  if (!raw || !isIsoDate(today)) return null;

  // 1) ISO
  let m = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const d = ymd(+m[1]!, +m[2]!, +m[3]!);
    if (d) return { date: d };
  }
  // 2) gg.aa(.yyyy) / gg/aa(/yy)
  m = raw.match(/(?:^|[^\d])(\d{1,2})[./](\d{1,2})(?:[./](\d{4}|\d{2}))?(?![\d])/);
  if (m) {
    const day = +m[1]!;
    const month = +m[2]!;
    const yy = m[3] ? +m[3] : 0;
    const d = yy ? ymd(yy < 100 ? 2000 + yy : yy, month, day) : nextOccurrence(month, day, today);
    if (d) return { date: d };
  }

  const t = ` ${normalizeTr(raw)} `;

  // 3) "15 kasım (2026)"
  m = t.match(new RegExp(`\\b(\\d{1,2}) (${MONTH_RE})[a-z]*(?: (\\d{4}))?`));
  if (m) {
    const day = +m[1]!;
    const month = MONTH_KEYS.indexOf(m[2] as (typeof MONTH_KEYS)[number]) + 1;
    const d = m[3] ? ymd(+m[3], month, day) : nextOccurrence(month, day, today);
    if (d) return { date: d };
  }

  // 4) bugün / yarın / öbür gün
  if (/\b(yarindan sonra|obur gun|obursu gun|ertesi gun)\b/.test(t)) return { date: addDays(today, 2) };
  if (/\byarin\b/.test(t)) return { date: addDays(today, 1) };
  if (/\b(bugun|hemen|simdi)\b/.test(t)) return { date: today };

  const nextWeek = /\b(haftaya|gelecek haftanin|onumuzdeki haftanin|bir sonraki haftanin)\b/.test(t);
  const nextOne = /\b(onumuzdeki|gelecek|bir sonraki|ilk)\b/.test(t);

  // 5) hafta sonu → cumartesi
  if (/\bhafta ?sonu/.test(t)) {
    if (nextWeek) return { date: upcomingWeekday(today, 6, "nextWeek") };
    // Pazar günü "bu hafta sonu" bugündür
    if (weekdayOf(today) === 0 && !nextOne) return { date: today };
    return { date: upcomingWeekday(today, 6, "this") };
  }

  // 6) haftanın günü
  for (const [key, wd] of WEEKDAY_KEYS) {
    if (new RegExp(`\\b${key}(?:[a-z]{0,5})\\b`).test(t)) {
      if (nextWeek) return { date: upcomingWeekday(today, wd, "nextWeek") };
      return { date: upcomingWeekday(today, wd, nextOne ? "next" : "this") };
    }
  }

  // 7) gelecek hafta / gelecek ay
  if (nextWeek || /\b(gelecek|onumuzdeki|bir sonraki) hafta\b/.test(t)) {
    return { date: upcomingWeekday(today, 1, "next"), note: "haftanın ilk günü (Pazartesi) varsayıldı" };
  }
  if (/\b(gelecek|onumuzdeki|bir sonraki) ay\b/.test(t)) {
    const y = Number(today.slice(0, 4));
    const mo = Number(today.slice(5, 7));
    const d = mo === 12 ? ymd(y + 1, 1, 1) : ymd(y, mo + 1, 1);
    if (d) return { date: d, note: "ayın 1'i varsayıldı" };
  }

  // 8) yalnız ay adı ("kasımda", "kasım ortası", "kasım sonu")
  m = t.match(new RegExp(`\\b(${MONTH_RE})[a-z]*(?: (\\d{4}))?(?: ([a-z]+))?`));
  if (m) {
    const month = MONTH_KEYS.indexOf(m[1] as (typeof MONTH_KEYS)[number]) + 1;
    const year = m[2] ? +m[2] : undefined;
    const rest = t.slice((m.index ?? 0) + m[0].length - (m[3]?.length ?? 0));
    let day = 1;
    let note = "gün belirtilmedi, ayın 1'i varsayıldı";
    if (/^\s*(orta|ortasi|ortasinda|ortalari|ortalarinda)\b/.test(rest)) {
      day = 15;
      note = "ay ortası için 15'i varsayıldı";
    } else if (/^\s*(son|sonu|sonunda|sonlari|sonlarinda)\b/.test(rest)) {
      day = 22;
      note = "ay sonu için 22'si varsayıldı";
    } else if (/^\s*(bas|basi|basinda|baslari|baslarinda)\b/.test(rest)) {
      note = "ay başı için 1'i varsayıldı";
    }
    const r = monthDate(month, today, day, year);
    if (r) return { date: r.date, note: r.note ? `${note}; ${r.note}` : note };
  }
  return null;
}
