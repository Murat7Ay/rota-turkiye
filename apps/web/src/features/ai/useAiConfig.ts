// Yapay zekâ ayarı (sağlayıcı + API anahtarı + model; OpenAI uyumlu uç için adres). Yalnızca bu cihazda, IndexedDB'de "rota:ai"
// anahtarı altında durur; hiçbir yere gönderilmez ve loglanmaz. Bütün bileşenler aynı
// modül düzeyindeki depoyu paylaşır: ayardan kaydedilen anahtar diğerlerinde anında görünür.
import { useEffect, useSyncExternalStore } from "react";
import { get, set } from "idb-keyval";
import { DEFAULT_AI_MODEL, isAiModelId, normalizeBaseUrl, type AiCallOptions, type AiModelId, type AiProvider } from "./core";

export const AI_CONFIG_KEY = "rota:ai";

export interface AiConfig {
  provider: AiProvider;
  /** Anthropic anahtarı ve modeli */
  apiKey: string;
  model: AiModelId;
  /** OpenAI uyumlu uç: adres, (isteğe bağlı) anahtar ve serbest model adı */
  oaBaseUrl: string;
  oaApiKey: string;
  oaModel: string;
}

const EMPTY: AiConfig = { provider: "anthropic", apiKey: "", model: DEFAULT_AI_MODEL, oaBaseUrl: "", oaApiKey: "", oaModel: "" };

/** Seçili sağlayıcı kullanılabilir durumda mı (Anthropic: anahtar; OpenAI uyumlu: adres + model) */
export function isAiReady(c: AiConfig): boolean {
  return c.provider === "openai" ? !!normalizeBaseUrl(c.oaBaseUrl) && !!c.oaModel.trim() : !!c.apiKey;
}

/** AI fonksiyonlarına verilecek ortak seçenekler; hazır değilse null */
export function toCallOptions(c: AiConfig): AiCallOptions | null {
  if (!isAiReady(c)) return null;
  return c.provider === "openai"
    ? { provider: "openai", baseUrl: normalizeBaseUrl(c.oaBaseUrl), apiKey: c.oaApiKey, model: c.oaModel.trim() }
    : { apiKey: c.apiKey, model: c.model };
}

interface Snapshot {
  /** IndexedDB okundu mu */
  loaded: boolean;
  config: AiConfig;
}

let snap: Snapshot = { loaded: false, config: EMPTY };
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function emit(next: Snapshot) {
  snap = next;
  for (const l of listeners) l();
}

function coerce(v: unknown): AiConfig {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  return {
    provider: o.provider === "openai" ? "openai" : "anthropic",
    apiKey: str(o.apiKey),
    model: isAiModelId(o.model) ? o.model : DEFAULT_AI_MODEL,
    oaBaseUrl: str(o.oaBaseUrl),
    oaApiKey: str(o.oaApiKey),
    oaModel: str(o.oaModel),
  };
}

/** İlk kullanımda IndexedDB'den bir kez okur */
export function loadAiConfig(): Promise<void> {
  if (!loading) {
    loading = get(AI_CONFIG_KEY)
      .then((v) => emit({ loaded: true, config: coerce(v) }))
      .catch(() => emit({ loaded: true, config: snap.config }));
  }
  return loading;
}

/** Kaydeder; IndexedDB yoksa (gizli pencere vb.) yalnızca bu oturumda geçerli olur ve false döner */
export async function saveAiConfig(patch: Partial<AiConfig>): Promise<boolean> {
  const next = coerce({ ...snap.config, ...patch });
  if (patch.model && !isAiModelId(patch.model)) next.model = snap.config.model;
  emit({ loaded: true, config: next });
  try {
    await set(AI_CONFIG_KEY, next);
    return true;
  } catch {
    return false;
  }
}

/** Seçili sağlayıcının anahtarını (OpenAI uyumluda adresi de) siler, model tercihini korur */
export function clearAiKey(): Promise<boolean> {
  return saveAiConfig(snap.config.provider === "openai" ? { oaApiKey: "", oaBaseUrl: "" } : { apiKey: "" });
}

/** React dışı kullanım için anlık değer */
export function getAiConfig(): AiConfig {
  return snap.config;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getSnap = () => snap;

export function useAiConfig() {
  const s = useSyncExternalStore(subscribe, getSnap, getSnap);
  useEffect(() => {
    void loadAiConfig();
  }, []);
  const callOptions = toCallOptions(s.config);
  return {
    loaded: s.loaded,
    config: s.config,
    /** Seçili sağlayıcı kullanıma hazır mı (adı geriye uyum için) */
    hasKey: !!callOptions,
    /** Anahtar varsa AI fonksiyonlarına verilecek ortak seçenekler */
    callOptions,
    save: saveAiConfig,
    clearKey: clearAiKey,
  };
}
