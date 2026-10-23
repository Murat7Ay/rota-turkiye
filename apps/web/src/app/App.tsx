// Uygulama kabuğu: hidrasyon, yönlendirme, alt sekme çubuğu (mobil) / yan ray (masaüstü),
// bildirim kartları, canlı mod motoru ve ekran bazlı hata sınırları.
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { BookOpen, CalendarDays, Map as MapIcon, Orbit, Plus, Settings as SettingsIcon, Sunrise, Wallet, WifiOff } from "lucide-react";
import type { SharePayload } from "@rota/core";
import { SharedPlanLoader } from "../features/share";
import { planTrip } from "../lib/core";
import { toast } from "../state/ui";
import { ErrorBoundary } from "./ErrorBoundary";
import { LiveEngine } from "./LiveEngine";
import { navigate, useRoute, type Route } from "./router";
import { Toasts } from "../components/Toasts";
import { Spinner, cx } from "../components/ui";
import CreateTrip from "../screens/CreateTrip";
import Today from "../screens/Today";
import { usePack } from "../state/pack";
import { useSettings } from "../state/settings";
import { useTrip } from "../state/trip";
import { useUi } from "../state/ui";

const PlanScreen = lazy(() => import("../screens/PlanScreen"));
const Around = lazy(() => import("../screens/Around"));
const Budget = lazy(() => import("../screens/Budget"));
const Settings = lazy(() => import("../screens/Settings"));
const Passport = lazy(() => import("../screens/Passport"));

const TABS: Array<{ route: Route; label: string; icon: ReactNode }> = [
  { route: "bugun", label: "Bugün", icon: <Sunrise className="size-[22px]" aria-hidden /> },
  { route: "plan", label: "Plan", icon: <MapIcon className="size-[22px]" aria-hidden /> },
  { route: "etrafim", label: "Etrafım", icon: <Orbit className="size-[22px]" aria-hidden /> },
  { route: "butce", label: "Bütçe", icon: <Wallet className="size-[22px]" aria-hidden /> },
  { route: "pasaport", label: "Pasaport", icon: <BookOpen className="size-[22px]" aria-hidden /> },
  { route: "ayarlar", label: "Ayarlar", icon: <SettingsIcon className="size-[22px]" aria-hidden /> },
];

/** Paylaşılan link (#/paylas/…): paketi yükler, aynı istek + tohumla planı yeniden kurar */
async function openSharedPlan(p: SharePayload) {
  const pack = await usePack.getState().ensurePack(p.packId);
  const { index } = usePack.getState();
  if (!pack || !index) throw new Error("Paylaşılan planın bölge paketi yüklenemedi.");
  const settings = useSettings.getState();
  settings.setSeed(p.seed);
  const plan = await planTrip(p.request, pack, index, p.seed, settings.osrmUrl, useTrip.getState().fx);
  useTrip.getState().setPlan(plan, { keepPrevious: true });
  toast({ kind: "success", title: "Paylaşılan plan açıldı", body: p.request.title });
  navigate("plan", { replace: true });
}

function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="size-10 rounded-[12px] shadow-card" width={40} height={40} />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[17px] font-extrabold tracking-tight text-ink">Rota Türkiye</span>
          <span className="block text-[11px] font-semibold text-muted">çevrimdışı gezi rehberi</span>
        </span>
      )}
    </span>
  );
}

function useOnline() {
  const [on, setOn] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener("online", a);
    window.addEventListener("offline", b);
    return () => {
      window.removeEventListener("online", a);
      window.removeEventListener("offline", b);
    };
  }, []);
  return on;
}

function LivePill() {
  const live = useUi((s) => s.live);
  const sim = useUi((s) => s.sim);
  if (!live && !sim) return null;
  return (
    <button
      type="button"
      onClick={() => navigate("bugun")}
      className="safe-top fixed right-3 top-3 z-40 inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface/90 px-3 text-xs font-bold text-ink shadow-card backdrop-blur lg:right-6 lg:top-5"
    >
      <span className={cx("size-2.5 rounded-full", sim ? "bg-brand" : "bg-good", "animate-pulse")} aria-hidden />
      {sim ? `Simülasyon ×${sim.multiplier}` : "Canlı mod"}
    </button>
  );
}

function Screen({ route }: { route: Route }) {
  switch (route) {
    case "olustur":
      return <CreateTrip />;
    case "bugun":
      return <Today />;
    case "plan":
      return <PlanScreen />;
    case "etrafim":
      return <Around />;
    case "butce":
      return <Budget />;
    case "pasaport":
      return <Passport />;
    case "ayarlar":
      return <Settings />;
  }
}

