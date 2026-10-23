// Sunucusuz plan paylaşımı. Planlama deterministik olduğundan (aynı istek + paket + tohum =
// aynı plan) bağlantı yalnızca isteği, paket kimliğini ve tohumu taşır; alıcı planı yeniden
// kurar. Biçim: kısa anahtarlı JSON → deflate-raw → base64url, başında biçim harfi:
//   "Z…" sıkıştırılmış, "J…" sıkıştırılmamış (CompressionStream yoksa).
// Varsayılan değerler bağlantıya yazılmaz; bağlantı kısa kalır.
import type {
  Currency,
  Interest,
  NamedPoint,
  Pace,
  Stay,
  TransportMode,
  TripPlan,
  TripRequest,
  Visitor,
} from "./types";

export const SHARE_VERSION = 1;
/** Uygulamanın paylaşım rotası: `${base}#/paylas/<kod>` */
export const SHARE_HASH_PREFIX = "#/paylas/";

export interface SharePayload {
  v: 1;
  packId: string;
  /** Paket sürümü; alıcıdaki sürüm farklıysa plan biraz değişebilir */
  packVersion?: string;
  seed: number;
  request: TripRequest;
}

/** Yazılmayan (varsayılan) değerler. Web uygulamasının boş taslağı ve ayar varsayılanlarıyla aynı. */
export const SHARE_DEFAULTS = {
  seed: 42,
  travelers: 2,
  pace: "dengeli" as Pace,
  interests: ["tarih", "yemek", "tatli"] as Interest[],
  budgetAmount: 30000,
  currency: "TRY" as Currency,
  transport: "araba" as TransportMode,
  dayStart: "08:30",
  dayEnd: "22:00",
  visitor: "yerli" as Visitor,
} as const;

const PACES: readonly Pace[] = ["sakin", "dengeli", "yogun"];
const TRANSPORTS: readonly TransportMode[] = ["araba", "yuruyus", "toplu"];
const VISITORS: readonly Visitor[] = ["yerli", "yabanci"];
const CURRENCIES: readonly Currency[] = ["TRY", "EUR", "USD"];
const INTERESTS: readonly Interest[] = ["tarih", "yemek", "tatli", "doga", "deniz", "alisveris", "kultur", "fotograf"];

/** Kod uzunluğu ve açılmış JSON için üst sınırlar (bozuk/kötü niyetli bağlantılara karşı) */
const MAX_CODE_CHARS = 16_000;
const MAX_JSON_BYTES = 200_000;

// ---------------------------------------------------------------- kısa biçim

type WirePoint = [string, number, number];
type WireStay = [string, string, number, number, number];

interface Wire {
  v: number;
  p: string;
  pv?: string;
  s?: number;
  t: string;
  d: string;
  a: WirePoint;
  st: WireStay[];
  e?: WirePoint;
  n?: number;
  pc?: string;
  i?: string[];
  b?: number;
  c?: string;
  tm?: string;
  ds?: string;
  de?: string;
  dv?: 1;
  dn?: 1;
  vi?: string;
  mk?: 1;
}

const pt = (p: NamedPoint): WirePoint => [p.name, p.loc.lat, p.loc.lon];
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function toWire(p: SharePayload): Wire {
  const r = p.request;
  const w: Wire = {
    v: SHARE_VERSION,
    p: p.packId,
    t: r.title,
    d: r.startDate,
    a: pt(r.start),
    st: r.stays.map((s) => [s.id, s.name, s.loc.lat, s.loc.lon, s.nights]),
  };
  if (p.packVersion) w.pv = p.packVersion;
  if (p.seed !== SHARE_DEFAULTS.seed) w.s = p.seed;
  if (r.end) w.e = pt(r.end);
  if (r.travelers !== SHARE_DEFAULTS.travelers) w.n = r.travelers;
  if (r.pace !== SHARE_DEFAULTS.pace) w.pc = r.pace;
  if (!sameList(r.interests, SHARE_DEFAULTS.interests)) w.i = [...r.interests];
  if (r.budget.amount !== SHARE_DEFAULTS.budgetAmount) w.b = r.budget.amount;
  if (r.budget.currency !== SHARE_DEFAULTS.currency) w.c = r.budget.currency;
  if (r.transport !== SHARE_DEFAULTS.transport) w.tm = r.transport;
  if (r.dayStart !== SHARE_DEFAULTS.dayStart) w.ds = r.dayStart;
  if (r.dayEnd !== SHARE_DEFAULTS.dayEnd) w.de = r.dayEnd;
  if (r.diet.vegetarian) w.dv = 1;
  if (r.diet.noAlcohol) w.dn = 1;
  if (r.visitor !== SHARE_DEFAULTS.visitor) w.vi = r.visitor;
  if (r.hasMuzekart) w.mk = 1;
  return w;
}

