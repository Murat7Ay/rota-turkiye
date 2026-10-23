// Serbest metin → TripRequest. Model YALNIZCA niyeti çıkarır (yapılandırılmış JSON);
// yer adları paket kasabalarına, tarih ifadeleri takvime, bütçe kapsamı toplam tutara
// burada, deterministik kodla çevrilir. Her değer doğrulanır ve sınırlanır; yapılan her
// varsayım kullanıcıya Türkçe not olarak döner.
import { daysBetween } from "../time";
import { fmtInt } from "../trtext";
import type { Currency, Interest, NamedPoint, Pace, RegionPack, Stay, TransportMode, TripRequest, Visitor } from "../types";
import { aiFail, aiOk, callClaude, responseJson } from "./client";
import type { AiCallOptions, AiResult } from "./client";
import { PARSE_SYSTEM } from "./prompts";
import { fmtDateTr, isIsoDate, monthDate, nextOccurrence, normalizeTr, resolveDateExpression, resolveTownName, ymd } from "./resolve";
import type { TownMatch } from "./resolve";

/** Bütçe söylenmediğinde kişi başı günlük varsayım */
export const DEFAULT_DAILY_BUDGET_PER_PERSON_TRY = 3000;

const INTERESTS: readonly Interest[] = ["tarih", "yemek", "tatli", "doga", "deniz", "alisveris", "kultur", "fotograf"];
const PACES: readonly Pace[] = ["sakin", "dengeli", "yogun"];
const TRANSPORTS: readonly TransportMode[] = ["araba", "yuruyus", "toplu"];
const VISITORS: readonly Visitor[] = ["yerli", "yabanci"];
const CURRENCIES: readonly Currency[] = ["TRY", "EUR", "USD"];
const SCOPES = ["kisi_basi_toplam", "kisi_basi_gunluk", "toplam", "gunluk_toplam"] as const;
export type BudgetScope = (typeof SCOPES)[number];

const INTEREST_LABEL: Record<Interest, string> = {
  tarih: "tarih",
  yemek: "yemek",
  tatli: "tatlı",
  doga: "doğa",
  deniz: "deniz",
  alisveris: "alışveriş",
  kultur: "kültür",
  fotograf: "fotoğraf",
};
const PACE_LABEL: Record<Pace, string> = { sakin: "sakin", dengeli: "dengeli", yogun: "yoğun" };
const TRANSPORT_LABEL: Record<TransportMode, string> = { araba: "araba", yuruyus: "yürüyüş", toplu: "toplu taşıma" };
const CURRENCY_LABEL: Record<Currency, string> = { TRY: "TL", EUR: "avro", USD: "dolar" };

const MAX_STAYS = 8;
const MAX_NIGHTS_PER_STAY = 14;
const MAX_TOTAL_NIGHTS = 30;
const MAX_TRAVELERS = 20;

// ---------------------------------------------------------------- model çıktısı

/** Modelin çıkardığı ham niyet (doğrulanmış/temizlenmiş hâli) */
export interface TripIntent {
  title: string;
  regionHint: string;
  start: string;
  end: string;
  stays: Array<{ place: string; nights: number }>;
  mustSee: string[];
  totalDays: number;
  totalNights: number;
  startDate: { text: string; day: number; month: number; year: number };
  travelers: number;
  pace: Pace | null;
  interests: Interest[];
  budget: { amount: number; currency: Currency | null; scope: BudgetScope | null };
  visitor: Visitor | null;
  hasMuzekart: boolean;
  diet: { vegetarian: boolean; noAlcohol: boolean };
  transport: TransportMode | null;
  dayStart: string;
  dayEnd: string;
  notes: string[];
}

const S = { type: "string" } as const;
const I = { type: "integer" } as const;
const B = { type: "boolean" } as const;
const strEnum = (values: readonly string[]) => ({ type: "string", enum: [...values, "belirsiz"] });
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

/**
 * Yapılandırılmış çıktı şeması. Birleşim (null) tipleri yerine "bilinmiyor" değerleri
 * kullanılır: "" / 0 / "belirsiz" / false — şema basit kalır, her modelde derlenir.
 */
