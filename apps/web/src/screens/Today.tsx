// Bugün — Sabah rehberi: brifing kartı, canlı mod/simülasyon, günün zaman çizelgesi ve
// plan onarımı (yaptım / atla / geç kaldım / kapalıydı → 2–3 seçenek).
import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Bus,
  Car,
  Check,
  ChevronDown,
  CloudRain,
  Clock,
  DoorClosed,
  Ellipsis,
  FlaskConical,
  Footprints,
  Info,
  Navigation,
  PiggyBank,
  SkipForward,
  TriangleAlert,
  Undo2,
  Volume2,
} from "lucide-react";
import {
  CATEGORIES,
  SLOT_LABELS,
  buildGuideContext,
  formatHHmm,
  goldenHourSpot,
  isWalkLeg,
  localTipsForDay,
  nowInputFromTrip,
  sunTimes,
  toTrWallClock,
  type DayPlan,
  type Place,
  type PlanStop,
  type RepairEvent,
  type RepairOption,
  type TripPlan,
  type WeatherDay,
} from "@rota/core";
import { navigate } from "../app/router";
import { DayTabs } from "../components/DayTabs";
import { LiveControls } from "../components/LiveControls";
import { RepairSheet } from "../components/RepairSheet";
import { Sheet } from "../components/Sheet";
import { Badge, Button, Card, EmptyState, IconButton, PageHeader, SectionTitle, Spinner, cx } from "../components/ui";
import { makeSamplePlan } from "../dev/sample";
import { GuideChat, NarrationButton } from "../features/ai";
import { LocalTipsCard, WarningsBanner } from "../features/knowledge";
import { NowButton } from "../features/now/NowButton";
import { GoldenHourCard } from "../features/sun/GoldenHourCard";
import { briefingToSpeech } from "../features/voice/speak";
import { speak } from "../features/voice/useSpeech";
import { VoiceToggle } from "../features/voice/VoiceToggle";
import * as C from "../lib/core";
import { fmtDateLong, fmtDuration, fmtKm, fmtTry } from "../lib/format";
import { directionsUrl } from "../lib/geo";
import { haptic } from "../lib/haptics";
import { showNotification, notificationPermission, requestNotificationPermission } from "../lib/notify";
import { useActiveDay, usePlanData, useTodayDate } from "../state/hooks";
import { usePack } from "../state/pack";
import { useSettings } from "../state/settings";
import { todayTr, useTrip } from "../state/trip";
import { toast, useUi } from "../state/ui";

const weatherCache = new Map<string, WeatherDay | null>();

