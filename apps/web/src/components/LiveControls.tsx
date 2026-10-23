// Canlı mod (gerçek GPS) ve Simülasyon (masaüstü demo) anahtarları.
import { Pause, Play, Radio, Route, Square } from "lucide-react";
import { formatHHmm, toTrWallClock } from "@rota/core";
import { fmtKm } from "../lib/format";
import { notificationPermission, requestNotificationPermission } from "../lib/notify";
import { SIM_MULTIPLIERS, pauseSimulation, setSimMultiplier, startSimulation, stopSimulation } from "../lib/simulation";
import { usePack } from "../state/pack";
import { useTrip } from "../state/trip";
import { toast, useUi } from "../state/ui";
import { Bar, Card, Chip, IconButton, Toggle, cx } from "./ui";

async function askNotifications() {
  if (notificationPermission() === "default") {
    const p = await requestNotificationPermission();
    if (p === "denied") toast({ kind: "info", title: "Bildirim izni verilmedi", body: "Keşifler yine de uygulama içinde kart olarak görünür." });
  }
}

export function LiveControls({ dayIndex, className }: { dayIndex: number; className?: string }) {
  const live = useUi((s) => s.live);
  const liveError = useUi((s) => s.liveError);
  const sim = useUi((s) => s.sim);
  const setLive = useUi((s) => s.setLive);
  const plan = useTrip((s) => s.plan);
  const index = usePack((s) => s.index);
  const day = plan?.days[dayIndex];

  function toggleLive(on: boolean) {
    if (on) {
      void askNotifications();
      if (sim) stopSimulation();
    }
    setLive(on);
  }

  function toggleSim(on: boolean) {
    if (!on) {
      stopSimulation();
      return;
    }
    if (!plan || !day) {
      toast({ kind: "info", title: "Önce bir plan gerekli", body: "Simülasyon, günün rotası boyunca ilerler." });
      return;
    }
    void askNotifications();
    try {
      startSimulation(day, index, plan.request.transport);
      toast({
        kind: "info",
        title: `Simülasyon başladı · ${dayIndex + 1}. gün`,
        body: day.route ? "Sahte konum günün rotasında hızlandırılmış ilerliyor." : "Sahte konum duraklar arasında ilerliyor.",
      });
    } catch (e) {
      toast({ kind: "error", title: "Simülasyon başlatılamadı", body: e instanceof Error ? e.message : String(e) });
    }
  }

  const clock = sim ? formatHHmm(toTrWallClock(new Date(sim.clock)).min) : null;

  return (
    <Card className={cx("p-4", className)}>
      <div className="grid gap-1 sm:grid-cols-2 sm:gap-6">
        <Toggle
          checked={live}
          onChange={toggleLive}
          icon={
            <span className={cx("grid size-10 shrink-0 place-items-center rounded-2xl", live ? "bg-good-soft text-good" : "bg-surface-2 text-muted")}>
              <Radio className="size-5" aria-hidden />
            </span>
          }
          label="Canlı mod"
          description={live ? "Konumun izleniyor · yakındaki değerli yerler bildirilir" : "GPS ile yol üstü keşif bildirimleri"}
        />
        <Toggle
          checked={!!sim}
          onChange={toggleSim}
          icon={
            <span className={cx("grid size-10 shrink-0 place-items-center rounded-2xl", sim ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted")}>
              <Route className="size-5" aria-hidden />
            </span>
          }
          label="Simülasyon"
          description={sim ? `${sim.dayIndex + 1}. gün rotası · ×${sim.multiplier} hız` : "Masaüstünde demo: sahte konum rotada ilerler"}
        />
      </div>
      {liveError && <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{liveError}</p>}
      {sim && (
        <div className="mt-3 rounded-2xl bg-surface-2 p-3">
          <div className="flex items-center gap-2">
            <IconButton label={sim.running ? "Duraklat" : "Devam et"} className="size-10 bg-surface" onClick={() => pauseSimulation(sim.running)}>
              {sim.running ? <Pause className="size-4" /> : <Play className="size-4" />}
            </IconButton>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between text-xs font-semibold text-muted tabular">
                <span>Sanal saat {clock}</span>
                <span>
                  {fmtKm(sim.progressKm)} / {fmtKm(sim.totalKm)}
                </span>
              </div>
              <Bar value={sim.progressKm} max={sim.totalKm} tone="brand" className="mt-1.5" label="Simülasyon ilerlemesi" />
            </div>
            <IconButton label="Simülasyonu durdur" className="size-10 bg-surface" onClick={() => stopSimulation()}>
              <Square className="size-4" />
            </IconButton>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-muted">Hız</span>
            {SIM_MULTIPLIERS.map((m) => (
              <Chip key={m} selected={sim.multiplier === m} onClick={() => setSimMultiplier(m)} className="min-h-8 px-2.5 text-xs">
                ×{m}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
