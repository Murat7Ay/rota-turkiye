// Bütçe motoru: deterministik. Planlanan maliyet ile gerçek harcamayı karşılaştırır,
// günlük limiti ve çözücüye geri beslenen "bütçe baskısını" hesaplar.
import { CATEGORIES } from "./catalog";
import type { PlaceIndex } from "./geo";
import { DEFAULT_FX, estimatePlaceCost, fuelCostTry, toTry } from "./pricing";
import { daysBetween, toTrWallClock } from "./time";
import { resolveFetch, timeoutInit } from "./net";
import { fmtInt, round2, round3 } from "./trtext";
import type {
  Currency,
  DayPlan,
  Expense,
  ExpenseCategory,
  FxRates,
  Place,
  PlaceCategory,
  Slot,
  TransportMode,
  TripPlan,
  Visitor,
} from "./types";

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  yemek: "Yemek",
  cay_kahve: "Çay-kahve",
  giris: "Giriş ücretleri",
  alisveris: "Alışveriş",
  ulasim: "Ulaşım",
  yakit: "Yakıt",
  konaklama: "Konaklama",
  diger: "Diğer",
};

const EXPENSE_CATEGORIES = Object.keys(EXPENSE_LABELS) as ExpenseCategory[];

export interface BudgetStatus {
  totalTry: number;
  spentTry: number;
  remainingTry: number;
  /** Planın tahmini toplamı */
  plannedTry: number;
  daysTotal: number;
  /** Bugün dahil kalan gün */
  daysLeft: number;
  /** Gezi içindeysek bugünün indeksi */
  todayIndex: number | null;
  todaySpentTry: number;
  /** Bugünün başındaki kalan bütçe / kalan gün */
  dailyLimitTry: number;
  todayLeftTry: number;
  byCategory: Record<ExpenseCategory, { plannedTry: number; spentTry: number }>;
  byDay: Array<{
    dayIndex: number;
    date: string;
    plannedTry: number;
    spentTry: number;
    /** Bu günün planlanan/harcanan konaklaması (önceden ödenen oteller kıyası bozmasın diye ayrı) */
    lodgingPlannedTry?: number;
    lodgingSpentTry?: number;
  }>;
  /** 0 = yolunda, 1 = ciddi aşım; çözücünün budgetPressure girdisi */
  pressure: number;
  status: "iyi" | "dikkat" | "asim";
  /** Türkçe öneriler */
  messages: string[];
}

/**
 * Mekân kategorisinin varsayılan harcama kategorisi.
 * Kafe/çay bahçesi/kahvehane → çay-kahve; tatlıcı ve fırın → yemek (tatlı molası bir öğün
 * yerine geçebildiği ve plandaki "tatli" yuvası yemek sayıldığı için); dinlenme tesisi → çay-kahve
 * (plandaki yuvası çay molası; yakıt ayrıca "yakit" olarak girilir).
 */
export function categoryForPlace(cat: PlaceCategory): ExpenseCategory {
  switch (CATEGORIES[cat].group) {
    case "gezi":
      return "giris";
    case "yeme":
      return cat === "kafe" || cat === "cay_bahcesi" || cat === "kahvehane" ? "cay_kahve" : "yemek";
    case "alisveris":
      return "alisveris";
    case "konaklama":
      return "konaklama";
    case "yol":
      return "cay_kahve";
  }
}

/** Plan durağının yuvasından harcama kategorisi (durak mekânı bilinmeden) */
const SLOT_EXPENSE: Record<Slot, ExpenseCategory> = {
  kahvalti: "yemek",
  ogle: "yemek",
  aksam: "yemek",
  tatli: "yemek",
  cay: "cay_kahve",
  gezi: "giris",
  alisveris: "alisveris",
  konaklama: "konaklama",
};

export interface NewExpense {
  tripId: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  at?: Date;
  note?: string;
  placeId?: string;
  dayIndex?: number;
  id?: string;
}

