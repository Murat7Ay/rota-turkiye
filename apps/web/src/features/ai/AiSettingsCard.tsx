// Ayarlar: isteğe bağlı yapay zekâ ("kendi anahtarını getir"). Anahtar yalnızca bu cihazda
// IndexedDB'de durur; istekler tarayıcıdan doğrudan Anthropic'e gider, arada sunucu yoktur.
import { useId, useState } from "react";
import { CircleCheck, ExternalLink, Eye, EyeOff, Lock, PlugZap, Sparkles, Trash2 } from "lucide-react";
import { AI_MODELS, testConnection, type AiError, type AiModelId } from "./core";
import { AiButton, AiErrorText, cx } from "./parts";
import { useAiConfig } from "./useAiConfig";

const maskKey = (k: string) => (k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-4)}` : "••••••");

export function AiSettingsCard({ className }: { className?: string }) {
  const { loaded, config, hasKey, save, clearKey } = useAiConfig();
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  const [okText, setOkText] = useState<string | null>(null);
  const keyId = useId();
  const modelId = useId();

  const trimmed = draft.trim();
  const looksOdd = trimmed.length > 0 && !trimmed.startsWith("sk-ant-");

  const flash = (text: string | null, err: AiError | null = null) => {
    setOkText(text);
    setError(err);
  };

  async function onSave() {
    if (!trimmed) return;
    const persisted = await save({ apiKey: trimmed });
    setDraft("");
    setShow(false);
    flash(persisted ? "Anahtar bu cihaza kaydedildi." : "Anahtar bu oturum için kullanılacak; tarayıcı kalıcı kaydı engelledi.");
  }

  async function onTest() {
    const apiKey = trimmed || config.apiKey;
    if (!apiKey) return;
    setTesting(true);
    flash(null);
    const res = await testConnection({ apiKey, model: config.model });
    setTesting(false);
    if (res.ok) {
      const name = res.value.displayName ?? AI_MODELS.find((m) => m.id === config.model)?.label ?? res.value.model;
      flash(`Bağlantı başarılı: ${name} kullanılabilir.${trimmed && trimmed !== config.apiKey ? " Kullanmak için Kaydet'e bas." : ""}`);
    } else {
      flash(null, res.error);
    }
  }

  async function onClear() {
    await clearKey();
    setDraft("");
    flash("Anahtar bu cihazdan silindi.");
  }

  return (
    <section className={cx("space-y-4 rounded-3xl border border-line bg-surface p-4 sm:p-5", className)} aria-labelledby={`${keyId}-title`}>
      <header className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${keyId}-title`} className="text-base font-bold text-ink">
              Yapay zekâ rehberi
            </h2>
            <span className="rounded-full bg-sea-soft px-2 py-0.5 text-xs font-semibold text-sea">İsteğe bağlı</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            Plan her zaman cihazında, yapay zekâ olmadan hesaplanır. Kendi Anthropic API anahtarını eklersen serbest metinle gezi kurma,
            “Rehber gibi anlat” ve “Rehbere sor” açılır.
          </p>
        </div>
      </header>

      {hasKey && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-good-soft px-3 py-2.5 text-sm text-good">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            Kayıtlı anahtar: <code className="font-mono text-[13px]">{maskKey(config.apiKey)}</code>
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor={keyId} className="text-sm font-semibold text-ink">
          {hasKey ? "Yeni API anahtarı" : "Anthropic API anahtarı"}
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              id={keyId}
              type={show ? "text" : "password"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSave();
              }}
              placeholder="sk-ant-…"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={!loaded}
              className="min-h-11 w-full rounded-2xl border border-line bg-surface px-3.5 pr-11 font-mono text-[15px] text-ink outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Anahtarı gizle" : "Anahtarı göster"}
              title={show ? "Anahtarı gizle" : "Anahtarı göster"}
              className="absolute inset-y-0 right-1 my-auto grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink"
            >
              {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
          <AiButton variant="primary" onClick={() => void onSave()} disabled={!trimmed}>
            Kaydet
          </AiButton>
        </div>
        {looksOdd && <p className="text-xs text-warn">Anthropic anahtarları genellikle “sk-ant-” ile başlar; doğru anahtarı yapıştırdığından emin ol.</p>}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-xs font-semibold text-sea hover:underline"
        >
          Anahtar al: console.anthropic.com <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={modelId} className="text-sm font-semibold text-ink">
          Model
        </label>
        <select
          id={modelId}
          value={config.model}
          onChange={(e) => void save({ model: e.target.value as AiModelId })}
          className="min-h-11 w-full rounded-2xl border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        >
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — {m.hint}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <AiButton variant="sea" icon={<PlugZap className="size-4" aria-hidden />} loading={testing} disabled={!trimmed && !hasKey} onClick={() => void onTest()}>
          Bağlantıyı test et
        </AiButton>
        {hasKey && (
          <AiButton variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => void onClear()} className="text-bad">
            Anahtarı sil
          </AiButton>
        )}
      </div>

      {okText && (
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-good-soft p-3 text-sm text-good">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{okText}</span>
        </p>
      )}
      <AiErrorText error={error} />

      <p className="flex items-start gap-2 text-xs text-muted">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Anahtarın yalnızca bu cihazda saklanır; istekler doğrudan Anthropic'e gider. Ücret Anthropic hesabından düşer. Yapay zekâ yalnızca
          önerir ve açıklar; saatleri ve sırayı her zaman uygulamanın kendi çözücüsü belirler.
        </span>
      </p>
    </section>
  );
}