// ---------------------------------------------------------------- doğrulama (zod yok, elle)

class Invalid extends Error {}
function need(cond: unknown, what: string): asserts cond {
  if (!cond) throw new Invalid(what);
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isStr = (x: unknown, min: number, max: number): x is string => typeof x === "string" && x.length >= min && x.length <= max;
const isInt = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
const isNum = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
const oneOf = <T extends string>(x: unknown, list: readonly T[]): x is T => typeof x === "string" && (list as readonly string[]).includes(x);

function isDate(x: unknown): x is string {
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const [y, m, d] = x.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
const isHHmm = (x: unknown): x is string => typeof x === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(x);

function point(x: unknown, what: string): NamedPoint {
  need(Array.isArray(x) && x.length === 3, what);
  const [name, lat, lon] = x as unknown[];
  need(isStr(name, 1, 120), `${what}.ad`);
  need(isNum(lat, -90, 90) && isNum(lon, -180, 180), `${what}.konum`);
  return { name, loc: { lat, lon } };
}

function stay(x: unknown, i: number): Stay {
  need(Array.isArray(x) && x.length === 5, `üs ${i}`);
  const [id, name, lat, lon, nights] = x as unknown[];
  need(isStr(id, 1, 200), `üs ${i}.id`);
  need(isStr(name, 1, 120), `üs ${i}.ad`);
  need(isNum(lat, -90, 90) && isNum(lon, -180, 180), `üs ${i}.konum`);
  need(isInt(nights, 1, 90), `üs ${i}.gece`);
  return { id, name, loc: { lat, lon }, nights };
}

function fromWire(x: unknown): SharePayload {
  need(isObj(x), "kök");
  need(x.v === SHARE_VERSION, "sürüm");
  need(isStr(x.p, 1, 64) && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(x.p), "paket");
  need(x.pv === undefined || isStr(x.pv, 1, 64), "paket sürümü");
  const seed = x.s === undefined ? SHARE_DEFAULTS.seed : x.s;
  need(isInt(seed, 0, 2 ** 32), "tohum");
  need(isStr(x.t, 0, 200), "başlık");
  need(isDate(x.d), "tarih");
  const start = point(x.a, "başlangıç");
  need(Array.isArray(x.st) && x.st.length >= 1 && x.st.length <= 60, "üsler");
  const stays = x.st.map(stay);
  need(stays.reduce((n, s) => n + s.nights, 0) <= 120, "toplam gece");
  const end = x.e === undefined ? undefined : point(x.e, "bitiş");

  const travelers = x.n === undefined ? SHARE_DEFAULTS.travelers : x.n;
  need(isInt(travelers, 1, 50), "yolcu");
  const pace = x.pc === undefined ? SHARE_DEFAULTS.pace : x.pc;
  need(oneOf(pace, PACES), "tempo");
  let interests: Interest[] = [...SHARE_DEFAULTS.interests];
  if (x.i !== undefined) {
    need(Array.isArray(x.i) && x.i.length <= INTERESTS.length, "ilgi");
    const list = x.i as unknown[];
    need(list.every((v) => oneOf(v, INTERESTS)) && new Set(list).size === list.length, "ilgi");
    interests = list as Interest[];
  }
  const amount = x.b === undefined ? SHARE_DEFAULTS.budgetAmount : x.b;
  need(isNum(amount, 0, 1e9), "bütçe");
  const currency = x.c === undefined ? SHARE_DEFAULTS.currency : x.c;
  need(oneOf(currency, CURRENCIES), "para birimi");
  const transport = x.tm === undefined ? SHARE_DEFAULTS.transport : x.tm;
  need(oneOf(transport, TRANSPORTS), "ulaşım");
  const dayStart = x.ds === undefined ? SHARE_DEFAULTS.dayStart : x.ds;
  const dayEnd = x.de === undefined ? SHARE_DEFAULTS.dayEnd : x.de;
  need(isHHmm(dayStart) && isHHmm(dayEnd), "gün saatleri");
  need(x.dv === undefined || x.dv === 1, "vejetaryen");
  need(x.dn === undefined || x.dn === 1, "alkolsüz");
  const visitor = x.vi === undefined ? SHARE_DEFAULTS.visitor : x.vi;
  need(oneOf(visitor, VISITORS), "ziyaretçi");
  need(x.mk === undefined || x.mk === 1, "müzekart");

  const diet: TripRequest["diet"] = {};
  if (x.dv === 1) diet.vegetarian = true;
  if (x.dn === 1) diet.noAlcohol = true;
  const request: TripRequest = {
    title: x.t,
    startDate: x.d,
    start,
    stays,
    travelers,
    pace,
    interests,
    budget: { amount, currency },
    transport,
    dayStart,
    dayEnd,
    diet,
    visitor,
    hasMuzekart: x.mk === 1,
  };
  if (end) request.end = end;
  const payload: SharePayload = { v: 1, packId: x.p, seed, request };
  if (typeof x.pv === "string") payload.packVersion = x.pv;
  return payload;
}

// ---------------------------------------------------------------- bayt ↔ metin

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Akışı sınırlı okuyarak dönüştürür (sıkıştırma/açma) */
async function pipe(bytes: Uint8Array<ArrayBuffer>, ts: CompressionStream | DecompressionStream, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = new Blob([bytes]).stream().pipeThrough(ts).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new Invalid("boyut");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function makeStream<T>(make: () => T): T | null {
  try {
    return make();
  } catch {
    return null; // tarayıcı "deflate-raw" biçimini tanımıyor
  }
}

// ---------------------------------------------------------------- dış API

/** Planı paylaşım yüküne çevirir (tohum planda tutulmadığı için çağıran verir) */
export function sharePayloadFromPlan(plan: TripPlan, seed: number, packVersion?: string): SharePayload {
  const p: SharePayload = { v: 1, packId: plan.packId, seed: plan.seed ?? seed, request: plan.request };
  if (packVersion) p.packVersion = packVersion;
  return p;
}

/** Yükü URL'de güvenle taşınabilen kısa bir koda çevirir */
export async function encodeShare(payload: SharePayload): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toWire(payload)));
  const cs = typeof CompressionStream === "function" ? makeStream(() => new CompressionStream("deflate-raw")) : null;
  if (cs) {
    try {
      return `Z${toB64Url(await pipe(json, cs, MAX_JSON_BYTES))}`;
    } catch {
      // sıkıştırma başarısız: düz biçime düş
    }
  }
  return `J${toB64Url(json)}`;
}

