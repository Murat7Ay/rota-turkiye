// Serbest metinle gezi kurma: "LLM önerir, çözücü karar verir". Model yalnızca niyeti çıkarır;
// yerler paket kasabalarına, tarihler takvime kodla çözülür. Kullanıcı özeti, varsayımları ve
// anlaşılamayanları görüp "forma aktar" der; planı yine deterministik çözücü kurar.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CalendarDays, CircleAlert, Info, MapPin, Users, Wallet, WandSparkles, X } from "lucide-react";
import type { Interest, Pace, RegionPack, TransportMode, TripRequest } from "@rota/core";
import { fmtDateTr, parseTripRequest, type AiError, type ParsedTripRequest } from "./core";
import { AiButton, AiErrorText, NoKeyHint, cx, fmtNum, todayTrDate } from "./parts";
import { useAiConfig } from "./useAiConfig";

export interface FreeTextTripInputProps {
  /** Yüklü bölge paketi; yer adları yalnızca bunun kasabalarına çözülür */
  pack: RegionPack | null;
  /** Formdaki mevcut değerler (söylenmeyen alanlar için) */
  defaults?: Partial<TripRequest>;
  /** YYYY-MM-DD; verilmezse bugünün Türkiye tarihi */
  today?: string;
  onApply: (request: TripRequest) => void;
  /** Anahtar yoksa "Ayarlara git" bağlantısı gösterilir */
  onOpenSettings?: () => void;
  className?: string;
}

const EXAMPLE = "Kasımda 4 gün Ege, Selçuk'ta 2 gece Pamukkale'de 1 gece, tarih ve yemek, kişi başı 15 bin TL";

const INTEREST_LABEL: Record<Interest, string> = {
  tarih: "🏛️ Tarih",
  yemek: "🍲 Yemek",
  tatli: "🍯 Tatlı",
  doga: "🌿 Doğa",
  deniz: "🏖️ Deniz",
  alisveris: "🛍️ Alışveriş",
  kultur: "🎭 Kültür",
  fotograf: "📸 Fotoğraf",
};
const PACE_LABEL: Record<Pace, string> = { sakin: "Sakin tempo", dengeli: "Dengeli tempo", yogun: "Yoğun tempo" };
const TRANSPORT_LABEL: Record<TransportMode, string> = { araba: "Araba", yuruyus: "Yürüyüş", toplu: "Toplu taşıma" };
const CURRENCY_LABEL = { TRY: "TL", EUR: "€", USD: "$" } as const;

export function FreeTextTripInput({ pack, defaults, today, onApply, onOpenSettings, className }: FreeTextTripInputProps) {
  const { hasKey, callOptions, loaded } = useAiConfig();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  const [result, setResult] = useState<ParsedTripRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const id = useId();

  useEffect(() => () => abortRef.current?.abort(), []);

  const disabled = !hasKey || !pack;

  async function onParse() {
    if (!callOptions || !pack || loading) return;
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await parseTripRequest(text, pack, defaults ?? {}, { ...callOptions, today: today ?? todayTrDate(), signal: ctl.signal });
    if (ctl.signal.aborted) return;
    setLoading(false);
    if (res.ok) setResult(res.value);
    else setError(res.error);
  }

  function onCancel() {
    abortRef.current?.abort();
    setLoading(false);
  }

  return (
    <section className={cx("space-y-3 rounded-3xl border border-line bg-surface p-4 sm:p-5", className)} aria-labelledby={`${id}-t`}>
      <header className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-2xl bg-brand-soft text-brand">
          <WandSparkles className="size-[18px]" aria-hidden />
        </span>
        <div>
          <h2 id={`${id}-t`} className="text-base font-bold text-ink">
            Anlat, biz kuralım
          </h2>
          <p className="text-xs text-muted">Yapay zekâ isteğini anlar; planı uygulamanın çözücüsü kurar.</p>
        </div>
      </header>

      <label htmlFor={id} className="sr-only">
        Nasıl bir gezi istiyorsun?
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void onParse();
        }}
        rows={4}
        maxLength={2000}
        disabled={disabled && loaded}
        placeholder={`Nasıl bir gezi istiyorsun? Örn: ${EXAMPLE}`}
        className="w-full resize-y rounded-2xl border border-line bg-bg p-3.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
      />

      {loaded && !hasKey && <NoKeyHint onOpenSettings={onOpenSettings}>Serbest metinle gezi kurmak için Ayarlar'dan yapay zekâ bağlantını kur (Anthropic ya da OpenAI uyumlu). Formu elle doldurmak her zaman mümkün.</NoKeyHint>}
      {hasKey && !pack && <NoKeyHint>Önce bir bölge paketi seç; yer adları o paketteki yerleşimlere eşlenir.</NoKeyHint>}

      <div className="flex flex-wrap items-center gap-2">
        <AiButton
          variant="primary"
          icon={<WandSparkles className="size-4" aria-hidden />}
          loading={loading}
          disabled={disabled || text.trim().length < 3}
          onClick={() => void onParse()}
        >
          {loading ? "Anlıyorum…" : "İsteği anla"}
        </AiButton>
        {loading && (
          <AiButton variant="ghost" size="sm" onClick={onCancel}>
            Vazgeç
          </AiButton>
        )}
        {!text && !disabled && (
          <AiButton variant="ghost" size="sm" onClick={() => setText(EXAMPLE)}>
            Örneği dene
          </AiButton>
        )}
      </div>

      <AiErrorText error={error} />

      {result && (
        <ParsedSummary
          result={result}
          onApply={() => onApply(result.request)}
          onDismiss={() => setResult(null)}
        />
      )}
    </section>
  );
}

