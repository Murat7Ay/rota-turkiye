import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_OSRM_URL, DEFAULT_PROXIMITY_SETTINGS, type ProximitySettings } from "@rota/core";
import { idbStorage } from "./persist";

export interface SettingsState {
  osrmUrl: string;
  proximity: ProximitySettings;
  seed: number;
  /** Etrafım yarıçapı, km */
  aroundRadiusKm: number;
  hydrated: boolean;
  setOsrmUrl: (url: string) => void;
  setProximity: (patch: Partial<ProximitySettings>) => void;
  resetProximity: () => void;
  setSeed: (seed: number) => void;
  setAroundRadius: (km: number) => void;
  replaceAll: (s: Partial<Pick<SettingsState, "osrmUrl" | "proximity" | "seed" | "aroundRadiusKm">>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      osrmUrl: DEFAULT_OSRM_URL,
      proximity: { ...DEFAULT_PROXIMITY_SETTINGS },
      seed: 42,
      aroundRadiusKm: 1,
      hydrated: false,
      setOsrmUrl: (osrmUrl) => set({ osrmUrl: osrmUrl.trim().replace(/\/+$/, "") || DEFAULT_OSRM_URL }),
      setProximity: (patch) => set((s) => ({ proximity: { ...s.proximity, ...patch } })),
      resetProximity: () => set({ proximity: { ...DEFAULT_PROXIMITY_SETTINGS } }),
      setSeed: (seed) => set({ seed: Math.max(0, Math.floor(seed) || 0) }),
      setAroundRadius: (aroundRadiusKm) => set({ aroundRadiusKm }),
      replaceAll: (s) => set(s),
    }),
    {
      name: "rota-settings",
      version: 1,
      storage: idbStorage,
      partialize: (s) => ({ osrmUrl: s.osrmUrl, proximity: s.proximity, seed: s.seed, aroundRadiusKm: s.aroundRadiusKm }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return { ...current, ...p, proximity: { ...DEFAULT_PROXIMITY_SETTINGS, ...(p.proximity ?? {}) } };
      },
      onRehydrateStorage: () => () => {
        useSettings.setState({ hydrated: true });
      },
    },
  ),
);
