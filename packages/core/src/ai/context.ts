// "Rehbere sor" için kompakt, modele verilecek bağlam. Yalnızca plandaki ve paketteki
// doğrulanabilir alanlar girer; model bunun dışına çıkmamakla yükümlüdür.
import type { BudgetStatus } from "../budget";
import { CATEGORIES, SLOT_LABELS } from "../catalog";
import type { PlaceIndex } from "../geo";
import { hoursSource } from "../hours";
import { formatHHmm } from "../time";
import type { TripPlan } from "../types";
import type { WeatherDay } from "../weather";

export interface GuideContextStop {
  saat: string;
  bitis: string;
  yuva: string;
  ad: string;
  kategori: string;
  durum: string;
  not?: string;
  /** OSM opening_hours; yoksa null */
  calismaSaati: string | null;
  /** false: kategori varsayılanı, gerçek veri yok */
  saatDogrulandi: boolean;
  tahminiMaliyetTry: number;
  yolDk: number;
  yolKm: number;
  kapali?: boolean;
  alkol?: boolean;
  vejetaryenDostu?: boolean;
}

export interface GuideContext {
  gezi: {
    baslik: string;
    kisi: number;
    tempo: string;
    ilgi: string[];
    ulasim: string;
    ziyaretci: string;
    beslenme: { vejetaryen: boolean; alkolsuz: boolean };
    toplamGun: number;
  };
  gun: {
    no: number;
    tarih: string;
    nereden: string;
    nereye: string;
    yolGunu: boolean;
    baslangic: string;
    bitis: string;
    duraklar: GuideContextStop[];
    konaklama?: string;
    uyarilar: string[];
    tahminiMaliyetTry: number;
  };
  /** Şu an (gün içi saat), verilirse */
  simdi?: string;
  hava?: { ozet: string; enDusukC: number; enYuksekC: number; yagmurSaatleri: string[] };
  butce?: {
    toplamTry: number;
    harcananTry: number;
    kalanTry: number;
    bugunLimitTry: number;
    bugunKalanTry: number;
    durum: string;
    oneriler: string[];
  };
}

const STATUS_TR: Record<string, string> = { planned: "planlandı", done: "yapıldı", skipped: "atlandı", closed: "kapalıydı" };

/** Planın bir gününden GuideChat için kompakt bağlam üretir */
export function buildGuideContext(
  plan: TripPlan,
  dayIndex: number,
  index: PlaceIndex,
  extra: { budget?: BudgetStatus | null; weather?: WeatherDay | null; nowMin?: number } = {},
): GuideContext {
  const day = plan.days.find((d) => d.index === dayIndex) ?? plan.days[dayIndex] ?? plan.days[0];
  const req = plan.request;
  const stops: GuideContextStop[] = (day?.stops ?? [])
    .slice()
    .sort((a, b) => a.arriveMin - b.arriveMin)
    .slice(0, 30)
    .map((s) => {
      const p = index.get(s.placeId);
      const out: GuideContextStop = {
        saat: formatHHmm(s.arriveMin),
        bitis: formatHHmm(s.departMin),
        yuva: SLOT_LABELS[s.slot],
        ad: p?.name ?? "Bilinmeyen yer",
        kategori: p ? CATEGORIES[p.cat].label : "Durak",
        durum: STATUS_TR[s.status] ?? s.status,
        calismaSaati: p?.openingHours ?? null,
        saatDogrulandi: p ? hoursSource(p) === "data" : false,
        tahminiMaliyetTry: Math.round(s.estCost),
        yolDk: Math.round(s.travelMin),
        yolKm: Math.round(s.travelKm * 10) / 10,
      };
      if (p?.note) out.not = p.note;
      if (p) {
        out.kapali = p.indoor ?? CATEGORIES[p.cat].indoor;
        if (p.alcohol !== undefined) out.alkol = p.alcohol;
        if (p.vegFriendly !== undefined) out.vejetaryenDostu = p.vegFriendly;
      }
      return out;
    });

  const hotel = day?.hotelPlaceId ? index.get(day.hotelPlaceId) : undefined;
  const ctx: GuideContext = {
    gezi: {
      baslik: req.title,
      kisi: req.travelers,
      tempo: req.pace,
      ilgi: [...req.interests],
      ulasim: req.transport,
      ziyaretci: req.visitor,
      beslenme: { vejetaryen: !!req.diet.vegetarian, alkolsuz: !!req.diet.noAlcohol },
      toplamGun: plan.days.length,
    },
    gun: {
      no: (day?.index ?? 0) + 1,
      tarih: day?.date ?? req.startDate,
      nereden: day?.from.name ?? "",
      nereye: day?.to.name ?? "",
      yolGunu: !!day?.isTravelDay,
      baslangic: formatHHmm(day?.startMin ?? 0),
      bitis: formatHHmm(day?.endMin ?? 0),
      duraklar: stops,
      uyarilar: [...(day?.warnings ?? [])],
      tahminiMaliyetTry: Math.round(day?.estCost ?? 0),
    },
  };
  if (hotel) ctx.gun.konaklama = hotel.name;
  if (extra.nowMin !== undefined) ctx.simdi = formatHHmm(extra.nowMin);
  const w = extra.weather;
  if (w && day && w.date === day.date) {
    ctx.hava = {
      ozet: w.summary,
      enDusukC: Math.round(w.tMinC),
      enYuksekC: Math.round(w.tMaxC),
      yagmurSaatleri: w.rainWindows.map(([s, e]) => `${formatHHmm(s)}–${formatHHmm(e)}`),
    };
  }
  const b = extra.budget;
  if (b) {
    ctx.butce = {
      toplamTry: Math.round(b.totalTry),
      harcananTry: Math.round(b.spentTry),
      kalanTry: Math.round(b.remainingTry),
      bugunLimitTry: Math.round(b.dailyLimitTry),
      bugunKalanTry: Math.round(b.todayLeftTry),
      durum: b.status,
      oneriler: b.messages.slice(0, 4),
    };
  }
  return ctx;
}
