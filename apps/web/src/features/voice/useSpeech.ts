// Sesli rehber: Web Speech API (speechSynthesis) üzerinde küçük bir denetleyici + React kancası.
// - Türkçe ses seçer (önce cihazdaki tr-TR sesi: çevrimdışı da çalışır), yoksa tarayıcı varsayılanı + lang=tr-TR.
// - Uzun metni cümlelere böler (bazı tarayıcılar ~15 sn'den uzun konuşmayı keser), kuyruğa alır.
// - Desteklenmeyen tarayıcıda her şey sessizce hiçbir şey yapmaz.
// Tercihler localStorage "rota:voice" anahtarında JSON olarak tutulur: { enabled, rate, pitch, voiceURI? }.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

export const VOICE_STORAGE_KEY = "rota:voice";

export interface VoicePrefs {
  enabled: boolean;
  /** 0,6–1,6 (1 = normal) */
  rate: number;
  /** 0,6–1,6 (1 = normal) */
  pitch: number;
  /** Kullanıcının seçtiği ses; yoksa otomatik Türkçe ses */
  voiceURI?: string;
}

export interface SpeakOptions {
  /** Kuyruğu boşaltıp hemen konuş */
  interrupt?: boolean;
  /** Sesli rehber kapalı olsa da konuş (ör. kullanıcı "dinle" düğmesine bastı) */
  force?: boolean;
  onEnd?: () => void;
  rate?: number;
  pitch?: number;
}

const DEFAULT_PREFS: VoicePrefs = { enabled: false, rate: 1, pitch: 1 };

const clamp = (x: unknown, lo: number, hi: number, def: number) =>
  typeof x === "number" && Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : def;

// ---------------------------------------------------------------- tercihler (paylaşılan depo)

function readPrefs(): VoicePrefs {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(VOICE_STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_PREFS };
    if (raw === "1" || raw === "true") return { ...DEFAULT_PREFS, enabled: true };
    if (raw === "0" || raw === "false") return { ...DEFAULT_PREFS };
    const p = JSON.parse(raw) as Partial<VoicePrefs>;
    return {
      enabled: p.enabled === true,
      rate: clamp(p.rate, 0.6, 1.6, 1),
      pitch: clamp(p.pitch, 0.6, 1.6, 1),
      ...(typeof p.voiceURI === "string" && p.voiceURI ? { voiceURI: p.voiceURI } : {}),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

let prefs: VoicePrefs = readPrefs();
const prefListeners = new Set<() => void>();

export function getVoicePrefs(): VoicePrefs {
  return prefs;
}

export function setVoicePrefs(patch: Partial<VoicePrefs>): void {
  const next: VoicePrefs = { ...prefs, ...patch };
  next.rate = clamp(next.rate, 0.6, 1.6, 1);
  next.pitch = clamp(next.pitch, 0.6, 1.6, 1);
  if (!next.voiceURI) delete next.voiceURI;
  prefs = next;
  try {
    localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // gizli sekme / kota: tercih yalnız bu oturumda geçerli
  }
  prefListeners.forEach((l) => l());
  if (!prefs.enabled) cancelSpeech();
}

function subscribePrefs(l: () => void): () => void {
  prefListeners.add(l);
  return () => prefListeners.delete(l);
}

if (typeof window !== "undefined") {
  // Başka sekmede değişirse eşitle
  window.addEventListener("storage", (e) => {
    if (e.key !== VOICE_STORAGE_KEY) return;
    prefs = readPrefs();
    prefListeners.forEach((l) => l());
  });
}

export function useVoicePrefs(): [VoicePrefs, (patch: Partial<VoicePrefs>) => void] {
  const p = useSyncExternalStore(subscribePrefs, getVoicePrefs, getVoicePrefs);
  return [p, setVoicePrefs];
}

// ---------------------------------------------------------------- motor

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

function allVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  try {
    return window.speechSynthesis.getVoices();
  } catch {
    return [];
  }
}

export function turkishVoices(): SpeechSynthesisVoice[] {
  return allVoices().filter((v) => /^tr([-_]|$)/i.test(v.lang));
}

/** Kullanıcının seçtiği ses; yoksa önce cihazdaki tr-TR sesi (çevrimdışı çalışır), sonra herhangi bir Türkçe ses */
export function pickTurkishVoice(voiceURI?: string): SpeechSynthesisVoice | null {
  if (voiceURI) {
    const chosen = allVoices().find((v) => v.voiceURI === voiceURI);
    if (chosen) return chosen;
  }
  const tr = turkishVoices();
  return (
    tr.find((v) => v.localService && /tr[-_]tr/i.test(v.lang)) ??
    tr.find((v) => v.localService) ??
    tr.find((v) => /tr[-_]tr/i.test(v.lang)) ??
    tr[0] ??
    null
  );
}

/** Metni cümlelere böler; çok uzun cümleyi virgül/boşluktan keser */
export function splitSentences(text: string, max = 180): string[] {
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]*/g) ?? [];
  const out: string[] = [];
  for (const raw of parts) {
    let s = raw.trim();
    while (s.length > max) {
      const head = s.slice(0, max);
      const cut = Math.max(head.lastIndexOf(", "), head.lastIndexOf("; "));
      const at = cut > max * 0.4 ? cut + 1 : head.lastIndexOf(" ") > 0 ? head.lastIndexOf(" ") : max;
      out.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s) out.push(s);
  }
  return out;
}