function useWeather(day: DayPlan | undefined, firstLoc: { lat: number; lon: number } | undefined) {
  const loc = firstLoc ?? day?.to.loc;
  const key = day && loc ? `${day.date}|${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}` : "";
  const [w, setW] = useState<WeatherDay | null | undefined>(() => (key ? weatherCache.get(key) : null));
  useEffect(() => {
    if (!key || !day || !loc) return;
    if (weatherCache.has(key)) {
      setW(weatherCache.get(key));
      return;
    }
    let alive = true;
    setW(undefined);
    void C.weather(loc, day.date).then((r) => {
      weatherCache.set(key, r);
      if (alive) setW(r);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return w;
}

type Pending = { title: string; subtitle?: string; event: RepairEvent; options: RepairOption[]; stopId?: string; status?: "skipped" | "closed" };

export default function Today() {
  const { plan, index } = usePlanData();
  const planIsSample = useTrip((s) => s.planIsSample);
  const setPlan = useTrip((s) => s.setPlan);
  const undoPlan = useTrip((s) => s.undoPlan);
  const expenses = useTrip((s) => s.expenses);
  const fx = useTrip((s) => s.fx);
  const feed = useUi((s) => s.feed);
  const sim = useUi((s) => s.sim);
  const position = useUi((s) => s.position);
  const seed = useSettings((s) => s.seed);
  const today = useTodayDate();
  const [dayIndex, setDayIndex] = useActiveDay();
  const [pending, setPending] = useState<Pending | null>(null);
  const [lateFor, setLateFor] = useState<boolean>(false);
  // Sıradaki durak dışındaki planlı duraklarda eylemler "⋯" ile açılır; biten duraklar tek satır
  const [openStop, setOpenStop] = useState<string | null>(null);
  const fellBack = usePack((s) => s.fellBackToSample);

  const day = plan?.days[dayIndex];
  const firstPlace = day?.stops.map((s) => index?.get(s.placeId)).find(Boolean);
  const weather = useWeather(day, firstPlace?.loc);

  const budget = useMemo(() => (plan ? C.budget(plan, expenses, new Date(), index, fx) : null), [plan, expenses, index, fx]);
  const brief = useMemo(() => (plan && index && day ? C.briefing(plan, dayIndex, index, weather ?? null, budget) : null), [plan, index, day, dayIndex, weather, budget]);

  // Altın saat: günün otel/varış noktası çevresinde gün batımı için en iyi manzara
  const golden = useMemo(() => {
    if (!plan || !day || !index) return null;
    try {
      const wall = toTrWallClock(new Date());
      return {
        spot: goldenHourSpot(day, position?.loc ?? day.to.loc, index, day.date, {
          travel: C.travelModel(plan.request.transport),
          nowMin: wall.date === day.date ? wall.min : undefined,
          weather: weather ?? null,
        }),
        sun: sunTimes(day.to.loc, day.date),
      };
    } catch (e) {
      console.warn("[altın saat]", e);
      return null;
    }
  }, [plan, day, index, position, weather]);

  // Yerel rehber ipuçları: yolda geçilen ilin coğrafi işaretli tatları, bölge uyarıları, görgü kuralları
  const tips = useMemo(() => {
    if (!day || !index) return [];
    try {
      return localTipsForDay(day, index);
    } catch {
      return [];
    }
  }, [day, index]);

  // "Rehbere sor" için kompakt bağlam
  const guideContext = useMemo(() => {
    if (!plan || !index) return null;
    try {
      return buildGuideContext(plan, dayIndex, index, { budget, weather: weather ?? null });
    } catch {
      return null;
    }
  }, [plan, dayIndex, index, budget, weather]);

  if (!plan) {
    return (
      <EmptyState emoji="🧭" title="Henüz bir gezin yok" action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={() => navigate("olustur")}>Gezi oluştur</Button>
          <Button
            onClick={() => {
              void usePack.getState().ensurePack("ornek");
              setPlan(makeSamplePlan(todayTr()), { sample: true });
            }}
          >
            Örnek planı gör
          </Button>
        </div>
      }>
        Rotanı ve geceleme yerlerini seç; her sabah sana kısa bir rehber hazırlayalım.
      </EmptyState>
    );
  }
  if (!index || !day) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-7" />
        <p className="mt-3 text-sm text-muted">Bölge paketi yükleniyor…</p>
      </div>
    );
  }

  const inTrip = plan.days.some((d) => d.date === today);
  const ctx = C.planContext(index, plan.request.transport, seed, fx);

  function nowMinFor(stop?: PlanStop): number {
    const wall = toTrWallClock(new Date());
    if (wall.date === day!.date) return wall.min;
    if (sim && sim.dayIndex === dayIndex) return toTrWallClock(new Date(sim.clock)).min;
    const next = stop ?? day!.stops.find((s) => s.status === "planned");
    return next?.arriveMin ?? day!.startMin;
  }

  function positionFor(stop?: PlanStop) {
    if (position && (position.source !== "sim" || sim?.dayIndex === dayIndex)) return position.loc;
    const done = [...day!.stops].reverse().find((s) => s.status === "done");
    const ref = done ?? stop;
    return ref ? index!.get(ref.placeId)?.loc : day!.from.loc;
  }

  function commit(next: TripPlan, msg: string) {
    setPlan(next, { keepPrevious: true });
    toast({ kind: "success", title: msg, action: { label: "Geri al", run: () => undoPlan() } });
  }

  function markDone(stop: PlanStop) {
    haptic();
    commit(C.markStop(plan!, dayIndex, stop.id, "done"), "Harika, işaretlendi ✓");
  }

  function startRepair(event: RepairEvent, title: string, stop?: PlanStop, status?: "skipped" | "closed") {
    const options = C.repairDay(plan!, dayIndex, event, { nowMin: nowMinFor(stop), position: positionFor(stop) }, ctx);
    setPending({ title, subtitle: options.length ? "Gün baştan yazılmaz; yapılanlar korunur. Birini seç:" : undefined, event, options, stopId: stop?.id, status });
  }

  function apply(o: RepairOption) {
    if (!pending) return;
    let next = C.applyRepair(plan!, dayIndex, o);
    if (pending.stopId && pending.status) {
      // Onarım durağı günde bıraktıysa (ör. "çıkar, güne devam") durumu da işaretlensin
      const still = next.days[dayIndex]?.stops.find((s) => s.id === pending.stopId);
      if (still && still.status === "planned") {
        try {
          next = C.markStop(next, dayIndex, pending.stopId, pending.status);
        } catch {
          /* yedek zaten çalıştı */
        }
      }
    }
    setPending(null);
    commit(next, "Plan güncellendi");
  }

  function justMark() {
    if (!pending?.stopId || !pending.status) return;
    const st = pending.status;
    const id = pending.stopId;
    setPending(null);
    commit(C.markStop(plan!, dayIndex, id, st), st === "closed" ? "Kapalı olarak işaretlendi" : "Atlandı");
  }

  async function sendMorningNotification() {
    if (!brief) return;
    let perm = notificationPermission();
    if (perm === "default") perm = await requestNotificationPermission();
    const ok = perm === "granted" && (await showNotification(brief.notification.title, brief.notification.body, `brifing-${brief.date}`));
    if (!ok) toast({ kind: "info", title: brief.notification.title, body: brief.notification.body });
  }

  const kindByStop = new Map(brief?.items.map((it) => [it.stopId, it.costKind]) ?? []);
  const hotel = day.hotelPlaceId ? index.get(day.hotelPlaceId) : undefined;
  const rainWin = weather?.rainWindows?.[0];
  const nextStop = day.stops.find((s) => s.status === "planned");
  const nowButton = (
    <NowButton
      floating={false}
      className="min-h-11 px-4 text-sm"
      input={() => nowInputFromTrip(plan, dayIndex, position?.loc ?? positionFor() ?? day.from.loc, sim && sim.dayIndex === dayIndex ? new Date(sim.clock) : new Date(), { weather: weather ?? null, budget })}
      ctx={C.planContext(index, plan.request.transport, seed, fx)}
      onPick={(s) => {
        const first = s.stops[0];
        if (first) window.open(directionsUrl(first.loc, position?.loc), "_blank", "noopener");
      }}
    />
  );

  return (
    <div className="pb-12">
      <PageHeader
        eyebrow={fmtDateLong(day.date)}
        title={inTrip && day.date === today ? "Bugün" : `${dayIndex + 1}. gün`}
        subtitle={plan.request.title}
        action={<VoiceToggle showLabel />}
      />
      <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4 px-4 sm:px-6">
        {(planIsSample || fellBack) && (
          <p className="flex items-start gap-2 rounded-2xl border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
            <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
            Örnek (test) veri gösteriliyor. Gerçek bölge paketiyle kendi planını <button className="font-bold underline" onClick={() => navigate("olustur")}>oluşturabilirsin</button>.
            </span>
          </p>
        )}
        {!inTrip && (
          <div className="space-y-2">
            <p className="text-sm text-muted">Gezi {fmtDateLong(plan.days[0]!.date)} günü başlıyor. Önizlemek istediğin günü seç:</p>
            <DayTabs days={plan.days} value={dayIndex} onChange={setDayIndex} todayDate={today} />
          </div>
        )}
        {inTrip && plan.days.length > 1 && <DayTabs days={plan.days} value={dayIndex} onChange={setDayIndex} todayDate={today} />}

        {/* ------------------------------------------------ brifing */}
        {brief && (
          <section
            aria-label="Sabah rehberi"
            className="brief-card relative overflow-hidden rounded-[28px] p-5 text-white shadow-lift"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-white/10" aria-hidden />
            <div className="pointer-events-none absolute -bottom-16 right-10 size-40 rounded-full bg-sea/30 blur-2xl" aria-hidden />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-extrabold leading-snug">{brief.title}</h2>
                <button
                  type="button"
                  onClick={sendMorningNotification}
                  className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15 hover:bg-white/25"
                  aria-label="Sabah bildirimini gönder"
                  title="Sabah bildirimini gönder"
                >
                  <BellRing className="size-5" />
                </button>
              </div>
              {weather === undefined && <p className="mt-2 text-sm text-white/80">Hava durumu alınıyor…</p>}
              {weather && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
                  <span aria-hidden>{rainWin ? "🌧️" : weather.tMaxC >= 28 ? "☀️" : "⛅"}</span>
                  {weather.summary}
                </div>
              )}
              <ul className="mt-3 space-y-1.5 text-[15px] text-white/95">
                {brief.summary.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="text-white/60">•</span>
                    {s}
                  </li>
                ))}
              </ul>
              {brief.warnings.length > 0 && (
                <ul className="mt-3 space-y-1.5 rounded-2xl bg-black/15 p-3 text-sm">
                  {brief.warnings.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-200" aria-hidden />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {brief.budgetLine && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
                    <PiggyBank className="size-4" aria-hidden /> {brief.budgetLine}
                  </span>
                )}
              </div>
              {brief.planB && (
                <p className="mt-3 rounded-2xl bg-white/10 p-3 text-sm">
                  <b>B planı:</b> {brief.planB.replace(/^B planı:\s*/, "")}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => speak(briefingToSpeech(brief), { interrupt: true, force: true })}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-sm font-semibold hover:bg-white/25"
                >
                  <Volume2 className="size-4" aria-hidden /> Sesli dinle
                </button>
              </div>
            </div>
          </section>
        )}
        {brief && <NarrationButton briefing={brief} />}

        {nextStop ? (
          <NextStopCard
            stop={nextStop}
            place={index.get(nextStop.placeId)}
            label={inTrip && day.date === today ? "Sıradaki durak" : "Günün ilk durağı"}
            transport={plan.request.transport}
            directions={(p) => directionsUrl(p.loc, position?.loc)}
            onDone={() => markDone(nextStop)}
            now={nowButton}
          />
        ) : (
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-good-soft text-good">
              <Check className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">Günün durakları tamam</p>
              <p className="text-sm text-muted">Akşam için bir fikir istersen:</p>
            </div>
            {nowButton}
          </Card>
        )}


        {feed.length > 0 && (
          <Card className="p-4">
            <SectionTitle action={<button className="text-sm font-semibold text-muted hover:text-ink" onClick={() => useUi.getState().clearFeed()}>Temizle</button>}>
              Yolda yakalananlar
            </SectionTitle>
            <ul className="mt-2 divide-y divide-line">
              {feed.slice(0, 5).map((f) => (
                <li key={f.notification.id} className="flex items-start gap-3 py-2.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-xl" aria-hidden>
                    {CATEGORIES[f.notification.discovery.place.cat]?.emoji ?? "✨"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{f.notification.title}</p>
                    <p className="text-sm text-muted">{f.notification.body}</p>
                  </div>
                  <a
                    href={directionsUrl(f.notification.discovery.place.loc, position?.loc)}
                    target="_blank"
                    rel="noopener"
                    className="grid size-10 shrink-0 place-items-center rounded-2xl text-sea hover:bg-sea-soft"
                    aria-label={`${f.notification.discovery.place.name} yol tarifi`}
                  >
                    <Navigation className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* ------------------------------------------------ zaman çizelgesi */}
        <section aria-label="Günün akışı">
          <SectionTitle className="mb-2">Günün akışı</SectionTitle>
          <ol className="relative">
            <TimelineEdge label={`${formatHHmm(day.startMin)} · ${day.from.name}`} emoji="🌅" />
            {day.stops.map((s, i) => {
              const p = index.get(s.placeId);
              const kind = kindByStop.get(s.id) ?? (s.estCost === 0 ? "free" : "estimate");
              const isNext = s.id === nextStop?.id;
              const expanded = isNext || openStop === s.id;
              return (
                <TimelineStop
                  key={s.id}
                  stop={s}
                  n={i + 1}
                  place={p}
                  costKind={kind}
                  transport={plan.request.transport}
                  isNext={isNext}
                  expanded={expanded}
                  onToggle={() => setOpenStop((cur) => (cur === s.id ? null : s.id))}
                  directions={p ? directionsUrl(p.loc, position?.loc) : undefined}
                  onDone={() => markDone(s)}
                  onSkip={() => startRepair({ type: "skip", stopId: s.id }, `${p?.name ?? "Durak"} atlanıyor`, s, "skipped")}
                  onLate={() => setLateFor(true)}
                  onClosed={() => startRepair({ type: "closed", stopId: s.id }, `${p?.name ?? "Durak"} kapalıydı`, s, "closed")}
                />
              );
            })}
            <TimelineEdge label={`${hotel ? hotel.name : day.to.name} · günün sonu`} emoji={hotel ? CATEGORIES[hotel.cat].emoji : "🏁"} last />
          </ol>
        </section>

        {/* ------------------------------------------------ beklenmedik durumlar */}
        <Card className="p-4">
          <SectionTitle>Plan değişti mi?</SectionTitle>
          <p className="mt-1 text-sm text-muted">Gün baştan yazılmaz: yaptıkların korunur, kalan saatler yeniden düzenlenir.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              icon={<CloudRain className="size-4" />}
              onClick={() => {
                const from = rainWin?.[0] ?? nowMinFor();
                const to = rainWin?.[1] ?? from + 180;
                startRepair({ type: "rain", fromMin: from, toMin: to }, "Yağmur bastırdı");
              }}
            >
              Yağmur başladı
            </Button>
            <Button
              icon={<PiggyBank className="size-4" />}
              onClick={() => startRepair({ type: "overBudget", overTry: Math.max(500, Math.round(-(budget?.todayLeftTry ?? -1000))) }, "Bütçeyi aştım")}
            >
              Bütçeyi aştım
            </Button>
            <Button icon={<Clock className="size-4" />} onClick={() => setLateFor(true)}>
              Geç kaldım
            </Button>
          </div>
        </Card>

        <section aria-label="Günün ipuçları" className="grid gap-4">
          <SectionTitle>Yolda işine yarayacaklar</SectionTitle>
          {tips.length > 0 && <LocalTipsCard tips={tips} />}
          <WarningsBanner loc={position?.loc ?? day.to.loc} />

          {golden && (golden.spot || golden.sun) && (
            <GoldenHourCard
              spot={golden.spot}
              sun={golden.sun}
              nowMin={toTrWallClock(new Date()).date === day.date ? toTrWallClock(new Date()).min : undefined}
              onGo={(s) => window.open(directionsUrl(s.place.loc, position?.loc), "_blank", "noopener")}
            />
          )}

          <LiveControls dayIndex={dayIndex} />
        </section>

        {guideContext && <GuideChat context={guideContext} onOpenSettings={() => navigate("ayarlar")} />}

        {plan.version > 1 && (
          <Button variant="ghost" icon={<Undo2 className="size-4" />} onClick={() => undoPlan()} className="justify-self-start">
            Son değişikliği geri al
          </Button>
        )}
      </div>

      <Sheet open={lateFor} onClose={() => setLateFor(false)} title="Ne kadar geç kaldın?" subtitle="Kalan durakları buna göre yeniden düzenleyelim.">
        <div className="grid grid-cols-3 gap-2 pb-2">
          {[15, 30, 45, 60, 90, 120].map((m) => (
            <Button
              key={m}
              size="lg"
              onClick={() => {
                setLateFor(false);
                startRepair({ type: "late", minutes: m }, `${fmtDuration(m)} gecikme`);
              }}
            >
              {fmtDuration(m)}
            </Button>
          ))}
        </div>
      </Sheet>

      <RepairSheet
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending?.title ?? ""}
        subtitle={pending?.subtitle}
        options={pending?.options ?? []}
        onApply={apply}
        emptyText={
          pending?.status
            ? "Şu an otomatik bir alternatif üretilemedi. Durağı yalnızca işaretleyip güne devam edebilirsin."
            : "Şu an otomatik bir alternatif üretilemedi. Plan olduğu gibi kalıyor."
        }
        extra={
          pending?.status ? (
            <Button size="lg" className="flex-1" onClick={justMark}>
              Sadece {pending.status === "closed" ? "kapalı" : "atlandı"} diye işaretle
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

function TimelineEdge({ label, emoji, last }: { label: string; emoji: string; last?: boolean }) {
  return (
    <li className="relative flex min-h-11 items-center pl-[68px]">
      <div className="absolute left-0 top-0 h-full w-[60px]" aria-hidden>
        <div className={cx("absolute left-[44px] w-0.5 bg-line", last ? "top-0 h-1/2" : "top-1/2 h-1/2")} />
        <div className="absolute left-[35px] top-1/2 grid size-5 -translate-y-1/2 place-items-center text-base">{emoji}</div>
      </div>
      <span className="text-sm font-semibold text-muted">{label}</span>
    </li>
  );
}

function TravelLeg({ stop, transport }: { stop: PlanStop; transport: TripPlan["request"]["transport"] }) {
  const Icon = isWalkLeg(stop.travelKm, transport) ? Footprints : transport === "toplu" ? Bus : Car;
  return (
    <span className="inline-flex items-center gap-1 tabular">
      <Icon className="size-3.5" aria-hidden /> {fmtDuration(stop.travelMin)} · {fmtKm(stop.travelKm)}
    </span>
  );
}

/** Ekranın üstünde: şimdi nereye gidileceği, tek dokunuşla yol tarifi ve "yaptım" */
function NextStopCard({
  stop,
  place,
  label,
  transport,
  directions,
  onDone,
  now,
}: {
  stop: PlanStop;
  place: Place | undefined;
  label: string;
  transport: TripPlan["request"]["transport"];
  directions: (p: Place) => string;
  onDone: () => void;
  now: React.ReactNode;
}) {
  const info = place ? CATEGORIES[place.cat] : undefined;
  return (
    <Card className="border-brand/30 p-4 ring-1 ring-brand/15">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-2xl" aria-hidden>
          {info?.emoji ?? "📍"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-brand">
            {label} · <span className="tabular">{formatHHmm(stop.arriveMin)}</span>
          </p>
          <h2 className="text-lg font-extrabold leading-snug text-ink">{place?.name ?? stop.placeId}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            {SLOT_LABELS[stop.slot]}
            {stop.travelMin > 0 && (
              <>
                <span aria-hidden>·</span>
                <TravelLeg stop={stop} transport={transport} />
              </>
            )}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {place && (
          <a
            href={directions(place)}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-sea px-4 text-[15px] font-semibold text-brand-ink shadow-sm hover:brightness-110"
          >
            <Navigation className="size-4" aria-hidden /> Yol tarifi
          </a>
        )}
        <Button variant="primary" className="flex-1" icon={<Check className="size-4" />} onClick={onDone}>
          Yaptım
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-sm text-muted">Planın dışında bir şey mi?</span>
        {now}
      </div>
    </Card>
  );
}

/** Zaman çizelgesindeki durak: sıradaki durak açık, diğerleri sade; biten duraklar tek satır */
function TimelineStop({
  stop: s,
  n,
  place: p,
  costKind,
  transport,
  isNext,
  expanded,
  onToggle,
  directions,
  onDone,
  onSkip,
  onLate,
  onClosed,
}: {
  stop: PlanStop;
  n: number;
  place: Place | undefined;
  costKind: string;
  transport: TripPlan["request"]["transport"];
  isNext: boolean;
  expanded: boolean;
  onToggle: () => void;
  directions?: string;
  onDone: () => void;
  onSkip: () => void;
  onLate: () => void;
  onClosed: () => void;
}) {
  const info = p ? CATEGORIES[p.cat] : undefined;
  const isDone = s.status === "done";
  const isOff = s.status === "skipped" || s.status === "closed";
  const finished = isDone || isOff;
  const showDetails = !finished || expanded;
  return (
    <li className="relative pl-[68px]">
      {s.travelMin > 0 && (
        <div className="py-1.5 text-xs text-muted">
          <TravelLeg stop={s} transport={transport} />
        </div>
      )}
      <div className="absolute left-0 top-0 h-full w-[60px]">
        <div className="absolute left-[44px] top-0 h-full w-0.5 bg-line" aria-hidden />
      </div>
      <div className="relative">
        <div className="absolute -left-[68px] top-3 w-[38px] text-right text-[13px] font-bold text-ink tabular">{formatHHmm(s.arriveMin)}</div>
        <div
          className={cx(
            "absolute -left-[33px] top-3 grid size-5 place-items-center rounded-full border-2",
            isDone ? "border-good bg-good text-white" : isOff ? "border-line bg-surface-3" : isNext ? "border-brand bg-brand" : "border-brand bg-surface",
          )}
          aria-hidden
        >
          {isDone && <Check className="size-3" />}
        </div>
        <article
          className={cx(
            "rounded-3xl border bg-surface shadow-card transition",
            finished ? "p-2.5 opacity-75" : "p-3.5",
            isNext ? "border-brand/40 ring-1 ring-brand/20" : "border-line",
          )}
        >
          <div className="flex items-start gap-3">
            <span className={cx("grid shrink-0 place-items-center rounded-2xl bg-surface-2", finished ? "size-9 text-xl" : "size-11 text-2xl")} aria-hidden>
              {info?.emoji ?? "📍"}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className={cx("font-bold leading-snug text-ink", isOff && "line-through decoration-2")}>
                {n}. {p?.name ?? s.placeId}
              </h3>
              {finished && !expanded ? (
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  {isDone && <Badge tone="good">Yapıldı</Badge>}
                  {s.status === "skipped" && <Badge>Atlandı</Badge>}
                  {s.status === "closed" && <Badge tone="bad">Kapalıydı</Badge>}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {SLOT_LABELS[s.slot]}
                  {info ? ` · ${info.label}` : ""} · {fmtDuration(s.departMin - s.arriveMin)}
                </p>
              )}
            </div>
            {(finished || !isNext) && (
              <IconButton
                label={expanded ? "Ayrıntıları kapat" : finished ? "Ayrıntılar" : "Durak işlemleri"}
                aria-expanded={expanded}
                onClick={onToggle}
                className="-mr-1 -mt-1 size-10 text-muted"
              >
                {finished ? <ChevronDown className={cx("size-5 transition", expanded && "rotate-180")} /> : <Ellipsis className="size-5" />}
              </IconButton>
            )}
          </div>
          {showDetails && (
            <>
              <div className={cx("mt-1.5 flex flex-wrap items-center gap-1.5", finished ? "pl-12" : "pl-14")}>
                {finished && isDone && <Badge tone="good">Yapıldı</Badge>}
                {finished && s.status === "skipped" && <Badge>Atlandı</Badge>}
                {finished && s.status === "closed" && <Badge tone="bad">Kapalıydı</Badge>}
                {s.discovered && <Badge tone="sea">Yol üstü keşif</Badge>}
                {costKind === "free" ? (
                  <Badge tone="good">Ücretsiz</Badge>
                ) : (
                  <span className="text-sm font-semibold text-ink-2 tabular">
                    {costKind === "estimate" ? "~" : ""}
                    {fmtTry(s.estCost)}
                    {costKind === "estimate" && <span className="ml-1 text-xs font-medium text-muted">tahmini</span>}
                  </span>
                )}
                {expanded && p && !p.openingHours && (
                  <Badge className="font-medium" tone="neutral">
                    <Clock className="size-3" aria-hidden /> Saat doğrulanmadı
                  </Badge>
                )}
              </div>
              {expanded && s.reasons.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Neden burası">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted">Neden burası</span>
                  {s.reasons.map((r, k) => (
                    <span key={k} className="rounded-full bg-sea-soft px-2 py-0.5 text-xs font-medium text-sea">
                      {r}
                    </span>
                  ))}
                </div>
              )}
              {expanded && p?.note && p.note !== "Örnek (test) verisi" && (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-warn">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {p.note}
                </p>
              )}
            </>
          )}
          {s.status === "planned" && expanded && (
            <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <Button size="sm" variant="primary" icon={<Check className="size-4" />} onClick={onDone}>
                Yaptım
              </Button>
              <Button size="sm" icon={<SkipForward className="size-4" />} onClick={onSkip}>
                Atla
              </Button>
              <Button size="sm" icon={<Clock className="size-4" />} onClick={onLate}>
                Geç kaldım
              </Button>
              <Button size="sm" icon={<DoorClosed className="size-4" />} onClick={onClosed}>
                Kapalıydı
              </Button>
            </div>
          )}
          {directions && s.status === "planned" && (
            <a className="mt-2 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-sea hover:underline" href={directions} target="_blank" rel="noopener">
              <Navigation className="size-3.5" aria-hidden /> Yol tarifi
            </a>
          )}
        </article>
      </div>
    </li>
  );
}
