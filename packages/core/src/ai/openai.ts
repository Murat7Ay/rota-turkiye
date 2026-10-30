// OpenAI uyumlu uç (/chat/completions): OpenAI, OpenRouter, Groq, Together, DeepSeek, Ollama,
// LM Studio, vLLM … Üst katman Claude Messages biçiminde konuşmaya devam eder; burada istek
// Chat Completions'a, yanıt da ClaudeResponse'a çevrilir. Böylece ayrıştırma, anlatım ve
// "Rehbere sor" hiçbir değişiklik olmadan iki sağlayıcıyla da çalışır.
import {
  aiFail,
  aiOk,
  checkKey,
  requestJson,
  type AiCallOptions,
  type AiContentBlockParam,
  type AiResponseBlock,
  type AiResult,
  type AiToolChoice,
  type CallClaudeParams,
  type ClaudeResponse,
} from "./client";

export const OPENAI_DEFAULT_BASE = "https://api.openai.com/v1";

/** Ayarlarda tek dokunuşla doldurulan bilinen uçlar */
export const OPENAI_PRESETS: ReadonlyArray<{ id: string; label: string; baseUrl: string; model: string; needsKey: boolean }> = [
  { id: "openai", label: "OpenAI", baseUrl: OPENAI_DEFAULT_BASE, model: "gpt-5-mini", needsKey: true },
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "", needsKey: true },
  { id: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "", needsKey: true },
  { id: "ollama", label: "Ollama (yerel)", baseUrl: "http://localhost:11434/v1", model: "", needsKey: false },
  { id: "lmstudio", label: "LM Studio (yerel)", baseUrl: "http://localhost:1234/v1", model: "", needsKey: false },
];

type OaMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OaToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface OaToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** Sondaki "/" ve yanlışlıkla yapıştırılan "/chat/completions" kısmını atar */
export function normalizeBaseUrl(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/+$/, "").replace(/\/chat\/completions$/i, "");
}

function oaHeaders(apiKey: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  const k = apiKey.trim();
  if (k) h.authorization = `Bearer ${k}`;
  return h;
}

function checkEndpoint(opts: AiCallOptions): AiResult<never> | null {
  const base = normalizeBaseUrl(opts.baseUrl);
  if (!/^https?:\/\/\S+$/i.test(base)) return aiFail("no_key", "Ayarlar'dan OpenAI uyumlu ucun adresini gir (ör. https://api.openai.com/v1).");
  if (!opts.model?.trim()) return aiFail("no_key", "Ayarlar'dan kullanılacak model adını gir.");
  return checkKey(opts.apiKey, true);
}

function toolChoice(c: AiToolChoice): unknown {
  switch (c.type) {
    case "auto":
      return "auto";
    case "none":
      return "none";
    case "any":
      return "required";
    case "tool":
      return { type: "function", function: { name: c.name } };
  }
}

/** Claude biçimindeki mesajları Chat Completions mesajlarına çevirir */
export function toOpenAiMessages(system: string, messages: CallClaudeParams["messages"]): OaMessage[] {
  const out: OaMessage[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    const blocks: AiContentBlockParam[] = m.content;
    const text = blocks
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n");
    if (m.role === "assistant") {
      const calls: OaToolCall[] = blocks
        .filter((b) => b.type === "tool_use")
        .map((b) => {
          const t = b as { id: string; name: string; input: unknown };
          return { id: t.id, type: "function", function: { name: t.name, arguments: JSON.stringify(t.input ?? {}) } };
        });
      out.push(calls.length ? { role: "assistant", content: text || null, tool_calls: calls } : { role: "assistant", content: text });
      continue;
    }
    // Kullanıcı tarafı: araç sonuçları ayrı "tool" mesajları olur, metin ardından gelir
    for (const b of blocks) {
      if (b.type === "tool_result") out.push({ role: "tool", tool_call_id: b.tool_use_id, content: b.content });
    }
    if (text) out.push({ role: "user", content: text });
  }
  return out;
}

/** Resmî OpenAI ucu mu (api.openai.com): parametreleri baştan doğru gönderebiliriz */
export function isOfficialOpenAi(baseUrl: string | undefined): boolean {
  return /^https:\/\/api\.openai\.com(\/|$)/i.test(normalizeBaseUrl(baseUrl));
}

/** Akıl yürüten OpenAI modelleri (gpt-5 ailesi, o-serisi): reasoning_effort alır, max_tokens'ı reddeder */
export function isOpenAiReasoningModel(model: string | undefined): boolean {
  return /^(gpt-5|o\d)/i.test((model ?? "").trim());
}

/** Akıl yürütme jetonları yanıt bütçesinden düşer; görünür metne yer kalsın diye bütçe büyütülür */
const REASONING_HEADROOM = 4000;

