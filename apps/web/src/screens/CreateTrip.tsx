// Gezi oluştur: bölge paketi, rota (başlangıç + geceleme üsleri), zaman, tercihler, bütçe.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bus,
  ChevronRight,
  Car,
  CircleAlert,
  Database,
  Footprints,
  Plus,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { DEFAULT_FX, addDays, toTry, type Interest, type Pace, type Town, type TransportMode, type TripRequest } from "@rota/core";
import { navigate } from "../app/router";
import { FreeTextTripInput } from "../features/ai";
import { TownPicker, normTr } from "../components/TownPicker";
import { Badge, Button, Card, Chip, Field, PageHeader, Segmented, SectionTitle, Spinner, Stepper, Toggle, cx, inputClass } from "../components/ui";
import { SAMPLE_PACK, SAMPLE_PACK_ID, makeSamplePlan } from "../dev/sample";
import { planTrip } from "../lib/core";
import { fmtBytes, fmtDateShort, fmtNumber, fmtTry } from "../lib/format";
import { samplePackMeta, usePack, type PackMeta } from "../state/pack";
import { useSettings } from "../state/settings";
import { draftToRequest, todayTr, useTrip } from "../state/trip";
import { toast } from "../state/ui";

/** Bölgelerin klasik rotaları: paket bu yerleşimleri içeriyorsa "hızlı doldur" düğmesi çıkar */
const QUICK_ROUTES: Array<{ label: string; stays: Array<[string, number]> }> = [
  { label: "İzmir → Efes → Pamukkale", stays: [["İzmir", 1], ["Selçuk", 1], ["Pamukkale", 1]] },
  { label: "Göreme + Ürgüp", stays: [["Göreme", 2], ["Ürgüp", 1]] },
  { label: "Sultanahmet + Kadıköy", stays: [["Sultanahmet", 2], ["Kadıköy", 1]] },
];

export const INTERESTS: Array<{ id: Interest; label: string; emoji: string }> = [
  { id: "tarih", label: "Tarih", emoji: "🏛️" },
  { id: "yemek", label: "Yemek", emoji: "🍲" },
  { id: "tatli", label: "Tatlı", emoji: "🍯" },
  { id: "doga", label: "Doğa", emoji: "🌿" },
  { id: "deniz", label: "Deniz", emoji: "🏖️" },
  { id: "alisveris", label: "Alışveriş", emoji: "🛍️" },
  { id: "kultur", label: "Kültür", emoji: "🎭" },
  { id: "fotograf", label: "Fotoğraf", emoji: "📸" },
];

const PACE: Array<{ value: Pace; label: string; hint: string }> = [
  { value: "sakin", label: "Sakin", hint: "Günde en fazla 2 gezi durağı, bol mola" },
  { value: "dengeli", label: "Dengeli", hint: "Günde 3–4 gezi durağı" },
  { value: "yogun", label: "Yoğun", hint: "Günde 6'ya kadar gezi durağı" },
];

const LOADING_LINES = [
  "Bölge paketi hazırlanıyor…",
  "Yol rotaları alınıyor (OSRM)…",
  "Açılış saatleri ve bayram takvimi kontrol ediliyor…",
  "Öğünler yerleştiriliyor: kahvaltı, öğle, akşam…",
  "Bütçeye göre seçenekler tartılıyor…",
];

type ProblemField = "bolge" | "baslangic" | "konaklama" | "zaman" | "butce";
interface Problem {
  field: ProblemField;
  /** Eylem çubuğundaki özet için */
  short: string;
  text: string;
}

function FieldError({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <span role="alert" className="flex items-center gap-1.5 text-sm font-semibold text-bad">
      <CircleAlert className="size-4 shrink-0" aria-hidden /> {text}
    </span>
  );
}

