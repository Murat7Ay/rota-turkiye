// Rota uçuşu: kamerayı günün rotası boyunca eğik (≈60°) bakışla gezdirir; reels kaydı için.
// Çizgi sıklaştırılır, yön ileri bakışla hesaplanıp yumuşatılır, duraklarda kamera yavaşlayıp
// kısa bir süre bekler. Arazi (terrain) kullanılmaz. prefers-reduced-motion açıksa sürekli
// kamera hareketi yerine duraktan durağa animasyonsuz geçilir.
import type { Map as MLMap } from "maplibre-gl";
import { bearingDeg, haversineKm, projectOnLine, type LonLat } from "@rota/core";

// ---------------------------------------------------------------- yol geometrisi

export interface RoutePath {
  pts: LonLat[];
  /** Her noktaya kadar birikimli mesafe, km */
  cum: number[];
  totalKm: number;
}

const ll = ([lon, lat]: LonLat) => ({ lat, lon });

/** Ardışık tekrarları atar ve çizgiyi en fazla `stepKm` aralıklı noktalara böler */
export function buildPath(line: LonLat[], stepKm?: number): RoutePath {
  const clean: LonLat[] = [];
  for (const p of line) {
    const last = clean[clean.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) clean.push(p);
  }
  let raw = 0;
  for (let i = 1; i < clean.length; i++) raw += haversineKm(ll(clean[i - 1]!), ll(clean[i]!));
  const step = stepKm ?? Math.max(0.01, Math.min(0.5, raw / 1500));
  const pts: LonLat[] = [];
  const cum: number[] = [];
  let acc = 0;
  for (let i = 0; i < clean.length; i++) {
    const a = clean[i]!;
    pts.push(a);
    cum.push(acc);
    const b = clean[i + 1];
    if (!b) break;
    const seg = haversineKm(ll(a), ll(b));
    const n = Math.floor(seg / step);
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      cum.push(acc + seg * t);
    }
    acc += seg;
  }
  return { pts, cum, totalKm: acc };
}

/** cum dizisinde km'yi içeren parçanın başlangıç indeksi (ikili arama) */
function segIndex(cum: number[], km: number): number {
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! <= km) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function pointAt(path: RoutePath, km: number): LonLat {
  const { pts, cum } = path;
  if (pts.length === 1 || km <= 0) return pts[0]!;
  if (km >= path.totalKm) return pts[pts.length - 1]!;
  const i = segIndex(cum, km);
  const a = pts[i]!;
  const b = pts[i + 1] ?? a;
  const len = (cum[i + 1] ?? cum[i]!) - cum[i]!;
  const t = len > 0 ? (km - cum[i]!) / len : 0;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** İleri bakışlı yön: biraz geriden biraz ileriye; kıvrımlı yollarda titremeyi azaltır */
export function lookAheadBearing(path: RoutePath, km: number, aheadKm: number): number | null {
  const a = pointAt(path, Math.max(0, km - aheadKm * 0.3));
  const b = pointAt(path, Math.min(path.totalKm, km + aheadKm));
  if (a[0] === b[0] && a[1] === b[1]) return null;
  return bearingDeg(ll(a), ll(b));
}

/** a'dan b'ye en kısa açısal yönde t kadar ilerle */
function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}

