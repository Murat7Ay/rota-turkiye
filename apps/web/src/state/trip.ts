// Gezi durumu: taslak istek, plan, harcamalar, seçili gün, bildirim sayaçları, kur.
// IndexedDB'ye kalıcı yazılır.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  EMPTY_PROXIMITY_STATE,
  toTrWallClock,
  type Expense,
  type FxRates,
  type Interest,
  type NamedPoint,
  type Pace,
  type ProximityState,
  type Stay,
  type TransportMode,
  type TripPlan,
  type TripRequest,
  type Visitor,
} from "@rota/core";
import { idbStorage } from "./persist";

export interface TripDraft {
  packId: string | null;
  title: string;
  startDate: string;
  start: (NamedPoint & { id?: string }) | null;
  stays: Stay[];
  end: (NamedPoint & { id?: string }) | null;
  travelers: number;
  pace: Pace;
  interests: Interest[];
  budgetTry: number;
  transport: TransportMode;
  dayStart: string;
  dayEnd: string;
  diet: { vegetarian?: boolean; noAlcohol?: boolean };
  visitor: Visitor;
  hasMuzekart: boolean;
}

export const todayTr = () => toTrWallClock(new Date()).date;

export function emptyDraft(): TripDraft {
  return {
    packId: null,
    title: "",
    startDate: todayTr(),
    start: null,
    stays: [],
    end: null,
    travelers: 2,
    pace: "dengeli",
    interests: ["tarih", "yemek", "tatli"],
    budgetTry: 30000,
    transport: "araba",
    dayStart: "08:30",
    dayEnd: "22:00",
    diet: {},
    visitor: "yerli",
    hasMuzekart: false,
  };
}

export function draftToRequest(d: TripDraft): TripRequest {
  if (!d.start) throw new Error("Başlangıç noktası seçilmedi.");
  const nights = d.stays.reduce((n, s) => n + s.nights, 0);
  const firstStay = d.stays[0]?.name ?? d.start.name;
  return {
    title: d.title.trim() || `${firstStay} gezisi · ${nights} gece`,
    startDate: d.startDate,
    start: { name: d.start.name, loc: d.start.loc },
    stays: d.stays.map((s) => ({ ...s })),
    end: d.end ? { name: d.end.name, loc: d.end.loc } : undefined,
    travelers: d.travelers,
    pace: d.pace,
    interests: [...d.interests],
    budget: { amount: d.budgetTry, currency: "TRY" },
    transport: d.transport,
    dayStart: d.dayStart,
    dayEnd: d.dayEnd,
    diet: { ...d.diet },
    visitor: d.visitor,
    hasMuzekart: d.visitor === "yerli" ? d.hasMuzekart : false,
  };
}

interface TripState {
  hydrated: boolean;
  draft: TripDraft;
  plan: TripPlan | null;
  /** Plan örnek (test) veriden mi geldi */
  planIsSample: boolean;
  /** Önceki sürüm (geri al) */
  previousPlan: TripPlan | null;
  expenses: Expense[];
  selectedDay: number;
  proximity: ProximityState;
  fx: FxRates | null;
  setDraft: (patch: Partial<TripDraft>) => void;
  resetDraft: () => void;
  setPlan: (plan: TripPlan | null, opts?: { sample?: boolean; keepPrevious?: boolean }) => void;
  undoPlan: () => void;
  setSelectedDay: (i: number) => void;
  addExpense: (e: Expense) => void;
  removeExpense: (id: string) => Expense | undefined;
  restoreExpense: (e: Expense) => void;
  setProximity: (s: ProximityState) => void;
  setFx: (fx: FxRates) => void;
  importAll: (data: { plan?: TripPlan | null; expenses?: Expense[]; draft?: TripDraft }) => void;
  clearTrip: () => void;
}

export const useTrip = create<TripState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      draft: emptyDraft(),
      plan: null,
      planIsSample: false,
      previousPlan: null,
      expenses: [],
      selectedDay: 0,
      proximity: { ...EMPTY_PROXIMITY_STATE },
      fx: null,
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      resetDraft: () => set({ draft: emptyDraft() }),
      setPlan: (plan, opts) =>
        set((s) => {
          const sameTrip = plan && s.plan && plan.id === s.plan.id;
          return {
            plan,
            planIsSample: plan ? (opts?.sample ?? (sameTrip ? s.planIsSample : false)) : false,
            previousPlan: opts?.keepPrevious ? s.plan : null,
            selectedDay: sameTrip ? Math.min(s.selectedDay, Math.max(0, (plan?.days.length ?? 1) - 1)) : 0,
            // Yeni gezi: harcamalar ve bildirim sayaçları sıfırlanır
            expenses: sameTrip || !plan ? s.expenses : s.expenses.filter((e) => e.tripId === plan.id),
            proximity: sameTrip ? s.proximity : { ...EMPTY_PROXIMITY_STATE, notified: {} },
          };
        }),
      undoPlan: () => {
        const prev = get().previousPlan;
        if (prev) set({ plan: prev, previousPlan: null });
      },
      setSelectedDay: (selectedDay) => set({ selectedDay }),
      addExpense: (e) => set((s) => ({ expenses: [e, ...s.expenses] })),
      removeExpense: (id) => {
        const e = get().expenses.find((x) => x.id === id);
        set((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) }));
        return e;
      },
      restoreExpense: (e) =>
        set((s) => ({ expenses: [e, ...s.expenses].sort((a, b) => b.at.localeCompare(a.at)) })),
      setProximity: (proximity) => set({ proximity }),
      setFx: (fx) => set({ fx }),
      importAll: (data) =>
        set((s) => ({
          plan: data.plan ?? null,
          planIsSample: false,
          previousPlan: null,
          expenses: data.expenses ?? [],
          draft: data.draft ? { ...emptyDraft(), ...data.draft } : s.draft,
          selectedDay: 0,
          proximity: { ...EMPTY_PROXIMITY_STATE, notified: {} },
        })),
      clearTrip: () =>
        set({
          draft: emptyDraft(),
          plan: null,
          planIsSample: false,
          previousPlan: null,
          expenses: [],
          selectedDay: 0,
          proximity: { ...EMPTY_PROXIMITY_STATE, notified: {} },
        }),
    }),
    {
      name: "rota-trip",
      version: 1,
      storage: idbStorage,
      partialize: (s) => ({
        draft: s.draft,
        plan: s.plan,
        planIsSample: s.planIsSample,
        expenses: s.expenses,
        selectedDay: s.selectedDay,
        proximity: s.proximity,
        fx: s.fx,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TripState>;
        return { ...current, ...p, draft: { ...emptyDraft(), ...(p.draft ?? {}) } };
      },
      onRehydrateStorage: () => () => {
        useTrip.setState({ hydrated: true });
      },
    },
  ),
);
