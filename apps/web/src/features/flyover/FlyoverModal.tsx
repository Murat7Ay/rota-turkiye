// Tam ekran "Uçuş" penceresi. Hafif kabuk: MapLibre içeren FlyoverMap yalnızca pencere
// açılınca yüklenir. Uçuş sırasında başlık ve kapat düğmesi gizlenir (temiz reels kaydı);
// harita atıfları (OpenFreeMap/OSM) lisans gereği görünür kalır.
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { DayPlan, Place, PlaceIndex } from "@rota/core";
import { Spinner, cx } from "../../components/ui";
import type { FlyoverState } from "./FlyoverButton";

const FlyoverMap = lazy(() => import("./FlyoverMap"));

export interface FlyoverModalProps {
  open: boolean;
  onClose: () => void;
  day: DayPlan;
  places: Map<string, Place> | PlaceIndex;
  /** Başlık (varsayılan "Uçuş · <gün>. gün") */
  title?: string;
  color?: string;
  autoPlay?: boolean;
}

export default function FlyoverModal({ open, onClose, day, places, title, color, autoPlay }: FlyoverModalProps) {
  const root = useRef<HTMLDivElement>(null);
  const [chromeHidden, setChromeHidden] = useState(false);
  const flight = useRef<FlyoverState>("idle");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Uçuş sürerken Esc uçuşu durdurur (FlyoverButton); boştayken pencereyi kapatır.
      if (e.key === "Escape" && flight.current === "idle") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      setChromeHidden(false);
      flight.current = "idle";
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div ref={root} role="dialog" aria-modal="true" aria-label={title ?? `Uçuş · ${day.index + 1}. gün`} className="fixed inset-0 z-[60] bg-black">
      <Suspense
        fallback={
          <div className="grid h-full place-items-center">
            <Spinner className="size-8" />
          </div>
        }
      >
        <FlyoverMap
          day={day}
          places={places}
          {...(color ? { color } : {})}
          {...(autoPlay ? { autoPlay } : {})}
          fullscreenTarget={() => root.current}
          onChromeHiddenChange={setChromeHidden}
          onStateChange={(s) => {
            flight.current = s;
          }}
        />
      </Suspense>
      <div
        className={cx(
          "safe-top pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-linear-to-b from-black/45 to-transparent px-4 pb-8 pt-3 transition-opacity duration-500",
          chromeHidden ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="min-w-0 pt-2 text-white drop-shadow">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Rota uçuşu</p>
          <h2 className="truncate text-lg font-bold">{title ?? `${day.index + 1}. gün · ${day.from.name} → ${day.to.name}`}</h2>
        </div>
        <button
          type="button"
          aria-label="Kapat"
          title="Kapat"
          onClick={onClose}
          className={cx(
            "inline-grid size-11 shrink-0 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/60",
            chromeHidden ? "pointer-events-none" : "pointer-events-auto",
          )}
        >
          <X className="size-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