/** Kur kayıt anında dondurulur */
export function makeExpense(input: NewExpense, fx: FxRates): Expense {
  if (!Number.isFinite(input.amount)) throw new RangeError("Harcama tutarı geçersiz");
  const fxRate = fx.tryPer[input.currency];
  if (!Number.isFinite(fxRate) || fxRate <= 0) throw new RangeError(`Kur yok: ${input.currency}`);
  const e: Expense = {
    id: input.id ?? crypto.randomUUID(),
    tripId: input.tripId,
    at: (input.at ?? new Date()).toISOString(),
    amount: input.amount,
    currency: input.currency,
    amountTry: round2(input.amount * fxRate),
    fxRate,
    category: input.category,
  };
  if (input.note !== undefined) e.note = input.note;
  if (input.placeId !== undefined) e.placeId = input.placeId;
  if (input.dayIndex !== undefined) e.dayIndex = input.dayIndex;
  return e;
}

type CatAmounts = Record<ExpenseCategory, number>;

function zeroCats(): CatAmounts {
  return { yemek: 0, cay_kahve: 0, giris: 0, alisveris: 0, ulasim: 0, yakit: 0, konaklama: 0, diger: 0 };
}

/**
 * Günün planlanan maliyetini kategorilere böler. Duraklar estCost taşır; day.estCost'un
 * duraklara dağılmayan kalanı otel (konaklama durağı yoksa) ve yakıttır. Yakıt, durakların
 * yol km'sinden (fuelCostTry) türetilir; kalan arabada yakıta, toplu taşımada ulaşıma yazılır.
 */
function plannedByCategory(day: DayPlan, transport: TransportMode): CatAmounts {
  const out = zeroCats();
  let stopsSum = 0;
  let km = 0;
  for (const s of day.stops) {
    out[SLOT_EXPENSE[s.slot]] += s.estCost;
    stopsSum += s.estCost;
    km += s.travelKm;
  }
  let rest = Math.max(0, day.estCost - stopsSum);
  if (rest > 0 && transport === "araba") {
    const fuel = Math.min(rest, fuelCostTry(km));
    out.yakit += fuel;
    rest -= fuel;
  }
  if (rest > 0) {
    const hotelInStops = day.stops.some((s) => s.slot === "konaklama");
    if (!hotelInStops && (day.hotelPlaceId || day.stayId)) out.konaklama += rest;
    else out[transport === "araba" ? "yakit" : transport === "toplu" ? "ulasim" : "diger"] += rest;
  }
  return out;
}

/** Baskı 1'e bu aşım oranında ulaşır (planın %40 üstü) */
const FULL_PRESSURE_OVER = 0.4;

/**
 * Bütçe durumu. `expenses` bu gezinin harcamalarıdır (tripId filtrelemesi çağırana aittir).
 * Harcama güne önce dayIndex ile, yoksa `at`'in Türkiye tarihine göre bağlanır.
 *
 * Baskı: tamamlanmış günlerin (konaklama hariç) planı ile harcaması karşılaştırılır; bugünün
 * yalnız plan üstü kısmı eklenir. Konaklama ayrı: oteller çoğu zaman önceden ödendiği için
 * yalnız toplam konaklama planını aşan kısım sayılır.
 */
