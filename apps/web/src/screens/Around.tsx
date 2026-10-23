// Etrafım — imza görünüm: çevrenin dairesel, eğik, yavaşça dönen 3B dioraması ve
// yakındaki öne çıkan yerlerin listesi (uzaklık, yön oku, açık/kapalı).
import { Suspense, lazy, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowUp, Crosshair, LocateFixed, MapPin, Navigation, Orbit, Radio, Route } from "lucide-react";
import { CATEGORIES, type LatLng, type PlaceCategory, type Town } from "@rota/core";
import { LiveControls } from "../components/LiveControls";
import { TownPicker } from "../components/TownPicker";
import { Badge, Card, Chip, PageHeader, SectionTitle, Segmented, Spinner, cx } from "../components/ui";
import { SAMPLE_PACK_ID } from "../dev/sample";
import * as C from "../lib/core";
import { compassLong, compassShort, fmtKm } from "../lib/format";
import { directionsUrl } from "../lib/geo";
import { startSimulation } from "../lib/simulation";
import { usePack } from "../state/pack";
import { useSettings } from "../state/settings";
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

const RADII = [0.5, 1, 1.5, 2, 3, 4, 5];

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
    mode === "konum"
      ? position?.source === "gps"
        ? `📡 GPS konumun${position.accuracyM ? ` (±${Math.round(position.accuracyM)} m)` : ""}`
        : "📡 Konum bekleniyor…"
      : mode === "sim"
        ? sim
          ? `🧪 Simülasyon · ${sim.dayIndex + 1}. gün`
          : "🧪 Simülasyon kapalı"
        : `📍 ${manual?.name ?? fallbackCenter.name ?? "Seçilen konum"}`;

  const activeH = highlights.find((h) => h.place.id === active);

  return (
    <div className="pb-28 lg:pb-10">
      <PageHeader title="Etrafım" subtitle="Çevrendeki değerli yerler, üç boyutlu bir maket gibi." eyebrow={sourceLabel} />
      <div className="mx-auto grid max-w-6xl gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4 lg:sticky lg:top-4">
          <Segmented<Mode>
            label="Konum kaynağı"
            value={mode}
            onChange={choose}
            options={[
              { value: "konum", label: <><LocateFixed className="size-4" aria-hidden /> Konumum</> },
              { value: "sim", label: <><Route className="size-4" aria-hidden /> Simülasyon</> },
              { value: "sec", label: <><MapPin className="size-4" aria-hidden /> Konum seç</> },
            ]}
          />

          <div className="relative px-2 pb-6 pt-3">
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
                />
              </Suspense>
            ) : (
              <div className="mx-auto grid aspect-square w-full max-w-[460px] place-items-center rounded-full bg-surface-2">
                <Spinner />
              </div>
            )}
            {activeH && (
              <div className="absolute inset-x-6 bottom-0 mx-auto max-w-sm animate-pop rounded-2xl border border-line bg-surface/95 p-3 shadow-lift backdrop-blur">
                <p className="font-bold text-ink">
                  {CATEGORIES[activeH.place.cat].emoji} {activeH.place.name}
                </p>
                <p className="text-sm text-muted">
                  {fmtKm(activeH.distanceKm)} · {compassLong(activeH.bearingDeg)} yönünde
                </p>
              </div>
            )}
          </div>

          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="radius" className="text-sm font-semibold text-ink-2">
                Yarıçap
              </label>
              <span className="text-sm font-bold text-brand tabular">{fmtKm(radiusKm)}</span>
            </div>
            <input
              id="radius"
              type="range"
              className="range"
              min={0}
              max={RADII.length - 1}
              step={1}
              value={Math.max(0, RADII.indexOf(radiusKm))}
              style={{ "--fill": `${(Math.max(0, RADII.indexOf(radiusKm)) / (RADII.length - 1)) * 100}%` } as CSSProperties}
              onChange={(e) => setRadius(RADII[Number(e.target.value)] ?? 1)}
              aria-valuetext={fmtKm(radiusKm)}
            />
            <div className="flex flex-wrap items-center gap-2">
              {mode === "sec" && (
                <>
                  <Chip selected={pick} onClick={() => setPick(!pick)}>
                    <Crosshair className="size-4" aria-hidden /> {pick ? "Maketin üstüne dokun" : "Haritadan seç"}
                  </Chip>
                  <div className="min-w-[180px] flex-1">
                    <TownPicker compact towns={pack?.towns ?? []} label="Yerleşim seç" value={manual?.name ? { name: manual.name } : null} onChange={chooseTown} placeholder="Yerleşim seç" />
                  </div>
                </>
              )}
              <Chip selected={rotate} onClick={() => setRotate(!rotate)} title="Otomatik döndürme">
                <Orbit className="size-4" aria-hidden /> Döndür
              </Chip>
            </div>
          </Card>

          {(mode === "konum" || mode === "sim") && <LiveControls dayIndex={sim?.dayIndex ?? selectedDay} />}

          <WarningsBanner loc={center} date={new Date()} />
          <TastesPanel loc={center} radiusKm={25} />
        </div>

        <section aria-label="Yakındaki öne çıkan yerler" className="space-y-3">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {FILTERS.map((f) => (
              <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)} className="shrink-0">
                <span aria-hidden>{f.emoji}</span> {f.label}
              </Chip>
            ))}
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
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setActive(isActive ? null : h.place.id)}>
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl" aria-hidden>
                        {info.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-ink">{h.place.name}</span>
                        <span className="block truncate text-sm text-muted">
                          {info.label}
                          {h.place.tags.includes("unesco") ? " · UNESCO" : ""}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          {h.openNow === true && <Badge tone="good">Açık</Badge>}
                          {h.openNow === false && <Badge tone="bad">Kapalı</Badge>}
                          {h.openNow === null && <Badge>Saat bilinmiyor</Badge>}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-col items-center gap-0.5 text-center" aria-label={`${fmtKm(h.distanceKm)}, ${compassLong(h.bearingDeg)} yönünde`}>
                      <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
                        <ArrowUp className="size-5 transition-transform" style={{ transform: `rotate(${h.bearingDeg}deg)` }} aria-hidden />
                      </span>
                      <span className="text-xs font-bold text-ink tabular">{fmtKm(h.distanceKm)}</span>
                      <span className="text-[10px] font-semibold text-muted">{compassShort(h.bearingDeg)}</span>
                    </div>
                    <a
                      href={directionsUrl(h.place.loc, center)}
                      target="_blank"
                      rel="noopener"
                      className="grid size-10 shrink-0 place-items-center rounded-2xl text-sea hover:bg-sea-soft"
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
          <p className="flex items-center gap-1.5 pt-2 text-xs text-muted">
            <Radio className="size-3.5" aria-hidden /> Yön okları kuzeye göredir. Harita: © OpenStreetMap katkıcıları · OpenFreeMap
          </p>
        </section>
      </div>
    </div>
  );
}