/** Chat Completions isteğinin gövdesi (testte de kullanılır) */
export function buildChatRequest(p: CallClaudeParams): { url: string; headers: Record<string, string>; body: Record<string, unknown> } {
  const official = isOfficialOpenAi(p.baseUrl);
  const reasoning = official && isOpenAiReasoningModel(p.model);
  const maxTokens = Math.max(1, Math.floor(p.maxTokens)) + (reasoning ? REASONING_HEADROOM : 0);
  const body: Record<string, unknown> = {
    model: (p.model ?? "").trim(),
    // Şema istemde de verilir: json_schema'yı desteklemeyen uçlar düz metne düştüğünde bile biçim bilinsin
    messages: toOpenAiMessages(p.jsonSchema ? `${p.system}\n\nYanıtın, şu JSON şemasına uyan tek bir JSON nesnesi olmalı:\n${JSON.stringify(p.jsonSchema)}` : p.system, p.messages),
    // OpenAI'nin kendisi max_completion_tokens ister; diğer uyumlu sunucuların çoğu yalnız max_tokens tanır
    ...(official ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
  };
  // Kısa işlerde (anlatım, sohbet) gereksiz uzun düşünmesin; ayrıştırma "medium" ister
  if (reasoning) body.reasoning_effort = p.effort ?? "low";
  if (p.tools?.length) {
    body.tools = p.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    if (p.toolChoice) body.tool_choice = toolChoice(p.toolChoice);
  }
  if (p.jsonSchema) body.response_format = { type: "json_schema", json_schema: { name: "yanit", schema: p.jsonSchema } };
  return { url: `${normalizeBaseUrl(p.baseUrl)}/chat/completions`, headers: oaHeaders(p.apiKey), body };
}

const STOP: Record<string, string> = { stop: "end_turn", length: "max_tokens", tool_calls: "tool_use", function_call: "tool_use", content_filter: "refusal" };

/** Chat Completions yanıtını Claude yanıt biçimine çevirir */
export function fromOpenAiResponse(v: unknown): ClaudeResponse | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const choice = Array.isArray(o.choices) ? (o.choices[0] as Record<string, unknown> | undefined) : undefined;
  const msg = choice?.message as { content?: unknown; refusal?: unknown; tool_calls?: unknown; reasoning_content?: unknown } | undefined;
  if (!msg) return null;
  const content: AiResponseBlock[] = [];
  // Bazı sunucular içeriği parça dizisi olarak döner
  const text = Array.isArray(msg.content)
    ? msg.content.map((c) => (c && typeof c === "object" && typeof (c as { text?: unknown }).text === "string" ? (c as { text: string }).text : "")).join("")
    : typeof msg.content === "string"
      ? msg.content
      : "";
  // Düşünen modellerin (<think>…</think>) iç sesini metinden ayıkla
  const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (clean) content.push({ type: "text", text: clean });
  if (Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls as Array<Partial<OaToolCall>>) {
      if (!tc?.function?.name) continue;
      let input: unknown = {};
      try {
        input = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        input = undefined;
      }
      content.push({ type: "tool_use", id: tc.id ?? "", name: tc.function.name, input });
    }
  }
  const finish = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
  const refused = typeof msg.refusal === "string" && msg.refusal.length > 0;
  const usage = (o.usage && typeof o.usage === "object" ? o.usage : {}) as { prompt_tokens?: number; completion_tokens?: number };
  return {
    id: typeof o.id === "string" ? o.id : "",
    model: typeof o.model === "string" ? o.model : "",
    content,
    stop_reason: refused ? "refusal" : finish ? (STOP[finish] ?? finish) : null,
    usage: { input_tokens: usage.prompt_tokens ?? 0, output_tokens: usage.completion_tokens ?? 0 },
  };
}

/**
 * OpenAI uyumlu çağrı. Uçlar arasındaki farklara karşı 400'de bir kez uyarlanıp yeniden
 * denenir: json_schema desteklenmiyorsa json_object'e, o da yoksa düz metne düşülür
 * (yanıt yine parseJsonLoose ile okunur); yeni OpenAI modelleri max_tokens yerine
 * max_completion_tokens ister.
 */
export async function callOpenAi(p: CallClaudeParams): Promise<AiResult<ClaudeResponse>> {
  const err = checkEndpoint(p);
  if (err) return err;
  const { url, headers, body } = buildChatRequest(p);
  let res = await requestJson(url, { method: "POST", headers, body: JSON.stringify(body) }, p);
  for (let attempt = 0; attempt < 3 && !res.ok && res.error.code === "bad_request"; attempt++) {
    const m = res.error.message;
    const rf = body.response_format as { type?: string } | undefined;
    if (/reasoning_effort/i.test(m) && "reasoning_effort" in body) {
      delete body.reasoning_effort;
    } else if (/max_tokens/i.test(m) && "max_tokens" in body) {
      body.max_completion_tokens = body.max_tokens;
      delete body.max_tokens;
    } else if (rf?.type === "json_schema" && /response_format|json_schema|schema/i.test(m)) {
      body.response_format = { type: "json_object" };
    } else if (rf && /response_format|json/i.test(m)) {
      delete body.response_format;
    } else break;
    res = await requestJson(url, { method: "POST", headers, body: JSON.stringify(body) }, p);
  }
  if (!res.ok) return res;
  const msg = fromOpenAiResponse(res.value);
  if (!msg) return aiFail("bad_response", "Yapay zekâ sunucusundan beklenmeyen bir yanıt geldi.");
  if (msg.stop_reason === "refusal") {
    return aiFail("refusal", "Model bu isteği yanıtlamadı. Farklı bir ifadeyle yeniden deneyebilirsin.");
  }
  return aiOk(msg);
}

/** GET {base}/models: jeton harcamaz; model listede yoksa bunu bildirir */
export async function testOpenAiConnection(opts: AiCallOptions): Promise<AiResult<{ model: string; displayName?: string }>> {
  const err = checkEndpoint(opts);
  if (err) return err;
  const model = opts.model!.trim();
  const res = await requestJson(`${normalizeBaseUrl(opts.baseUrl)}/models`, { method: "GET", headers: oaHeaders(opts.apiKey) }, {
    ...opts,
    timeoutMs: opts.timeoutMs ?? 15_000,
  });
  if (!res.ok) return res;
  const data = (res.value as { data?: unknown } | null)?.data;
  const ids = Array.isArray(data) ? data.map((d) => (d as { id?: unknown })?.id).filter((x): x is string => typeof x === "string") : [];
  if (ids.length && !ids.includes(model)) {
    return aiFail("not_found", `Uç çalışıyor ama "${model}" modeli listede yok. Örnek: ${ids.slice(0, 4).join(", ")}`);
  }
  return aiOk({ model });
}
