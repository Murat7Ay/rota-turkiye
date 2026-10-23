// Plan onarımı: gün baştan yazılmaz; yapılmış duraklar kilitlenir, kalan gün aynı çözücüyle
// şu anki konum ve saatten yeniden çözülür, birbirinden farklı 2–3 seçenek döner.
import { SLOT_LABELS, SLOT_WINDOWS } from "./catalog";
import type { Interval } from "./hours";
import { DEFAULT_FX, toTry } from "./pricing";
import { planDay } from "./solver";
import type { DayInput, PlanContext, TimedSlot } from "./solver";
import { formatHHmm } from "./time";
import type { DayPlan, LatLng, PlanStop, Slot, StopStatus, TripPlan } from "./types";

export type RepairEvent =
  | { type: "skip"; stopId: string }
  | { type: "closed"; stopId: string }
  | { type: "late"; minutes: number }
  | { type: "rain"; fromMin: number; toMin: number }
  | { type: "overBudget"; overTry: number }
  | { type: "missedMeal"; slot: Slot }
  /** Kullanıcı bir durağı alternatifleriyle değiştirdi */
  | { type: "swap"; stopId: string; placeId: string };

export interface RepairState {
  /** Şu an, gün içi dakika (Türkiye saati) */
  nowMin: number;
  /** Bilinen son konum; yoksa son tamamlanan durak ya da günün başlangıcı */
  position?: LatLng;
}

export interface RepairOption {
  id: string;
  /** Kısa başlık: "Y yerine Z", "Y'yi çıkar, güne devam" */
  label: string;
  /** Türkçe açıklama (şablon; LLM opsiyonel) */
  description: string;
  day: DayPlan;
  /** İnsan okunur değişiklik listesi */
  changes: string[];
  /** Orijinal planın korunan durak oranı (0..1) */
  keptRatio: number;
}

/** Öğün kaçtıysa ve penceresi geçtiyse uzatılmış "geç" pencere sonu */
const LATE_WINDOW_END: Record<TimedSlot, number> = {
  kahvalti: 12 * 60,
  ogle: 16 * 60 + 30,
  aksam: 23 * 60,
  cay: 20 * 60,
  tatli: 23 * 60,
  alisveris: 20 * 60 + 30,
};

const lower = (s: string) => s.toLocaleLowerCase("tr");
const byArrive = (a: PlanStop, b: PlanStop) => a.arriveMin - b.arriveMin;

