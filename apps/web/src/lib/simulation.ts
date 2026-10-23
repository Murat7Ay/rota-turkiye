// Simülasyon: masaüstünde demo için günün rotası (ya da duraklar arası çizgi) boyunca
// hızlandırılmış sahte bir konum yürütür. Sanal saat de aynı çarpanla ilerler; böylece
// yakınlık bildirimlerinin bekleme süreleri ve sessiz saatleri gerçekçi davranır.
import {
  bearingDeg,
  fromTrWallClock,
  lineLengthKm,
  pointAlongLine,
  type DayPlan,
  type LonLat,
  type PlaceIndex,
  type TransportMode,
} from "@rota/core";
import { simulationPath } from "./geo";
import { newSimProximity, useUi } from "../state/ui";

let path: LonLat[] = [];

export const SIM_MULTIPLIERS = [15, 60, 180, 600] as const;

export function simPath(): LonLat[] {
  return path;
}

function baseSpeed(mode: TransportMode): number {
  return mode === "yuruyus" ? 4.5 : mode === "toplu" ? 35 : 80;
}

export function startSimulation(day: DayPlan, index: PlaceIndex | null, mode: TransportMode, multiplier?: number) {
  path = simulationPath(day, index);
  const totalKm = lineLengthKm(path);
  if (path.length < 2 || totalKm < 0.05) throw new Error("Bu gün için simüle edilecek bir yol yok.");
  const speedKmh = day.route ? baseSpeed(mode) : mode === "araba" ? 35 : baseSpeed(mode);
  const m = multiplier ?? (speedKmh < 10 ? 60 : 180);
  const ui = useUi.getState();
  ui.setLive(false);
  ui.setSim({
    running: true,
    dayIndex: day.index,
    multiplier: m,
    speedKmh,
    totalKm,
    progressKm: 0,
    clock: fromTrWallClock(day.date, day.startMin).getTime(),
    proximity: newSimProximity(),
  });
  const start = pointAlongLine(path, 0);
  const ahead = pointAlongLine(path, Math.min(totalKm, 0.05));
  ui.setPosition({ loc: start, source: "sim", headingDeg: bearingDeg(start, ahead), speedKmh, at: Date.now() });
}

/** dtMs gerçek zaman geçtiğinde simülasyonu ilerletir; bitti mi döner */
export function tickSimulation(dtMs: number): boolean {
  const ui = useUi.getState();
  const sim = ui.sim;
  if (!sim || !sim.running || path.length < 2) return false;
  const simMs = dtMs * sim.multiplier;
  const progressKm = Math.min(sim.totalKm, sim.progressKm + (sim.speedKmh * simMs) / 3_600_000);
  const loc = pointAlongLine(path, progressKm);
  const ahead = pointAlongLine(path, Math.min(sim.totalKm, progressKm + 0.08));
  const heading = progressKm < sim.totalKm ? bearingDeg(loc, ahead) : ui.position?.headingDeg;
  ui.patchSim({ progressKm, clock: sim.clock + simMs });
  ui.setPosition({ loc, source: "sim", headingDeg: heading, speedKmh: sim.speedKmh, at: Date.now() });
  return progressKm >= sim.totalKm;
}

export function pauseSimulation(paused: boolean) {
  useUi.getState().patchSim({ running: !paused });
}

export function setSimMultiplier(multiplier: number) {
  useUi.getState().patchSim({ multiplier });
}

export function stopSimulation() {
  const ui = useUi.getState();
  ui.setSim(null);
  const p = ui.position;
  if (p?.source === "sim") ui.setPosition({ ...p, source: "manual" });
}