/** Hızlanma/yavaşlama rampalı (yamuk hız profili) ilerleme, 0..1 → 0..1 */
function easeTrapezoid(u: number, r = 0.08): number {
  const x = Math.max(0, Math.min(1, u));
  const A = 1 - r;
  if (x < r) return (x * x) / (2 * r) / A;
  if (x > 1 - r) return (1 - r - ((1 - x) * (1 - x)) / (2 * r)) / A;
  return (r / 2 + (x - r)) / A;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Rota uzunluğuna göre varsayılan yakınlık: kısa şehir günü ≈15–16, uzun yol günü ≈10,5 */
export function autoZoom(totalKm: number): number {
  return Math.max(10.5, Math.min(16, 16.2 - 0.85 * Math.log2(Math.max(1, totalKm))));
}

/** Varsayılan hareket süresi (duraklardaki beklemeler hariç), ms */
export function autoDurationMs(totalKm: number): number {
  return Math.max(12_000, Math.min(32_000, 9_000 + totalKm * 70));
}

// ---------------------------------------------------------------- uçuş

export interface FlyoverInfo {
  km: number;
  totalKm: number;
  /** Beklenen durak (stops dizisindeki indeks) ya da null */
  atStop: number | null;
}

export interface FlyoverOptions {
  /** Hareket süresi, ms (durak beklemeleri hariç). Varsayılan rota uzunluğuna göre 12–32 sn. */
  durationMs?: number;
  /** Eğim, derece (varsayılan 60) */
  pitch?: number;
  /** Yakınlık (varsayılan rota uzunluğuna göre) */
  zoom?: number;
  /** Kameranın yavaşlayıp bekleyeceği noktalar (durak işaretleri) */
  stops?: LonLat[];
  /** Durak başına bekleme, ms (varsayılan 1200) */
  pauseMs?: number;
  /** Rotaya bundan uzak duraklarda beklenmez, km (varsayılan 1,5) */
  stopMaxOffsetKm?: number;
  /** Yön için ileri bakış mesafesi, km (varsayılan rotanın %4'ü, 0,12–5 km) */
  lookAheadKm?: number;
  /** Başlangıca süzülme süresi, ms (varsayılan 1200) */
  introMs?: number;
  onProgress?: (p: number, info: FlyoverInfo) => void;
  /** Bir durağa varıldığında (stops dizisindeki indeks) */
  onStop?: (stopIndex: number) => void;
  /** Kullanıcı haritaya dokunduğu için uçuş duraklatıldı */
  onInterrupt?: () => void;
  signal?: AbortSignal;
  /** Verilmezse prefers-reduced-motion okunur */
  reducedMotion?: boolean;
}

export type FlyoverEnd = "done" | "stopped";

export interface FlyoverHandle {
  done: Promise<FlyoverEnd>;
  pause(): void;
  resume(): void;
  stop(): void;
  readonly paused: boolean;
  readonly reducedMotion: boolean;
}

interface StopMark {
  index: number;
  km: number;
}

/**
 * Kamerayı `line` boyunca uçurur. Dönen tutamaçla duraklatılabilir/durdurulabilir;
 * `done` uçuş bitince ya da durdurulunca çözülür. Haritanın maxPitch'i gerekirse geçici
 * olarak yükseltilir ve sonunda geri alınır.
 */
export function flyAlongRoute(map: MLMap, line: LonLat[], opts: FlyoverOptions = {}): FlyoverHandle {
  const path = buildPath(line);
  const total = path.totalKm;
  const reduced = opts.reducedMotion ?? prefersReducedMotion();
  const pitch = Math.max(0, Math.min(75, opts.pitch ?? 60));
  const baseZoom = opts.zoom ?? autoZoom(total);
  const moveMs = Math.max(2000, opts.durationMs ?? autoDurationMs(total));
  const pauseMs = Math.max(0, opts.pauseMs ?? 1200);
  const ahead = opts.lookAheadKm ?? Math.max(0.12, Math.min(5, total * 0.04));
  const maxOffset = opts.stopMaxOffsetKm ?? 1.5;

  // Durakları rotaya izdüşür, rota boyunca sırala
  const stops: StopMark[] = [];
  (opts.stops ?? []).forEach((p, index) => {
    if (path.pts.length < 2) return;
    const pr = projectOnLine(ll(p), path.pts);
    if (pr.distanceKm <= maxOffset) stops.push({ index, km: Math.min(total, pr.alongKm) });
  });
  stops.sort((a, b) => a.km - b.km);

  // Zaman ağırlığı: durak yakınında birim mesafe daha uzun sürer → kamera yumuşakça yavaşlar
  const slowKm = Math.max(0.15, Math.min(3, total * 0.03));
  const weightAt = (km: number) => {
    let w = 1;
    for (const s of stops) {
      const d = Math.abs(km - s.km) / slowKm;
      if (d < 1) w += 3 * (1 - d) * (1 - d);
    }
    return w;
  };
  const cumW: number[] = [0];
  for (let i = 1; i < path.cum.length; i++) {
    const a = path.cum[i - 1]!;
    const b = path.cum[i]!;
    cumW.push(cumW[i - 1]! + (b - a) * weightAt((a + b) / 2));
  }
  const totalW = cumW[cumW.length - 1] ?? 0;
  const kmAtWeight = (w: number) => {
    if (w <= 0 || path.cum.length < 2) return 0;
    if (w >= totalW) return total;
    const i = segIndex(cumW, w);
    const w0 = cumW[i]!;
    const w1 = cumW[i + 1] ?? w0;
    const k0 = path.cum[i]!;
    const k1 = path.cum[i + 1] ?? k0;
    return w1 > w0 ? k0 + ((w - w0) / (w1 - w0)) * (k1 - k0) : k0;
  };

  let state: "running" | "paused" | "stopped" = "running";
  let resolveDone!: (e: FlyoverEnd) => void;
  const done = new Promise<FlyoverEnd>((r) => (resolveDone = r));
  let raf = 0;
  let last = 0;
  let moveElapsed = 0;
  let holdLeft = 0;
  let nextStop = 0;
  let km = 0;
  let atStop: number | null = null;
  let bearing = (path.pts.length >= 2 ? lookAheadBearing(path, 0, ahead) : null) ?? map.getBearing();
  let finished = false;
  let zoom = baseZoom;

  const prevMaxPitch = map.getMaxPitch();
  const raisedPitch = prevMaxPitch < pitch;
  if (raisedPitch) map.setMaxPitch(pitch);

  const container = map.getCanvasContainer();
  const onUserInput = () => {
    if (state !== "running") return;
    handle.pause();
    opts.onInterrupt?.();
  };
  container.addEventListener("pointerdown", onUserInput);
  container.addEventListener("wheel", onUserInput, { passive: true });

  const report = () => opts.onProgress?.(total > 0 ? km / total : 1, { km, totalKm: total, atStop });

  function finish(end: FlyoverEnd) {
    if (finished) return;
    finished = true;
    state = "stopped";
    cancelAnimationFrame(raf);
    container.removeEventListener("pointerdown", onUserInput);
    container.removeEventListener("wheel", onUserInput);
    opts.signal?.removeEventListener("abort", onAbort);
    if (raisedPitch) {
      // maxPitch'i geri al; eğim yüksekse önce yumuşakça indir (setMaxPitch aniden keser)
      try {
        if (map.getPitch() <= prevMaxPitch || reduced) map.setMaxPitch(prevMaxPitch);
        else {
          map.once("moveend", () => {
            try {
              map.setMaxPitch(prevMaxPitch);
            } catch {
              /* harita kaldırılmış */
            }
          });
          map.easeTo({ pitch: prevMaxPitch, duration: 600 });
        }
      } catch {
        /* harita kaldırılmış */
      }
    }
    resolveDone(end);
  }

  function camera(center: LonLat, b: number, z: number, p: number) {
    try {
      map.jumpTo({ center, bearing: b, zoom: z, pitch: p });
      return true;
    } catch {
      finish("stopped");
      return false;
    }
  }

  // --- sürekli uçuş
  function frame(ts: number) {
    if (state !== "running") return;
    const dt = last ? Math.min(64, ts - last) : 16;
    last = ts;
    if (holdLeft > 0) {
      holdLeft -= dt;
      if (holdLeft <= 0) atStop = null;
    } else {
      moveElapsed = Math.min(moveMs, moveElapsed + dt);
      let nk = kmAtWeight(easeTrapezoid(moveElapsed / moveMs) * totalW);
      const s = stops[nextStop];
      if (s && nk >= s.km && pauseMs > 0) {
        nk = s.km;
        holdLeft = pauseMs;
        atStop = s.index;
        nextStop++;
        opts.onStop?.(s.index);
      } else if (s && nk >= s.km) {
        nextStop++;
        opts.onStop?.(s.index);
      }
      km = nk;
    }
    const target = lookAheadBearing(path, km, ahead);
    if (target !== null) bearing = lerpAngle(bearing, target, 1 - Math.exp(-dt / 450));
    const zTarget = holdLeft > 0 ? baseZoom + 0.5 : baseZoom;
    zoom += (zTarget - zoom) * (1 - Math.exp(-dt / 700));
    if (!camera(pointAt(path, km), bearing, zoom, pitch)) return;
    report();
    if (moveElapsed >= moveMs && holdLeft <= 0) {
      finish("done");
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  // --- azaltılmış hareket: duraktan durağa animasyonsuz geçiş
  async function slideshow() {
    const marks: Array<{ km: number; stop: number | null }> = [
      { km: 0, stop: null },
      ...stops.map((s) => ({ km: s.km, stop: s.index })),
      { km: total, stop: null },
    ];
    for (const m of marks) {
      if (state === "stopped") return;
      km = m.km;
      atStop = m.stop;
      if (m.stop !== null) opts.onStop?.(m.stop);
      if (!camera(pointAt(path, km), 0, baseZoom, 0)) return;
      report();
      let left = Math.max(1500, pauseMs * 2);
      // state await sırasında değişebilir; TS'nin daraltmasını kırmak için geniş tipte oku
      while (left > 0 && (state as string) !== "stopped") {
        await new Promise((r) => setTimeout(r, 100));
        if (state === "running") left -= 100;
      }
    }
    finish("done");
  }

  function onAbort() {
    handle.stop();
  }

  const handle: FlyoverHandle = {
    done,
    get paused() {
      return state === "paused";
    },
    get reducedMotion() {
      return reduced;
    },
    pause() {
      if (state !== "running") return;
      state = "paused";
      cancelAnimationFrame(raf);
    },
    resume() {
      if (state !== "paused") return;
      state = "running";
      last = 0;
      if (!reduced) raf = requestAnimationFrame(frame);
    },
    stop() {
      if (state === "stopped") return;
      finish("stopped");
    },
  };

  if (opts.signal?.aborted || path.pts.length < 2 || total <= 0) {
    finish("stopped");
    return handle;
  }
  opts.signal?.addEventListener("abort", onAbort, { once: true });

  if (reduced) {
    void slideshow();
    return handle;
  }

  // Başlangıca süzül, sonra kare döngüsü
  const start = path.pts[0]!;
  const introMs = Math.max(0, opts.introMs ?? 1200);
  try {
    map.easeTo({ center: start, zoom: baseZoom, pitch, bearing, duration: introMs, essential: true });
  } catch {
    finish("stopped");
    return handle;
  }
  window.setTimeout(() => {
    if (state === "stopped") return;
    try {
      map.stop();
    } catch {
      /* yok say */
    }
    last = 0;
    if (state === "running") raf = requestAnimationFrame(frame);
  }, introMs + 30);
  report();
  return handle;
}
