// "Rehbere sor": günün planı hakkında kısa soru-cevap. Yanıtlar yalnızca verilen bağlama
// (plan günü, mekân adları/kategorileri/notları, bütçe durumu) dayanır; model saat ya da
// fiyat uyduramaz, emin değilse "bilmiyorum" der.
import { useEffect, useId, useRef, useState } from "react";
import { MessageCircle, RotateCcw, Send } from "lucide-react";
import { askGuide, type AiError, type GuideTurn } from "./core";
import { AiButton, AiErrorText, NoKeyHint, cx } from "./parts";
import { useAiConfig } from "./useAiConfig";

export interface GuideChatProps {
  /** Modele gidecek kompakt bağlam; core'daki buildGuideContext(plan, dayIndex, index, {budget, weather}) önerilir */
  context: unknown;
  title?: string;
  /** Hızlı soru önerileri */
  suggestions?: string[];
  onOpenSettings?: () => void;
  className?: string;
}

const DEFAULT_SUGGESTIONS = ["Yağmur yağarsa ne yapalım?", "Öğle yemeği nerede ve saat kaçta?", "Bugün bütçem nasıl gidiyor?"];

export function GuideChat({ context, title = "Rehbere sor", suggestions = DEFAULT_SUGGESTIONS, onOpenSettings, className }: GuideChatProps) {
  const { hasKey, loaded, callOptions } = useAiConfig();
  const [turns, setTurns] = useState<GuideTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputId = useId();

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, loading]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || !callOptions || loading) return;
    const ctl = new AbortController();
    abortRef.current = ctl;
    const history = turns;
    setTurns([...history, { role: "user", text: q }]);
    setInput("");
    setError(null);
    setLoading(true);
    const res = await askGuide(q, context, { ...callOptions, history, signal: ctl.signal });
    if (ctl.signal.aborted) return;
    setLoading(false);
    if (res.ok) {
      setTurns([...history, { role: "user", text: q }, { role: "assistant", text: res.value }]);
    } else {
      // Yanıtsız soruyu geçmişe bırakma; metni kutuya geri koy
      setTurns(history);
      setInput(q);
      setError(res.error);
    }
  }

  function reset() {
    abortRef.current?.abort();
    setTurns([]);
    setError(null);
    setLoading(false);
  }

  return (
    <section className={cx("flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4", className)} aria-label={title}>
      <header className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-2xl bg-sea-soft text-sea">
          <MessageCircle className="size-[18px]" aria-hidden />
        </span>
        <h2 className="flex-1 text-base font-bold text-ink">{title}</h2>
        {turns.length > 0 && (
          <AiButton variant="ghost" size="sm" icon={<RotateCcw className="size-3.5" aria-hidden />} onClick={reset}>
            Temizle
          </AiButton>
        )}
      </header>

      {loaded && !hasKey ? (
        <NoKeyHint onOpenSettings={onOpenSettings}>Rehbere soru sormak için Ayarlar'dan kendi Anthropic API anahtarını ekle.</NoKeyHint>
      ) : (
        <>
          <div ref={listRef} className="max-h-80 space-y-2 overflow-y-auto overscroll-contain" aria-live="polite">
            {turns.length === 0 && !loading && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    disabled={!hasKey}
                    className="min-h-9 rounded-full border border-line bg-bg px-3 text-sm text-ink-2 transition hover:border-sea hover:text-sea disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={cx("flex", t.role === "user" ? "justify-end" : "justify-start")}>
                <p
                  className={cx(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
                    t.role === "user" ? "rounded-br-md bg-brand text-brand-ink" : "rounded-bl-md bg-surface-2 text-ink",
                  )}
                >
                  {t.text}
                </p>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <p className="rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2 text-[15px] text-muted">
                  <span className="inline-flex gap-1" aria-label="Rehber yazıyor">
                    <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted" />
                  </span>
                </p>
              </div>
            )}
          </div>

          <AiErrorText error={error} />

          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              Sorun
            </label>
            <textarea
              id={inputId}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              maxLength={600}
              placeholder="Örn: Efes'ten sonra çay molası nerede?"
              disabled={!hasKey}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-bg px-3.5 py-2.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-sea focus:ring-2 focus:ring-sea/20"
            />
            <button
              type="submit"
              aria-label="Gönder"
              title="Gönder"
              disabled={!hasKey || loading || !input.trim()}
              className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sea text-white shadow-sm transition hover:brightness-110 active:scale-95 disabled:opacity-40"
            >
              <Send className="size-[18px]" aria-hidden />
            </button>
          </form>
          <p className="text-xs text-muted">
            Yanıtlar planındaki bilgilere dayanır; emin olmadığında “bilmiyorum” der. Saat ve fiyatları yerinde teyit et.
          </p>
        </>
      )}
    </section>
  );
}
