// "Şimdi ne yapsam?" — yüzen düğme + alt sayfa. Konuma, saate, havaya ve bütçeye göre 3 farklı
// mini öneri; her biri kısa bir zaman çizelgesiyle. Tek elle kullanım: büyük dokunma hedefleri,
// alt kenara yakın eylem düğmeleri. Hesap tamamen cihazda (çevrimdışı) yapılır.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Car, Footprints, RefreshCw, Sparkles, Volume2, VolumeX, Wallet, X } from "lucide-react";
import { formatHHmm, type PlanContext } from "@rota/core";
import { suggestNow, type NowInput, type NowStop, type NowSuggestion } from "../../../../../packages/core/src/now";
import { nowSuggestionsToSpeech } from "../voice/speak";
import { cancelSpeech, speak, useSpeech } from "../voice/useSpeech";

export interface NowButtonProps {
  /**
   * Öneri girdisi. Fonksiyon verilirse düğmeye basıldığı anda çağrılır (saat/konum taze olur — önerilir).
   * null: konum henüz yok.
   */
  input: NowInput | null | (() => NowInput | null);
  /** Bölge paketi + yol modeli; null: paket yüklenmedi */
  ctx: PlanContext | null;
  /** "Bunu yap" — seçilen öneri (ör. plana ekle / yol tarifini aç) */
  onPick: (s: NowSuggestion) => void;
  /** Hazır öneri listesi verilirse hesap yapılmaz (test/önizleme) */
  suggestions?: NowSuggestion[];
  /** true (varsayılan): sağ altta yüzen hap düğme; false: satır içi düğme */
  floating?: boolean;
  className?: string;
  label?: string;
  /** Sesli rehber açıksa öneriler açılışta okunur (varsayılan true) */
  autoSpeak?: boolean;
}

const fmtTry = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

function TravelChip({ stop }: { stop: NowStop }) {
  if (stop.walkMin !== undefined) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-sea">
        <Footprints className="size-3.5" aria-hidden />
        {stop.walkMin <= 0 ? "yanında" : `${stop.walkMin} dk`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-medium text-sea">
      <Car className="size-3.5" aria-hidden />
      {stop.driveMin ?? 0} dk
    </span>
  );
}

