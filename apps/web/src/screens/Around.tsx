// Etrafım — imza görünüm: çevrenin dairesel, eğik, yavaşça dönen 3B dioraması ve
// yakındaki öne çıkan yerlerin listesi (uzaklık, yön oku, açık/kapalı).
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Crosshair, FlaskConical, LocateFixed, MapPin, Navigation, Orbit, Radio, Route, Satellite, X } from "lucide-react";
import { CATEGORIES, type LatLng, type PlaceCategory, type Town } from "@rota/core";
import { LiveControls } from "../components/LiveControls";
import { TownPicker } from "../components/TownPicker";
import { Badge, Chip, IconButton, PageHeader, SectionTitle, Segmented, Spinner, cx } from "../components/ui";
import { SAMPLE_PACK_ID } from "../dev/sample";
import * as C from "../lib/core";
import { compassLong, fmtKm } from "../lib/format";
import { directionsUrl } from "../lib/geo";
import { startSimulation } from "../lib/simulation";
import { usePack } from "../state/pack";
import { useMapboxToken, useSettings } from "../state/settings";
import { useTrip } from "../state/trip";
import { toast, useUi } from "../state/ui";
import { TastesPanel, WarningsBanner } from "../features/knowledge";

const Diorama = lazy(() => import("../map/Diorama"));

type Mode = "konum" | "sim" | "sec";

const FILTERS: Array<{ id: string; label: string; emoji: string; cats: PlaceCategory[] | null }> = [
  { id: "hepsi", label: "Hepsi", emoji: "✨", cats: null },
  { id: "gezi", label: "Gezi", emoji: "🏛️", cats: ["antik_kent", "muze", "tarihi_yapi", "cami", "carsi"] },
  { id: "yeme", label: "Yeme-içme", emoji: "🍲", cats: ["kahvalti", "esnaf_lokantasi", "restoran", "kebapci", "pideci", "meyhane", "balikci"] },
  { id: "tatli", label: "Tatlı & çay", emoji: "🍯", cats: ["tatlici", "firin", "kafe", "cay_bahcesi", "kahvehane"] },
  { id: "doga", label: "Doğa & manzara", emoji: "🌿", cats: ["dogal_alan", "manzara", "plaj"] },
  { id: "alisveris", label: "Alışveriş", emoji: "🛍️", cats: ["carsi", "pazar", "yoresel_urun", "hediyelik"] },
];

const RADII = [0.5, 1, 2, 3, 5];

