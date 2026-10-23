// Yapay zekâ katmanı: ağ çağrıları sahte fetch ile; gerçek Anthropic'e istek gitmez.
import { describe, expect, it } from "vitest";
import {
  askGuide,
  buildMessagesRequest,
  callClaude,
  narrateBriefing,
  parseTripRequest,
  resolveDateExpression,
  resolveTownName,
  testConnection,
} from "../src/ai";
import type { Briefing, RegionPack, Town } from "../src";
import { PLACES } from "./fixtures";

const TOWNS: Town[] = [
  { id: "izmir", name: "İzmir", loc: { lat: 38.4237, lon: 27.1428 }, kind: "city", population: 4479525 },
  { id: "selcuk", name: "Selçuk", loc: { lat: 37.951, lon: 27.368 }, kind: "town", population: 38151 },
  { id: "kusadasi", name: "Kuşadası", loc: { lat: 37.8579, lon: 27.261 }, kind: "town", population: 133177 },
  { id: "sirince", name: "Şirince", loc: { lat: 37.9437, lon: 27.4339 }, kind: "village", population: 600 },
  { id: "denizli", name: "Denizli", loc: { lat: 37.7765, lon: 29.0864 }, kind: "city", population: 1059082 },
  { id: "pamukkale", name: "Pamukkale", loc: { lat: 37.9203, lon: 29.1189 }, kind: "village", population: 2500 },
  { id: "cesme", name: "Çeşme", loc: { lat: 38.3236, lon: 26.3029 }, kind: "town", population: 49000 },
];

const PACK: RegionPack = {
  id: "ege",
  name: "Ege",
  version: "test",
  generatedAt: "2026-10-01T00:00:00Z",
  bbox: [26.2, 37.6, 29.5, 38.6],
  attribution: "test",
  towns: TOWNS,
  places: PLACES,
};

const TODAY = "2026-10-21"; // Çarşamba
const KEY = "sk-ant-test-123";

interface Call {
  url: string;
  init: RequestInit;
  body: Record<string, unknown> | null;
}

function mockFetch(status: number, payload: unknown, headers: Record<string, string> = {}) {
  const calls: Call[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const i = init ?? {};
    calls.push({ url: String(input), init: i, body: typeof i.body === "string" ? JSON.parse(i.body) : null });
    return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json", ...headers } });
  }) as typeof fetch;
  return { fetchFn, calls };
}

const message = (content: unknown[], stop_reason = "end_turn") => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-haiku-5-5",
  content,
  stop_reason,
  usage: { input_tokens: 10, output_tokens: 20 },
});

const INTENT = {
  title: "",
  regionHint: "Ege",
  start: "",
  end: "",
  stays: [
    { place: "Selçuk", nights: 2 },
    { place: "Pamukkale", nights: 1 },
  ],
  mustSee: [],
  totalDays: 4,
  totalNights: 0,
  startDate: { text: "Kasımda", day: 0, month: 11, year: 0 },
  travelers: 2,
  pace: "belirsiz",
  interests: ["tarih", "yemek"],
  budget: { amount: 15000, currency: "TRY", scope: "kisi_basi_toplam" },
  visitor: "belirsiz",
  hasMuzekart: false,
  diet: { vegetarian: false, noAlcohol: false },
  transport: "belirsiz",
  dayStart: "",
  dayEnd: "",
  notes: [],
};

