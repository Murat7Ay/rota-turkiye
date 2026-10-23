// Geçici arayüz durumu: bildirim kartları (toast), canlı mod, simülasyon ve anlık konum.
// Kalıcı değildir.
import { create } from "zustand";
import type { LatLng, ProximityNotification, ProximityState } from "@rota/core";
import { EMPTY_PROXIMITY_STATE } from "@rota/core";

export type ToastKind = "info" | "success" | "error" | "discovery";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  action?: { label: string; run: () => void };
  /** ms; 0 = elle kapatılır */
  duration: number;
}

export type PositionSource = "gps" | "sim" | "manual";

export interface CurrentPosition {
  loc: LatLng;
  source: PositionSource;
  headingDeg?: number;
  speedKmh?: number;
  accuracyM?: number;
  at: number;
}

export interface SimState {
  running: boolean;
  dayIndex: number;
  /** Gerçek zamana göre hız çarpanı */
  multiplier: number;
  /** Sanal hız, km/sa */
  speedKmh: number;
  totalKm: number;
  progressKm: number;
  /** Simülasyonun sanal saati (epoch ms) */
  clock: number;
  /** Simülasyona özel bildirim durumu (gerçek sayaçları etkilemez) */
  proximity: ProximityState;
}

export interface FeedItem {
  at: number;
  source: PositionSource;
  notification: ProximityNotification;
}

interface UiState {
  toasts: Toast[];
  live: boolean;
  liveError: string | null;
  sim: SimState | null;
  position: CurrentPosition | null;
  feed: FeedItem[];
  pushToast: (t: Omit<Toast, "id" | "duration"> & { duration?: number }) => string;
  dismissToast: (id: string) => void;
  setLive: (on: boolean) => void;
  setLiveError: (msg: string | null) => void;
  setSim: (sim: SimState | null) => void;
  patchSim: (patch: Partial<SimState>) => void;
  setPosition: (p: CurrentPosition | null) => void;
  addFeed: (items: FeedItem[]) => void;
  clearFeed: () => void;
}

let seq = 0;

export const useUi = create<UiState>()((set, get) => ({
  toasts: [],
  live: false,
  liveError: null,
  sim: null,
  position: null,
  feed: [],
  pushToast(t) {
    const id = `t${++seq}`;
    const duration = t.duration ?? (t.kind === "error" ? 8000 : t.kind === "discovery" ? 9000 : 4500);
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id, duration }] }));
    if (duration > 0) window.setTimeout(() => get().dismissToast(id), duration);
    return id;
  },
  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },
  setLive(on) {
    set({ live: on, liveError: null });
  },
  setLiveError(msg) {
    set({ liveError: msg });
  },
  setSim(sim) {
    set({ sim });
  },
  patchSim(patch) {
    const cur = get().sim;
    if (cur) set({ sim: { ...cur, ...patch } });
  },
  setPosition(p) {
    set({ position: p });
  },
  addFeed(items) {
    if (items.length) set((s) => ({ feed: [...items, ...s.feed].slice(0, 30) }));
  },
  clearFeed() {
    set({ feed: [] });
  },
}));

export const toast = (t: Omit<Toast, "id" | "duration"> & { duration?: number }) => useUi.getState().pushToast(t);

export const newSimProximity = (): ProximityState => ({ ...EMPTY_PROXIMITY_STATE, notified: {} });
