// Bölge paketleri: packs/index.json listesi ve seçili paketin kendisi + mekân indeksi.
import { create } from "zustand";
import { buildPlaceIndex, type PlaceIndex, type RegionPack } from "@rota/core";
import { SAMPLE_PACK, SAMPLE_PACK_ID, SAMPLE_PACK_META } from "../dev/sample";

export interface PackMeta {
  id: string;
  name: string;
  bbox: [number, number, number, number];
  places: number;
  towns: number;
  generatedAt: string;
  bytes: number;
  /** Arayüzde "örnek/test verisi" rozeti */
  sample?: boolean;
}

type Status = "idle" | "loading" | "ready" | "error";

interface PackState {
  list: PackMeta[] | null;
  listStatus: Status;
  listError: string | null;
  pack: RegionPack | null;
  index: PlaceIndex | null;
  status: Status;
  error: string | null;
  /** Paket bulunamadığı için örnek veriye düşüldü */
  fellBackToSample: boolean;
  loadList: () => Promise<PackMeta[]>;
  ensurePack: (id: string) => Promise<RegionPack | null>;
}

const base = import.meta.env.BASE_URL;

function packUrl(meta: PackMeta | undefined, id: string) {
  const v = meta?.generatedAt ? `?v=${encodeURIComponent(meta.generatedAt)}` : "";
  return `${base}packs/${id}.json${v}`;
}

let inflight: { id: string; p: Promise<RegionPack | null> } | null = null;

export const usePack = create<PackState>()((set, get) => ({
  list: null,
  listStatus: "idle",
  listError: null,
  pack: null,
  index: null,
  status: "idle",
  error: null,
  fellBackToSample: false,

  async loadList() {
    const cur = get();
    if (cur.list && cur.listStatus === "ready") return cur.list;
    set({ listStatus: "loading", listError: null });
    try {
      const res = await fetch(`${base}packs/index.json`, { cache: "no-cache" });
      if (!res.ok) throw new Error(`Paket listesi alınamadı (HTTP ${res.status}).`);
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("text/html")) throw new Error("Paket listesi henüz yayınlanmamış.");
      const raw = (await res.json()) as unknown;
      const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { packs?: unknown }).packs) ? (raw as { packs: unknown[] }).packs : [];
      const list = (arr as PackMeta[]).filter((p) => p && typeof p.id === "string");
      set({ list, listStatus: "ready" });
      return list;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ list: [], listStatus: "error", listError: msg });
      return [];
    }
  },

  async ensurePack(id) {
    const cur = get();
    if (cur.pack?.id === id && cur.index) return cur.pack;
    if (id === SAMPLE_PACK_ID) {
      set({ pack: SAMPLE_PACK, index: buildPlaceIndex(SAMPLE_PACK.places), status: "ready", error: null, fellBackToSample: false });
      return SAMPLE_PACK;
    }
    if (inflight?.id === id) return inflight.p;
    set({ status: "loading", error: null });
    const p = (async () => {
      try {
        const list = get().list ?? (await get().loadList());
        const meta = list.find((m) => m.id === id);
        const res = await fetch(packUrl(meta, id));
        if (!res.ok) throw new Error(`"${id}" paketi bulunamadı (HTTP ${res.status}).`);
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("text/html")) throw new Error(`"${id}" paketi henüz yayınlanmamış.`);
        const pack = (await res.json()) as RegionPack;
        if (!Array.isArray(pack.places) || !Array.isArray(pack.towns)) throw new Error("Paket biçimi tanınmadı.");
        set({ pack, index: buildPlaceIndex(pack.places), status: "ready", error: null, fellBackToSample: false });
        return pack;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Gerçek paket yoksa örnek veriye düş; arayüz bunu açıkça belirtir.
        set({
          pack: SAMPLE_PACK,
          index: buildPlaceIndex(SAMPLE_PACK.places),
          status: "error",
          error: msg,
          fellBackToSample: true,
        });
        return null;
      } finally {
        inflight = null;
      }
    })();
    inflight = { id, p };
    return p;
  },
}));

export const samplePackMeta = SAMPLE_PACK_META;
