// "LLM açıklar": brifingi rehber ağzından anlatma, onarım seçeneğini açıklama, gün hakkında
// soru-cevap. Hepsi verilen JSON'a dayanır; hata ya da dayanaksız çıktı olursa AiResult
// ok=false döner ve arayüz şablon metne düşer.
import type { Briefing } from "../briefing";
import type { RepairOption } from "../repair";
import { aiFail, aiOk, callClaude, responseText } from "./client";
import type { AiCallOptions, AiContentBlockParam, AiMessage, AiResult } from "./client";
import { GUIDE_SYSTEM, NARRATE_SYSTEM, REPAIR_SYSTEM } from "./prompts";

/** Etiket kaçışı: veri içindeki "</brifing>" gibi diziler istemi bozmasın */
function safeJson(v: unknown, maxChars: number): string {
  let s = JSON.stringify(v ?? null).replace(/</g, "\\u003c");
  if (s.length > maxChars) s = `${s.slice(0, maxChars)}…(kısaltıldı)`;
  return s;
}

/** Tek paragraf düz metin: Markdown işaretleri ve fazla boşluk temizlenir */
export function toPlainParagraph(text: string, maxChars = 1200): string {
  let t = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\*\*|__|\*|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > maxChars) {
    const cut = t.slice(0, maxChars);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    t = end > maxChars * 0.5 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
  }
  return t;
}

const TIME_RE = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g;
const normTime = (h: string, m: string) => `${h.padStart(2, "0")}:${m}`;

/** Metindeki saatlerden kaynakta (brifing) geçmeyenler — dayanak kontrolü */
export function ungroundedTimes(output: string, source: string): string[] {
  const allowed = new Set<string>();
  for (const m of source.matchAll(TIME_RE)) allowed.add(normTime(m[1]!, m[2]!));
  const bad: string[] = [];
  for (const m of output.matchAll(TIME_RE)) {
    const t = normTime(m[1]!, m[2]!);
    if (!allowed.has(t) && !bad.includes(t)) bad.push(t);
  }
  return bad;
}

// ---------------------------------------------------------------- brifing anlatımı

/** Brifingin modele giden kompakt hâli (yalnızca gösterilen alanlar) */
export function briefingPayload(b: Briefing): unknown {
  return {
    baslik: b.title,
    tarih: b.date,
    ozet: b.summary,
    duraklar: b.items.map((i) => ({ saat: i.time, tur: i.label, yer: i.placeName, ...(i.note ? { not: i.note } : {}) })),
    uyarilar: b.warnings,
    ...(b.budgetLine ? { butce: b.budgetLine } : {}),
    ...(b.planB ? { bPlani: b.planB } : {}),
  };
}

/**
 * Sabah brifingini 3–5 cümlelik sıcak bir rehber paragrafına çevirir. Brifingde olmayan
 * bir saat geçerse çıktı reddedilir (ok=false, code "ungrounded").
 */
export async function narrateBriefing(briefing: Briefing, opts: AiCallOptions): Promise<AiResult<string>> {
  const payload = safeJson(briefingPayload(briefing), 12_000);
  const res = await callClaude({
    ...opts,
    system: NARRATE_SYSTEM,
    messages: [{ role: "user", content: `<brifing>\n${payload}\n</brifing>\n\nBu brifingi rehber gibi tek paragrafta anlat.` }],
    maxTokens: 2000,
    effort: "low",
  });
  if (!res.ok) return res;
  const text = toPlainParagraph(responseText(res.value));
  if (!text) {
    return res.value.stop_reason === "max_tokens"
      ? aiFail("max_tokens", "Anlatım yarım kaldı. Yeniden dene.")
      : aiFail("bad_response", "Anlatım üretilemedi.");
  }
  const bad = ungroundedTimes(text, JSON.stringify(briefing));
  if (bad.length) {
    return aiFail("ungrounded", "Anlatım planla tam örtüşmedi; plan metni gösteriliyor.");
  }
  return aiOk(text);
}