export const TRIP_INTENT_SCHEMA: Record<string, unknown> = obj({
  title: S,
  regionHint: S,
  start: S,
  end: S,
  stays: { type: "array", items: obj({ place: S, nights: I }) },
  mustSee: { type: "array", items: S },
  totalDays: I,
  totalNights: I,
  startDate: obj({ text: S, day: I, month: I, year: I }),
  travelers: I,
  pace: strEnum(PACES),
  interests: { type: "array", items: { type: "string", enum: [...INTERESTS] } },
  budget: obj({ amount: { type: "number" }, currency: strEnum(CURRENCIES), scope: strEnum(SCOPES) }),
  visitor: strEnum(VISITORS),
  hasMuzekart: B,
  diet: obj({ vegetarian: B, noAlcohol: B }),
  transport: strEnum(TRANSPORTS),
  dayStart: S,
  dayEnd: S,
  notes: { type: "array", items: S },
});

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 80) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}
const int = (v: unknown) => Math.round(num(v));
function oneOf<T extends string>(v: unknown, list: readonly T[]): T | null {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null;
}
function strList(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = str(x, maxLen);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Model çıktısını (güvenilmez) savunmacı biçimde TripIntent'e çevirir */
export function sanitizeIntent(raw: unknown): TripIntent {
  const o = isObj(raw) ? raw : {};
  const sd = isObj(o.startDate) ? o.startDate : {};
  const bu = isObj(o.budget) ? o.budget : {};
  const di = isObj(o.diet) ? o.diet : {};
  const stays = Array.isArray(o.stays)
    ? o.stays
        .filter(isObj)
        .map((s) => ({ place: str(s.place), nights: int(s.nights) }))
        .filter((s) => s.place)
        .slice(0, 12)
    : [];
  const interests = Array.isArray(o.interests)
    ? [...new Set(o.interests.map((x) => oneOf(x, INTERESTS)).filter((x): x is Interest => !!x))]
    : [];
  return {
    title: str(o.title, 60),
    regionHint: str(o.regionHint),
    start: str(o.start),
    end: str(o.end),
    stays,
    mustSee: strList(o.mustSee, 8, 60),
    totalDays: int(o.totalDays),
    totalNights: int(o.totalNights),
    startDate: { text: str(sd.text, 60), day: int(sd.day), month: int(sd.month), year: int(sd.year) },
    travelers: int(o.travelers),
    pace: oneOf(o.pace, PACES),
    interests,
    budget: { amount: num(bu.amount), currency: oneOf(bu.currency, CURRENCIES), scope: oneOf(bu.scope, SCOPES) },
    visitor: oneOf(o.visitor, VISITORS),
    hasMuzekart: o.hasMuzekart === true,
    diet: { vegetarian: di.vegetarian === true, noAlcohol: di.noAlcohol === true },
    transport: oneOf(o.transport, TRANSPORTS),
    dayStart: str(o.dayStart, 10),
    dayEnd: str(o.dayEnd, 10),
    notes: strList(o.notes, 5, 140),
  };
}

// ---------------------------------------------------------------- deterministik kurulum

export interface ParsedTripRequest {
  request: TripRequest;
  /** Uygulamanın yaptığı varsayımlar, Türkçe ("Bütçe belirtilmedi, …") */
  assumptions: string[];
  /** Çözülemeyen ya da plana aktarılamayan istekler, Türkçe */
  unresolved: string[];
}

/** "a", "a ve b", "a, b ve c" */
function joinTr(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ve ${items[items.length - 1]}`;
}

const point = (t: { name: string; loc: { lat: number; lon: number } }): NamedPoint => ({ name: t.name, loc: { lat: t.loc.lat, lon: t.loc.lon } });
const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

/** "7:00", "07.30" → "07:00" / "07:30"; geçersizse null */
function parseClock(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = m[2] ? Number(m[2]) : 0;
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function matchNote(label: string, m: TownMatch): string | null {
  switch (m.how) {
    case "exact":
    case "suffix":
      return null;
    case "place":
      return `“${label}” bir yer adı (${m.placeName}); en yakın yerleşim ${m.town.name} kullanıldı.`;
    default:
      return `“${label}” → ${m.town.name} olarak eşleştirildi.`;
  }
}

/**
 * Doğrulanmış niyetten TripRequest kurar (LLM'siz, saf fonksiyon). Yer adları yalnızca
 * pack.towns (gerekirse pack.places üzerinden en yakın yerleşim) ile çözülür.
 */
export function buildTripRequest(
  intent: TripIntent,
  pack: RegionPack,
  defaults: Partial<TripRequest> = {},
  today: string,
): ParsedTripRequest {
  const assumptions: string[] = [];
  const unresolved: string[] = [];
  const note = (s: string | null) => {
    if (s && !assumptions.includes(s)) assumptions.push(s);
  };
  const resolve = (label: string) => {
    const m = resolveTownName(label, pack);
    if (m) note(matchNote(label, m));
    return m;
  };
  const day0 = isIsoDate(today) ? today : (defaults.startDate ?? "2026-01-01");

  // ---- bölge
  if (intent.regionHint) {
    const rk = normalizeTr(intent.regionHint);
    const inPack = ` ${normalizeTr(`${pack.name} ${pack.id}`)} `.includes(` ${rk} `) || !!resolveTownName(intent.regionHint, pack);
    if (rk && !inPack) {
      unresolved.push(`İstekte “${intent.regionHint}” geçiyor ama yüklü bölge paketi “${pack.name}”. Plan bu paketteki yerlerle kurulur.`);
    }
  }

  // ---- geceleme üsleri
  let stays: Stay[] = [];
  for (const s of intent.stays) {
    if (stays.length >= MAX_STAYS) {
      unresolved.push(`En fazla ${MAX_STAYS} geceleme yeri desteklenir; “${s.place}” ve sonrası eklenmedi.`);
      break;
    }
    const m = resolve(s.place);
    if (!m) {
      unresolved.push(`“${s.place}” bu bölge paketinde bulunamadı; geceleme listesine eklenmedi.`);
      continue;
    }
    const prev = stays[stays.length - 1];
    if (prev && prev.id === m.town.id) prev.nights += s.nights;
    else stays.push({ id: m.town.id, name: m.town.name, loc: { ...m.town.loc }, nights: s.nights });
  }

  // ---- başlangıç / bitiş (açıkça söylenenler)
  let start: NamedPoint | undefined;
  if (intent.start) {
    const m = resolve(intent.start);
    if (m) start = point(m.town);
    else unresolved.push(`Başlangıç noktası “${intent.start}” bu bölge paketinde bulunamadı.`);
  }
  let end: NamedPoint | undefined;
  if (intent.end) {
    const m = resolve(intent.end);
    if (m) end = point(m.town);
    else unresolved.push(`Bitiş noktası “${intent.end}” bu bölge paketinde bulunamadı; son gün dönüş planlanmadı.`);
  }

  // ---- hiç üs çözülemediyse
  if (stays.length === 0) {
    if (defaults.stays?.length) {
      stays = defaults.stays.map((s) => ({ ...s, loc: { ...s.loc } }));
      note("Geceleme yeri anlaşılamadı; formdaki geceleme listesi korundu.");
    } else {
      const fallback = start
        ? { id: `pt:${normalizeTr(start.name).replace(/ /g, "-")}`, name: start.name, loc: start.loc }
        : biggestTown(pack);
      stays = [{ id: fallback.id, name: fallback.name, loc: { ...fallback.loc }, nights: 0 }];
      unresolved.push(`Geceleme yeri anlaşılamadı; ${fallback.name} varsayıldı — formdan düzelt.`);
    }
  }

  // ---- gece sayıları
  const daysWanted = clampInt(intent.totalDays, 0, 60);
  const nightsWanted = clampInt(intent.totalNights, 0, 60);
  const target = nightsWanted || (daysWanted > 1 ? daysWanted - 1 : daysWanted);
  const unknown = stays.filter((s) => s.nights <= 0);
  if (unknown.length) {
    const known = stays.reduce((a, s) => a + Math.max(0, s.nights), 0);
    const remaining = Math.max(0, target - known);
    const each = Math.max(1, Math.floor(remaining / unknown.length));
    let extra = Math.max(0, remaining - each * unknown.length);
    for (const s of unknown) {
      s.nights = each + (extra > 0 ? 1 : 0);
      extra--;
    }
    const names = unknown.map((s) => `${s.name} ${s.nights}`);
    note(
      remaining >= unknown.length
        ? `Gece sayısı belirtilmeyen yerlere toplam süreye göre paylaştırıldı (${joinTr(names)} gece).`
        : `${joinTr(unknown.map((s) => s.name))} için gece sayısı belirtilmedi; ${unknown.length > 1 ? "her birine " : ""}${each} gece varsayıldı.`,
    );
  }
  for (const s of stays) {
    if (s.nights > MAX_NIGHTS_PER_STAY) {
      note(`${s.name} için en fazla ${MAX_NIGHTS_PER_STAY} gece planlanabilir; ${MAX_NIGHTS_PER_STAY} geceye indirildi.`);
      s.nights = MAX_NIGHTS_PER_STAY;
    }
    s.nights = Math.max(1, Math.round(s.nights));
  }
  let totalNights = stays.reduce((a, s) => a + s.nights, 0);
  while (totalNights > MAX_TOTAL_NIGHTS && stays.length) {
    const last = stays[stays.length - 1]!;
    const cut = Math.min(last.nights - 1, totalNights - MAX_TOTAL_NIGHTS);
    if (cut > 0) last.nights -= cut;
    else stays.pop();
    totalNights = stays.reduce((a, s) => a + s.nights, 0);
    note(`Gezi en fazla ${MAX_TOTAL_NIGHTS} gece olabilir; süre kısaltıldı.`);
  }
  if (nightsWanted && !unknown.length && nightsWanted !== totalNights) {
    note(`İstekte ${nightsWanted} gece geçiyor ama geceleme süreleri toplamı ${totalNights}; geceleme süreleri esas alındı.`);
  }

  // ---- başlangıç varsayımı
  const first = stays[0]!;
  if (!start) {
    if (defaults.start) {
      start = point(defaults.start);
      note(`Başlangıç noktası belirtilmedi; formdaki başlangıç (${start.name}) korundu.`);
    } else {
      start = point(first);
      note(`Başlangıç noktası belirtilmedi; ilk geceleme yeri (${first.name}) başlangıç kabul edildi.`);
    }
  }

  // ---- gün sayısı ↔ gece sayısı: bir gün fazlaysa son gün başlangıca dönüş
  if (!end && daysWanted > totalNights) {
    if (daysWanted === totalNights + 1) {
      end = { ...start, loc: { ...start.loc } };
      note(`${daysWanted} gün / ${totalNights} gece: son gün başlangıç noktasına (${start.name}) dönüş varsayıldı.`);
    } else {
      note(`İstekte ${daysWanted} gün geçiyor; geceleme süreleri esas alınarak ${totalNights} günlük plan kuruldu.`);
    }
  } else if (daysWanted && daysWanted < totalNights + (end ? 1 : 0)) {
    note(`İstekte ${daysWanted} gün geçiyor; geceleme süreleri esas alınarak ${totalNights + (end ? 1 : 0)} günlük plan kuruldu.`);
  }
  const tripDays = totalNights + (end ? 1 : 0);

  // ---- tarih
  const startDate = resolveStartDate(intent.startDate, day0, defaults.startDate, note, unresolved);

  // ---- kişi sayısı
  let travelers: number;
  if (intent.travelers > 0) {
    travelers = clampInt(intent.travelers, 1, MAX_TRAVELERS);
    if (travelers !== intent.travelers) note(`Kişi sayısı ${MAX_TRAVELERS} ile sınırlandı.`);
  } else {
    travelers = clampInt(defaults.travelers ?? 2, 1, MAX_TRAVELERS);
    note(`Kişi sayısı belirtilmedi; ${travelers} kişi varsayıldı.`);
  }

  // ---- bütçe (TripRequest.budget: bütün gezi ve bütün yolcular için toplam)
  let budget: { amount: number; currency: Currency };
  if (intent.budget.amount > 0) {
    const currency = intent.budget.currency ?? "TRY";
    if (!intent.budget.currency) note("Para birimi belirtilmedi; TL varsayıldı.");
    const cur = CURRENCY_LABEL[currency];
    const a = intent.budget.amount;
    let total = a;
    switch (intent.budget.scope ?? "toplam") {
      case "kisi_basi_toplam":
        total = a * travelers;
        if (travelers > 1) note(`Kişi başı ${fmtInt(a)} ${cur} × ${travelers} kişi = toplam ${fmtInt(total)} ${cur} bütçe.`);
        break;
      case "kisi_basi_gunluk":
        total = a * travelers * tripDays;
        note(`Kişi başı günlük ${fmtInt(a)} ${cur} × ${travelers} kişi × ${tripDays} gün = toplam ${fmtInt(total)} ${cur} bütçe.`);
        break;
      case "gunluk_toplam":
        total = a * tripDays;
        note(`Günlük ${fmtInt(a)} ${cur} × ${tripDays} gün = toplam ${fmtInt(total)} ${cur} bütçe.`);
        break;
      case "toplam":
        break;
    }
    if (total > 100_000_000) {
      total = 100_000_000;
      note("Bütçe çok yüksek anlaşıldı; üst sınıra indirildi, formdan kontrol et.");
    }
    budget = { amount: Math.round(total), currency };
  } else {
    const total = DEFAULT_DAILY_BUDGET_PER_PERSON_TRY * travelers * tripDays;
    budget = { amount: total, currency: "TRY" };
    note(`Bütçe belirtilmedi; kişi başı günlük ${fmtInt(DEFAULT_DAILY_BUDGET_PER_PERSON_TRY)} TL varsayıldı (toplam ${fmtInt(total)} TL).`);
  }

  // ---- tercihler
  let pace: Pace;
  if (intent.pace) pace = intent.pace;
  else {
    pace = defaults.pace ?? "dengeli";
    note(`Tempo belirtilmedi; ${PACE_LABEL[pace]} tempo varsayıldı.`);
  }

  let interests: Interest[];
  if (intent.interests.length) interests = [...intent.interests];
  else {
    interests = defaults.interests?.length ? [...defaults.interests] : ["tarih", "yemek", "tatli"];
    note(`İlgi alanı belirtilmedi; ${joinTr(interests.map((i) => INTEREST_LABEL[i]))} varsayıldı.`);
  }

  let transport: TransportMode;
  if (intent.transport) transport = intent.transport;
  else {
    transport = defaults.transport ?? "araba";
    note(`Ulaşım belirtilmedi; ${TRANSPORT_LABEL[transport]} varsayıldı.`);
  }

  let visitor: Visitor;
  if (intent.visitor) visitor = intent.visitor;
  else {
    visitor = defaults.visitor ?? "yerli";
    note(`Ziyaretçi türü belirtilmedi; ${visitor === "yerli" ? "yerli ziyaretçi (TL bilet fiyatları)" : "yabancı ziyaretçi"} varsayıldı.`);
  }
  const hasMuzekart = visitor === "yerli" && (intent.hasMuzekart || defaults.hasMuzekart === true);

  const diet: TripRequest["diet"] = { ...(defaults.diet ?? {}) };
  if (intent.diet.vegetarian) diet.vegetarian = true;
  if (intent.diet.noAlcohol) diet.noAlcohol = true;

  // ---- gün saatleri
  const defStart = parseClock(defaults.dayStart ?? "") ?? 8 * 60 + 30;
  const defEnd = parseClock(defaults.dayEnd ?? "") ?? 22 * 60;
  let ds = defStart;
  let de = defEnd;
  if (intent.dayStart) {
    const v = parseClock(intent.dayStart);
    if (v !== null && v >= 5 * 60 && v <= 13 * 60) ds = v;
    else note(`“${intent.dayStart}” gün başlangıcı için uygun görünmedi; ${hhmm(defStart)} kullanıldı.`);
  }
  if (intent.dayEnd) {
    const v = parseClock(intent.dayEnd);
    if (v !== null && v >= 15 * 60 && v <= 23 * 60 + 59) de = v;
    else note(`“${intent.dayEnd}” gün bitişi için uygun görünmedi; ${hhmm(defEnd)} kullanıldı.`);
  }
  if (de - ds < 6 * 60) {
    ds = defStart;
    de = defEnd;
    note(`Gün saatleri çok kısa anlaşıldı; ${hhmm(ds)}–${hhmm(de)} kullanıldı.`);
  }

  // ---- plana aktarılamayanlar
  if (intent.mustSee.length) {
    unresolved.push(
      `Görmek istediğin yerler (${joinTr(intent.mustSee)}) zorunlu durak olarak işaretlenemiyor; çözücü ilgi alanlarına göre seçer, plan oluşunca kontrol et.`,
    );
  }
  for (const n of intent.notes) unresolved.push(`Plana doğrudan aktarılamayan istek: ${n}`);

  const request: TripRequest = {
    title: intent.title || `${first.name} gezisi · ${totalNights} gece`,
    startDate,
    start,
    stays,
    travelers,
    pace,
    interests,
    budget,
    transport,
    dayStart: hhmm(ds),
    dayEnd: hhmm(de),
    diet,
    visitor,
    hasMuzekart,
  };
  if (end) request.end = end;
  return { request, assumptions, unresolved };
}

function biggestTown(pack: RegionPack): { id: string; name: string; loc: { lat: number; lon: number } } {
  const rank = { city: 0, town: 1, village: 2 } as const;
  const t = [...pack.towns].sort((a, b) => rank[a.kind] - rank[b.kind] || (b.population ?? 0) - (a.population ?? 0))[0];
  if (t) return t;
  const [minLon, minLat, maxLon, maxLat] = pack.bbox;
  return { id: `pack:${pack.id}`, name: pack.name, loc: { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 } };
}

function resolveStartDate(
  sd: TripIntent["startDate"],
  today: string,
  fallback: string | undefined,
  note: (s: string) => void,
  unresolved: string[],
): string {
  const guard = (d: string): string => {
    if (d < today) {
      note("Geçmiş bir tarih anlaşıldı; bugünden başlatıldı.");
      return today;
    }
    if (daysBetween(today, d) > 730) {
      note("İki yıldan uzak bir tarih anlaşıldı; bugünden başlatıldı, formdan düzelt.");
      return today;
    }
    return d;
  };

  if (sd.text) {
    const r = resolveDateExpression(sd.text, today);
    if (r) {
      const d = guard(r.date);
      if (d === r.date) note(`“${sd.text}” → ${fmtDateTr(d)}${r.note ? ` (${r.note})` : ""}.`);
      return d;
    }
  }
  if (sd.month >= 1 && sd.month <= 12) {
    if (sd.day >= 1) {
      const d = sd.year ? ymd(sd.year, sd.month, sd.day) : nextOccurrence(sd.month, sd.day, today);
      if (d) {
        const g = guard(d);
        if (g === d) note(`Başlangıç tarihi: ${fmtDateTr(d)}.`);
        return g;
      }
    } else {
      const r = monthDate(sd.month, today, 1, sd.year || undefined);
      if (r) {
        const g = guard(r.date);
        if (g === r.date) note(`Başlangıç tarihi: ${fmtDateTr(g)} (gün belirtilmedi, ayın 1'i varsayıldı${r.note ? `; ${r.note}` : ""}).`);
        return g;
      }
    }
  }
  const def = fallback && isIsoDate(fallback) && fallback >= today ? fallback : today;
  if (sd.text) unresolved.push(`“${sd.text}” tarihi çözülemedi; ${fmtDateTr(def)} varsayıldı — formdan düzelt.`);
  else note(`Tarih belirtilmedi; başlangıç ${fmtDateTr(def)} varsayıldı.`);
  return def;
}

