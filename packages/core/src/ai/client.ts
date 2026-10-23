// Claude Messages API istemcisi — SDK yok, doğrudan fetch. Kullanıcının kendi anahtarıyla
// ("kendi anahtarını getir") tarayıcıdan Anthropic'e gider; sunucu yoktur. Anahtar hiçbir
// yere loglanmaz, hata mesajlarına da girmez. Her çağrı AiResult döner: hata fırlatılmaz,
// çağıran taraf şablon metne düşebilir.

export const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1";
/** API sürümü (2026-10-21: temperature/top_p/top_k artık gönderilmez) */
export const ANTHROPIC_VERSION = "2026-10-21";

// ---------------------------------------------------------------- modeller

export type AiModelId = "claude-haiku-5-5" | "claude-sonnet-5-5";

export interface AiModelInfo {
  id: AiModelId;
  label: string;
  hint: string;
}

/** Varsayılan en ucuz güncel Haiku; Sonnet ayarlardan seçilebilir. */
export const AI_MODELS: readonly AiModelInfo[] = [
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", hint: "Hızlı ve en ucuz — önerilen" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", hint: "Daha güçlü; yaklaşık 20 kat pahalı" },
];

export const DEFAULT_AI_MODEL: AiModelId = "claude-haiku-5-5";

export function isAiModelId(x: unknown): x is AiModelId {
  return AI_MODELS.some((m) => m.id === x);
}

interface ModelTraits {
  /** Sunucu tarafı yedek model (fallbacks: "default"); Haiku 5.5'te yok */
  serverFallback: boolean;
  /** tool_choice any/tool kabul ediliyor mu (Sonnet 5.5 400 döner) */
  forcedToolChoice: boolean;
}

const TRAITS: Record<string, ModelTraits> = {
  "claude-haiku-5-5": { serverFallback: false, forcedToolChoice: true },
  "claude-sonnet-5-5": { serverFallback: true, forcedToolChoice: false },
};
const UNKNOWN_TRAITS: ModelTraits = { serverFallback: false, forcedToolChoice: false };

// ---------------------------------------------------------------- tel biçimi (wire) tipleri

export interface AiTextBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}
export interface AiToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}
export interface AiToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}
export type AiContentBlockParam = AiTextBlock | AiToolUseBlock | AiToolResultBlock;

export interface AiMessage {
  role: "user" | "assistant";
  content: string | AiContentBlockParam[];
}

export interface AiTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  strict?: boolean;
}

export type AiToolChoice = { type: "auto" } | { type: "none" } | { type: "any" } | { type: "tool"; name: string };

/** Yanıt içerik bloğu: text, tool_use, thinking, fallback … (bilinmeyen türler korunur) */
export interface AiResponseBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  [k: string]: unknown;
}

export interface AiUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ClaudeResponse {
  id: string;
  model: string;
  content: AiResponseBlock[];
  stop_reason: string | null;
  usage: AiUsage;
}

// ---------------------------------------------------------------- hatalar

export type AiErrorCode =
  | "no_key"
  | "invalid_key"
  | "permission"
  | "not_found"
  | "billing"
  | "rate_limit"
  | "overloaded"
  | "server"
  | "bad_request"
  | "too_large"
  | "network"
  | "offline"
  | "timeout"
  | "aborted"
  | "refusal"
  | "max_tokens"
  | "bad_response"
  | "ungrounded"
  | "empty_input";

export interface AiError {
  code: AiErrorCode;
  /** Kullanıcıya gösterilebilir Türkçe mesaj */
  message: string;
  status?: number;
  /** Aynı istek biraz sonra yeniden denenebilir mi */
  retryable: boolean;
  retryAfterSec?: number;
}

export type AiResult<T> = { ok: true; value: T } | { ok: false; error: AiError };

export const aiOk = <T>(value: T): AiResult<T> => ({ ok: true, value });

export function aiFail<T = never>(code: AiErrorCode, message: string, extra: Partial<AiError> = {}): AiResult<T> {
  return { ok: false, error: { code, message, retryable: RETRYABLE.has(code), ...extra } };
}

const RETRYABLE = new Set<AiErrorCode>(["rate_limit", "overloaded", "server", "network", "timeout", "max_tokens"]);

// ---------------------------------------------------------------- seçenekler

/** Bütün AI fonksiyonlarının ortak seçenekleri */
export interface AiCallOptions {
  apiKey: string;
  /** Varsayılan DEFAULT_AI_MODEL */
  model?: string;
  /** Testler için; verilmezse global fetch */
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  /** Varsayılan 45 sn */
  timeoutMs?: number;
}

export type AiEffort = "low" | "medium" | "high";

export interface CallClaudeParams extends AiCallOptions {
  /** Büyük ve sabit sistem istemi; önbelleğe alınır (cache_control) */
  system: string;
  messages: AiMessage[];
  tools?: AiTool[];
  toolChoice?: AiToolChoice;
  maxTokens: number;
  /** Varsayılan "low" (kısa, ucuz işler) */
  effort?: AiEffort;
  /** Verilirse yapılandırılmış çıktı: output_config.format = json_schema */
  jsonSchema?: Record<string, unknown>;
}