function ParsedSummary({ result, onApply, onDismiss }: { result: ParsedTripRequest; onApply: () => void; onDismiss: () => void }) {
  const r = result.request;
  const nights = r.stays.reduce((a, s) => a + s.nights, 0);
  const days = nights + (r.end ? 1 : 0);
  const cur = CURRENCY_LABEL[r.budget.currency];

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-bg p-3.5">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-[15px] font-bold text-ink">{r.title}</h3>
        <button type="button" onClick={onDismiss} aria-label="Özeti kapat" title="Özeti kapat" className="grid size-8 place-items-center rounded-xl text-muted hover:bg-surface-2">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <dl className="grid gap-2 text-sm text-ink-2">
        <Row icon={<CalendarDays className="size-4" aria-hidden />} label="Tarih">
          {fmtDateTr(r.startDate)} · {days} gün / {nights} gece
        </Row>
        <Row icon={<MapPin className="size-4" aria-hidden />} label="Rota">
          <span className="flex flex-wrap items-center gap-1">
            <Stop>{r.start.name}</Stop>
            {r.stays.map((s, i) => (
              <span key={`${s.id}-${i}`} className="inline-flex items-center gap-1">
                <ArrowRight className="size-3.5 text-muted" aria-hidden />
                <Stop strong>
                  {s.name} · {s.nights} gece
                </Stop>
              </span>
            ))}
            {r.end && (
              <span className="inline-flex items-center gap-1">
                <ArrowRight className="size-3.5 text-muted" aria-hidden />
                <Stop>{r.end.name}</Stop>
              </span>
            )}
          </span>
        </Row>
        <Row icon={<Users className="size-4" aria-hidden />} label="Kişi ve tempo">
          {r.travelers} kişi · {PACE_LABEL[r.pace]} · {TRANSPORT_LABEL[r.transport]} · {r.visitor === "yabanci" ? "Yabancı ziyaretçi" : "Yerli ziyaretçi"}
          {r.hasMuzekart ? " · Müzekart" : ""}
          {r.diet.vegetarian ? " · Vejetaryen" : ""}
          {r.diet.noAlcohol ? " · Alkolsüz" : ""}
        </Row>
        <Row icon={<Wallet className="size-4" aria-hidden />} label="Bütçe">
          Toplam {fmtNum(r.budget.amount)} {cur} · gün {r.dayStart}–{r.dayEnd}
        </Row>
      </dl>

      <div className="flex flex-wrap gap-1.5">
        {r.interests.map((i) => (
          <span key={i} className="rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
            {INTEREST_LABEL[i]}
          </span>
        ))}
      </div>

      {result.assumptions.length > 0 && (
        <div className="rounded-2xl bg-sea-soft p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-sea">
            <Info className="size-3.5" aria-hidden /> Varsayımlar
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-2">
            {result.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {result.unresolved.length > 0 && (
        <div className="rounded-2xl bg-warn-soft p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-warn">
            <CircleAlert className="size-3.5" aria-hidden /> Anlaşılamayanlar
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-2">
            {result.unresolved.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <AiButton variant="primary" icon={<ArrowRight className="size-4" aria-hidden />} onClick={onApply}>
          Bu isteği forma aktar
        </AiButton>
        <p className="self-center text-xs text-muted">Aktardıktan sonra formda her alanı değiştirebilirsin.</p>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="mt-0.5 text-muted" title={label}>
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function Stop({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <span className={cx("rounded-lg px-2 py-0.5 text-[13px]", strong ? "bg-surface-3 font-semibold text-ink" : "bg-surface-2 text-ink-2")}>{children}</span>
  );
}