describe("istek gövdesi", () => {
  it("Haiku: önbellekli sistem istemi, json_schema, tarayıcı başlığı; sampling parametresi yok", async () => {
    const { fetchFn, calls } = mockFetch(200, message([{ type: "text", text: "Merhaba" }]));
    const res = await callClaude({
      apiKey: KEY,
      fetchFn,
      system: "SABİT",
      messages: [{ role: "user", content: "selam" }],
      maxTokens: 500,
      jsonSchema: { type: "object", additionalProperties: false, required: [], properties: {} },
    });
    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c.url).toBe("https://api.anthropic.com/v1/messages");
    const h = c.init.headers as Record<string, string>;
    expect(h["x-api-key"]).toBe(KEY);
    expect(h["anthropic-version"]).toBe("2026-10-21");
    expect(h["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(h["anthropic-beta"]).toBeUndefined();
    expect(c.body).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 500,
      system: [{ type: "text", text: "SABİT", cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: "selam" }],
      output_config: { effort: "low", format: { type: "json_schema" } },
    });
    expect(c.body).not.toHaveProperty("temperature");
    expect(c.body).not.toHaveProperty("fallbacks");
  });

  it("Sonnet: sunucu tarafı yedek model ve zorunlu araç seçimi auto'ya düşer", () => {
    const r = buildMessagesRequest({
      apiKey: KEY,
      model: "claude-sonnet-5-5",
      system: "x",
      messages: [{ role: "user", content: "y" }],
      tools: [{ name: "t", description: "d", input_schema: { type: "object" }, strict: true }],
      toolChoice: { type: "tool", name: "t" },
      maxTokens: 100,
    });
    expect(r.body.fallbacks).toBe("default");
    expect(r.headers["anthropic-beta"]).toBe("server-side-fallback-2026-07-01");
    expect(r.body.tool_choice).toEqual({ type: "auto" });
  });
});

