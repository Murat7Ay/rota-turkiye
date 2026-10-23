// Basit hash yönlendirme (GitHub Pages'te sunucu yönlendirmesi gerekmez).
import { useSyncExternalStore } from "react";

export type Route = "olustur" | "bugun" | "plan" | "etrafim" | "butce" | "pasaport" | "ayarlar";

const ROUTES: Route[] = ["olustur", "bugun", "plan", "etrafim", "butce", "pasaport", "ayarlar"];

function read(): Route | null {
  const h = window.location.hash.replace(/^#\/?/, "").split(/[/?]/)[0] ?? "";
  return (ROUTES as string[]).includes(h) ? (h as Route) : null;
}

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function useRoute(): Route | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function navigate(route: Route, opts: { replace?: boolean } = {}) {
  const url = `#/${route}`;
  if (opts.replace) {
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else if (window.location.hash !== url) {
    window.location.hash = url;
  }
  window.scrollTo({ top: 0 });
}
