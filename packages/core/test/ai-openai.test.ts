// OpenAI uyumlu uç: istek/yanıt çevirisi ve uyarlamalı yeniden deneme; ağa çıkılmaz.
import { describe, expect, it } from "vitest";
import { callClaude, normalizeBaseUrl, parseTripRequest, responseJson, testConnection, type CallClaudeParams } from "../src/ai";
import type { RegionPack } from "../src";
import { PLACES } from "./fixtures";

interface Call {
  url: string;
  init: RequestInit;
  body: Record<string, unknown> | null;
}

/** Sırayla verilen yanıtları döndüren sahte fetch */
function seqFetch(...replies: Array<[number, unknown]>) {
  const calls: Call[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const i = init ?? {};
    calls.push({ url: String(input), init: i, body: typeof i.body === "string" ? JSON.parse(i.body) : null });
    const [status, payload] = replies[Math.min(calls.length - 1, replies.length - 1)]!;
    return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fetchFn, calls };
}

const completion = (message: Record<string, unknown>, finish_reason = "stop") => ({
  id: "chatcmpl-1",
  model: "gpt-test",
  choices: [{ index: 0, message: { role: "assistant", ...message }, finish_reason }],
  usage: { prompt_tokens: 5, completion_tokens: 7 },
});

const OA = { provider: "openai" as const, baseUrl: "https://api.example.com/v1/", apiKey: "sk-test", model: "gpt-test" };
const base: Omit<CallClaudeParams, "apiKey"> = { system: "SİSTEM", messages: [{ role: "user", content: "selam" }], maxTokens: 50 };