/** İlk açılış: üç adımda ne olacağı ve tek dokunuşla örnek plan */
function Welcome({ onSample }: { onSample: () => void }) {
  const steps = [
    { n: 1, t: "Bölgeni seç", d: "Ege, Kapadokya ya da İstanbul" },
    { n: 2, t: "Nerede kalacağını söyle", d: "ya da klasik rotayı tek dokunuşla al" },
    { n: 3, t: "Her sabah rehberin hazır", d: "kahvaltıdan otele, çevrimdışı" },
  ];
  return (
    <section aria-label="Nasıl çalışır" className="rounded-3xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <ol className="grid gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">{s.n}</span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold leading-snug text-ink">{s.t}</span>
              <span className="block text-sm text-muted">{s.d}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <span className="min-w-0 flex-1 text-sm text-muted">Önce nasıl göründüğüne bakmak ister misin?</span>
        <Button size="sm" icon={<Sparkles className="size-4" />} onClick={onSample}>
          Örnek planı gör
        </Button>
      </div>
    </section>
  );
}

function PackCard({ meta, selected, onSelect }: { meta: PackMeta; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition",
        selected ? "border-brand bg-brand-soft/60 ring-1 ring-brand" : "border-line bg-surface hover:bg-surface-2",
      )}
    >
      <span className={cx("grid size-12 shrink-0 place-items-center rounded-2xl text-2xl", meta.sample ? "bg-surface-2" : "bg-sea-soft")} aria-hidden>
        {meta.sample ? "🧪" : "🗺️"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-ink">{meta.name}</span>
          {meta.sample && <Badge tone="warn">Test verisi</Badge>}
        </span>
        <span className="block text-sm text-muted">
          {fmtNumber(meta.places)} mekân · {fmtNumber(meta.towns)} yerleşim
          {meta.bytes ? ` · ${fmtBytes(meta.bytes)}` : ""}
        </span>
        {!meta.sample && meta.generatedAt && <span className="block text-xs text-muted">Güncelleme: {fmtDateShort(meta.generatedAt.slice(0, 10))}</span>}
      </span>
    </button>
  );
}

