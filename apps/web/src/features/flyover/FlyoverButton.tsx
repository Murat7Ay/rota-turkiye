// "Rotayı uçarak izle" düğmesi: verilen MapLibre haritasında rota uçuşunu başlatır;
// oynat/duraklat/durdur, ilerleme çubuğu, isteğe bağlı tam ekran. Uçuş sırasında
// onChromeHiddenChange(true) ile üst/alt çubukların gizlenmesi istenir (temiz reels kaydı).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Map as MLMap } from "maplibre-gl";
import { Maximize2, Minimize2, Pause, Play, Plane, Square } from "lucide-react";
import type { LonLat } from "@rota/core";
import { Button, IconButton, cx } from "../../components/ui";
import { flyAlongRoute, prefersReducedMotion, type FlyoverHandle, type FlyoverOptions } from "./flyover";

export type FlyoverState = "idle" | "running" | "paused";

export interface FlyoverButtonProps {
  /** Uçuşun yapılacağı harita (hazır değilse null) */
  map: MLMap | null;
  line: LonLat[];
  /** Beklenecek durak noktaları */
  stops?: LonLat[];
  options?: Omit<FlyoverOptions, "signal" | "onProgress" | "stops" | "onStop" | "onInterrupt">;
  /** Uçuş başlarken true, bitince false */
  onChromeHiddenChange?: (hidden: boolean) => void;
  onStateChange?: (s: FlyoverState) => void;
  onStop?: (stopIndex: number) => void;
  /** Bitince ("done") ya da durdurulunca ("stopped") */
  onEnd?: (end: "done" | "stopped") => void;
  /** Verilirse "Tam ekran" düğmesi çıkar (tarayıcı destekliyorsa) */
  fullscreenTarget?: () => HTMLElement | null;
  /** Uçuşta kontroller 2,5 sn hareketsizlikten sonra solar (varsayılan true) */
  autoHideControls?: boolean;
  autoStart?: boolean;
  className?: string;
}

export default function FlyoverButton({
  map,
  line,
  stops,
  options,
  onChromeHiddenChange,
  onStateChange,
  onStop,
  onEnd,
  fullscreenTarget,
  autoHideControls = true,
  autoStart,
  className,
}: FlyoverButtonProps) {
  const [state, setState] = useState<FlyoverState>("idle");
  const [progress, setProgress] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const handle = useRef<FlyoverHandle | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const cbs = useRef({ onChromeHiddenChange, onStateChange, onStop, onEnd });
  cbs.current = { onChromeHiddenChange, onStateChange, onStop, onEnd };

  const canFly = !!map && line.length > 1;
  const fsSupported = typeof document !== "undefined" && !!document.fullscreenEnabled && !!fullscreenTarget;

  const update = useCallback((s: FlyoverState) => {
    setState(s);
    cbs.current.onStateChange?.(s);
  }, []);

  const start = useCallback(() => {
    if (!map || line.length < 2 || handle.current) return;
    setProgress(0);
    cbs.current.onChromeHiddenChange?.(true);
    const h = flyAlongRoute(map, line, {
      ...options,
      ...(stops ? { stops } : {}),
      onProgress: (p) => setProgress(p),
      onStop: (i) => cbs.current.onStop?.(i),
      onInterrupt: () => update("paused"),
    });
    handle.current = h;
    update("running");
    void h.done.then((end) => {
      if (handle.current !== h) return;
      handle.current = null;
      update("idle");
      setControlsVisible(true);
      cbs.current.onChromeHiddenChange?.(false);
      cbs.current.onEnd?.(end);
    });
  }, [map, line, stops, options, update]);

  const togglePause = useCallback(() => {
    const h = handle.current;
    if (!h) return;
    if (h.paused) {
      h.resume();
      update("running");
    } else {
      h.pause();
      update("paused");
    }
  }, [update]);

  const stop = useCallback(() => handle.current?.stop(), []);

  // Sökülünce uçuşu durdur
  useEffect(() => () => handle.current?.stop(), []);

  // Otomatik başlat (harita hazır olunca bir kez)
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && canFly && !autoStarted.current) {
      autoStarted.current = true;
      start();
    }
  }, [autoStart, canFly, start]);

  // Klavye: boşluk = duraklat/sürdür, Esc = durdur
  useEffect(() => {
    if (state === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        togglePause();
      } else if (e.key === "Escape") {
        stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, togglePause, stop]);

  // Uçuşta kontrolleri soldur; dokunma/fare hareketiyle geri getir
  useEffect(() => {
    if (state !== "running" || !autoHideControls) {
      setControlsVisible(true);
      return;
    }
    const arm = () => {
      setControlsVisible(true);
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setControlsVisible(false), 2500);
    };
    arm();
    window.addEventListener("pointermove", arm);
    window.addEventListener("pointerdown", arm);
    return () => {
      window.clearTimeout(hideTimer.current);
      window.removeEventListener("pointermove", arm);
      window.removeEventListener("pointerdown", arm);
    };
  }, [state, autoHideControls]);

  useEffect(() => {
    const on = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void fullscreenTarget?.()?.requestFullscreen?.().catch(() => undefined);
  };

  if (state === "idle") {
    return (
      <div className={cx("flex items-center gap-2", className)}>
        <Button
          variant="primary"
          icon={<Plane className="size-4" aria-hidden />}
          disabled={!canFly}
          title={canFly ? (prefersReducedMotion() ? "Hareket azaltma açık: duraktan durağa geçilir" : undefined) : "Uçulacak rota yok"}
          onClick={start}
        >
          Rotayı uçarak izle
        </Button>
        {fsSupported && (
          <IconButton label={isFullscreen ? "Tam ekrandan çık" : "Tam ekran"} className="bg-surface/90 shadow-card" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
          </IconButton>
        )}
      </div>
    );
  }

  return (
    <div
      className={cx(
        "flex items-center gap-1 rounded-full bg-black/55 p-1 pr-3 text-white shadow-lift backdrop-blur-md transition-opacity duration-500",
        controlsVisible ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
      role="group"
      aria-label="Rota uçuşu"
    >
      <PillButton label={state === "paused" ? "Sürdür" : "Duraklat"} onClick={togglePause}>
        {state === "paused" ? <Play className="size-5" /> : <Pause className="size-5" />}
      </PillButton>
      <PillButton label="Durdur" onClick={stop}>
        <Square className="size-4" />
      </PillButton>
      {fsSupported && (
        <PillButton label={isFullscreen ? "Tam ekrandan çık" : "Tam ekran"} onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
        </PillButton>
      )}
      <div
        className="ml-1 h-1.5 w-24 overflow-hidden rounded-full bg-white/25 sm:w-36"
        role="progressbar"
        aria-label="Uçuş ilerlemesi"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div className="h-full rounded-full bg-white" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}

/** Koyu, yarı saydam uçuş çubuğu için düğme (44 px dokunma hedefi) */
function PillButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-grid size-11 place-items-center rounded-full text-white transition hover:bg-white/15 active:scale-95"
    >
      {children}
    </button>
  );
}