export function budgetStatus(plan: TripPlan, expenses: Expense[], now: Date, fx: FxRates = DEFAULT_FX): BudgetStatus {
  const days = plan.days;
  const n = days.length;
  const totalTry = Math.round(toTry(plan.request.budget, fx));
  const today = toTrWallClock(now).date;
  const nowMs = now.getTime();

  // ---- plan
  const byCategory = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, { plannedTry: 0, spentTry: 0 }])) as BudgetStatus["byCategory"];
  const plannedDay: number[] = [];
  const plannedLodging: number[] = [];
  for (const day of days) {
    const cats = plannedByCategory(day, plan.request.transport);
    for (const c of EXPENSE_CATEGORIES) byCategory[c].plannedTry += cats[c];
    plannedDay.push(day.estCost);
    plannedLodging.push(cats.konaklama);
  }

  // ---- harcama
  const posByIndex = new Map(days.map((d, i) => [d.index, i]));
  const posByDate = new Map(days.map((d, i) => [d.date, i]));
  const spentDay = new Array<number>(n).fill(0);
  const spentLodging = new Array<number>(n).fill(0);
  let spentTry = 0;
  let spentLodgingTotal = 0;
  let unassignedPastNonLodging = 0;
  for (const e of expenses) {
    const amt = e.amountTry;
    spentTry += amt;
    byCategory[e.category].spentTry += amt;
    const lodging = e.category === "konaklama";
    if (lodging) spentLodgingTotal += amt;
    const pos =
      (e.dayIndex !== undefined ? posByIndex.get(e.dayIndex) : undefined) ?? posByDate.get(toTrWallClock(new Date(e.at)).date);
    if (pos !== undefined) {
      spentDay[pos] = spentDay[pos]! + amt;
      if (lodging) spentLodging[pos] = spentLodging[pos]! + amt;
    } else if (!lodging && Date.parse(e.at) <= nowMs) {
      unassignedPastNonLodging += amt;
    }
  }

  // ---- bugün
  const todayPos = posByDate.get(today);
  const completed = days.filter((d) => d.date < today).length;
  const daysLeft = n - completed;
  const todaySpentTry = todayPos !== undefined ? spentDay[todayPos]! : 0;
  const remainingTry = totalTry - spentTry;
  const remainingAtStart = totalTry - (spentTry - todaySpentTry);
  const dailyLimitTry = daysLeft > 0 ? Math.round(Math.max(0, remainingAtStart) / daysLeft) : 0;
  const todayLeftTry = daysLeft > 0 ? Math.round(dailyLimitTry - todaySpentTry) : 0;

  // ---- baskı
  const nonLodgingPlanned = (i: number) => plannedDay[i]! - plannedLodging[i]!;
  const nonLodgingSpent = (i: number) => spentDay[i]! - spentLodging[i]!;
  let plannedToDate = 0;
  let spentToDate = unassignedPastNonLodging;
  for (let i = 0; i < completed; i++) {
    plannedToDate += nonLodgingPlanned(i);
    spentToDate += nonLodgingSpent(i);
  }
  if (todayPos !== undefined) spentToDate += Math.max(0, nonLodgingSpent(todayPos) - nonLodgingPlanned(todayPos));
  const plannedLodgingTotal = plannedLodging.reduce((a, b) => a + b, 0);
  const lodgingOver = Math.max(0, spentLodgingTotal - plannedLodgingTotal);
  const over = spentToDate + lodgingOver - plannedToDate;
  const avgDay = n > 0 ? days.reduce((a, _d, i) => a + nonLodgingPlanned(i), 0) / n : 0;
  const base = Math.max(1, plannedToDate > 0 ? plannedToDate : avgDay);
  const pressure = over <= 0 ? 0 : round3(Math.min(1, over / base / FULL_PRESSURE_OVER));

  // Kalan planın kalan bütçeye sığıp sığmadığı (ödenmiş konaklama düşülerek)
  let needAhead = Math.max(0, plannedLodgingTotal - spentLodgingTotal);
  for (let i = completed; i < n; i++) needAhead += nonLodgingPlanned(i);
  const available = totalTry - spentTry + (todayPos !== undefined ? nonLodgingSpent(todayPos) : 0);

  // ---- durum
  const tight = needAhead > available * 1.02;
  const status: BudgetStatus["status"] =
    remainingTry < 0 || pressure >= 0.5 ? "asim" : pressure >= 0.05 || todayLeftTry < 0 || tight ? "dikkat" : "iyi";

  // ---- mesajlar
  const messages: string[] = [];
  const firstDate = days[0]?.date;
  const lastDate = days[n - 1]?.date;
  if (firstDate && today < firstDate) {
    const k = daysBetween(today, firstDate);
    messages.push(`Gezi ${k === 1 ? "yarın" : `${k} gün sonra`} başlıyor; günlük ortalama ${fmtInt(dailyLimitTry)} TL.`);
  } else if (lastDate && today > lastDate) {
    messages.push(`Gezi tamamlandı: toplam ${fmtInt(spentTry)} TL harcandı (bütçe ${fmtInt(totalTry)} TL).`);
  }
  if (todayPos !== undefined && todayPos > 0 && spentDay[todayPos - 1]! > 0) {
    const y = todayPos - 1;
    const diff = nonLodgingSpent(y) - nonLodgingPlanned(y);
    const tol = Math.max(50, 0.03 * nonLodgingPlanned(y));
    if (diff > tol) {
      messages.push(
        pressure > 0
          ? `Dün planın ${fmtInt(diff)} TL üstündeydin; bugünün önerileri daha uygun seçildi.`
          : `Dün planın ${fmtInt(diff)} TL üstündeydin.`,
      );
    } else if (diff < -tol) {
      messages.push(`Dün planın ${fmtInt(-diff)} TL altında kaldın.`);
    }
  }
  if (remainingTry < 0) messages.push(`Bütçe ${fmtInt(-remainingTry)} TL aşıldı.`);
  else if (tight) {
    messages.push(`Kalan planın tahmini maliyeti (${fmtInt(needAhead)} TL) kalan bütçenin (${fmtInt(available)} TL) üstünde.`);
  }
  if (todayPos !== undefined && todayLeftTry < 0) messages.push(`Bugün günlük limitin ${fmtInt(-todayLeftTry)} TL üstündesin.`);
  if (messages.length === 0 && status === "iyi") messages.push("Bütçe yolunda.");

  for (const c of EXPENSE_CATEGORIES) {
    byCategory[c].plannedTry = Math.round(byCategory[c].plannedTry);
    byCategory[c].spentTry = round2(byCategory[c].spentTry);
  }

  return {
    totalTry,
    spentTry: round2(spentTry),
    remainingTry: round2(remainingTry),
    plannedTry: Math.round(plan.estTotal),
    daysTotal: n,
    daysLeft,
    todayIndex: todayPos !== undefined ? days[todayPos]!.index : null,
    todaySpentTry: round2(todaySpentTry),
    dailyLimitTry,
    todayLeftTry,
    byCategory,
    byDay: days.map((d, i) => ({
      dayIndex: d.index,
      date: d.date,
      plannedTry: Math.round(plannedDay[i]!),
      spentTry: round2(spentDay[i]!),
      lodgingPlannedTry: Math.round(plannedLodging[i]!),
      lodgingSpentTry: round2(spentLodging[i]!),
    })),
    pressure,
    status,
    messages,
  };
}

