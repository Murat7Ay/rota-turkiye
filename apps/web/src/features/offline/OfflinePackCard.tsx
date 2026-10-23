// "Gezi paketini indir" kartı: rota koridorunun harita karolarını, stilleri ve bölge paketini
// çevrimdışı kullanım için önbelleğe alır. İlerleme, iptal ve "indirildi ✓" durumu.
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, CloudDownload, RefreshCw, WifiOff, X } from "lucide-react";
import type { TripPlan } from "@rota/core";
import { Badge, Bar, Button, Card, cx } from "../../components/ui";
import { fmtBytes, fmtNumber } from "../../lib/format";
import { usePack } from "../../state/pack";
import { SAMPLE_PACK_ID } from "../../dev/sample";
import {
  DEFAULT_MAX_TILES,
  cachedTileTemplate,
  downloadTripPack,
  planTileDownload,
  type DownloadProgress,
  type PlaceLookup,
} from "./tiles";

export interface OfflinePackCardProps {
  plan: TripPlan;
  /** Durak konumları için (PlaceIndex ya da Map) */
  places?: PlaceLookup | null;
  /** Bölge paketinin URL'si; verilmezse paket listesinden türetilir */
  packUrl?: string;
  minZoom?: number;
  maxZoom?: number;
  corridorKm?: number;
  className?: string;
}

interface PackRecord {
  /** ISO tarih-saat */
  at: string;
  planVersion: number;
  tiles: number;
  bytes: number;
  failed: number;
  capped: boolean;
  tileTemplate: string;
}

const storeKey = (planId: string) => `rota-offline-pack:${planId}`;

function readRecord(planId: string): PackRecord | null {
  try {
    const raw = localStorage.getItem(storeKey(planId));
    return raw ? (JSON.parse(raw) as PackRecord) : null;
  } catch {
    return null;
  }
}

function writeRecord(planId: string, r: PackRecord) {
  try {
    localStorage.setItem(storeKey(planId), JSON.stringify(r));
  } catch {
    /* gizli sekme vb. */
  }
}

const dtFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function useOnline() {
  const [on, setOn] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return on;
}

type Phase = "idle" | "preparing" | "downloading" | "done" | "error";

