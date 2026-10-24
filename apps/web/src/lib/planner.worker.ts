// Planlama işçisi: gezi planı saniyeler sürebilir (çalışma saatleri ayrıştırma + çözücü);
// ana iş parçacığı donmasın diye burada koşar. Paket bir kez gönderilir, indeks önbellekte tutulur.
import { buildPlaceIndex, createTravelModel, planTripWithRoutes, type FxRates, type PlaceIndex, type RegionPack, type TripRequest } from "@rota/core";

export type PlannerRequest = {
  id: number;
  req: TripRequest;
  /** Paket ilk kez ya da sürümü değişince gönderilir */
  pack?: RegionPack;
  packKey: string;
  seed: number;
  osrmUrl: string;
  fx?: FxRates | null;
};

export type PlannerResponse = { id: number; ok: true; plan: Awaited<ReturnType<typeof planTripWithRoutes>> } | { id: number; ok: false; error: string; needPack?: boolean };

let cached: { key: string; pack: RegionPack; index: PlaceIndex } | null = null;

self.onmessage = async (e: MessageEvent<PlannerRequest>) => {
  const m = e.data;
  try {
    if (m.pack) cached = { key: m.packKey, pack: m.pack, index: buildPlaceIndex(m.pack.places) };
    if (!cached || cached.key !== m.packKey) {
      (self as unknown as Worker).postMessage({ id: m.id, ok: false, error: "paket yok", needPack: true } satisfies PlannerResponse);
      return;
    }
    const ctx = { index: cached.index, travel: createTravelModel(m.req.transport), seed: m.seed, fx: m.fx ?? undefined };
    const plan = await planTripWithRoutes(m.req, cached.pack, ctx, m.osrmUrl);
    (self as unknown as Worker).postMessage({ id: m.id, ok: true, plan } satisfies PlannerResponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: m.id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies PlannerResponse);
  }
};