describe("OpenAI uyumlu uç", () => {
  it("adres normalleştirilir", () => {
    expect(normalizeBaseUrl(" http://localhost:11434/v1/chat/completions ")).toBe("http://localhost:11434/v1");
  });

  it("istek Chat Completions biçiminde gider, yanıt Claude biçimine döner", async () => {
    const { fetchFn, calls } = seqFetch([200, completion({ content: "<think>iç ses</think>Merhaba!" })]);
    const res = await callClaude({ ...base, ...OA, fetchFn, jsonSchema: { type: "object" } });
    expect(res.ok).toBe(true);
    const c = calls[0]!;
    expect(c.url).toBe("https://api.example.com/v1/chat/completions");
    expect((c.init.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
    expect(c.body).toMatchObject({ model: "gpt-test", max_tokens: 50, response_format: { type: "json_schema" } });
    const msgs = c.body!.messages as Array<{ role: string; content: string }>;
    expect(msgs[0]!.role).toBe("system");
    expect(msgs[0]!.content).toContain("SİSTEM");
    expect(msgs[1]).toEqual({ role: "user", content: "selam" });
    if (res.ok) {
      expect(res.value.content).toEqual([{ type: "text", text: "Merhaba!" }]);
      expect(res.value.stop_reason).toBe("end_turn");
      expect(res.value.usage).toEqual({ input_tokens: 5, output_tokens: 7 });
    }
  });

  it("araç çağrısı tool_use bloğuna, length max_tokens'a çevrilir", async () => {
    const { fetchFn } = seqFetch([
      200,
      completion({ content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "trip_intent", arguments: '{"a":1}' } }] }, "length"),
    ]);
    const res = await callClaude({ ...base, ...OA, fetchFn });
    expect(res.ok && responseJson(res.value, "trip_intent")).toEqual({ a: 1 });
    expect(res.ok && res.value.stop_reason).toBe("max_tokens");
  });

  it("anahtarsız yerel sunucu: Authorization başlığı yok", async () => {
    const { fetchFn, calls } = seqFetch([200, completion({ content: "ok" })]);
    const res = await callClaude({ ...base, ...OA, apiKey: "", baseUrl: "http://localhost:11434/v1", fetchFn });
    expect(res.ok).toBe(true);
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("adres ya da model yoksa istek atılmaz", async () => {
    const { fetchFn, calls } = seqFetch([200, {}]);
    const r1 = await callClaude({ ...base, ...OA, baseUrl: "", fetchFn });
    const r2 = await callClaude({ ...base, ...OA, model: " ", fetchFn });
    expect(!r1.ok && r1.error.code).toBe("no_key");
    expect(!r2.ok && r2.error.code).toBe("no_key");
    expect(calls).toHaveLength(0);
  });

  it("400'de uyarlanıp yeniden dener: max_completion_tokens, sonra json_object", async () => {
    const { fetchFn, calls } = seqFetch(
      [400, { error: { message: "Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead." } }],
      [400, { error: { message: "response_format json_schema is not supported" } }],
      [200, completion({ content: "{}" })],
    );
    const res = await callClaude({ ...base, ...OA, fetchFn, jsonSchema: { type: "object" } });
    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls[1]!.body).toHaveProperty("max_completion_tokens", 50);
    expect(calls[1]!.body).not.toHaveProperty("max_tokens");
    expect(calls[2]!.body!.response_format).toEqual({ type: "json_object" });
  });

  it("hata mesajı sağlayıcıdan bağımsız; kota hatası billing olur", async () => {
    const r = await callClaude({ ...base, ...OA, fetchFn: seqFetch([429, { error: { message: "You exceeded your current quota" } }]).fetchFn });
    expect(!r.ok && r.error.code).toBe("billing");
    const r2 = await callClaude({ ...base, ...OA, fetchFn: seqFetch([503, {}]).fetchFn });
    expect(!r2.ok && r2.error.message).not.toContain("Anthropic");
  });

  it("bağlantı testi /models listesini okur, eksik modeli bildirir", async () => {
    const ok = seqFetch([200, { data: [{ id: "gpt-test" }, { id: "diger" }] }]);
    const r = await testConnection({ ...OA, fetchFn: ok.fetchFn });
    expect(r.ok).toBe(true);
    expect(ok.calls[0]!.url).toBe("https://api.example.com/v1/models");
    const miss = await testConnection({ ...OA, model: "yok", fetchFn: seqFetch([200, { data: [{ id: "gpt-test" }] }]).fetchFn });
    expect(!miss.ok && miss.error.code).toBe("not_found");
  });

  it("serbest metin ayrıştırma OpenAI ucuyla da çalışır", async () => {
    const pack: RegionPack = {
      id: "ege",
      name: "Ege",
      version: "t",
      generatedAt: "2026-10-01T00:00:00Z",
      bbox: [26.2, 37.6, 29.5, 38.6],
      attribution: "t",
      towns: [{ id: "selcuk", name: "Selçuk", loc: { lat: 37.951, lon: 27.368 }, kind: "town", population: 38151 }],
      places: PLACES,
    };
    const intent = { stays: [{ place: "Selçuk", nights: 2 }], travelers: 2, interests: ["tarih"] };
    const { fetchFn } = seqFetch([200, completion({ content: "```json\n" + JSON.stringify(intent) + "\n```" })]);
    const res = await parseTripRequest("Selçuk'ta 2 gece", pack, {}, { ...OA, fetchFn, today: "2026-10-21" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.request.stays[0]!.id).toBe("selcuk");
  });

  it("resmî OpenAI + gpt-5: max_completion_tokens ve reasoning_effort baştan gönderilir", async () => {
    const { fetchFn, calls } = seqFetch([200, completion({ content: "ok" })]);
    const res = await callClaude({ ...base, provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "sk-x", model: "gpt-5-mini", effort: "medium", fetchFn });
    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toMatchObject({ max_completion_tokens: 4050, reasoning_effort: "medium" });
    expect(calls[0]!.body).not.toHaveProperty("max_tokens");
  });

  it("resmî OpenAI + düşünmeyen model: reasoning_effort yok, ek bütçe yok", async () => {
    const { fetchFn, calls } = seqFetch([200, completion({ content: "ok" })]);
    await callClaude({ ...base, provider: "openai", baseUrl: "https://api.openai.com/v1/", apiKey: "sk-x", model: "gpt-4.1-mini", fetchFn });
    expect(calls[0]!.body).toMatchObject({ max_completion_tokens: 50 });
    expect(calls[0]!.body).not.toHaveProperty("reasoning_effort");
  });

  it("reasoning_effort reddedilirse çıkarılıp yeniden denenir", async () => {
    const { fetchFn, calls } = seqFetch(
      [400, { error: { message: "Unrecognized request argument supplied: reasoning_effort" } }],
      [200, completion({ content: "ok" })],
    );
    const res = await callClaude({ ...base, provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "sk-x", model: "o4-mini", fetchFn });
    expect(res.ok).toBe(true);
    expect(calls[1]!.body).not.toHaveProperty("reasoning_effort");
  });
});
