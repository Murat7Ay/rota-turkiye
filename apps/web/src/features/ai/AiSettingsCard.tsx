// Ayarlar: isteğe bağlı yapay zekâ ("kendi anahtarını getir"). Sağlayıcı Anthropic ya da OpenAI
// uyumlu bir uç (OpenAI, OpenRouter, Groq, Ollama, LM Studio …) olabilir. Anahtar yalnızca bu
// cihazda IndexedDB'de durur; istekler tarayıcıdan doğrudan sağlayıcıya gider, arada sunucu yoktur.
import { useEffect, useId, useState } from "react";
import { CircleCheck, ExternalLink, Eye, EyeOff, Lock, PlugZap, Sparkles, Trash2 } from "lucide-react";
import { AI_MODELS, OPENAI_PRESETS, testConnection, type AiError, type AiModelId, type AiProvider } from "./core";
import { AiButton, AiErrorText, cx } from "./parts";
import { toCallOptions, useAiConfig } from "./useAiConfig";

const maskKey = (k: string) => (k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-4)}` : "••••••");

const fieldClass =
  "min-h-11 w-full rounded-2xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20";

const PROVIDERS: Array<{ value: AiProvider; label: string }> = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI uyumlu" },
];

export function AiSettingsCard({ className }: { className?: string }) {
  const { loaded, config, hasKey, save, clearKey } = useAiConfig();
  const isOa = config.provider === "openai";
  const savedKey = isOa ? config.oaApiKey : config.apiKey;
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  const [okText, setOkText] = useState<string | null>(null);
  // OpenAI uyumlu uç: adres ve model alanları yazarken değil, alandan çıkınca kaydedilir
  const [baseUrl, setBaseUrl] = useState(config.oaBaseUrl);
  const [oaModel, setOaModel] = useState(config.oaModel);
  const keyId = useId();
  const modelId = useId();
  const urlId = useId();

  useEffect(() => {
    setBaseUrl(config.oaBaseUrl);
    setOaModel(config.oaModel);
  }, [config.oaBaseUrl, config.oaModel]);

  const trimmed = draft.trim();
  const looksOdd = !isOa && trimmed.length > 0 && !trimmed.startsWith("sk-ant-");
  const httpRemote = isOa && /^http:\/\//i.test(baseUrl) && !/^http:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(baseUrl);

  const flash = (text: string | null, err: AiError | null = null) => {
    setOkText(text);
    setError(err);
  };

  async function onSave() {
    if (!trimmed) return;
    const persisted = await save(isOa ? { oaApiKey: trimmed } : { apiKey: trimmed });
    setDraft("");
    setShow(false);
    flash(persisted ? "Anahtar bu cihaza kaydedildi." : "Anahtar bu oturum için kullanılacak; tarayıcı kalıcı kaydı engelledi.");
  }

  async function onTest() {
    const draftConfig = isOa
      ? { ...config, oaBaseUrl: baseUrl, oaModel, oaApiKey: trimmed || config.oaApiKey }
      : { ...config, apiKey: trimmed || config.apiKey };
    const opts = toCallOptions(draftConfig);
    if (!opts) return;
    setTesting(true);
    flash(null);
    const res = await testConnection(opts);
    setTesting(false);
    if (res.ok) {
      const name = res.value.displayName ?? (isOa ? undefined : AI_MODELS.find((m) => m.id === config.model)?.label) ?? res.value.model;
      flash(`Bağlantı başarılı: ${name} kullanılabilir.${trimmed && trimmed !== savedKey ? " Kullanmak için Kaydet'e bas." : ""}`);
    } else {
      flash(null, res.error);
    }
  }

  async function onClear() {
    await clearKey();
    setDraft("");
    flash(isOa ? "Uç ayarları bu cihazdan silindi." : "Anahtar bu cihazdan silindi.");
  }

  const canTest = isOa ? !!baseUrl.trim() && !!oaModel.trim() : !!trimmed || !!config.apiKey;

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
            Plan her zaman cihazında, yapay zekâ olmadan hesaplanır. Kendi Anthropic anahtarını ya da OpenAI uyumlu bir ucu (OpenAI, OpenRouter,
            Groq, Ollama, LM Studio…) bağlarsan serbest metinle gezi kurma, “Rehber gibi anlat” ve “Rehbere sor” açılır.
          </p>
        </div>
      </header>

      <div role="radiogroup" aria-label="Sağlayıcı" className="flex gap-1 rounded-2xl bg-surface-2 p-1">
        {PROVIDERS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={config.provider === p.value}
            disabled={!loaded}
            onClick={() => {
              setDraft("");
              flash(null);
              void save({ provider: p.value });
            }}
            className={cx(
              "flex min-h-10 flex-1 items-center justify-center rounded-xl px-2 text-sm font-semibold transition",
              config.provider === p.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {hasKey && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-good-soft px-3 py-2.5 text-sm text-good">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 break-words">
            {isOa ? (
              <>
                Bağlı: <code className="font-mono text-[13px]">{config.oaModel}</code> @ {config.oaBaseUrl.replace(/^https?:\/\//, "")}
                {config.oaApiKey && <> · anahtar <code className="font-mono text-[13px]">{maskKey(config.oaApiKey)}</code></>}
              </>
            ) : (
              <>
                Kayıtlı anahtar: <code className="font-mono text-[13px]">{maskKey(config.apiKey)}</code>
              </>
            )}
          </span>
        </div>
      )}

      {isOa && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-ink">Hazır uçlar</span>
            <div className="flex flex-wrap gap-1.5">
              {OPENAI_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={baseUrl === p.baseUrl}
                  onClick={() => {
                    setBaseUrl(p.baseUrl);
                    if (p.model && !oaModel) setOaModel(p.model);
                    void save({ oaBaseUrl: p.baseUrl, ...(p.model && !oaModel ? { oaModel: p.model } : {}) });
                  }}
                  className={cx(
                    "min-h-9 rounded-full border px-3 text-sm font-medium transition",
                    baseUrl === p.baseUrl ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-ink-2 hover:bg-surface-2",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={urlId} className="text-sm font-semibold text-ink">
              Uç adresi (base URL)
            </label>
            <input
              id={urlId}
              type="url"
              inputMode="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              onBlur={() => void save({ oaBaseUrl: baseUrl })}
              placeholder="https://api.openai.com/v1"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={!loaded}
              className={cx(fieldClass, "font-mono")}
            />
            <p className="text-xs text-muted">İstekler bu adresin sonuna /chat/completions eklenerek gönderilir. Uç tarayıcıdan gelen isteğe (CORS) izin vermeli.</p>
            {httpRemote && <p className="text-xs text-warn">Uzak bir adrese şifresiz http ile bağlanıyorsun; anahtarın açıkta gider. Mümkünse https kullan.</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor={modelId} className="text-sm font-semibold text-ink">
              Model adı
            </label>
            <input
              id={modelId}
              value={oaModel}
              onChange={(e) => setOaModel(e.target.value)}
              onBlur={() => void save({ oaModel })}
              placeholder="ör. gpt-5-mini, llama3.3, qwen3"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={!loaded}
              className={cx(fieldClass, "font-mono")}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor={keyId} className="text-sm font-semibold text-ink">
          {savedKey ? "Yeni API anahtarı" : isOa ? "API anahtarı (yerel sunucularda gerekmez)" : "Anthropic API anahtarı"}
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
              placeholder={isOa ? "sk-…" : "sk-ant-…"}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={!loaded}
              className={cx(fieldClass, "pr-11 font-mono")}
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
        {!isOa && (
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs font-semibold text-sea hover:underline"
          >
            Anahtar al: console.anthropic.com <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>

      {!isOa && (
        <div className="space-y-1.5">
          <label htmlFor={modelId} className="text-sm font-semibold text-ink">
            Model
          </label>
          <select id={modelId} value={config.model} onChange={(e) => void save({ model: e.target.value as AiModelId })} className={cx(fieldClass, "px-3")}>
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.hint}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <AiButton variant="sea" icon={<PlugZap className="size-4" aria-hidden />} loading={testing} disabled={!canTest} onClick={() => void onTest()}>
          Bağlantıyı test et
        </AiButton>
        {(savedKey || (isOa && config.oaBaseUrl)) && (
          <AiButton variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => void onClear()} className="text-bad">
            {isOa ? "Uç ayarlarını sil" : "Anahtarı sil"}
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
          Anahtarın yalnızca bu cihazda saklanır; istekler doğrudan seçtiğin sağlayıcıya gider ve ücret o hesaptan düşer. Yapay zekâ yalnızca
          önerir ve açıklar; saatleri ve sırayı her zaman uygulamanın kendi çözücüsü belirler.
        </span>
      </p>
    </section>
  );
}