export function repairDay(
  plan: TripPlan,
  dayIndex: number,
  event: RepairEvent,
  state: RepairState,
  ctx: PlanContext,
): RepairOption[] {
  const day = plan.days[dayIndex];
  if (!day) throw new Error(`repairDay: ${dayIndex}. gün planda yok`);
  const req = plan.request;
  const nowMin = state.nowMin;
  const name = (placeId: string) => ctx.index.get(placeId)?.name ?? placeId;

  const eventStopId = event.type === "skip" || event.type === "closed" || event.type === "swap" ? event.stopId : undefined;
  const eventStop = eventStopId ? day.stops.find((s) => s.id === eventStopId) : undefined;
  if (eventStopId && !eventStop) throw new Error(`repairDay: durak bulunamadı (${eventStopId})`);
  if (eventStop?.slot === "konaklama") throw new Error("repairDay: konaklama durağı atlanamaz");

  // ---- kilitli (yapılmış/geçmiş/süren), geçmiş kayıtlar (atlandı/kapalı) ve kalan planlı duraklar
  const locked: PlanStop[] = [];
  const history: PlanStop[] = [];
  const pending: PlanStop[] = [];
  for (const s of day.stops) {
    if (s.slot === "konaklama" || s === eventStop) continue;
    if (s.status === "done" || s.locked) locked.push(s);
    else if (s.status === "skipped" || s.status === "closed") history.push(s);
    else if (event.type === "missedMeal" && s.slot === event.slot) continue; // kaçan öğün yeniden çözülür
    else if (s.arriveMin < nowMin) locked.push(s); // başlamış ya da geçmişte kalmış
    else pending.push(s);
  }
  if (eventStop && event.type !== "swap") {
    const { locked: _wasLocked, ...rest } = eventStop;
    history.push({ ...rest, status: event.type === "closed" ? "closed" : "skipped" });
  }
  locked.sort(byArrive);
  pending.sort(byArrive);
  const last = locked[locked.length - 1];
  const hotelStop = day.stops.find((s) => s.slot === "konaklama");

  const position = state.position ?? (last ? ctx.index.get(last.placeId)?.loc : undefined) ?? day.from.loc;
  let readyMin = Math.max(nowMin, day.startMin, last ? last.departMin : -Infinity);
  if (event.type === "late") {
    const next = pending[0] ?? hotelStop;
    const anchor = last ? last.departMin : next ? next.arriveMin - next.travelMin : day.startMin;
    readyMin = Math.max(readyMin, anchor + event.minutes);
  }

  // ---- yasaklar: gezinin her yerinde "kapalı" işaretlenenler + bu günün atlananları
  const ban = new Set<string>();
  plan.days.forEach((d) => d.stops.forEach((s) => s.status === "closed" && ban.add(s.placeId)));
  for (const s of history) ban.add(s.placeId);
  if (event.type === "swap") ban.add(eventStop!.placeId);
  const exclude = new Set<string>();
  plan.days.forEach((d, i) => {
    if (i !== dayIndex) for (const s of d.stops) if (s.slot !== "konaklama") exclude.add(s.placeId);
  });

  const lodging = plan.days.reduce((sum, d) => sum + d.stops.filter((s) => s.slot === "konaklama").reduce((a, s) => a + s.estCost, 0), 0);
  const dailyBudgetTry = Math.max(0, toTry(req.budget, ctx.fx ?? DEFAULT_FX) - lodging) / Math.max(1, plan.days.length);
  const pendingIds = new Set(pending.map((s) => s.placeId));
  const preferSlots = new Map(pending.map((s) => [s.placeId, s.slot]));
  if (event.type === "swap") {
    pendingIds.add(event.placeId);
    preferSlots.set(event.placeId, eventStop!.slot);
  }

  const base: DayInput = {
    index: day.index,
    date: day.date,
    from: { name: "Şu anki konum", loc: position },
    to: day.to,
    stayId: day.stayId,
    hotelPlaceId: day.hotelPlaceId,
    startMin: readyMin,
    endMin: day.endMin,
    pace: req.pace,
    interests: req.interests,
    travelers: req.travelers,
    visitor: req.visitor,
    hasMuzekart: req.hasMuzekart,
    diet: req.diet,
    dailyBudgetTry,
    budgetPressure: 0,
    excludePlaceIds: exclude,
    banPlaceIds: ban,
    locked,
    preferPlaceIds: pendingIds,
    preferSlots,
    route: day.route,
  };

  const lockedIds = new Set(locked.map((s) => s.id));
  const solve = (mod: Partial<DayInput>): DayPlan => {
    const solved = planDay({ ...base, ...mod }, ctx);
    const keptLocked = solved.stops.filter((s) => lockedIds.has(s.id));
    const fresh = solved.stops.filter((s) => !lockedIds.has(s.id));
    const { route: _route, ...rest } = solved;
    return {
      ...rest,
      from: day.from,
      isTravelDay: day.isTravelDay,
      startMin: day.startMin,
      stops: [...keptLocked, ...history, ...fresh],
      ...(day.route ? { route: day.route } : {}),
    };
  };
  const newPlanned = (d: DayPlan) => d.stops.filter((s) => s.status === "planned" && s.slot !== "konaklama" && !lockedIds.has(s.id));
  /** Yuvaya yeni gelen yer (başka yuvadan kaydırılmış olabilir: akşamki restoran öğleye gibi) */
  const replacementIn = (d: DayPlan, slot: Slot) =>
    newPlanned(d).find((s) => s.slot === slot && !pending.some((p) => p.placeId === s.placeId && p.slot === slot));

  // ---- değişiklik listesi ve korunma oranı
  const eventLine = (() => {
    switch (event.type) {
      case "skip":
        return `${name(eventStop!.placeId)} atlandı`;
      case "closed":
        return `${name(eventStop!.placeId)} kapalı; gezinin geri kalanında önerilmeyecek`;
      case "late":
        return `${event.minutes} dk gecikme`;
      case "rain":
        return `Yağış bekleniyor: ${formatHHmm(event.fromMin)}–${formatHHmm(event.toMin)}`;
      case "overBudget":
        return `Bütçe aşımı: ${Math.round(event.overTry)} TL`;
      case "missedMeal":
        return `${SLOT_LABELS[event.slot]} kaçırıldı`;
      case "swap":
        return `${name(eventStop!.placeId)} yerine ${name(event.placeId)} seçildi`;
    }
  })();
  const originalRemaining = pending.length + (eventStop ? 1 : 0);
  const changesOf = (d: DayPlan): { changes: string[]; keptRatio: number } => {
    const np = newPlanned(d);
    const npIds = new Set(np.map((s) => s.placeId));
    const changes = [eventLine];
    for (const s of pending) if (!npIds.has(s.placeId)) changes.push(`${name(s.placeId)} çıkarıldı`);
    for (const s of np) {
      const old = pending.find((p) => p.placeId === s.placeId);
      if (!old) changes.push(`${name(s.placeId)} eklendi (${SLOT_LABELS[s.slot]}, ${formatHHmm(s.arriveMin)})`);
      else if (old.slot !== s.slot) changes.push(`${name(s.placeId)}: ${lower(SLOT_LABELS[old.slot])} yerine ${lower(SLOT_LABELS[s.slot])} (${formatHHmm(s.arriveMin)})`);
      else if (Math.abs(old.arriveMin - s.arriveMin) >= 10) changes.push(`${name(s.placeId)}: ${formatHHmm(old.arriveMin)} → ${formatHHmm(s.arriveMin)}`);
    }
    const newHotel = d.stops.find((s) => s.slot === "konaklama");
    if (hotelStop && newHotel && Math.abs(newHotel.arriveMin - hotelStop.arriveMin) >= 15) {
      changes.push(`Konaklamaya varış: ${formatHHmm(hotelStop.arriveMin)} → ${formatHHmm(newHotel.arriveMin)}`);
    }
    const kept = pending.filter((s) => npIds.has(s.placeId)).length;
    return { changes, keptRatio: originalRemaining > 0 ? Math.round((kept / originalRemaining) * 100) / 100 : 1 };
  };

  const options: RepairOption[] = [];
  const seen = new Set<string>();
  const add = (key: string, d: DayPlan, label: string, description: string): boolean => {
    const sig = newPlanned(d)
      .map((s) => `${s.slot}:${s.placeId}`)
      .sort()
      .join("|");
    if (seen.has(sig) || options.length >= 3) return false;
    seen.add(sig);
    const diff = changesOf(d);
    // Kalan plan hiç değişmediyse başlık bunu açıkça söylesin
    const unchanged = !eventStop && diff.changes.length === 1 && diff.keptRatio === 1;
    options.push({
      id: `${day.index}-${event.type}-${key}`,
      label: unchanged ? "Planı olduğu gibi sürdür" : label,
      description: unchanged ? "Kalan plan bu duruma zaten uygun; değişiklik gerekmiyor." : description,
      day: d,
      ...diff,
    });
    return true;
  };

  const part = readyMin >= 17 * 60 ? "akşam" : readyMin >= 12 * 60 ? "öğleden sonra" : "gün";

  switch (event.type) {
    case "swap": {
      const x = name(eventStop!.placeId);
      const y = name(event.placeId);
      const d1 = solve({ onlyPlaceIds: pendingIds });
      const ok = newPlanned(d1).some((s) => s.placeId === event.placeId);
      add(
        "takas",
        d1,
        ok ? `${x} yerine ${y}` : `${y} bugüne sığmıyor`,
        ok ? `${y} eklendi; diğer duraklar korunup saatleri kaydırıldı.` : `${y} çalışma saatleri ya da yol süresi nedeniyle bugüne sığmadı; kalan plan korunuyor.`,
      );
      add("yeniden", solve({}), "Kalan günü buna göre düzenle", `${y} öncelikli; kalan gün şu anki konumdan yeniden planlandı.`);
      break;
    }
    case "skip":
    case "closed": {
      const stop = eventStop!;
      const x = name(stop.placeId);
      const slotName = lower(SLOT_LABELS[stop.slot]);
      const intro = event.type === "closed" ? `${x} kapalıydı; gezinin geri kalanında önerilmeyecek.` : `${x} atlandı.`;
      const d1 = solve({});
      const z = replacementIn(d1, stop.slot);
      add(
        "degistir",
        d1,
        z ? `${x} yerine ${name(z.placeId)}` : `${x} olmadan devam`,
        z
          ? `${intro} ${SLOT_LABELS[stop.slot]} için ${name(z.placeId)} öneriliyor; planın geri kalanı mümkün olduğunca korunuyor.`
          : `${intro} Yerine uygun ve açık bir ${slotName} seçeneği yok; kalan gün buna göre düzenlendi.`,
      );
      add(
        "cikar",
        solve({ onlyPlaceIds: pendingIds, skipSlots: stop.slot === "gezi" ? [] : [stop.slot] }),
        `${x} olmadan devam`,
        stop.slot === "gezi"
          ? `${intro} Yeni yer eklenmez; kalan duraklar saatlerine göre kaydırılır.`
          : `${intro} ${SLOT_LABELS[stop.slot]} bugün atlanır; yeni yer eklenmez, kalan duraklar saatlerine göre kaydırılır.`,
      );
      if (z) {
        const d3 = solve({ banPlaceIds: new Set([...ban, z.placeId]) });
        const w = replacementIn(d3, stop.slot);
        if (w) add("alternatif", d3, `${x} yerine ${name(w.placeId)}`, `${intro} ${SLOT_LABELS[stop.slot]} için başka bir seçenek: ${name(w.placeId)}.`);
      }
      break;
    }
    case "late": {
      const m = event.minutes;
      add(
        "kaydir",
        solve({ onlyPlaceIds: pendingIds }),
        `Programı ${m} dk kaydır`,
        `Yeni yer eklenmez; kalan duraklar ${m} dk gecikmeye göre ileri alınır, sığmayan en düşük öncelikli durak çıkarılır.`,
      );
      add("yeniden", solve({}), "Kalan günü yeniden düzenle", "Gecikmeye göre kalan gün şu anki konumdan yeniden planlandı; uyan duraklar korunur.");
      break;
    }
    case "rain": {
      const rain: Interval[] = [[event.fromMin, event.toMin]];
      const span = `${formatHHmm(event.fromMin)}–${formatHHmm(event.toMin)}`;
      add("kapali", solve({ rainWindows: rain }), "Yağmura göre düzenle", `${span} arası yağış bekleniyor; bu saatlerde kapalı mekânlar öne alındı.`);
      add(
        "koru",
        solve({ rainWindows: rain, onlyPlaceIds: pendingIds }),
        "Planı koru, açık havayı kaydır",
        "Yeni yer eklenmez; açık hava durakları yağmur dışındaki saatlere alınır, sığmayan çıkarılır.",
      );
      add("yeni", solve({ rainWindows: rain, preferPlaceIds: new Set() }), "Yağmura göre yeni öneriler", `${span} için kapalı alanlara ağırlık veren yeni bir düzen.`);
      break;
    }
    case "overBudget": {
      const pressure = Math.min(1, Math.max(0, 0.4 + event.overTry / Math.max(1, dailyBudgetTry)));
      add("ekonomik", solve({ budgetPressure: pressure }), "Daha ekonomik seçenekler", "Kalan duraklarda daha uygun fiyatlı yerler seçildi.");
      add(
        "molalar",
        solve({ budgetPressure: pressure, skipSlots: ["cay", "tatli", "alisveris"] }),
        "Ekstra molaları atla",
        "Çay, tatlı ve alışveriş molaları çıkarıldı; öğünler ve geziler korunur.",
      );
      add("sakin", solve({ budgetPressure: 1, pace: "sakin", preferPlaceIds: new Set() }), `Sakin ve ucuz bir ${part}`, "Daha az ücretli durak, en uygun fiyatlı öğünler.");
      break;
    }
    case "missedMeal": {
      const slot = event.slot;
      if (slot === "gezi" || slot === "konaklama") {
        add("yeniden", solve({}), "Kalan günü yeniden düzenle", "Kalan gün şu anki konumdan yeniden planlandı.");
        break;
      }
      const label = SLOT_LABELS[slot];
      const w = SLOT_WINDOWS[slot];
      if (readyMin + 15 <= w[1]) {
        const d1 = solve({ requireSlots: [slot] });
        const z = newPlanned(d1).find((s) => s.slot === slot);
        add(
          "telafi",
          d1,
          z ? `${label}: ${name(z.placeId)}` : "Kalan günü yeniden düzenle",
          z ? `${label} için vakit var (son varış ${formatHHmm(w[1])}); ${name(z.placeId)} eklendi.` : "Kalan gün yeniden düzenlendi.",
        );
        if (z) {
          const d2 = solve({ requireSlots: [slot], banPlaceIds: new Set([...ban, z.placeId]) });
          const y = newPlanned(d2).find((s) => s.slot === slot);
          if (y) add("telafi-alt", d2, `${label}: ${name(y.placeId)}`, `${label} için başka bir seçenek: ${name(y.placeId)}.`);
        }
      } else {
        const lateWin: Partial<Record<TimedSlot, [number, number]>> = {};
        lateWin[slot] = [w[0], Math.max(w[1], LATE_WINDOW_END[slot])];
        const d1 = solve({ requireSlots: [slot], slotWindows: lateWin });
        const z = newPlanned(d1).find((s) => s.slot === slot);
        if (z) add("gec", d1, `Geç ${lower(label)}: ${name(z.placeId)}`, `${label} saati geçti ama ${name(z.placeId)} hâlâ uygun; kısa ve geç bir öğün.`);
        const next: { slot: TimedSlot; win: [number, number]; label: string } | undefined =
          slot === "kahvalti"
            ? { slot: "ogle", win: [11 * 60, SLOT_WINDOWS.ogle[1]], label: "Erken öğle yemeği" }
            : slot === "ogle"
              ? { slot: "aksam", win: [17 * 60 + 30, SLOT_WINDOWS.aksam[1]], label: "Akşam yemeğini öne çek" }
              : slot === "aksam"
                ? { slot: "tatli", win: [Math.max(readyMin, SLOT_WINDOWS.tatli[0]), 23 * 60], label: "Tatlıyla kapat" }
                : undefined;
        if (next) {
          const nw: Partial<Record<TimedSlot, [number, number]>> = {};
          nw[next.slot] = next.win;
          add("sonraki", solve({ requireSlots: [next.slot], slotWindows: nw }), next.label, `${label} kaçtı; bir sonraki öğün öne alındı.`);
        }
        const snack: Partial<Record<TimedSlot, [number, number]>> = { cay: [readyMin, readyMin + 150] };
        add("ara", solve({ requireSlots: ["cay"], slotWindows: snack }), "Ara öğün: çay molası", `${label} yerine yakında kısa bir çay-simit molası.`);
      }
      break;
    }
  }

  // ---- yedek seçenekler: en az 2, en çok 3 farklı seçenek
  if (options.length < 3) {
    add("sakin", solve({ pace: "sakin" }), `Daha sakin bir ${part}`, "Daha az durak ve daha uzun molalarla otele erken varış.");
  }
  if (options.length < 2) {
    add("yemekler", solve({ maxGezi: 0, skipSlots: ["cay", "tatli", "alisveris"] }), "Sadece öğünler", "Geziler çıkarıldı; yalnızca kalan öğünler ve konaklama.");
  }
  if (options.length < 2) {
    add("bitir", solve({ onlyPlaceIds: new Set() }), "Günü burada bitir", "Kalan bütün duraklar (öğünler dahil) iptal edilir; doğrudan konaklamaya dönülür.");
  }
  return options;
}

