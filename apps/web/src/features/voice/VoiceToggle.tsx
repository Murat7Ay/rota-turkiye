// Sesli rehber aç/kapa düğmesi (kulaklık simgesi). Tercih localStorage "rota:voice" anahtarında kalır.
import { HeadphoneOff, Headphones } from "lucide-react";
import { speak, useSpeech } from "./useSpeech";

export interface VoiceToggleProps {
  className?: string;
  /** Simgenin yanında "Sesli rehber" yazısı */
  showLabel?: boolean;
  /** Açılınca okunacak kısa onay (iOS'ta sesin kilidini de açar) */
  greeting?: string;
  onChange?: (enabled: boolean) => void;
}

export function VoiceToggle({ className, showLabel = false, greeting = "Sesli rehber açık.", onChange }: VoiceToggleProps) {
  const { supported, enabled, speaking, setPrefs, cancel } = useSpeech();
  const label = !supported ? "Bu tarayıcı sesli okumayı desteklemiyor" : enabled ? "Sesli rehberi kapat" : "Sesli rehberi aç";

  function toggle() {
    if (!supported) return;
    const next = !enabled;
    setPrefs({ enabled: next });
    // İlk konuşma dokunuşun içinde başlamalı (iOS Safari)
    if (next) speak(greeting, { force: true, interrupt: true });
    else cancel();
    onChange?.(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!supported}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
      className={[
        "relative inline-flex min-h-11 min-w-11 select-none items-center justify-center gap-2 rounded-2xl px-3 transition active:scale-95 disabled:opacity-40",
        enabled ? "bg-sea text-white shadow-sm" : "bg-surface-2 text-ink-2 hover:bg-surface-3",
        className ?? "",
      ].join(" ")}
    >
      {enabled ? <Headphones className="size-5" aria-hidden /> : <HeadphoneOff className="size-5" aria-hidden />}
      {showLabel && <span className="text-sm font-semibold">{enabled ? "Sesli rehber açık" : "Sesli rehber"}</span>}
      {enabled && speaking && (
        <span className="absolute right-1.5 top-1.5 size-2 animate-pulse rounded-full bg-amber-300 ring-2 ring-sea" aria-hidden />
      )}
    </button>
  );
}