const DEFAULT_TIMEOUT_MS = 45_000;

// ---------------------------------------------------------------- istek

/** Messages API isteğinin gövdesi ve başlıkları (testte de kullanılır) */
export function buildMessagesRequest(p: CallClaudeParams): { url: string; headers: Record<string, string>; body: Record<string, unknown> } {
  const model = p.model || DEFAULT_AI_MODEL;
  const traits = TRAITS[model] ?? UNKNOWN_TRAITS;
  const outputConfig: Record<string, unknown> = { effort: p.effort ?? "low" };
  if (p.jsonSchema) outputConfig.format = { type: "json_schema", schema: p.jsonSchema };

  const body: Record<string, unknown> = {
    model,
    max_tokens: Math.max(1, Math.floor(p.maxTokens)),
    // Sabit sistem istemi önce gelir ve önbelleğe alınır (araçlar da bu önekin parçası)
    system: [{ type: "text", text: p.system, cache_control: { type: "ephemeral" } }],
    messages: p.messages,
    output_config: outputConfig,
  };
  if (p.tools?.length) body.tools = p.tools;
  if (p.toolChoice) {
    const forced = p.toolChoice.type === "any" || p.toolChoice.type === "tool";
    // Zorunlu araç seçimini desteklemeyen modelde "auto"ya düş (aksi hâlde 400)
    body.tool_choice = forced && !traits.forcedToolChoice ? { type: "auto" } : p.toolChoice;
  }
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": p.apiKey.trim(),
    "anthropic-version": ANTHROPIC_VERSION,
    // Tarayıcıdan doğrudan çağrı (CORS) için zorunlu; anahtar kullanıcının kendisine ait
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (traits.serverFallback) {
    // Güvenlik sınıflandırıcısı reddederse Anthropic önerdiği modelde sunucu tarafında yeniden dener
    headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
    body.fallbacks = "default";
  }
  return { url: `${ANTHROPIC_API_BASE}/messages`, headers, body };
}

/** Claude Messages API çağrısı. Başarısızlıkta Türkçe mesajlı AiError döner, fırlatmaz. */
export async function callClaude(p: CallClaudeParams): Promise<AiResult<ClaudeResponse>> {
  const keyErr = checkKey(p.apiKey);
  if (keyErr) return keyErr;
  const { url, headers, body } = buildMessagesRequest(p);
  const res = await requestJson(url, { method: "POST", headers, body: JSON.stringify(body) }, p);
  if (!res.ok) return res;
  const msg = asClaudeResponse(res.value);
  if (!msg) return aiFail("bad_response", "Anthropic'ten beklenmeyen bir yanıt geldi.");
  if (msg.stop_reason === "refusal") {
    return aiFail("refusal", "Model bu isteği yanıtlamadı. Farklı bir ifadeyle yeniden deneyebilirsin.");
  }
  return aiOk(msg);
}

/**
 * Anahtarı ve model erişimini sınar. GET /v1/models/{model} kullanır: jeton harcamaz.
 */
