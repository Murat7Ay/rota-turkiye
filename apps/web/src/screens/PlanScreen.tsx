// Plan: gün sekmeleri, MapLibre haritası (gün rengi rota, numaralı duraklar, otel),
// yol üstü keşifler ("Yol üstünde" + Ekle) ve alternatifli durak kartları.
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ChevronDown, Navigation, Plane, Plus, RotateCcw, Sparkles } from "lucide-react";
import { sharePayloadFromPlan } from "@rota/core";
import OfflinePackCard from "../features/offline/OfflinePackCard";
import { ShareLinkButton, ShareStoryButton } from "../features/share";
import { CATEGORIES, SLOT_LABELS, formatHHmm, haversineKm, type Discovery, type RepairOption } from "@rota/core";
import { navigate } from "../app/router";
import { DayTabs } from "../components/DayTabs";
import { RepairSheet } from "../components/RepairSheet";
import { dayColorCss } from "../components/dayColor";
import { Badge, Button, Card, EmptyState, PageHeader, SectionTitle, Spinner, cx } from "../components/ui";
import * as C from "../lib/core";
import { fmtDateLong, fmtDuration, fmtKm, fmtTry } from "../lib/format";
import { directionsUrl } from "../lib/geo";
import { insertionOption } from "../lib/planEdit";
import { usePlanData, useTodayDate } from "../state/hooks";
import { useSettings } from "../state/settings";
import { useTrip } from "../state/trip";
import { toast } from "../state/ui";

const PlanMap = lazy(() => import("../map/PlanMap"));
const FlyoverModal = lazy(() => import("../features/flyover/FlyoverModal"));