const SCOPE: Record<Route, string> = {
  olustur: "Gezi oluştur",
  bugun: "Bugün",
  plan: "Plan",
  etrafim: "Etrafım",
  butce: "Bütçe",
  pasaport: "Pasaport",
  ayarlar: "Ayarlar",
};

export default function App() {
  const tripHydrated = useTrip((s) => s.hydrated);
  const settingsHydrated = useSettings((s) => s.hydrated);
  const hasPlan = useTrip((s) => !!s.plan);
  const planPack = useTrip((s) => s.plan?.packId);
  const ensurePack = usePack((s) => s.ensurePack);
  const route = useRoute();
  const online = useOnline();
  const ready = tripHydrated && settingsHydrated;

  // İlk açılış: plan yoksa oluşturma ekranı
  useEffect(() => {
    if (ready && !route) navigate(hasPlan ? "bugun" : "olustur", { replace: true });
  }, [ready, route, hasPlan]);

  useEffect(() => {
    if (ready && planPack) void ensurePack(planPack);
  }, [ready, planPack, ensurePack]);

  if (!ready || !route) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-xl focus:bg-surface focus:px-3 focus:py-2">
        İçeriğe geç
      </a>

      {/* ------------------------------------------------ yan ray (masaüstü) */}
      <nav aria-label="Ana gezinme" className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-surface/70 px-4 py-6 backdrop-blur lg:flex">
        <a href="#/bugun" className="px-1">
          <Logo />
        </a>
        <button
          type="button"
          onClick={() => navigate("olustur")}
          className={cx(
            "mt-6 flex min-h-12 items-center justify-center gap-2 rounded-2xl font-bold transition",
            route === "olustur" ? "bg-brand-strong text-white" : "bg-brand text-brand-ink hover:bg-brand-strong",
          )}
        >
          <Plus className="size-5" aria-hidden /> Yeni gezi
        </button>
        <ul className="mt-6 space-y-1">
          {TABS.map((t) => {
            const active = route === t.route;
            return (
              <li key={t.route}>
                <a
                  href={`#/${t.route}`}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex min-h-12 items-center gap-3 rounded-2xl px-3.5 font-semibold transition",
                    active ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-surface-2",
                  )}
                >
                  {t.icon}
                  {t.label}
                </a>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto space-y-2 px-1 text-xs text-muted">
          {!online && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 font-semibold text-warn">
              <WifiOff className="size-3.5" aria-hidden /> Çevrimdışı
            </p>
          )}
          <p>
            <CalendarDays className="mr-1 inline size-3.5" aria-hidden />
            Türkiye saati · UTC+3
          </p>
          <p>© OpenStreetMap katkıcıları</p>
        </div>
      </nav>

      {/* ------------------------------------------------ içerik */}
      <main id="main" className="mx-auto max-w-[1400px] pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0">
        {!online && (
          <div className="safe-top flex items-center justify-center gap-2 bg-warn-soft px-4 py-1.5 text-xs font-semibold text-warn lg:hidden">
            <WifiOff className="size-3.5" aria-hidden /> Çevrimdışısın · kayıtlı plan ve paketler çalışmaya devam eder
          </div>
        )}
        <ErrorBoundary scope={SCOPE[route]} resetKey={route}>
          <Suspense
            fallback={
              <div className="grid place-items-center py-32">
                <Spinner className="size-7" />
              </div>
            }
          >
            <Screen route={route} />
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* ------------------------------------------------ alt sekmeler (mobil) */}
      <nav aria-label="Ana gezinme" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 backdrop-blur-lg lg:hidden">
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-6">
          {TABS.map((t) => {
            const active = route === t.route || (t.route === "bugun" && route === "olustur");
            return (
              <li key={t.route}>
                <a
                  href={`#/${t.route}`}
                  aria-current={route === t.route ? "page" : undefined}
                  className={cx("flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition", active ? "text-brand" : "text-muted")}
                >
                  <span className={cx("grid h-7 w-12 place-items-center rounded-full transition", active && "bg-brand-soft")}>{t.icon}</span>
                  {t.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <LivePill />
      <SharedPlanLoader onOpen={openSharedPlan} currentPackId={planPack ?? null} hasCurrentPlan={hasPlan} />
      <Toasts />
      <LiveEngine />
    </div>
  );
}