export async function testConnection(opts: AiCallOptions): Promise<AiResult<{ model: string; displayName?: string }>> {
  const keyErr = checkKey(opts.apiKey);
  if (keyErr) return keyErr;
  const model = opts.model || DEFAULT_AI_MODEL;
  const res = await requestJson(
    `${ANTHROPIC_API_BASE}/models/${encodeURIComponent(model)}`,
    {
      method: "GET",
      headers: {
        "x-api-key": opts.apiKey.trim(),
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
    },
    { ...opts, timeoutMs: opts.timeoutMs ?? 15_000 },
  );
  if (!res.ok) return res;
  const v = res.value as { id?: unknown; display_name?: unknown } | null;
  const id = typeof v?.id === "string" ? v.id : model;
  return aiOk(typeof v?.display_name === "string" ? { model: id, displayName: v.display_name } : { model: id });
}

function checkKey(apiKey: string | undefined): AiResult<never> | null {
  const k = (apiKey ?? "").trim();
  if (!k) return aiFail("no_key", "Önce Ayarlar'dan kendi Anthropic API anahtarını ekle.");
  // Başlığa konamayan karakterler fetch'te "ağ hatası" gibi görünür; önceden yakala
  if (!/^[\x21-\x7e]+$/.test(k)) return aiFail("invalid_key", "API anahtarı geçersiz karakter içeriyor. Anahtarı yeniden yapıştır.");
  return null;
}

/** Zaman aşımı + kullanıcı iptali + HTTP hata eşlemesi; gövde JSON olarak döner */
async function requestJson(url: string, init: RequestInit, opts: AiCallOptions): Promise<AiResult<unknown>> {
  const fetchFn = opts.fetchFn ?? ((input: RequestInfo | URL, i?: RequestInit) => fetch(input, i));
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onAbort = () => ctl.abort();
  if (opts.signal) {
    if (opts.signal.aborted) ctl.abort();
    else opts.signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    let res: Response;
    try {
      res = await fetchFn(url, { ...init, signal: ctl.signal });
    } catch {
      return transportError(timedOut, opts.signal);
    }
    let data: unknown = null;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : null;
    } catch {
      if (timedOut || opts.signal?.aborted) return transportError(timedOut, opts.signal);
      data = null;
    }
    if (!res.ok) return httpError(res.status, data, res.headers);
    return aiOk(data);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

function transportError(timedOut: boolean, signal?: AbortSignal): AiResult<never> {
  if (timedOut) return aiFail("timeout", "Anthropic zamanında yanıt vermedi. Biraz sonra yeniden dene.");
  if (signal?.aborted) return aiFail("aborted", "İstek iptal edildi.");
  const nav = (globalThis as { navigator?: { onLine?: boolean } }).navigator;
  if (nav && nav.onLine === false) {
    return aiFail("offline", "Çevrimdışısın. Yapay zekâ özellikleri internet ister; plan ve rehber çevrimdışı çalışmaya devam eder.", {
      retryable: true,
    });
  }
  return aiFail("network", "Anthropic'e ulaşılamadı (ağ hatası). Bağlantını kontrol edip yeniden dene.");
}

/** HTTP durum kodunu Türkçe hata mesajına çevirir */
export function httpError(status: number, data: unknown, headers?: { get(name: string): string | null }): AiResult<never> {
  const err = (data as { error?: { type?: unknown; message?: unknown } } | null)?.error;
  const apiMsg = typeof err?.message === "string" ? err.message : "";
  const shortMsg = apiMsg ? ` (${apiMsg.slice(0, 160)})` : "";
  const ra = Number(headers?.get("retry-after"));
  const retryAfterSec = Number.isFinite(ra) && ra > 0 ? Math.ceil(ra) : undefined;
  const extra = { status, ...(retryAfterSec ? { retryAfterSec } : {}) };

  if (/credit balance|billing/i.test(apiMsg)) {
    return aiFail("billing", "Anthropic hesabında yeterli kredi yok. console.anthropic.com üzerinden bakiye ekleyebilirsin.", extra);
  }
  switch (status) {
    case 401:
      return aiFail("invalid_key", "API anahtarı geçersiz ya da iptal edilmiş. Ayarlar'dan anahtarını kontrol et.", extra);
    case 403:
      return aiFail("permission", "Bu anahtarın bu işlem ya da model için izni yok.", extra);
    case 404:
      return aiFail("not_found", "Seçilen model bulunamadı. Ayarlar'dan başka bir model seç.", extra);
    case 408:
      return aiFail("timeout", "İstek zaman aşımına uğradı. Biraz sonra yeniden dene.", extra);
    case 413:
      return aiFail("too_large", "İstek çok büyük. Metni kısaltıp yeniden dene.", extra);
    case 429:
      return aiFail(
        "rate_limit",
        `Hız sınırına takıldın. ${retryAfterSec ? `${retryAfterSec} saniye sonra` : "Biraz bekleyip"} yeniden dene.`,
        extra,
      );
    case 503:
    case 529:
      return aiFail("overloaded", "Anthropic şu anda çok yoğun. Birkaç dakika sonra yeniden dene.", extra);
    default:
      if (status >= 500) return aiFail("server", `Anthropic tarafında bir sorun oluştu (${status}). Biraz sonra yeniden dene.`, extra);
      return aiFail("bad_request", `İstek kabul edilmedi (${status})${shortMsg}.`, extra);
  }
}

function asClaudeResponse(v: unknown): ClaudeResponse | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.content)) return null;
  const usage = (o.usage && typeof o.usage === "object" ? o.usage : {}) as Partial<AiUsage>;
  return {
    id: typeof o.id === "string" ? o.id : "",
    model: typeof o.model === "string" ? o.model : "",
    content: o.content.filter((b): b is AiResponseBlock => !!b && typeof b === "object" && typeof (b as { type?: unknown }).type === "string"),
    stop_reason: typeof o.stop_reason === "string" ? o.stop_reason : null,
    usage: { ...usage, input_tokens: usage.input_tokens ?? 0, output_tokens: usage.output_tokens ?? 0 },
  };
}

// ---------------------------------------------------------------- yanıt yardımcıları

/** Yanıttaki metin bloklarını birleştirir (thinking blokları atlanır) */
export function responseText(resp: ClaudeResponse): string {
  return resp.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("")
    .trim();
}

/** Adı verilen aracın ilk tool_use girdisi */
export function responseToolInput(resp: ClaudeResponse, name: string): unknown {
  const b = resp.content.find((x) => x.type === "tool_use" && x.name === name);
  return b ? b.input : undefined;
}

/**
 * Yapılandırılmış yanıt: önce (varsa) aracın tool_use girdisi, yoksa metin bloğundaki JSON.
 * Ayrıştırılamazsa undefined.
 */
export function responseJson(resp: ClaudeResponse, toolName?: string): unknown {
  if (toolName) {
    const input = responseToolInput(resp, toolName);
    if (input !== undefined) return input;
  }
  return parseJsonLoose(responseText(resp));
}

/** ```json çitlerini ve baştaki/sondaki metni tolere eden JSON ayrıştırıcı */
export function parseJsonLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}