// ---------------------------------------------------------------- müze kartları

/**
 * Müzekart (T.C. vatandaşı, yıllık): 200 TL — 2025 fiyatı (Habertürk, 2025).
 * 2023'ten kalma 60 TL rakamı da dolaşıyor; 2026 fiyatı doğrulanmadı.
 */
export const MUZEKART_PRICE_TRY = 200;

/**
 * Museum Pass Türkiye (yabancı ziyaretçi), avro. 1 Nisan 2027'den itibaren €185 (KTB 2027
 * tarifesi, resmî). Öncesi için €165 ikincil kaynaklara dayanan yaklaşık değerdir.
 */
export const MUSEUM_PASS_TURKIYE_EUR: ReadonlyArray<{ from: string; eur: number; approx: boolean }> = [
  { from: "0000-01-01", eur: 165, approx: true },
  { from: "2027-04-01", eur: 185, approx: false },
];

/** Museum Pass Türkiye geçerlilik süresi, gün (ikincil kaynaklar: "15 gün") */
export const MUSEUM_PASS_TURKIYE_DAYS = 15;

export function museumPassPriceEur(date: string): number {
  let eur = MUSEUM_PASS_TURKIYE_EUR[0]!.eur;
  for (const t of MUSEUM_PASS_TURKIYE_EUR) if (date >= t.from) eur = t.eur;
  return eur;
}