function MiniTimeline({ stops }: { stops: NowStop[] }) {
  return (
    <ol className="mt-3 rounded-2xl bg-surface-2 px-3 py-3">
      {stops.map((st, i) => (
        <li key={`${st.placeId}-${i}`} className="flex gap-3">
          <div className="w-11 shrink-0 pt-px text-right text-sm font-bold text-ink tabular">{formatHHmm(st.arriveMin)}</div>
          <div className="flex flex-col items-center" aria-hidden>
            <span className="mt-1.5 size-2.5 rounded-full bg-brand ring-4 ring-brand-soft" />
            {i < stops.length - 1 && <span className="my-1 w-0.5 flex-1 rounded-full bg-line" />}
          </div>
          <div className={`min-w-0 flex-1 ${i < stops.length - 1 ? "pb-3" : ""}`}>
            <p className="truncate text-sm font-semibold text-ink">
              <span aria-hidden>{st.emoji}</span> {st.name}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-snug text-muted">
              <TravelChip stop={st} />
              <span>{st.note}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SuggestionCard({ s, primary, onPick }: { s: NowSuggestion; primary: boolean; onPick: (s: NowSuggestion) => void }) {
  return (
    <article
      className={`rounded-3xl border bg-surface p-4 shadow-card ${primary ? "border-brand/40 ring-1 ring-brand/25" : "border-line"}`}
    >
      <div className="flex items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-2xl" aria-hidden>
          {s.emoji}
        </div>
        <div className="min-w-0 flex-1">
          {primary && (
            <span className="mb-1 inline-block rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold tracking-wide text-brand-ink">
              ÖNERİM
            </span>
          )}
          <h3 className="text-[15px] font-bold leading-snug text-ink">{s.title}</h3>
          <p className="mt-0.5 text-sm leading-snug text-muted">{s.subtitle}</p>
        </div>
      </div>

      <MiniTimeline stops={s.stops} />

      {s.reasons.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {s.reasons.map((r) => (
            <li key={r} className="rounded-full bg-sea-soft px-2.5 py-1 text-xs font-medium text-sea">
              {r}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-2" title="Bütün yolcular için tahmini">
          <Wallet className="size-4 text-muted" aria-hidden />
          {s.totalCostTry > 0 ? `~${fmtTry(s.totalCostTry)} TL` : "Ücretsiz"}
        </span>
        <button
          type="button"
          onClick={() => onPick(s)}
          className="ml-auto inline-flex min-h-11 items-center justify-center rounded-2xl bg-brand px-5 text-[15px] font-semibold text-brand-ink shadow-sm transition hover:bg-brand-strong active:scale-[0.98]"
        >
          Bunu yap
        </button>
      </div>
    </article>
  );
}

export function NowButton({
  input,
  ctx,
  onPick,
  suggestions,
  floating = true,
  className,
  label = "Şimdi ne yapsam?",
  autoSpeak = true,
}: NowButtonProps) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<NowSuggestion[] | null>(null);
  const [atMin, setAtMin] = useState<number | null>(null);
  const [horizon, setHorizon] = useState(180);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { supported: voiceOk, speaking } = useSpeech();
  const panelRef = useRef<HTMLDivElement>(null);

  // Her render'da güncel girdiyi tut (düğmeye basıldığı anki değer kullanılsın)
  const latest = useRef({ input, ctx, suggestions, autoSpeak });
  latest.current = { input, ctx, suggestions, autoSpeak };

  const compute = useCallback(() => {
    const { input: inp0, ctx: c, suggestions: given, autoSpeak: say } = latest.current;
    if (given) {
      setList(given);
      setProblem(null);
      return;
    }
    const inp = typeof inp0 === "function" ? inp0() : inp0;
    if (!inp || !c) {
      setList([]);
      setProblem(!inp ? "Konumun henüz yok — konumu aç ya da simülasyonu başlat." : "Bölge paketi henüz yüklenmedi.");
      return;
    }
    setBusy(true);
    // Alt sayfa animasyonu takılmasın diye hesabı bir sonraki kareye bırak
    window.setTimeout(() => {
      try {
        const r = suggestNow(inp, c);
        setList(r);
        setAtMin(inp.nowMin);
        setHorizon(inp.horizonMin ?? 180);
        setProblem(null);
        if (say) speak(nowSuggestionsToSpeech(r), { interrupt: true });
      } catch (err) {
        console.warn("[now] suggestNow:", err);
        setList([]);
        setProblem("Öneriler şu an hesaplanamadı.");
      } finally {
        setBusy(false);
      }
    }, 30);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (speaking) cancelSpeech();
  }, [speaking]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      window.clearTimeout(t);
    };
  }, [open, close]);

  function openSheet() {
    setOpen(true);
    setList(null);
    setProblem(null);
    compute();
  }

  function pick(s: NowSuggestion) {
    cancelSpeech();
    setOpen(false);
    onPick(s);
  }

  const trigger = (
    <button
      type="button"
      onClick={openSheet}
      aria-haspopup="dialog"
      className={[
        "inline-flex min-h-13 select-none items-center gap-2 rounded-full bg-[linear-gradient(135deg,#C2410C,#EA580C)] px-5 text-[15px] font-bold text-white shadow-lift transition active:scale-95",
        floating ? "fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-40" : "",
        className ?? "",
      ].join(" ")}
    >
      <Sparkles className="size-5" aria-hidden />
      {label}
    </button>
  );

  const hours = Math.round(horizon / 60);
  const subtitle =
    atMin !== null ? `Saat ${formatHHmm(atMin)} · önümüzdeki ${hours} saat için` : "Konumuna, saate ve havaya göre";

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <div className="absolute inset-0 animate-fade bg-black/45 backdrop-blur-[2px]" onClick={close} aria-hidden />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Şimdi ne yapsam?"
              tabIndex={-1}
              className="relative flex max-h-[90dvh] w-full animate-slide-up flex-col rounded-t-[28px] bg-bg shadow-lift outline-none sm:max-w-lg sm:animate-pop sm:rounded-[28px]"
            >
              <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-surface-3 sm:hidden" aria-hidden />
              <div className="flex items-center gap-3 px-5 pb-3 pt-3 sm:pt-5">
                <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#C2410C,#EA580C)] text-white">
                  <Sparkles className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold leading-tight text-ink">Şimdi ne yapsam?</h2>
                  <p className="truncate text-sm text-muted">{subtitle}</p>
                </div>
                {voiceOk && list && list.length > 0 && (
                  <button
                    type="button"
                    onClick={() => (speaking ? cancelSpeech() : speak(nowSuggestionsToSpeech(list), { force: true, interrupt: true }))}
                    aria-label={speaking ? "Okumayı durdur" : "Önerileri sesli oku"}
                    title={speaking ? "Okumayı durdur" : "Önerileri sesli oku"}
                    className="grid size-11 place-items-center rounded-2xl text-ink-2 transition hover:bg-surface-2 active:scale-95"
                  >
                    {speaking ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={compute}
                  disabled={busy}
                  aria-label="Yenile"
                  title="Yenile"
                  className="grid size-11 place-items-center rounded-2xl text-ink-2 transition hover:bg-surface-2 active:scale-95 disabled:opacity-40"
                >
                  <RefreshCw className={`size-5 ${busy ? "animate-spin" : ""}`} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Kapat"
                  title="Kapat"
                  className="-mr-2 grid size-11 place-items-center rounded-2xl text-ink-2 transition hover:bg-surface-2 active:scale-95"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>

              <div className="safe-bottom min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-5">
                {(busy || list === null) && !problem && (
                  <div className="space-y-3" aria-busy="true" aria-live="polite">
                    <p className="sr-only">Öneriler hazırlanıyor…</p>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-40 animate-pulse rounded-3xl bg-surface-2" />
                    ))}
                  </div>
                )}
                {!busy && list !== null && list.length === 0 && (
                  <div className="rounded-3xl border border-line bg-surface p-5 text-center">
                    <p className="text-3xl" aria-hidden>
                      🧭
                    </p>
                    <p className="mt-2 font-semibold text-ink">{problem ?? "Şu an yakında açık ve uygun bir yer bulamadım."}</p>
                    {!problem && <p className="mt-1 text-sm text-muted">Biraz sonra yeniden dene; açılış saatleri değiştikçe öneriler de değişir.</p>}
                  </div>
                )}
                {!busy &&
                  list?.map((s, i) => <SuggestionCard key={s.id} s={s} primary={i === 0} onPick={pick} />)}
                {!busy && list && list.length > 0 && (
                  <p className="px-1 text-center text-xs text-muted">
                    Saatler ve fiyatlar tahminidir; çalışma saati doğrulanmamış yerler not edilir.
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