let pending = 0;
let generation = 0;
let watchdog: number | undefined;
const speakingListeners = new Set<() => void>();

function setPending(n: number): void {
  const was = pending > 0;
  pending = Math.max(0, n);
  if (was !== pending > 0) speakingListeners.forEach((l) => l());
  if (pending === 0 && watchdog !== undefined) {
    window.clearInterval(watchdog);
    watchdog = undefined;
  }
}

/** Bazı Android tarayıcıları end/error olayını atlayabiliyor: motor boşsa sayacı sıfırla */
function startWatchdog(): void {
  if (watchdog !== undefined) return;
  let idle = 0;
  watchdog = window.setInterval(() => {
    const synth = window.speechSynthesis;
    idle = synth.speaking || synth.pending ? 0 : idle + 1;
    if (idle >= 3) setPending(0);
  }, 700);
}

export function isSpeaking(): boolean {
  return pending > 0;
}

export function cancelSpeech(): void {
  generation++;
  if (speechSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // yok say
    }
  }
  setPending(0);
}

/**
 * Metni Türkçe okur. Sesli rehber kapalıysa (force yoksa) ya da tarayıcı desteklemiyorsa false döner.
 * iOS Safari ilk konuşmanın bir dokunuşla başlamasını ister: ilk çağrıyı bir düğme tıklamasından yapın.
 */
export function speak(text: string | readonly string[], opts: SpeakOptions = {}): boolean {
  if (!speechSupported()) return false;
  if (!prefs.enabled && !opts.force) return false;
  const chunks = (typeof text === "string" ? [text] : [...text]).flatMap((t) => splitSentences(t));
  if (chunks.length === 0) return false;
  if (opts.interrupt) cancelSpeech();

  const synth = window.speechSynthesis;
  const gen = generation;
  const voice = pickTurkishVoice(prefs.voiceURI);
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = voice?.lang ?? "tr-TR";
    if (voice) u.voice = voice;
    u.rate = clamp(opts.rate ?? prefs.rate, 0.6, 1.6, 1);
    u.pitch = clamp(opts.pitch ?? prefs.pitch, 0.6, 1.6, 1);
    let done = false;
    const finish = () => {
      if (done || gen !== generation) return;
      done = true;
      setPending(pending - 1);
      if (i === chunks.length - 1) opts.onEnd?.();
    };
    u.onend = finish;
    u.onerror = finish;
    synth.speak(u);
  });
  setPending(pending + chunks.length);
  // Chrome bazen duraklatılmış kalır
  if (synth.paused) synth.resume();
  startWatchdog();
  return true;
}

function subscribeSpeaking(l: () => void): () => void {
  speakingListeners.add(l);
  return () => speakingListeners.delete(l);
}

// ---------------------------------------------------------------- kanca

export interface UseSpeech {
  supported: boolean;
  enabled: boolean;
  speaking: boolean;
  /** Cihazdaki Türkçe sesler (boşsa varsayılan sesle tr-TR okunur) */
  voices: SpeechSynthesisVoice[];
  voice: SpeechSynthesisVoice | null;
  prefs: VoicePrefs;
  setPrefs: (patch: Partial<VoicePrefs>) => void;
  toggle: () => void;
  speak: (text: string | readonly string[], opts?: SpeakOptions) => boolean;
  /** Kuyruğun sonuna ekle (speak ile aynı, interrupt'sız) */
  enqueue: (text: string | readonly string[]) => boolean;
  cancel: () => void;
}

export function useSpeech(): UseSpeech {
  const [supported] = useState(speechSupported);
  const [p, setPrefs] = useVoicePrefs();
  const speaking = useSyncExternalStore(subscribeSpeaking, isSpeaking, () => false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => turkishVoices());

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const update = () => setVoices(turkishVoices());
    update();
    // Chrome sesleri geç yükler
    synth.addEventListener?.("voiceschanged", update);
    return () => synth.removeEventListener?.("voiceschanged", update);
  }, [supported]);

  const voice = useMemo(() => (supported ? pickTurkishVoice(p.voiceURI) : null), [supported, voices, p.voiceURI]);
  const toggle = useCallback(() => setPrefs({ enabled: !getVoicePrefs().enabled }), [setPrefs]);
  const enqueue = useCallback((text: string | readonly string[]) => speak(text), []);

  return { supported, enabled: p.enabled, speaking, voices, voice, prefs: p, setPrefs, toggle, speak, enqueue, cancel: cancelSpeech };
}