export interface MuzekartAdvice {
  worth: boolean;
  visits: number;
  savingTry: number;
  message: string;
}

const isTicketed = (p: Place) => p.cat === "muze" || p.cat === "antik_kent";

/**
 * Yerli için Müzekart, yabancı için Museum Pass başabaş önerisi. Kapsam için yerin "muzekart"
 * etiketi kullanılır (Bakanlık müze/ören yerleri; Museum Pass için de yaklaşık kapsam).
 * Tasarruf bütün yolcular içindir (herkesin kendi kartı gerekir).
 */
export function museumPassAdvice(
  plan: TripPlan,
  index: PlaceIndex,
  opts: { visitor: Visitor; fx?: FxRates },
): MuzekartAdvice | null {
  const fx = opts.fx ?? DEFAULT_FX;
  const travelers = Math.max(1, plan.request.travelers);
  const seen = new Set<string>();
  const ticketed: Array<{ place: Place; date: string }> = [];
  for (const day of plan.days) {
    for (const s of [...day.stops].sort((a, b) => a.arriveMin - b.arriveMin)) {
      if (s.status === "skipped" || s.status === "closed" || seen.has(s.placeId)) continue;
      const place = index.get(s.placeId);
      if (!place || !isTicketed(place)) continue;
      seen.add(s.placeId);
      ticketed.push({ place, date: day.date });
    }
  }
  if (ticketed.length === 0) return null;
  const covered = ticketed.filter((t) => t.place.tags.includes("muzekart"));
  const outside = ticketed.length - covered.length;
  const outsideNote = outside > 0 ? ` ${outside} yer kapsam dışında olabilir.` : "";

  if (opts.visitor === "yerli") {
    if (covered.length === 0) {
      return { worth: false, visits: 0, savingTry: -MUZEKART_PRICE_TRY * travelers, message: "Plandaki müze ve ören yerleri Müzekart kapsamında görünmüyor." };
    }
    const sum = covered.reduce(
      (a, t) => a + estimatePlaceCost(t.place, { travelers: 1, visitor: "yerli", hasMuzekart: false, date: t.date, fx }).amountTry,
      0,
    );
    if (plan.request.hasMuzekart) {
      return {
        worth: true,
        visits: covered.length,
        savingTry: Math.round(sum * travelers),
        message: `Müzekart'ın var: plandaki ${covered.length} müze/ören yerinde yaklaşık ${fmtInt(sum * travelers)} TL giriş ödemezsin.${outsideNote}`,
      };
    }
    const perPerson = sum - MUZEKART_PRICE_TRY;
    const savingTry = Math.round(perPerson * travelers);
    return {
      worth: perPerson > 0,
      visits: covered.length,
      savingTry,
      message:
        perPerson > 0
          ? `Müzekart al: ${covered.length} müze/ören yeri kişi başı ~${fmtInt(sum)} TL, kart ${fmtInt(MUZEKART_PRICE_TRY)} TL; ${travelers} kişi için ~${fmtInt(savingTry)} TL tasarruf.${outsideNote}`
          : `Müzekart bu plan için kârlı değil: girişler kişi başı ~${fmtInt(sum)} TL, kart ${fmtInt(MUZEKART_PRICE_TRY)} TL.${outsideNote}`,
    };
  }

  // yabancı: Museum Pass Türkiye, ilk kapsanan ziyaretten itibaren 15 gün
  if (covered.length === 0) {
    const eur = museumPassPriceEur(ticketed[0]!.date);
    return {
      worth: false,
      visits: 0,
      savingTry: -Math.round(eur * fx.tryPer.EUR * travelers),
      message: "Plandaki müze ve ören yerleri Museum Pass kapsamında görünmüyor.",
    };
  }
  const first = covered[0]!.date;
  const within = covered.filter((t) => daysBetween(first, t.date) < MUSEUM_PASS_TURKIYE_DAYS);
  const eur = museumPassPriceEur(first);
  const passTry = eur * fx.tryPer.EUR;
  const sum = within.reduce(
    (a, t) => a + estimatePlaceCost(t.place, { travelers: 1, visitor: "yabanci", date: t.date, fx }).amountTry,
    0,
  );
  const perPerson = sum - passTry;
  const savingTry = Math.round(perPerson * travelers);
  return {
    worth: perPerson > 0,
    visits: within.length,
    savingTry,
    message:
      perPerson > 0
        ? `Museum Pass Türkiye (€${eur}) kârlı: ${within.length} müze/ören yeri kişi başı ~${fmtInt(sum)} TL, kart ~${fmtInt(passTry)} TL; ${travelers} kişi için ~${fmtInt(savingTry)} TL tasarruf.${outsideNote}`
        : `Museum Pass Türkiye (€${eur}) bu plan için kârlı değil: biletler kişi başı ~${fmtInt(sum)} TL, kart ~${fmtInt(passTry)} TL.${outsideNote}`,
  };
}