export default function PlanScreen() {
  const { plan, index } = usePlanData();
  const dayIndex = useTrip((s) => Math.min(s.selectedDay, Math.max(0, (s.plan?.days.length ?? 1) - 1)));
  const setDay = useTrip((s) => s.setSelectedDay);
  const setPlan = useTrip((s) => s.setPlan);
  const undoPlan = useTrip((s) => s.undoPlan);
  const today = useTodayDate();
  const [active, setActive] = useState<string | null>(null);
  const [openAlt, setOpenAlt] = useState<string | null>(null);
  const [proposal, setProposal] = useState<RepairOption | null>(null);
  const [swapOptions, setSwapOptions] = useState<RepairOption[] | null>(null);
  const [flying, setFlying] = useState(false);
  const fx = useTrip((s) => s.fx);
  const seed = useSettings((s) => s.seed);
  const listRef = useRef<HTMLDivElement>(null);

  const day = plan?.days[dayIndex];

  const discoveries: Discovery[] = useMemo(() => {
    if (!plan || !day?.route || !index) return [];
    const exclude = new Set<string>();
    for (const d of plan.days) for (const s of d.stops) exclude.add(s.placeId);
    return C.corridor(day.route, { interests: plan.request.interests, mode: plan.request.transport, excludeIds: exclude, limit: 8 }, index);
  }, [plan, day, index]);

  useEffect(() => {
    setActive(null);
    setOpenAlt(null);
  }, [dayIndex]);

  if (!plan) {
    return (
      <EmptyState emoji="🗺️" title="Plan burada görünecek" action={<Button variant="primary" onClick={() => navigate("olustur")}>Gezi oluştur</Button>}>
        Günlerin haritası, durakları ve yol üstündeki keşifler bu ekranda.
      </EmptyState>
    );
  }
  if (!index || !day) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-7" />
      </div>
    );
  }

  const totalKm = day.stops.reduce((n, s) => n + s.travelKm, 0);
  const color = dayColorCss(dayIndex);

  function selectStop(id: string) {
    setActive(id);
    listRef.current?.querySelector<HTMLElement>(`[data-stop="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function propose(d: Discovery) {
    try {
      setProposal(insertionOption(plan!, dayIndex, d, index!, C.travelModel(plan!.request.transport)));
    } catch (e) {
      toast({ kind: "error", title: "Eklenemedi", body: e instanceof Error ? e.message : String(e) });
    }
  }

  function applyProposal(o: RepairOption) {
    const next = C.applyRepair(plan!, dayIndex, o);
    setPlan(next, { keepPrevious: true });
    setProposal(null);
    setSwapOptions(null);
    toast({ kind: "success", title: "Plan güncellendi", body: o.label, action: { label: "Geri al", run: () => undoPlan() } });
  }

  /** Durağı alternatifiyle değiştir: çekirdek gün onarımı (swap) 1–2 seçenek döner */
  function swap(stopId: string, placeId: string) {
    const stop = day!.stops.find((s) => s.id === stopId);
    const ctx = C.planContext(index!, plan!.request.transport, seed, fx);
    const prevDepart = [...day!.stops].filter((s) => stop && s.arriveMin < stop.arriveMin).pop()?.departMin;
    const options = C.repairDay(plan!, dayIndex, { type: "swap", stopId, placeId }, { nowMin: prevDepart ?? day!.startMin }, ctx);
    if (options.length === 0) toast({ kind: "error", title: "Değiştirilemedi", body: "Bu alternatif bugüne sığmıyor." });
    else setSwapOptions(options);
  }

  return (
    <div className="pb-28 lg:pb-10">
      <PageHeader
        eyebrow={`${plan.days.length} gün · ${plan.request.travelers} kişi · ~${fmtTry(plan.estTotal)}`}
        title={plan.request.title}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <ShareLinkButton size="sm" label="Link" payload={() => sharePayloadFromPlan(plan, seed)} />
            <ShareStoryButton size="sm" label="Hikâye" story={{ kind: "day", plan, dayIndex, index }} />
            <Button size="sm" icon={<Plus className="size-4" />} onClick={() => navigate("olustur")}>
              Yeni gezi
            </Button>
          </div>
        }
      />
      <div className="px-4 sm:px-6">
        <DayTabs days={plan.days} value={dayIndex} onChange={setDay} todayDate={today} />
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:px-6">
        {/* harita */}
        <div className="order-1 h-[42vh] min-h-[280px] overflow-hidden border-y border-line lg:sticky lg:top-4 lg:order-2 lg:h-[calc(100dvh-2rem)] lg:rounded-3xl lg:border">
          <Suspense fallback={<div className="grid h-full place-items-center bg-surface-2"><Spinner /></div>}>
            <PlanMap plan={plan} dayIndex={dayIndex} index={index} discoveries={discoveries} activeStopId={active} onSelectStop={selectStop} onSelectDiscovery={(id) => {
              const d = discoveries.find((x) => x.place.id === id);
              if (d) propose(d);
            }} />
          </Suspense>
        </div>

        {/* liste */}
        {/* grid-cols-[minmax(0,1fr)]: yatay kaydırmalı "Yol üstünde" şeridi sütunu genişletmesin */}
        <div ref={listRef} className="order-2 grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 px-4 sm:px-6 lg:order-1 lg:px-0">
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-muted">{fmtDateLong(day.date)}</p>
                <h2 className="text-lg font-bold text-ink">{day.isTravelDay ? `${day.from.name} → ${day.to.name}` : day.to.name}</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {day.stops.length} durak · ~{fmtKm(totalKm)} yol · {formatHHmm(day.startMin)}–{formatHHmm(day.endMin)} · ~{fmtTry(day.estCost)}
                </p>
              </div>
              {day.stops.length > 1 && (
                <Button size="sm" variant="sea" icon={<Plane className="size-4" />} onClick={() => setFlying(true)} aria-label="Günün rotasını uçarak izle">
                  Uç
                </Button>
              )}
            </div>
            {day.warnings.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-2xl bg-warn-soft p-3 text-sm text-warn">
                {day.warnings.map((w, i) => (
                  <li key={i}>⚠️ {w}</li>
                ))}
              </ul>
            )}
          </Card>

          {discoveries.length > 0 && (
            <section aria-label="Yol üstünde">
              <SectionTitle className="mb-2">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="size-4 text-brand" aria-hidden /> Yol üstünde
                </span>
              </SectionTitle>
              <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
                {discoveries.map((d) => (
                  <article key={d.place.id} className="w-[250px] shrink-0 snap-start rounded-3xl border border-dashed border-sea/50 bg-surface p-3.5 shadow-card">
                    <div className="flex items-start gap-2.5">
                      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sea-soft text-xl" aria-hidden>
                        {CATEGORIES[d.place.cat].emoji}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-bold leading-snug text-ink">{d.place.name}</h3>
                        <p className="text-xs text-muted">{CATEGORIES[d.place.cat].label}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-ink-2">{d.reason}</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="sea" icon={<Plus className="size-4" />} onClick={() => propose(d)} className="flex-1">
                        Ekle
                      </Button>
                      <a
                        href={directionsUrl(d.place.loc)}
                        target="_blank"
                        rel="noopener"
                        className="grid size-9 place-items-center rounded-xl border border-line text-sea hover:bg-sea-soft"
                        aria-label={`${d.place.name} yol tarifi`}
                      >
                        <Navigation className="size-4" />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Duraklar" className="grid gap-2.5">
            <SectionTitle>Duraklar</SectionTitle>
            {day.stops.length === 0 && <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">Bu gün için durak yok.</p>}
            {day.stops.map((s, i) => {
              const p = index.get(s.placeId);
              const info = p ? CATEGORIES[p.cat] : undefined;
              const alts = (day.alternatives[s.id] ?? []).map((id) => index.get(id)).filter((x) => !!x);
              const isActive = active === s.id;
              return (
                <article
                  key={s.id}
                  data-stop={s.id}
                  className={cx(
                    "rounded-3xl border bg-surface p-3.5 shadow-card transition",
                    isActive ? "border-brand ring-1 ring-brand" : "border-line",
                    (s.status === "skipped" || s.status === "closed") && "opacity-60",
                  )}
                >
                  <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setActive(s.id)} aria-label={`${i + 1}. durak: ${p?.name ?? s.placeId}, haritada göster`}>
                    <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl" aria-hidden>
                      {info?.emoji ?? "📍"}
                      <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>
                        {i + 1}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold leading-snug text-ink">{p?.name ?? s.placeId}</span>
                      <span className="block text-sm text-muted tabular">
                        {formatHHmm(s.arriveMin)}–{formatHHmm(s.departMin)} · {SLOT_LABELS[s.slot]}
                        {s.travelMin > 0 ? ` · ${fmtDuration(s.travelMin)} yol` : ""}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {s.status !== "planned" && <Badge tone={s.status === "done" ? "good" : s.status === "closed" ? "bad" : "neutral"}>{s.status === "done" ? "Yapıldı" : s.status === "closed" ? "Kapalıydı" : "Atlandı"}</Badge>}
                        {s.discovered && <Badge tone="sea">Keşif</Badge>}
                        {p?.tags.includes("unesco") && <Badge tone="brand">UNESCO</Badge>}
                        {s.estCost > 0 ? <Badge>~{fmtTry(s.estCost)}</Badge> : <Badge tone="good">Ücretsiz</Badge>}
                      </span>
                    </span>
                  </button>
                  {s.reasons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-14">
                      {s.reasons.map((r, k) => (
                        <span key={k} className="rounded-full bg-sea-soft px-2 py-0.5 text-xs font-medium text-sea">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                  {alts.length > 0 && (
                    <div className="mt-2 pl-14">
                      <button
                        type="button"
                        className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink"
                        aria-expanded={openAlt === s.id}
                        onClick={() => setOpenAlt(openAlt === s.id ? null : s.id)}
                      >
                        Alternatifler ({alts.length})
                        <ChevronDown className={cx("size-4 transition", openAlt === s.id && "rotate-180")} aria-hidden />
                      </button>
                      {openAlt === s.id && (
                        <ul className="mt-1 space-y-1">
                          {alts.map((a) => (
                            <li key={a.id} className="flex items-center gap-2 rounded-2xl bg-surface-2 px-2.5 py-2 text-sm">
                              <span aria-hidden>{CATEGORIES[a.cat].emoji}</span>
                              <span className="min-w-0 flex-1 truncate font-medium text-ink">{a.name}</span>
                              {p && <span className="shrink-0 text-xs text-muted">{fmtKm(haversineKm(p.loc, a.loc))}</span>}
                              <a href={directionsUrl(a.loc)} target="_blank" rel="noopener" className="shrink-0 text-sea" aria-label={`${a.name} yol tarifi`}>
                                <Navigation className="size-4" />
                              </a>
                              {s.status === "planned" && s.slot !== "konaklama" && (
                                <button
                                  type="button"
                                  onClick={() => swap(s.id, a.id)}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-line px-2 py-1 text-xs font-semibold text-brand hover:bg-surface"
                                  aria-label={`${p?.name ?? "Durak"} yerine ${a.name}`}
                                >
                                  <ArrowLeftRight className="size-3.5" aria-hidden /> Seç
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          <OfflinePackCard plan={plan} places={index} />

          {plan.version > 1 && (
            <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => undoPlan()} className="justify-self-start">
              Son değişikliği geri al
            </Button>
          )}
        </div>
      </div>

      <RepairSheet
        open={!!proposal}
        onClose={() => setProposal(null)}
        title="Yol üstü keşfi ekle"
        subtitle="Rota bozulmadan araya eklenir."
        options={proposal ? [proposal] : []}
        onApply={applyProposal}
      />
      {flying && (
        <Suspense fallback={null}>
          <FlyoverModal open={flying} onClose={() => setFlying(false)} day={day} places={index} title={day.isTravelDay ? `${day.from.name} → ${day.to.name}` : day.to.name} color={color} autoPlay />
        </Suspense>
      )}
      <RepairSheet
        open={!!swapOptions}
        onClose={() => setSwapOptions(null)}
        title="Alternatifle değiştir"
        subtitle="Gün baştan yazılmaz; diğer duraklar korunur."
        options={swapOptions ?? []}
        onApply={applyProposal}
      />
    </div>
  );
}
