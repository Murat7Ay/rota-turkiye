// "Rehber gibi anlat": sabah brifingini sıcak bir rehber paragrafına çevirir. Metin yalnızca
// brifingdeki adlara/saatlere dayanır; dayanaksız çıktı çekirdekte reddedilir. Aynı brifing
// için sonuç bellekte tutulur (tekrar tıklamak ücret doğurmaz).
import { useEffect, useRef, useState } from "react";
import { RefreshCw, Sparkles, Square, Volume2, X } from "lucide-react";
import type { Briefing } from "@rota/core";
import { briefingPayload, narrateBriefing, type AiError } from "./core";
import { AiButton, AiErrorText, cx } from "./parts";
import { useAiConfig } from "./useAiConfig";

const cache = new Map<string, string>();

export interface NarrationButtonProps {
  briefing: Briefing;
  /** Anahtar yoksa hiç gösterme (varsayılan true) */
  hideWhenNoKey?: boolean;
  className?: string;
}

export function NarrationButton({ briefing, hideWhenNoKey = true, className }: NarrationButtonProps) {
  const { hasKey, callOptions, config } = useAiConfig();
  const key = `${config.model}|${JSON.stringify(briefingPayload(briefing))}`;
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Brifing değişince eski anlatımı gösterme
  useEffect(() => {
    setText(cache.get(key) ?? null);
    setError(null);
  }, [key]);
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
    [],
  );

  if (!hasKey && hideWhenNoKey) return null;

  async function narrate(force = false) {
    if (!callOptions || loading) return;
    const cached = cache.get(key);
    if (cached && !force) {
      setText(cached);
      return;
    }
    const ctl = new AbortController();
    abortRef.current = ctl;
    setLoading(true);
    setError(null);
    const res = await narrateBriefing(briefing, { ...callOptions, signal: ctl.signal });
    if (ctl.signal.aborted) return;
    setLoading(false);
    if (res.ok) {
      cache.set(key, res.value);
      setText(res.value);
    } else {
      setError(res.error);
    }
  }

  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  function toggleSpeak() {
    if (!text || !canSpeak) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "tr-TR";
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  }

  return (
    <div className={cx("space-y-2", className)}>
      {!text && (
        <AiButton
          variant="secondary"
          size="sm"
          icon={<Sparkles className="size-4 text-brand" aria-hidden />}
          loading={loading}
          disabled={!hasKey}
          title={hasKey ? undefined : "Ayarlar'dan API anahtarı ekle"}
          onClick={() => void narrate()}
        >
          {loading ? "Rehber hazırlanıyor…" : "Rehber gibi anlat"}
        </AiButton>
      )}

      {text && (
        <figure className="relative rounded-2xl border border-brand/20 bg-brand-soft/60 p-3.5 pr-10">
          <blockquote className="text-[15px] leading-relaxed text-ink">{text}</blockquote>
          <figcaption className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <Sparkles className="size-3.5 text-brand" aria-hidden />
            <span className="mr-auto">Yapay zekâ anlatımı · yalnızca bugünkü plana dayanır</span>
            {canSpeak && (
              <AiButton variant="ghost" size="sm" icon={speaking ? <Square className="size-3.5" aria-hidden /> : <Volume2 className="size-3.5" aria-hidden />} onClick={toggleSpeak}>
                {speaking ? "Durdur" : "Dinle"}
              </AiButton>
            )}
            <AiButton variant="ghost" size="sm" icon={<RefreshCw className="size-3.5" aria-hidden />} loading={loading} onClick={() => void narrate(true)}>
              Yeniden
            </AiButton>
          </figcaption>
          <button
            type="button"
            onClick={() => {
              window.speechSynthesis?.cancel();
              setSpeaking(false);
              setText(null);
            }}
            aria-label="Anlatımı kapat"
            title="Anlatımı kapat"
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-xl text-muted hover:bg-surface-2"
          >
            <X className="size-4" aria-hidden />
          </button>
        </figure>
      )}

      <AiErrorText error={error} />
    </div>
  );
}