// ---------------------------------------------------------------- canlı kur

/**
 * Frankfurter (ECB referans kurları; ücretsiz, anahtarsız, CORS açık). v1 uç noktası
 * "deprecation" başlığıyla v2'ye yönlendiriyor; önce v2, olmazsa v1 denenir.
 * v2 yanıtı: [{date, base, quote, rate}], v1 yanıtı: {base, date, rates: {TRY, USD}}.
 */
export const FX_SOURCES = [
  "https://api.frankfurter.dev/v2/rates?base=EUR&quotes=TRY,USD&providers=ecb",
  "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=TRY,USD",
] as const;

function parseFrankfurter(body: unknown): { date: string; eurTry: number; eurUsd: number } | null {
  let date: unknown;
  let eurTry: unknown;
  let eurUsd: unknown;
  if (Array.isArray(body)) {
    for (const r of body as Array<Record<string, unknown>>) {
      if (!r || r.base !== "EUR") continue;
      if (r.quote === "TRY") eurTry = r.rate;
      if (r.quote === "USD") eurUsd = r.rate;
      date ??= r.date;
    }
  } else if (body && typeof body === "object") {
    const b = body as { base?: unknown; date?: unknown; rates?: Record<string, unknown> };
    if (b.base !== "EUR" || !b.rates) return null;
    date = b.date;
    eurTry = b.rates.TRY;
    eurUsd = b.rates.USD;
  }
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (typeof eurTry !== "number" || typeof eurUsd !== "number") return null;
  if (!(eurTry > 0) || !(eurUsd > 0) || !Number.isFinite(eurTry) || !Number.isFinite(eurUsd)) return null;
  return { date, eurTry, eurUsd };
}

/** Canlı kur (CORS destekli kaynak); alınamazsa null — çağıran DEFAULT_FX'e düşer */
export async function fetchFxRates(fetchFn?: typeof fetch): Promise<FxRates | null> {
  const f = resolveFetch(fetchFn);
  for (const url of FX_SOURCES) {
    try {
      const res = await f(url, timeoutInit(8000));
      if (!res.ok) continue;
      const r = parseFrankfurter(await res.json());
      if (!r) continue;
      const r4 = (x: number) => Math.round(x * 10_000) / 10_000;
      return { date: r.date, source: url, tryPer: { TRY: 1, EUR: r4(r.eurTry), USD: r4(r.eurTry / r.eurUsd) } };
    } catch {
      // sonraki kaynak
    }
  }
  return null;
}