// ---------------------------------------------------------------- LLM çağrısı

export interface ParseTripOptions extends AiCallOptions {
  /** Göreli tarihlerin çözüldüğü gün, YYYY-MM-DD (Türkiye saati) */
  today: string;
}

/**
 * Serbest metinden gezi isteği. Model yalnız niyeti çıkarır; TripRequest'i
 * buildTripRequest kurar. Hata olursa AiResult.ok = false (çağıran form ile devam eder).
 */
export async function parseTripRequest(
  text: string,
  pack: RegionPack,
  defaults: Partial<TripRequest>,
  opts: ParseTripOptions,
): Promise<AiResult<ParsedTripRequest>> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 2000);
  if (clean.length < 3) return aiFail("empty_input", "Önce nasıl bir gezi istediğini birkaç kelimeyle yaz.");

  const res = await callClaude({
    ...opts,
    system: PARSE_SYSTEM,
    // Kullanıcı metni veri olarak etiket içinde; tarih/bugün bilgisi bilerek verilmez (hesaplamayı kod yapar)
    messages: [{ role: "user", content: `<istek>\n${clean.replace(/<\/?istek>/gi, "")}\n</istek>` }],
    jsonSchema: TRIP_INTENT_SCHEMA,
    maxTokens: 4000,
    effort: "medium",
    timeoutMs: opts.timeoutMs ?? 60_000,
  });
  if (!res.ok) return res;
  const raw = responseJson(res.value, "trip_intent");
  if (!isObj(raw)) {
    if (res.value.stop_reason === "max_tokens") {
      return aiFail("max_tokens", "Yanıt yarım kaldı. İsteği biraz kısaltıp yeniden dene.");
    }
    return aiFail("bad_response", "İstek anlaşılamadı. Biraz daha açık yazıp yeniden dene ya da formu kullan.");
  }
  try {
    return aiOk(buildTripRequest(sanitizeIntent(raw), pack, defaults, opts.today));
  } catch {
    return aiFail("bad_response", "İstekten geçerli bir gezi kurulamadı. Formu kullanabilirsin.");
  }
}