describe("hata eşleme", () => {
  const base = { system: "s", messages: [{ role: "user" as const, content: "x" }], maxTokens: 10 };

  it("401 geçersiz anahtar", async () => {
    const { fetchFn } = mockFetch(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
    const res = await callClaude({ ...base, apiKey: KEY, fetchFn });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("invalid_key");
      expect(res.error.message).toMatch(/anahtar/i);
      expect(res.error.message).not.toContain(KEY);
    }
  });

  it("429 hız sınırı, retry-after okunur", async () => {
    const { fetchFn } = mockFetch(429, { type: "error", error: { type: "rate_limit_error", message: "slow down" } }, { "retry-after": "12" });
    const res = await callClaude({ ...base, apiKey: KEY, fetchFn });
    expect(!res.ok && res.error.code).toBe("rate_limit");
    expect(!res.ok && res.error.retryAfterSec).toBe(12);
    expect(!res.ok && res.error.retryable).toBe(true);
    expect(!res.ok && res.error.message).toContain("12 saniye");
  });

  it("529 yoğunluk, 400 kredi yok, ağ hatası, anahtar yok", async () => {
    const r529 = await callClaude({ ...base, apiKey: KEY, fetchFn: mockFetch(529, {}).fetchFn });
    expect(!r529.ok && r529.error.code).toBe("overloaded");

    const credit = mockFetch(400, { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low" } });
    const rCredit = await callClaude({ ...base, apiKey: KEY, fetchFn: credit.fetchFn });
    expect(!rCredit.ok && rCredit.error.code).toBe("billing");

    const failing = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const rNet = await callClaude({ ...base, apiKey: KEY, fetchFn: failing });
    expect(!rNet.ok && ["network", "offline"].includes(rNet.error.code)).toBe(true);

    const noKey = mockFetch(200, {});
    const rNoKey = await callClaude({ ...base, apiKey: "  ", fetchFn: noKey.fetchFn });
    expect(!rNoKey.ok && rNoKey.error.code).toBe("no_key");
    expect(noKey.calls).toHaveLength(0);
  });

  it("bağlantı testi models uç noktasını kullanır (jeton harcamaz)", async () => {
    const { fetchFn, calls } = mockFetch(200, { id: "claude-haiku-5-5", display_name: "Claude Haiku 5.5" });
    const res = await testConnection({ apiKey: KEY, fetchFn });
    expect(res.ok && res.value.displayName).toBe("Claude Haiku 5.5");
    expect(calls[0]!.url).toBe("https://api.anthropic.com/v1/models/claude-haiku-5-5");
    expect(calls[0]!.init.method).toBe("GET");
  });
});

describe("yer adı çözümleme", () => {
  it("Türkçe karakter, ek, büyük harf ve yazım hatası", () => {
    expect(resolveTownName("Selcuk", PACK)?.town.id).toBe("selcuk");
    expect(resolveTownName("Kuşadası'nda", PACK)?.town.id).toBe("kusadasi");
    expect(resolveTownName("kusadasinda", PACK)).toMatchObject({ how: "suffix", town: { id: "kusadasi" } });
    expect(resolveTownName("İZMİR", PACK)).toMatchObject({ how: "exact", town: { id: "izmir" } });
    expect(resolveTownName("Pamukale", PACK)).toMatchObject({ how: "fuzzy", town: { id: "pamukkale" } });
    expect(resolveTownName("CESME", PACK)?.town.id).toBe("cesme");
  });

  it("mekân adından en yakın yerleşim; bilinmeyen yer null", () => {
    expect(resolveTownName("Efes", PACK)).toMatchObject({ how: "place", town: { id: "selcuk" } });
    expect(resolveTownName("Bodrum", PACK)).toBeNull();
  });
});

describe("göreli tarih", () => {
  const d = (s: string) => resolveDateExpression(s, TODAY)?.date;
  it("gün adları, hafta sonu, ay adları", () => {
    expect(d("yarın")).toBe("2026-10-22");
    expect(d("önümüzdeki cuma")).toBe("2026-10-23");
    expect(d("cumartesi")).toBe("2026-10-24");
    expect(d("bu hafta sonu")).toBe("2026-10-24");
    expect(d("haftaya cuma")).toBe("2026-10-30");
    expect(d("gelecek hafta")).toBe("2026-10-26");
    expect(d("15 Kasım")).toBe("2026-11-15");
    expect(d("kasımda")).toBe("2026-11-01");
    expect(d("kasım ortası")).toBe("2026-11-15");
    expect(d("3 Ocak")).toBe("2027-01-03");
    expect(d("15.11.2026")).toBe("2026-11-15");
    expect(d("2026-12-05")).toBe("2026-12-05");
    expect(d("bir ara")).toBeUndefined();
  });
});

describe("serbest metinden istek", () => {
  const text = "Kasımda 4 gün Ege, Selçuk'ta 2 gece Pamukkale'de 1 gece, tarih ve yemek, kişi başı 15 bin TL, eşimle";

  it("yapılandırılmış JSON yanıtından TripRequest kurar", async () => {
    const { fetchFn, calls } = mockFetch(200, message([{ type: "thinking", thinking: "", signature: "x" }, { type: "text", text: JSON.stringify(INTENT) }]));
    const res = await parseTripRequest(text, PACK, {}, { apiKey: KEY, fetchFn, today: TODAY });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { request, assumptions } = res.value;
    expect(request.stays.map((s) => [s.id, s.nights])).toEqual([
      ["selcuk", 2],
      ["pamukkale", 1],
    ]);
    // Koordinatlar paketten gelir
    expect(request.stays[0]!.loc).toEqual(TOWNS[1]!.loc);
    expect(request.startDate).toBe("2026-11-01");
    expect(request.start.name).toBe("Selçuk");
    expect(request.end?.name).toBe("Selçuk"); // 4 gün / 3 gece → dönüş günü
    expect(request.travelers).toBe(2);
    expect(request.budget).toEqual({ amount: 30000, currency: "TRY" });
    expect(request.interests).toEqual(["tarih", "yemek"]);
    expect(request.pace).toBe("dengeli");
    expect(assumptions.some((a) => a.includes("15.000 TL × 2 kişi"))).toBe(true);
    expect(assumptions.some((a) => a.startsWith("Tempo belirtilmedi"))).toBe(true);
    // Kullanıcı metni etiket içinde, tarih modele verilmez
    const sent = (calls[0]!.body!.messages as Array<{ content: string }>)[0]!.content;
    expect(sent).toContain("<istek>");
    expect(sent).not.toContain(TODAY);
  });

  it("tool_use yanıtını da okur; bilinmeyen yer ve eksik bütçe notlanır", async () => {
    const intent = {
      ...INTENT,
      stays: [
        { place: "Bodrum", nights: 2 },
        { place: "Kusadasi", nights: 0 },
      ],
      totalDays: 0,
      startDate: { text: "önümüzdeki cuma", day: 0, month: 0, year: 0 },
      budget: { amount: 0, currency: "belirsiz", scope: "belirsiz" },
      travelers: 3,
      notes: ["havuzlu otel istiyor"],
    };
    const { fetchFn } = mockFetch(200, message([{ type: "tool_use", id: "tu_1", name: "trip_intent", input: intent }], "tool_use"));
    const res = await parseTripRequest("Bodrum ve Kuşadası, önümüzdeki cuma, 3 kişi, havuzlu otel", PACK, {}, { apiKey: KEY, fetchFn, today: TODAY });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { request, assumptions, unresolved } = res.value;
    expect(request.stays).toHaveLength(1);
    expect(request.stays[0]).toMatchObject({ id: "kusadasi", nights: 1 });
    expect(request.startDate).toBe("2026-10-23");
    expect(request.budget).toEqual({ amount: 9000, currency: "TRY" }); // 3.000 × 3 kişi × 1 gün
    expect(assumptions.some((a) => a.startsWith("Bütçe belirtilmedi, ") || a.startsWith("Bütçe belirtilmedi;"))).toBe(true);
    expect(unresolved.some((u) => u.includes("Bodrum"))).toBe(true);
    expect(unresolved.some((u) => u.includes("havuzlu otel"))).toBe(true);
  });

  it("bozuk yanıtta ok=false döner", async () => {
    const { fetchFn } = mockFetch(200, message([{ type: "text", text: "üzgünüm" }]));
    const res = await parseTripRequest(text, PACK, {}, { apiKey: KEY, fetchFn, today: TODAY });
    expect(!res.ok && res.error.code).toBe("bad_response");
  });
});

describe("anlatım ve rehber", () => {
  const briefing: Briefing = {
    dayIndex: 0,
    date: "2026-11-01",
    title: "Günaydın! 1. gün: Selçuk",
    summary: ["İlk çıkış 08:40", "3 durak (1 gezi)"],
    items: [
      { stopId: "a", slot: "kahvalti", time: "09:00", label: "Kahvaltı: Kahvaltı salonu", placeName: "Selçuk Kahvaltı Evi", emoji: "🍳", costTry: 600, costKind: "estimate" },
      { stopId: "b", slot: "gezi", time: "10:30", label: "Gezi: Antik kent", placeName: "Efes Antik Kenti", emoji: "🏛️", costTry: 0, costKind: "free" },
    ],
    warnings: [],
    notification: { title: "Günaydın — 1. gün", body: "…" },
  };

  it("brifingde olmayan saat geçen anlatım reddedilir", async () => {
    const good = mockFetch(200, message([{ type: "text", text: "Günaydın! 09:00'da Selçuk Kahvaltı Evi'nde kahvaltı, 10:30'da Efes Antik Kenti." }]));
    const ok = await narrateBriefing(briefing, { apiKey: KEY, fetchFn: good.fetchFn });
    expect(ok.ok).toBe(true);

    const bad = mockFetch(200, message([{ type: "text", text: "Efes Antik Kenti 19:00'a kadar açık." }]));
    const r = await narrateBriefing(briefing, { apiKey: KEY, fetchFn: bad.fetchFn });
    expect(!r.ok && r.error.code).toBe("ungrounded");
  });

  it("rehbere sor: bağlam önbellekli ilk blokta, geçmiş eklenerek gider", async () => {
    const { fetchFn, calls } = mockFetch(200, message([{ type: "text", text: "Bilmiyorum." }]));
    const res = await askGuide("Efes kaçta kapanıyor?", { gun: { no: 1 } }, {
      apiKey: KEY,
      fetchFn,
      history: [
        { role: "user", text: "Bugün nereye gidiyoruz?" },
        { role: "assistant", text: "Efes'e." },
      ],
    });
    expect(res.ok && res.value).toBe("Bilmiyorum.");
    const msgs = calls[0]!.body!.messages as Array<{ role: string; content: unknown }>;
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    const first = msgs[0]!.content as Array<{ type: string; text: string; cache_control?: unknown }>;
    expect(first[0]!.text).toContain("<baglam>");
    expect(first[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(first[1]!.text).toBe("Bugün nereye gidiyoruz?");
    expect(msgs[2]!.content).toBe("Efes kaçta kapanıyor?");
  });
});
