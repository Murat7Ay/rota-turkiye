// Altın saat / gün batımı kartı: sıcak gün batımı degradesi, geri sayım, önerilen manzara noktası.
import { MapPin, Sunrise, Sunset, Volume2 } from "lucide-react";
import { formatHHmm } from "@rota/core";
import type { GoldenHourSpot, SunTimes } from "../../../../../packages/core/src/sun";
import { goldenHourToSpeech } from "../voice/speak";
import { speak, speechSupported } from "../voice/useSpeech";

export interface GoldenHourCardProps {
  /** goldenHourSpot(...).line ya da sunLine(...); spot verilirse onun satırı kullanılır */
  line?: string;
  spot?: GoldenHourSpot | null;
  /** Gün doğumu/batımı satırı ve geri sayım için (spot verilirse onun sun'ı kullanılır) */
  sun?: SunTimes | null;
  /** Şimdiki gün içi dakika (geri sayım için) */
  nowMin?: number;
  /** "Oraya git" — yol tarifi / plana ekle */
  onGo?: (spot: GoldenHourSpot) => void;
  /** Kısa tek satır görünüm (Bugün ekranı üstü gibi) */
  compact?: boolean;
  className?: string;
}

function dur(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? (r ? `${h} sa ${r} dk` : `${h} sa`) : `${r} dk`;
}

function countdown(sun: SunTimes, now: number): string {
  const [g0, g1] = sun.goldenEvening;
  if (now < sun.sunriseMin) return `Gün doğumuna ${dur(sun.sunriseMin - now)}`;
  if (now <= sun.goldenMorning[1]) return "Sabah altın saati şimdi";
  if (now < g0) return `Altın saate ${dur(g0 - now)}`;
  if (now <= g1) return `Altın saat şimdi · batışa ${dur(g1 - now)}`;
  return "Güneş battı";
}

const GRADIENT = "linear-gradient(140deg, #7C2D12 0%, #C2410C 42%, #EA580C 70%, #F59E0B 100%)";

export function GoldenHourCard({ line, spot, sun, nowMin, onGo, compact = false, className }: GoldenHourCardProps) {
  const text = spot?.line ?? line;
  const times = spot?.sun ?? sun ?? null;
  if (!text && !times) return null;
  const chip = times && nowMin !== undefined ? countdown(times, nowMin) : null;
  const canSpeak = !!text && speechSupported();

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-white shadow-card ${className ?? ""}`}
        style={{ background: GRADIENT }}
      >
        <Sunset className="size-5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{text ?? `Gün batımı ${formatHHmm(times!.sunsetMin)}`}</p>
        {chip && <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">{chip}</span>}
      </div>
    );
  }

  return (
    <section
      className={`relative overflow-hidden rounded-3xl p-4 text-white shadow-lift ${className ?? ""}`}
      style={{ background: GRADIENT }}
      aria-label="Altın saat"
    >
      {/* Batan güneş ve ufuk */}
      <div className="pointer-events-none absolute -bottom-10 -right-8 size-40 rounded-full bg-amber-200/45 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-6 right-6 size-20 rounded-full bg-amber-100/70" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-black/25 to-transparent" aria-hidden />

      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-2xl bg-white/20">
            <Sunset className="size-5" aria-hidden />
          </span>
          <h3 className="text-base font-bold">Altın saat</h3>
          {chip && <span className="ml-auto rounded-full bg-black/20 px-2.5 py-1 text-xs font-semibold">{chip}</span>}
        </div>

        {text && <p className="mt-3 text-[15px] font-semibold leading-snug [text-shadow:0_1px_2px_rgb(0_0_0/0.25)]">{text}</p>}

        {times && (
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90 tabular">
            <span className="inline-flex items-center gap-1">
              <Sunrise className="size-4" aria-hidden />
              {formatHHmm(times.sunriseMin)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Sunset className="size-4" aria-hidden />
              {formatHHmm(times.sunsetMin)}
            </span>
            <span>
              Altın saat {formatHHmm(times.goldenEvening[0])}–{formatHHmm(times.goldenEvening[1])}
            </span>
          </p>
        )}

        {spot?.rainy && <p className="mt-2 text-xs text-white/85">Gün batımında yağmur bekleniyor; manzara bulutlu olabilir.</p>}

        {((spot && onGo) || canSpeak) && (
          <div className="mt-4 flex items-center gap-2">
            {spot && onGo && (
              <button
                type="button"
                onClick={() => onGo(spot)}
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-[15px] font-semibold text-[#9A3412] shadow-sm transition hover:bg-amber-50 active:scale-[0.98]"
              >
                <MapPin className="size-4" aria-hidden />
                Oraya git
              </button>
            )}
            {canSpeak && (
              <button
                type="button"
                onClick={() => speak(goldenHourToSpeech(text!), { force: true, interrupt: true })}
                aria-label="Sesli oku"
                title="Sesli oku"
                className="grid size-11 place-items-center rounded-2xl bg-white/20 transition hover:bg-white/30 active:scale-95"
              >
                <Volume2 className="size-5" aria-hidden />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