export default function CreateTrip() {
  const draft = useTrip((s) => s.draft);
  const setDraft = useTrip((s) => s.setDraft);
  const setPlan = useTrip((s) => s.setPlan);
  const hasPlan = useTrip((s) => !!s.plan);
  const fx = useTrip((s) => s.fx);
  const settings = useSettings();
  const list = usePack((s) => s.list);
  const listStatus = usePack((s) => s.listStatus);
  const loadList = usePack((s) => s.loadList);
  const ensurePack = usePack((s) => s.ensurePack);
  const pack = usePack((s) => s.pack);
  const packStatus = usePack((s) => s.status);
  const packError = usePack((s) => s.error);
  const fellBack = usePack((s) => s.fellBackToSample);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // İlk "Planı oluştur" denemesinden sonra eksikler alanların yanında da gösterilir
  const [attempted, setAttempted] = useState(false);
  const sectionRefs = useRef<Partial<Record<ProblemField, HTMLElement | null>>>({});

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Paket listesi gelince varsayılanı seç
  const options: PackMeta[] = useMemo(() => {
    const real = list ?? [];
    return real.length ? real : [samplePackMeta];
  }, [list]);

  useEffect(() => {
    if (listStatus !== "ready" && listStatus !== "error") return;
    if (!draft.packId || !options.some((o) => o.id === draft.packId)) setDraft({ packId: options[0]?.id ?? SAMPLE_PACK_ID });
  }, [listStatus, options, draft.packId, setDraft]);

  useEffect(() => {
    if (draft.packId) void ensurePack(draft.packId);
  }, [draft.packId, ensurePack]);

  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(() => setLine((l) => (l + 1) % LOADING_LINES.length), 1600);
    return () => window.clearInterval(t);
  }, [busy]);

  const towns: Town[] = pack?.towns ?? [];
  const nights = draft.stays.reduce((n, s) => n + s.nights, 0);
  const days = nights + (draft.end ? 1 : 0);
  const perPersonDay = days > 0 ? draft.budgetTry / days / Math.max(1, draft.travelers) : 0;

  const problems: Problem[] = [];
  if (!draft.packId) problems.push({ field: "bolge", short: "bölge", text: "Bir bölge seç." });
  if (!draft.start) problems.push({ field: "baslangic", short: "başlangıç noktası", text: "Başlangıç noktasını seç." });
  if (draft.stays.length === 0) problems.push({ field: "konaklama", short: "konaklama", text: "En az bir geceleme yeri ekle." });
  if (draft.stays.some((s) => s.nights < 1)) problems.push({ field: "konaklama", short: "gece sayısı", text: "Her konaklama en az 1 gece olmalı." });
  if (draft.dayStart >= draft.dayEnd) problems.push({ field: "zaman", short: "gün saatleri", text: "Gün bitişi başlangıçtan sonra olmalı." });
  if (draft.budgetTry <= 0) problems.push({ field: "butce", short: "bütçe", text: "Bütçe gir." });
  const problemFor = (f: ProblemField) => (attempted ? problems.find((p) => p.field === f)?.text : undefined);

  function addStay(t?: Town) {
    const town = t ?? towns.find((x) => !draft.stays.some((s) => s.id === x.id)) ?? towns[0];
    if (!town) return;
    setDraft({ stays: [...draft.stays, { id: town.id, name: town.name, loc: town.loc, nights: 1 }] });
  }

  function moveStay(i: number, d: -1 | 1) {
    const s = [...draft.stays];
    const j = i + d;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j]!, s[i]!];
    setDraft({ stays: s });
  }

  /** Paket bu yerleri içeriyorsa bölgenin klasik rotasını tek dokunuşla doldurur */
  const quick = useMemo(() => {
    const find = (n: string) => towns.find((t) => normTr(t.name) === normTr(n));
    for (const route of QUICK_ROUTES) {
      const stays = route.stays.map(([n, nights]) => ({ town: find(n), nights }));
      if (stays.every((s) => s.town)) {
        return { label: route.label, stays: stays.map((s) => ({ town: s.town!, nights: s.nights })) };
      }
    }
    return null;
  }, [towns]);

  function fillQuick() {
    if (!quick) return;
    const first = quick.stays[0]!.town;
    setDraft({
      start: { id: first.id, name: first.name, loc: first.loc },
      stays: quick.stays.map(({ town: t, nights }) => ({ id: t.id, name: t.name, loc: t.loc, nights })),
    });
  }

  async function create() {
    setError(null);
    if (problems.length) {
      setAttempted(true);
      // İlk eksik alana kaydır; hata metni alanın yanında görünür
      const el = sectionRefs.current[problems[0]!.field];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true });
      return;
    }
    setBusy(true);
    setLine(0);
    try {
      const req = draftToRequest(draft);
      const p = draft.packId === SAMPLE_PACK_ID ? SAMPLE_PACK : await ensurePack(draft.packId!);
      const st = usePack.getState();
      if (!p || !st.index) throw new Error(st.error ?? "Bölge paketi yüklenemedi.");
      const plan = await planTrip(req, p, st.index, settings.seed, settings.osrmUrl, fx);
      setPlan(plan, { sample: p.id === SAMPLE_PACK_ID });
      toast({ kind: "success", title: "Planın hazır!", body: `${plan.days.length} gün · ${req.title}` });
      navigate("bugun");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /** Serbest metinden (AI) çözülen isteği forma aktarır; kullanıcı formda düzeltip planlar */
  function applyAiRequest(req: TripRequest) {
    setDraft({
      title: req.title,
      startDate: req.startDate,
      start: req.start,
      stays: req.stays,
      end: req.end ?? null,
      travelers: req.travelers,
      pace: req.pace,
      interests: req.interests,
      budgetTry: Math.round(toTry(req.budget, fx ?? DEFAULT_FX)),
      transport: req.transport,
      dayStart: req.dayStart,
      dayEnd: req.dayEnd,
      diet: req.diet,
      visitor: req.visitor,
      hasMuzekart: !!req.hasMuzekart,
    });
    toast({ kind: "success", title: "Form dolduruldu", body: "Kontrol et, sonra planı oluştur." });
  }

  async function useSample() {
    await ensurePack(SAMPLE_PACK_ID);
    const plan = makeSamplePlan(todayTr());
    // Bugün ekranı zaten "örnek veri" uyarısı gösteriyor; ayrıca bildirim çıkarılmaz
    setPlan(plan, { sample: true });
    navigate("bugun");
  }

  const transportOpts: Array<{ value: TransportMode; label: ReactNode }> = [
    { value: "araba", label: <><Car className="size-4" aria-hidden /> Araba</> },
    { value: "toplu", label: <><Bus className="size-4" aria-hidden /> Toplu</> },
    { value: "yuruyus", label: <><Footprints className="size-4" aria-hidden /> Yürüyüş</> },
  ];

  return (
    <div className="pb-40 lg:pb-16">
      <PageHeader
        eyebrow={hasPlan ? "Yeni gezi" : "Hoş geldin 👋"}
        title="Gezini planlayalım"
        subtitle="Türkiye'ye özel: bayram takvimi, namaz saatleri, Müzekart, esnaf lokantaları. Hepsi telefonunda, çevrimdışı."
      />

      <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-5 px-4 sm:px-6">
        {!hasPlan && <Welcome onSample={useSample} />}

        {/* ------------------------------------------------ tek cümleyle (isteğe bağlı AI) */}
        <FreeTextTripInput
          pack={pack ?? null}
          defaults={{
            startDate: draft.startDate,
            travelers: draft.travelers,
            pace: draft.pace,
            interests: draft.interests,
            budget: { amount: draft.budgetTry, currency: "TRY" },
            transport: draft.transport,
            dayStart: draft.dayStart,
            dayEnd: draft.dayEnd,
            diet: draft.diet,
            visitor: draft.visitor,
            hasMuzekart: draft.hasMuzekart,
          }}
          today={todayTr()}
          onApply={applyAiRequest}
          onOpenSettings={() => navigate("ayarlar")}
        />

        {/* ------------------------------------------------ bölge */}
        <section className="space-y-2.5" aria-labelledby="sec-bolge" ref={(el) => void (sectionRefs.current.bolge = el)}>
          <SectionTitle>
            <span id="sec-bolge">1 · Bölge</span>
          </SectionTitle>
          {listStatus === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner className="size-4" /> Bölge paketleri yükleniyor…
            </div>
          )}
          {listStatus !== "loading" && (list?.length ?? 0) === 0 && (
            <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-3.5 text-sm text-warn">
              <Database className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Henüz yayınlanmış bir bölge paketi bulunamadı. Arayüzü denemek için <b>örnek (test) veri</b> ile devam edebilirsin.
              </p>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Bölge paketi">
            {options.map((m) => (
              <PackCard key={m.id} meta={m} selected={draft.packId === m.id} onSelect={() => setDraft({ packId: m.id, start: null, stays: [], end: null })} />
            ))}
          </div>
          {packStatus === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner className="size-4" /> Paket indiriliyor…
            </div>
          )}
          <FieldError text={problemFor("bolge")} />
          {quick && draft.stays.length === 0 && (
            <button
              type="button"
              onClick={fillQuick}
              className="flex w-full items-center gap-3 rounded-2xl border border-sea/30 bg-sea-soft p-3.5 text-left transition hover:brightness-[0.98]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sea text-white">
                <WandSparkles className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">Klasik rotayla başla</span>
                <span className="block text-sm text-sea">
                  {quick.label} · {quick.stays.reduce((n, s) => n + s.nights, 0)} gece
                </span>
              </span>
              <ChevronRight className="size-5 text-sea" aria-hidden />
            </button>
          )}
          {fellBack && draft.packId !== SAMPLE_PACK_ID && (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
              {packError} Şimdilik örnek veri gösteriliyor.
            </p>
          )}
        </section>

        {/* ------------------------------------------------ rota */}
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionTitle
            action={
              quick &&
              draft.stays.length > 0 && (
                <Button size="sm" variant="ghost" icon={<WandSparkles className="size-4" />} onClick={fillQuick}>
                  Klasik rota
                </Button>
              )
            }
          >
            2 · Rota
          </SectionTitle>
          <div ref={(el) => void (sectionRefs.current.baslangic = el)}>
          <Field label="Nereden başlıyorsun?" hint={problemFor("baslangic") ? <FieldError text={problemFor("baslangic")} /> : undefined}>
            <TownPicker
              towns={towns}
              label="Başlangıç noktası"
              value={draft.start}
              onChange={(t) => setDraft({ start: { id: t.id, name: t.name, loc: t.loc } })}
              placeholder="Şehir ya da kasaba seç"
            />
          </Field>
          </div>

          <div className="space-y-2" ref={(el) => void (sectionRefs.current.konaklama = el)}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-2">Nerede kalacaksın?</span>
              <span className="text-xs text-muted">{nights} gece</span>
            </div>
            {draft.stays.length === 0 && <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">Gecelemek istediğin yerleri sırayla ekle. Örn. Selçuk 2 gece, Pamukkale 1 gece.</p>}
            <ol className="space-y-2">
              {draft.stays.map((s, i) => (
                <li key={`${s.id}-${i}`} className="rounded-2xl border border-line bg-surface-2/50 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <TownPicker
                        compact
                        towns={towns}
                        label={`${i + 1}. konaklama`}
                        value={s}
                        onChange={(t) => setDraft({ stays: draft.stays.map((x, k) => (k === i ? { ...x, id: t.id, name: t.name, loc: t.loc } : x)) })}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-9">
                    <Stepper
                      label="Gece"
                      value={s.nights}
                      min={1}
                      max={14}
                      suffix="gece"
                      onChange={(v) => setDraft({ stays: draft.stays.map((x, k) => (k === i ? { ...x, nights: v } : x)) })}
                    />
                    <div className="flex">
                      <Button size="sm" variant="ghost" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => moveStay(i, -1)}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Aşağı taşı" disabled={i === draft.stays.length - 1} onClick={() => moveStay(i, 1)}>
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Kaldır" onClick={() => setDraft({ stays: draft.stays.filter((_, k) => k !== i) })}>
                        <Trash2 className="size-4 text-bad" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => addStay()} disabled={!towns.length} className="w-full border-dashed">
              Konaklama ekle
            </Button>
            <FieldError text={problemFor("konaklama")} />
          </div>

          <Toggle
            checked={!!draft.end}
            onChange={(on) => setDraft({ end: on ? (draft.start ?? null) : null })}
            label="Son gün bir yere dönüş var"
            description="Havalimanı ya da ev: son gün otelden oraya gidilir (+1 gün)."
          />
          {draft.end && (
            <TownPicker towns={towns} label="Dönüş noktası" value={draft.end} onChange={(t) => setDraft({ end: { id: t.id, name: t.name, loc: t.loc } })} />
          )}
        </Card>

        {/* ------------------------------------------------ zaman */}
        <section ref={(el) => void (sectionRefs.current.zaman = el)} className="rounded-3xl border border-line bg-surface p-4 shadow-card sm:p-5">
          <div className="space-y-4">
          <SectionTitle>3 · Zaman</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Başlangıç tarihi" htmlFor="f-date">
              <input id="f-date" type="date" className={inputClass} value={draft.startDate} onChange={(e) => e.target.value && setDraft({ startDate: e.target.value })} />
            </Field>
            <Field label="Güne başlama" htmlFor="f-ds">
              <input id="f-ds" type="time" className={inputClass} value={draft.dayStart} onChange={(e) => setDraft({ dayStart: e.target.value })} />
            </Field>
            <Field label="Günü bitirme" htmlFor="f-de">
              <input id="f-de" type="time" className={inputClass} value={draft.dayEnd} onChange={(e) => setDraft({ dayEnd: e.target.value })} />
            </Field>
          </div>
          {days > 0 && (
            <p className="text-sm text-muted">
              {days} gün: {fmtDateShort(draft.startDate)} – {fmtDateShort(addDays(draft.startDate, days - 1))}
            </p>
          )}
          <FieldError text={problemFor("zaman")} />
          </div>
        </section>

        {/* ------------------------------------------------ tercihler */}
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionTitle>4 · Tercihler</SectionTitle>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink-2">Kaç kişisiniz?</span>
            <Stepper label="Yolcu" value={draft.travelers} min={1} max={12} suffix="kişi" onChange={(v) => setDraft({ travelers: v })} />
          </div>
          <Field label="Tempo">
            <Segmented label="Tempo" value={draft.pace} options={PACE} onChange={(v) => setDraft({ pace: v })} />
          </Field>
          <Field label="Ulaşım">
            <Segmented label="Ulaşım" value={draft.transport} options={transportOpts} onChange={(v) => setDraft({ transport: v })} />
          </Field>
          <Field label="İlgi alanların">
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((it) => {
                const on = draft.interests.includes(it.id);
                return (
                  <Chip
                    key={it.id}
                    selected={on}
                    onClick={() => setDraft({ interests: on ? draft.interests.filter((x) => x !== it.id) : [...draft.interests, it.id] })}
                  >
                    <span aria-hidden>{it.emoji}</span> {it.label}
                  </Chip>
                );
              })}
            </div>
          </Field>
          <div className="grid gap-1 sm:grid-cols-2 sm:gap-6">
            <Toggle checked={!!draft.diet.vegetarian} onChange={(v) => setDraft({ diet: { ...draft.diet, vegetarian: v } })} label="Vejetaryen" description="Uygun mekânlar öne çıkar" />
            <Toggle checked={!!draft.diet.noAlcohol} onChange={(v) => setDraft({ diet: { ...draft.diet, noAlcohol: v } })} label="Alkolsüz mekânlar" description="Meyhaneler önerilmez" />
          </div>
        </Card>

        {/* ------------------------------------------------ bütçe */}
        <section ref={(el) => void (sectionRefs.current.butce = el)} className="space-y-4 rounded-3xl border border-line bg-surface p-4 shadow-card sm:p-5">
          <SectionTitle>5 · Bütçe</SectionTitle>
          <Field
            label="Toplam bütçe (bütün yolcular, konaklama dahil)"
            htmlFor="f-budget"
            hint={days > 0 ? `≈ kişi başı günde ${fmtTry(perPersonDay)}` : undefined}
          >
            <div className="relative">
              <input
                id="f-budget"
                inputMode="numeric"
                className={cx(inputClass, "pr-10 text-lg font-bold tabular")}
                value={draft.budgetTry ? fmtNumber(draft.budgetTry) : ""}
                placeholder="30.000"
                onChange={(e) => setDraft({ budgetTry: Number(e.target.value.replace(/\D/g, "")) || 0 })}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-muted">₺</span>
            </div>
          </Field>
          <FieldError text={problemFor("butce")} />
          <Field label="Ziyaretçi" hint="Müze biletleri yerli ve yabancı için farklı fiyatlanır.">
            <Segmented
              label="Ziyaretçi"
              value={draft.visitor}
              options={[
                { value: "yerli", label: "🇹🇷 Yerli" },
                { value: "yabanci", label: "🌍 Yabancı" },
              ]}
              onChange={(v) => setDraft({ visitor: v })}
            />
          </Field>
          {draft.visitor === "yerli" && (
            <Toggle
              checked={draft.hasMuzekart}
              onChange={(v) => setDraft({ hasMuzekart: v })}
              label="Müzekart'ım var"
              description="Bakanlık müze ve ören yerleri ücretsiz hesaplanır."
            />
          )}
        </section>

        {error && (
          <div role="alert" className="flex gap-3 rounded-2xl border border-bad/30 bg-bad-soft p-4 text-bad">
            <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Plan oluşturulamadı</p>
              <p className="mt-0.5 text-sm">{error}</p>
              <Button size="sm" variant="secondary" className="mt-3" icon={<Sparkles className="size-4" />} onClick={useSample}>
                Örnek planı göster
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------ eylem çubuğu */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur lg:static lg:mx-auto lg:mt-6 lg:max-w-3xl lg:border-0 lg:bg-transparent lg:px-6 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Button variant="primary" size="lg" className="flex-1" loading={busy} icon={<Sparkles className="size-5" />} onClick={create}>
            Planı oluştur
          </Button>
          {!busy && (
            <Button variant="secondary" size="lg" onClick={useSample} title="Test verisiyle hazır bir 3 günlük plan" className="px-3.5">
              Örnek
            </Button>
          )}
        </div>
        {busy ? (
          <p className="mx-auto mt-2 max-w-3xl text-center text-sm text-muted" aria-live="polite">
            {LOADING_LINES[line]}
          </p>
        ) : (
          problems.length > 0 && (
            <p className={cx("mx-auto mt-2 max-w-3xl text-center text-sm", attempted ? "font-semibold text-bad" : "text-muted")} aria-live="polite">
              Eksik: {[...new Set(problems.map((p) => p.short))].join(", ")}
            </p>
          )
        )}
      </div>
    </div>
  );
}
