// `#/paylas/<kod>` adresini okur, çözer ve paylaşılan planın yükünü sunar.
// Kod, modül yüklenirken yakalanır: uygulama yönlendiricisi bilinmeyen rotayı hemen başka bir
// sekmeye çevirebildiği için hash kaybolmadan saklanır.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { decodeShare, shareCodeFromHash, type SharePayload } from "../../../../../packages/core/src/share";

let pendingCode: string | null = null;
let listening = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function readHash() {
  const code = shareCodeFromHash(window.location.hash);
  if (code && code !== pendingCode) {
    pendingCode = code;
    emit();
  }
}

/**
 * Paylaşım kodunu yakalar ve hash değişimlerini dinlemeye başlar. Modül yüklenince kendiliğinden
 * çağrılır; bu modül tembel (lazy) yüklenecekse main.tsx'te render'dan önce çağırın.
 */
export function captureSharedPlanHash() {
  if (typeof window === "undefined") return;
  readHash();
  if (!listening) {
    listening = true;
    window.addEventListener("hashchange", readHash);
  }
}

captureSharedPlanHash();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
const getCode = () => pendingCode;

export interface SharedPlanState {
  /** none: paylaşım yok · loading: çözülüyor · ready: geçerli · invalid: bozuk bağlantı */
  status: "none" | "loading" | "ready" | "invalid";
  code: string | null;
  payload: SharePayload | null;
  /** Paylaşımı kapatır; adres hâlâ #/paylas/… ise `nextHash`e (varsayılan: boş) çevirir */
  dismiss: (nextHash?: string) => void;
}

export function useSharedPlanFromHash(): SharedPlanState {
  const code = useSyncExternalStore(subscribe, getCode, () => null);
  const [result, setResult] = useState<{ code: string; payload: SharePayload | null } | null>(null);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    void decodeShare(code).then((payload) => {
      if (alive) setResult({ code, payload });
    });
    return () => {
      alive = false;
    };
  }, [code]);

  const dismiss = useCallback((nextHash?: string) => {
    pendingCode = null;
    setResult(null);
    emit();
    if (shareCodeFromHash(window.location.hash)) {
      const url = nextHash ?? `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, "", url);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }, []);

  const status: SharedPlanState["status"] = !code
    ? "none"
    : !result || result.code !== code
      ? "loading"
      : result.payload
        ? "ready"
        : "invalid";
  return { status, code, payload: status === "ready" ? (result?.payload ?? null) : null, dismiss };
}