// ---------------------------------------------------------------- onarım açıklaması

/** Onarım seçeneğini 1–3 cümleyle açıklar. eventText: "Efes kapalı çıktı" gibi olay özeti. */
export async function explainRepair(
  option: RepairOption,
  opts: AiCallOptions & { eventText?: string },
): Promise<AiResult<string>> {
  const payload = {
    secenek: option.label,
    aciklama: option.description,
    degisiklikler: option.changes.slice(0, 12),
    korunanOran: Math.round(option.keptRatio * 100) / 100,
    ...(opts.eventText ? { olay: opts.eventText.slice(0, 200) } : {}),
  };
  const res = await callClaude({
    ...opts,
    system: REPAIR_SYSTEM,
    messages: [{ role: "user", content: `<onarim>\n${safeJson(payload, 6_000)}\n</onarim>\n\nBu seçeneği kısaca açıkla.` }],
    maxTokens: 1200,
    effort: "low",
  });
  if (!res.ok) return res;
  const text = toPlainParagraph(responseText(res.value), 600);
  if (!text) return aiFail("bad_response", "Açıklama üretilemedi.");
  const source = JSON.stringify(payload);
  if (ungroundedTimes(text, source).length) return aiFail("ungrounded", "Açıklama seçenekle örtüşmedi; şablon metin gösteriliyor.");
  return aiOk(text);
}

// ---------------------------------------------------------------- rehbere sor

export interface GuideTurn {
  role: "user" | "assistant";
  text: string;
}

const MAX_HISTORY_TURNS = 12;

/**
 * Gün/gezi hakkında soru-cevap. Bağlam ilk kullanıcı mesajının başında, önbelleğe alınan ayrı
 * bir blokta gider; geçmiş yalnızca eklenerek büyür (önek önbelleği korunur).
 */
export async function askGuide(
  question: string,
  context: unknown,
  opts: AiCallOptions & { history?: GuideTurn[] },
): Promise<AiResult<string>> {
  const q = question.replace(/\s+/g, " ").trim().slice(0, 600);
  if (!q) return aiFail("empty_input", "Önce bir soru yaz.");

  const asked: GuideTurn = { role: "user", text: q };
  const turns: GuideTurn[] = [...(opts.history ?? []), asked]
    .map((t): GuideTurn => ({ role: t.role, text: t.text.trim().slice(0, 2000) }))
    .filter((t) => t.text);
  // Sığdır: son N tur, ilk tur kullanıcı olmalı; ardışık aynı roller birleştirilir
  let recent = turns.slice(-MAX_HISTORY_TURNS);
  while (recent.length && recent[0]!.role !== "user") recent = recent.slice(1);
  const merged: GuideTurn[] = [];
  for (const t of recent) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === t.role) prev.text = `${prev.text}\n\n${t.text}`;
    else merged.push({ ...t });
  }

  const ctxBlock: AiContentBlockParam = {
    type: "text",
    text: `<baglam>\n${safeJson(context, 40_000)}\n</baglam>`,
    cache_control: { type: "ephemeral" },
  };
  const messages: AiMessage[] = merged.map(
    (t, i): AiMessage =>
      i === 0 ? { role: "user", content: [ctxBlock, { type: "text", text: t.text }] } : { role: t.role, content: t.text },
  );

  const res = await callClaude({ ...opts, system: GUIDE_SYSTEM, messages, maxTokens: 2000, effort: "low" });
  if (!res.ok) return res;
  const text = responseText(res.value)
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .trim()
    .slice(0, 2500);
  if (!text) {
    return res.value.stop_reason === "max_tokens"
      ? aiFail("max_tokens", "Yanıt yarım kaldı. Soruyu daraltıp yeniden dene.")
      : aiFail("bad_response", "Yanıt üretilemedi.");
  }
  return aiOk(text);
}