function recount(plan: TripPlan, days: DayPlan[]): TripPlan {
  return {
    ...plan,
    days,
    estTotal: Math.round(days.reduce((sum, d) => sum + d.estCost, 0)),
    version: plan.version + 1,
  };
}

/** Seçilen onarımı plana uygular, plan.version'ı artırır (değiştirmeden yeni nesne döner) */
export function applyRepair(plan: TripPlan, dayIndex: number, option: RepairOption): TripPlan {
  if (!plan.days[dayIndex]) throw new Error(`applyRepair: ${dayIndex}. gün planda yok`);
  return recount(
    plan,
    plan.days.map((d, i) => (i === dayIndex ? option.day : d)),
  );
}

/** Bir durağın durumunu değiştirir (yapıldı/atlandı/kapalıydı); done olanlar kilitlenir */
export function markStop(plan: TripPlan, dayIndex: number, stopId: string, status: StopStatus): TripPlan {
  const day = plan.days[dayIndex];
  if (!day) throw new Error(`markStop: ${dayIndex}. gün planda yok`);
  if (!day.stops.some((s) => s.id === stopId)) throw new Error(`markStop: durak bulunamadı (${stopId})`);
  const stops = day.stops.map((s) => {
    if (s.id !== stopId) return s;
    const { locked: wasLocked, ...rest } = s;
    if (status === "done") return { ...rest, status, locked: true };
    if (status === "planned" && wasLocked) return { ...rest, status, locked: true };
    return { ...rest, status };
  });
  return recount(
    plan,
    plan.days.map((d, i) => (i === dayIndex ? { ...d, stops } : d)),
  );
}
