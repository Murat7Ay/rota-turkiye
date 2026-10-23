// Ayarlar ekranı için sesli rehber paneli: aç/kapa, ses seçimi, hız, ton ve deneme.
import type { CSSProperties } from "react";
import { Play, Square } from "lucide-react";
import { useSpeech } from "./useSpeech";
import { VoiceToggle } from "./VoiceToggle";

const SAMPLE =
  "İleride, on iki kilometre sonra bir antik kent var. Rotadan beş dakikalık sapma. Uğramak ister misin?";

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm text-ink-2">
        {label}
        <span className="tabular text-muted">{value.toFixed(1).replace(".", ",")}×</span>
      </span>
      <input
        type="range"
        className="range"
        min={0.6}
        max={1.6}
        step={0.1}
        value={value}
        style={{ "--fill": `${Math.round((value - 0.6) * 100)}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function VoiceSettings({ className }: { className?: string }) {
  const { supported, voices, voice, prefs, setPrefs, speak, cancel, speaking } = useSpeech();

  if (!supported) {
    return (
      <div className={`rounded-3xl border border-line bg-surface p-4 text-sm text-muted ${className ?? ""}`}>
        Bu tarayıcı sesli okumayı (Web Speech API) desteklemiyor. Sesli rehber için güncel Chrome, Safari ya da Edge kullan.
      </div>
    );
  }

  return (
    <div className={`space-y-4 rounded-3xl border border-line bg-surface p-4 ${className ?? ""}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">Sesli rehber</p>
          <p className="text-sm text-muted">Sabah brifingi ve "ileride şu var" bildirimleri sesli okunur.</p>
        </div>
        <VoiceToggle />
      </div>

      {voices.length === 0 ? (
        <p className="rounded-2xl bg-warn-soft px-3 py-2 text-sm text-warn">
          Cihazında Türkçe ses bulunamadı; metin varsayılan sesle okunur. Telefonun metin okuma ayarlarından Türkçe ses
          ekleyebilirsin.
        </p>
      ) : (
        <label className="block text-sm text-ink-2">
          Ses
          <select
            className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-surface-2 px-3"
            value={prefs.voiceURI ?? ""}
            onChange={(e) => setPrefs({ voiceURI: e.target.value || undefined })}
          >
            <option value="">Otomatik{voice ? ` (${voice.name})` : ""}</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
                {v.localService ? " · çevrimdışı" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <Slider label="Hız" value={prefs.rate} onChange={(rate) => setPrefs({ rate })} />
      <Slider label="Ton" value={prefs.pitch} onChange={(pitch) => setPrefs({ pitch })} />

      <button
        type="button"
        onClick={() => (speaking ? cancel() : speak(SAMPLE, { force: true, interrupt: true }))}
        className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-surface-2 px-4 text-sm font-semibold text-ink hover:bg-surface-3"
      >
        {speaking ? <Square className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        {speaking ? "Durdur" : "Dene"}
      </button>
    </div>
  );
}