/**
 * Paylaşım kodunu çözer ve doğrular; geçersizse null. Tam bağlantı ya da `#/paylas/…`
 * parçası da verilebilir.
 */
export async function decodeShare(s: string): Promise<SharePayload | null> {
  try {
    let code = s.trim();
    const at = code.indexOf(SHARE_HASH_PREFIX);
    if (at >= 0) code = code.slice(at + SHARE_HASH_PREFIX.length);
    code = code.split(/[?&#/]/)[0] ?? "";
    if (code.includes("%")) code = decodeURIComponent(code);
    if (code.length < 2 || code.length > MAX_CODE_CHARS) return null;
    const kind = code[0];
    const bytes = fromB64Url(code.slice(1));
    if (!bytes) return null;
    let json: Uint8Array<ArrayBuffer>;
    if (kind === "Z") {
      if (typeof DecompressionStream !== "function") return null;
      const ds = makeStream(() => new DecompressionStream("deflate-raw"));
      if (!ds) return null;
      json = await pipe(bytes, ds, MAX_JSON_BYTES);
    } else if (kind === "J") {
      if (bytes.length > MAX_JSON_BYTES) return null;
      json = bytes;
    } else {
      return null;
    }
    return fromWire(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(json)));
  } catch {
    return null;
  }
}

/** `${baseUrl}#/paylas/<kod>`; baseUrl'deki mevcut # kısmı atılır */
export async function shareUrl(baseUrl: string, payload: SharePayload): Promise<string> {
  const base = baseUrl.split("#")[0] ?? baseUrl;
  return `${base}${SHARE_HASH_PREFIX}${await encodeShare(payload)}`;
}

/** location.hash bir paylaşım rotasıysa kodu döndürür */
export function shareCodeFromHash(hash: string): string | null {
  const h = hash.startsWith("#") ? hash : `#${hash}`;
  if (!h.startsWith(SHARE_HASH_PREFIX)) return null;
  const code = h.slice(SHARE_HASH_PREFIX.length).split(/[?&#/]/)[0] ?? "";
  return code.length >= 2 ? code : null;
}
