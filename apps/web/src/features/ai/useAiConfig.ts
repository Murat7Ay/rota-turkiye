// Yapay zekâ ayarı (API anahtarı + model). Yalnızca bu cihazda, IndexedDB'de "rota:ai"
// anahtarı altında durur; hiçbir yere gönderilmez ve loglanmaz. Bütün bileşenler aynı
// modül düzeyindeki depoyu paylaşır: ayardan kaydedilen anahtar diğerlerinde anında görünür.
import { useEffect, useSyncExternalStore } from "react";
import { get, set } from "idb-keyval";
import { DEFAULT_AI_MODEL, isAiModelId, type AiCallOptions, type AiModelId } from "./core";

export const AI_CONFIG_KEY = "rota:ai";

export interface AiConfig {
  apiKey: string;
  model: AiModelId;
}

interface Snapshot {
  /** IndexedDB okundu mu */
  loaded: boolean;
  config: AiConfig;
}

let snap: Snapshot = { loaded: false, config: { apiKey: "", model: DEFAULT_AI_MODEL } };
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function emit(next: Snapshot) {
  snap = next;
  for (const l of listeners) l();
}

function coerce(v: unknown): AiConfig {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    apiKey: typeof o.apiKey === "string" ? o.apiKey.trim() : "",
    model: isAiModelId(o.model) ? o.model : DEFAULT_AI_MODEL,
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
  const next: AiConfig = {
    apiKey: (patch.apiKey ?? snap.config.apiKey).trim(),
    model: patch.model && isAiModelId(patch.model) ? patch.model : snap.config.model,
  };
  emit({ loaded: true, config: next });
  try {
    await set(AI_CONFIG_KEY, next);
    return true;
  } catch {
    return false;
  }
}

/** Anahtarı siler, model tercihini korur */
export function clearAiKey(): Promise<boolean> {
  return saveAiConfig({ apiKey: "" });
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
  const callOptions: AiCallOptions | null = s.config.apiKey ? { apiKey: s.config.apiKey, model: s.config.model } : null;
  return {
    loaded: s.loaded,
    config: s.config,
    hasKey: !!s.config.apiKey,
    /** Anahtar varsa AI fonksiyonlarına verilecek ortak seçenekler */
    callOptions,
    save: saveAiConfig,
    clearKey: clearAiKey,
  };
}