export default function Around() {
  const plan = useTrip((s) => s.plan);
  const selectedDay = useTrip((s) => s.selectedDay);
  const pack = usePack((s) => s.pack);
  const index = usePack((s) => s.index);
  const ensurePack = usePack((s) => s.ensurePack);
  const loadList = usePack((s) => s.loadList);
  const draftPack = useTrip((s) => s.draft.packId);
  const position = useUi((s) => s.position);
  const sim = useUi((s) => s.sim);
  const live = useUi((s) => s.live);
  const radiusKm = useSettings((s) => s.aroundRadiusKm);
  const setRadius = useSettings((s) => s.setAroundRadius);
  const [manual, setManual] = useState<(LatLng & { name?: string }) | null>(null);
  const [mode, setMode] = useState<Mode>(() => (useUi.getState().sim ? "sim" : useUi.getState().live ? "konum" : "sec"));
  const [pick, setPick] = useState(false);
  const [filter, setFilter] = useState("hepsi");
  const [active, setActive] = useState<string | null>(null);
  const [rotate, setRotate] = useState(true);
  const mapboxToken = useMapboxToken();
  const [provider, setProvider] = useState<"mapbox" | "openfreemap">("openfreemap");
  const mapRef = useRef<HTMLDivElement>(null);

  // Bir paket yüklü olsun
  useEffect(() => {
    if (pack) return;
    void (async () => {
      if (plan) return void ensurePack(plan.packId);
      if (draftPack) return void ensurePack(draftPack);
      const list = await loadList();
      void ensurePack(list[0]?.id ?? SAMPLE_PACK_ID);
    })();
  }, [pack, plan, draftPack, ensurePack, loadList]);

  // Varsayılan merkez: planın seçili günündeki konaklama, yoksa paketin en büyük şehri
  const fallbackCenter: LatLng & { name?: string } = useMemo(() => {
    const day = plan?.days[selectedDay];
    if (day) {
      const first = day.stops.map((s) => index?.get(s.placeId)).find(Boolean);
      if (first) return { ...first.loc, name: first.city ?? first.name };
      return { ...day.to.loc, name: day.to.name };
    }
    const town = [...(pack?.towns ?? [])].sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
    if (town) return { ...town.loc, name: town.name };
    return { lat: 38.4189, lon: 27.1287, name: "İzmir" };
  }, [plan, selectedDay, index, pack]);

  const live2 = (mode === "konum" && position?.source === "gps") || (mode === "sim" && position?.source === "sim");
  const center: LatLng = live2 && position ? position.loc : (manual ?? fallbackCenter);
  const heading = live2 ? position?.headingDeg : undefined;

  // Konum ~100 m değişmedikçe yeniden hesaplama
  const key = `${center.lat.toFixed(3)},${center.lon.toFixed(3)}`;
  const cats = FILTERS.find((f) => f.id === filter)?.cats ?? undefined;
  const interests = plan?.request.interests ?? [];
  const highlights = useMemo(
    () => (index ? C.nearby(center, radiusKm, { interests, limit: 24, categories: cats }, index) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, radiusKm, index, filter, interests.join(",")],
  );

  function choose(m: Mode) {
    setMode(m);
    setPick(false);
    if (m === "konum" && !live) useUi.getState().setLive(true);
    if (m === "sim" && !sim) {
      const day = plan?.days[selectedDay];
      if (!plan || !day) {
        toast({ kind: "info", title: "Simülasyon için bir plan gerekli", body: "Gezi oluştur ya da örnek planı yükle." });
        return;
      }
      try {
        startSimulation(day, index, plan.request.transport);
      } catch (e) {
        toast({ kind: "error", title: "Simülasyon başlatılamadı", body: e instanceof Error ? e.message : String(e) });
      }
    }
    if (m === "sec" && !manual) setManual(fallbackCenter);
  }

  function chooseTown(t: Town) {
    setManual({ ...t.loc, name: t.name });
    setMode("sec");
  }

  const sourceLabel =
    mode === "konum" ? (
      <span className="inline-flex items-center gap-1.5">
        <Satellite className="size-3.5" aria-hidden />
        {position?.source === "gps" ? `GPS konumun${position.accuracyM ? ` (±${Math.round(position.accuracyM)} m)` : ""}` : "Konum bekleniyor…"}
      </span>
    ) : mode === "sim" ? (
      <span className="inline-flex items-center gap-1.5">
        <FlaskConical className="size-3.5" aria-hidden />
        {sim ? `Simülasyon · ${sim.dayIndex + 1}. gün` : "Simülasyon kapalı"}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5">
        <MapPin className="size-3.5" aria-hidden />
        {manual?.name ?? fallbackCenter.name ?? "Seçilen konum"}
      </span>
    );

  const activeH = highlights.find((h) => h.place.id === active);

  /** Listeden seçince mobilde maket görünür olsun (yan yana düzende gerek yok) */
  function selectFromList(id: string | null) {
    setActive(id);
    if (id && window.matchMedia?.("(max-width: 1023px)").matches) {
      mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="pb-10">
      <PageHeader title="Etrafım" subtitle="Çevrendeki değerli yerler, 3B bir maket üstünde." eyebrow={sourceLabel} />
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-4 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-x-6">
        {/* ------------------------------------------------ maket ve kontroller */}
        <div ref={mapRef} className="scroll-mt-3 space-y-3 lg:col-start-1 lg:row-start-1">
          <Segmented<Mode>
            label="Konum kaynağı"
            value={mode}
            onChange={choose}
            options={[
              { value: "konum", label: <><LocateFixed className="size-4" aria-hidden /> Konumum</> },
              { value: "sim", label: <><Route className="size-4" aria-hidden /> Simülasyon</> },
              { value: "sec", label: <><MapPin className="size-4" aria-hidden /> Seç</> },
            ]}
          />

          {mode === "sec" && (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <TownPicker compact towns={pack?.towns ?? []} label="Yerleşim seç" value={manual?.name ? { name: manual.name } : null} onChange={chooseTown} placeholder="Yerleşim seç" />
              </div>
              <Chip selected={pick} onClick={() => setPick(!pick)} className="shrink-0">
                <Crosshair className="size-4" aria-hidden /> {pick ? "İptal" : "Haritadan"}
              </Chip>
            </div>
          )}

          <div className="relative -mx-2 overflow-x-clip px-2 pb-2 pt-3">
            {index ? (
              <Suspense fallback={<div className="mx-auto grid aspect-square w-full max-w-[460px] place-items-center rounded-full bg-surface-2"><Spinner /></div>}>
                <Diorama
                  center={center}
                  radiusKm={radiusKm}
                  headingDeg={heading}
                  highlights={highlights}
                  activeId={active}
                  onSelect={(id) => setActive(id)}
                  pickMode={pick}
                  onPick={(loc) => {
                    setManual({ ...loc, name: "Haritadan seçilen nokta" });
                    setMode("sec");
                    setPick(false);
                  }}
                  autoRotate={rotate}
                  mapboxToken={mapboxToken || undefined}
                  onProvider={setProvider}
                />
              </Suspense>
            ) : (
              <div className="mx-auto grid aspect-square w-full max-w-[460px] place-items-center rounded-full bg-surface-2">
                <Spinner />
              </div>
            )}
            <div className="absolute right-1 top-1">
              <IconButton
                label={rotate ? "Döndürmeyi durdur" : "Otomatik döndür"}
                active={rotate}
                onClick={() => setRotate(!rotate)}
                className="border border-line bg-surface/90 shadow-card backdrop-blur"
              >
                <Orbit className="size-5" />
              </IconButton>
            </div>
            {pick && (
              <p className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-ink px-3 py-1 text-xs font-semibold text-bg shadow-card">
                Maketin üstünde bir noktaya dokun
              </p>
            )}
          </div>

          {activeH && (
            <div className="animate-pop rounded-3xl border border-brand/40 bg-surface p-3.5 shadow-lift">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-2xl" aria-hidden>
                  {CATEGORIES[activeH.place.cat].emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-snug text-ink">{activeH.place.name}</p>
                  <p className="text-sm text-muted">
                    {CATEGORIES[activeH.place.cat].label} · {fmtKm(activeH.distanceKm)} · {compassLong(activeH.bearingDeg)} yönünde
                  </p>
                </div>
                <IconButton label="Kapat" onClick={() => setActive(null)} className="-mr-1 -mt-1 size-10 text-muted">
                  <X className="size-5" />
                </IconButton>
              </div>
              <a
                href={directionsUrl(activeH.place.loc, center)}
                target="_blank"
                rel="noopener"
                className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-sea text-[15px] font-semibold text-brand-ink hover:brightness-110"
              >
                <Navigation className="size-4" aria-hidden /> Yol tarifi
              </a>
            </div>
          )}

          <div role="radiogroup" aria-label="Yarıçap" className="flex items-center gap-2">
            <span className="shrink-0 text-sm font-semibold text-ink-2">Yarıçap</span>
            <div className="no-scrollbar -mr-4 flex gap-1.5 overflow-x-auto pr-4 sm:mr-0 sm:pr-0">
              {RADII.map((r) => (
                <Chip key={r} selected={radiusKm === r} onClick={() => setRadius(r)} className="shrink-0 tabular">
                  {fmtKm(r)}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------ liste (mobilde maketin hemen altında) */}
        <section aria-label="Yakındaki öne çıkan yerler" className="space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="sticky top-0 z-10 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {FILTERS.map((f) => (
                <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)} className="shrink-0">
                  <span aria-hidden>{f.emoji}</span> {f.label}
                </Chip>
              ))}
            </div>
          </div>
          <SectionTitle>
            {highlights.length ? `${highlights.length} öne çıkan yer · ${fmtKm(radiusKm)} içinde` : "Öne çıkan yerler"}
          </SectionTitle>
          {index && highlights.length === 0 && (
            <div className="rounded-3xl border border-dashed border-line p-6 text-center text-sm text-muted">
              Bu yarıçapta kayıtlı bir yer yok. Yarıçapı büyüt ya da başka bir nokta seç.
              {mode === "konum" && position?.source === "gps" && pack && " Konumun bölge paketinin dışında olabilir."}
            </div>
          )}
          <ul className="grid gap-2">
            {highlights.map((h) => {
              const info = CATEGORIES[h.place.cat];
              const isActive = h.place.id === active;
              return (
                <li key={h.place.id}>
                  <div
                    className={cx(
                      "flex items-center gap-3 rounded-3xl border bg-surface p-3 shadow-card transition",
                      isActive ? "border-brand ring-1 ring-brand" : "border-line",
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={isActive}
                      className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => selectFromList(isActive ? null : h.place.id)}
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl" aria-hidden>
                        {info.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-ink">{h.place.name}</span>
                        <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
                          <span className="truncate">
                            {info.label}
                            {h.place.tags.includes("unesco") ? " · UNESCO" : ""}
                          </span>
                          {h.openNow === true && <Badge tone="good">Açık</Badge>}
                          {h.openNow === false && <Badge tone="bad">Kapalı</Badge>}
                        </span>
                      </span>
                    </button>
                    <div className="flex w-12 shrink-0 flex-col items-center gap-0.5 text-center" aria-label={`${fmtKm(h.distanceKm)}, ${compassLong(h.bearingDeg)} yönünde`}>
                      <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-brand">
                        <ArrowUp className="size-4 transition-transform" style={{ transform: `rotate(${h.bearingDeg}deg)` }} aria-hidden />
                      </span>
                      <span className="text-xs font-bold text-ink tabular">{fmtKm(h.distanceKm)}</span>
                    </div>
                    <a
                      href={directionsUrl(h.place.loc, center)}
                      target="_blank"
                      rel="noopener"
                      className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sea-soft text-sea hover:brightness-95"
                      aria-label={`${h.place.name} yol tarifi`}
                    >
                      <Navigation className="size-5" />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
          {!index && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner className="size-4" /> Bölge paketi yükleniyor…
            </div>
          )}
          <p className="flex items-start gap-1.5 pt-1 text-xs text-muted">
            <Radio className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Yön okları kuzeye göredir. Harita:{" "}
              {provider === "mapbox" ? (
                <>
                  <a className="underline" href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">
                    © Mapbox
                  </a>{" "}
                  ·{" "}
                  <a className="underline" href="https://apps.mapbox.com/feedback/" target="_blank" rel="noopener">
                    Haritayı iyileştir
                  </a>
                </>
              ) : (
                "OpenFreeMap"
              )}{" "}
              · © OpenStreetMap katkıcıları
            </span>
          </p>
        </section>

        {/* ------------------------------------------------ canlı mod ve yöre bilgisi */}
        <div className="space-y-4 lg:col-start-1 lg:row-start-2">
          {(mode === "konum" || mode === "sim") && <LiveControls dayIndex={sim?.dayIndex ?? selectedDay} />}
          <WarningsBanner loc={center} date={new Date()} />
          <TastesPanel loc={center} radiusKm={25} />
        </div>
      </div>
    </div>
  );
}
