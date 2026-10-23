import { useEffect, useMemo, useState } from "react";
import { toTrWallClock, type TripPlan } from "@rota/core";
import { usePack } from "./pack";
import { useTrip } from "./trip";

/** Planın paketini (yoksa) yükler; plan ve indeks döner */
export function usePlanData() {
  const plan = useTrip((s) => s.plan);
  const pack = usePack((s) => s.pack);
  const index = usePack((s) => s.index);
  const status = usePack((s) => s.status);
  const ensurePack = usePack((s) => s.ensurePack);
  useEffect(() => {
    if (plan && pack?.id !== plan.packId) void ensurePack(plan.packId);
  }, [plan, pack?.id, ensurePack]);
  const indexReady = !!index && (!plan || pack?.id === plan.packId || usePack.getState().fellBackToSample);
  return { plan, pack, index: indexReady ? index : null, packStatus: status };
}

/** Türkiye saatine göre bugünün tarihi; dakikada bir tazelenir */
export function useTodayDate(): string {
  const [d, setD] = useState(() => toTrWallClock(new Date()).date);
  useEffect(() => {
    const t = window.setInterval(() => setD(toTrWallClock(new Date()).date), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return d;
}

/** Gezi bugünü kapsıyorsa bugünün gün indeksi */
export function useTodayIndex(plan: TripPlan | null): number | null {
  const today = useTodayDate();
  return useMemo(() => {
    if (!plan) return null;
    const i = plan.days.findIndex((d) => d.date === today);
    return i >= 0 ? i : null;
  }, [plan, today]);
}

/** Gezi bugün sürüyorsa bugünü, değilse kullanıcının seçtiği günü kullan (bir kez hizalar) */
export function useActiveDay(): [number, (i: number) => void] {
  const plan = useTrip((s) => s.plan);
  const selected = useTrip((s) => s.selectedDay);
  const setSelected = useTrip((s) => s.setSelectedDay);
  const todayIdx = useTodayIndex(plan);
  const [aligned, setAligned] = useState(false);
  useEffect(() => {
    if (!aligned && todayIdx !== null) {
      setSelected(todayIdx);
      setAligned(true);
    }
  }, [aligned, todayIdx, setSelected]);
  const max = Math.max(0, (plan?.days.length ?? 1) - 1);
  return [Math.min(selected, max), setSelected];
}