export default function OfflinePackCard({ plan, places, packUrl, minZoom = 8, maxZoom = 14, corridorKm = 3, className }: OfflinePackCardProps) {
  const online = useOnline();
  const packList = usePack((s) => s.list);
  const [record, setRecord] = useState<PackRecord | null>(() => readRecord(plan.id));
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [quotaWarn, setQuotaWarn] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => setRecord(readRecord(plan.id)), [plan.id]);
  useEffect(() => () => ctrl.current?.abort(), []);

  const estimate = useMemo(() => planTileDownload(plan, { minZoom, maxZoom, corridorKm, places: places ?? null }), [plan, places, minZoom, maxZoom, corridorKm]);

  // Uygulamanın paketi yüklediği URL ile aynı olmalı (state/pack.ts packUrl): ?v=<generatedAt>
  const resolvedPackUrl = useMemo(() => {
    if (packUrl) return packUrl;
    if (plan.packId === SAMPLE_PACK_ID) return undefined; // örnek paket uygulamaya gömülü
    const meta = packList?.find((m) => m.id === plan.packId);
    const v = meta?.generatedAt ? `?v=${encodeURIComponent(meta.generatedAt)}` : "";
    return `${import.meta.env.BASE_URL}packs/${plan.packId}.json${v}`;
  }, [packUrl, packList, plan.packId]);

  // Harita sürümü (TileJSON şablonu) değiştiyse indirilen karolar artık kullanılmaz.
  useEffect(() => {
    let alive = true;
    if (!record) {
      setStale(false);
      return;
    }
    void cachedTileTemplate().then((t) => {
      if (alive) setStale(!!t && t !== record.tileTemplate);
    });
    return () => {
      alive = false;
    };
  }, [record]);

  // Yer kontrolü (tahmin, tarayıcı izin veriyorsa)
  useEffect(() => {
    let alive = true;
    void navigator.storage
      ?.estimate?.()
      .then((e) => {
        if (!alive || e.quota === undefined) return;
        setQuotaWarn(e.quota - (e.usage ?? 0) < estimate.estimatedBytes * 1.2);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [estimate.estimatedBytes]);

  const busy = phase === "preparing" || phase === "downloading";
  const planChanged = !!record && record.planVersion !== plan.version;

  async function start() {
    if (busy) return;
    const ac = new AbortController();
    ctrl.current = ac;
    setError(null);
    setPhase("preparing");
    setProgress(null);
    try {
      const r = await downloadTripPack(plan, {
        minZoom,
        maxZoom,
        corridorKm,
        places: places ?? null,
        concurrency: 4,
        signal: ac.signal,
        ...(resolvedPackUrl ? { packUrl: resolvedPackUrl } : {}),
        onProgress: (p) => {
          setPhase("downloading");
          setProgress(p);
        },
      });
      if (r.aborted) {
        setPhase("idle");
        setProgress(null);
        return;
      }
      const rec: PackRecord = {
        at: new Date().toISOString(),
        planVersion: plan.version,
        tiles: r.tiles,
        bytes: r.bytes,
        failed: r.failed,
        capped: r.capped,
        tileTemplate: r.tileTemplate,
      };
      writeRecord(plan.id, rec);
      setRecord(rec);
      setStale(false);
      setPhase("done");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setPhase("idle");
        setProgress(null);
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    } finally {
      ctrl.current = null;
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const unsupported = typeof window !== "undefined" && !("caches" in window);

  return (
    <Card className={cx("p-4", className)}>
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sea-soft text-sea" aria-hidden>
          <CloudDownload className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-ink">Çevrimdışı gezi paketi</h3>
          <p className="mt-0.5 text-sm text-muted">
            Rotanın {corridorKm} km çevresi ve durakların 2 km çevresindeki harita (yakınlık {minZoom}–{Math.min(maxZoom, 14)}), harita stilleri ve bölge paketi telefona
            kaydedilir.
          </p>
        </div>
      </div>

      {/* Tahmin */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="neutral" className="tabular">
          ~{fmtNumber(estimate.tiles.length)} karo
        </Badge>
        <Badge tone="neutral" className="tabular">
          ~{estimate.estimatedMB.toLocaleString("tr-TR")} MB
        </Badge>
        <span className="text-xs text-muted">tahmini</span>
        {estimate.capped && (
          <Badge tone="warn">
            Üst sınır {fmtNumber(DEFAULT_MAX_TILES)} karo: en yakın görünümün bir kısmı ({fmtNumber(estimate.dropped)} karo) atlanır
          </Badge>
        )}
      </div>
      {quotaWarn && !busy && <p className="mt-2 text-xs font-medium text-warn">Cihazda yer az görünüyor; indirme yarıda kalabilir.</p>}

      {/* Durum */}
      {record && !busy && (
        <div className="mt-3 rounded-2xl bg-good-soft px-3 py-2 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-good">
            <CircleCheck className="size-4" aria-hidden />
            İndirildi ✓ ({dtFmt.format(new Date(record.at))})
          </p>
          <p className="mt-0.5 text-xs text-ink-2 tabular">
            {fmtNumber(record.tiles)} karo
            {record.bytes > 0 ? ` · bu indirmede ${fmtBytes(record.bytes)}` : ""}
            {record.failed > 0 ? ` · ${fmtNumber(record.failed)} dosya alınamadı` : ""}
          </p>
          {(planChanged || stale) && (
            <p className="mt-1 text-xs font-medium text-warn">
              {planChanged ? "Plan değişti; yeni rota için paketi güncelle." : "Harita verisi güncellendi; paketi yenilemen önerilir."}
            </p>
          )}
        </div>
      )}

      {busy && (
        <div className="mt-3 space-y-1.5" aria-live="polite">
          <Bar value={pct} max={100} tone="sea" label="İndirme ilerlemesi" />
          <p className="flex justify-between text-xs text-muted tabular">
            <span>{phase === "preparing" ? "Hazırlanıyor…" : `${fmtNumber(progress?.done ?? 0)} / ${fmtNumber(progress?.total ?? 0)} dosya · %${pct}`}</span>
            {progress && progress.bytes > 0 && <span>{fmtBytes(progress.bytes)}</span>}
          </p>
        </div>
      )}

      {phase === "error" && error && <p className="mt-3 text-sm font-medium text-bad">İndirme tamamlanamadı: {error}</p>}

      {/* Eylemler */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {busy ? (
          <Button variant="secondary" icon={<X className="size-4" aria-hidden />} onClick={() => ctrl.current?.abort()}>
            İptal
          </Button>
        ) : unsupported ? (
          <p className="text-sm text-muted">Bu tarayıcı çevrimdışı önbelleği desteklemiyor.</p>
        ) : !online ? (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <WifiOff className="size-4" aria-hidden /> İnternete bağlanınca indirebilirsin.
          </p>
        ) : record ? (
          <Button variant="secondary" icon={<RefreshCw className="size-4" aria-hidden />} onClick={() => void start()}>
            {planChanged || stale ? "Paketi güncelle" : "Eksikleri tamamla"}
          </Button>
        ) : (
          <Button variant="sea" icon={<CloudDownload className="size-4" aria-hidden />} onClick={() => void start()}>
            Gezi paketini indir (~{estimate.estimatedMB.toLocaleString("tr-TR")} MB)
          </Button>
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Harita karoları ücretsiz ve gönüllü bir hizmet olan OpenFreeMap'ten gelir. Sunucuyu yormamak için yalnızca rotanın çevresi, en fazla 4 eşzamanlı istekle
        indirilir; önbellekte olan dosyalar yeniden istenmez. Wi-Fi'de indirmen önerilir.
      </p>
    </Card>
  );
}
