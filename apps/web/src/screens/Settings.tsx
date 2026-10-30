// Ayarlar: rota sunucusu, yakınlık bildirimleri, planlayıcı tohumu, veri yönetimi, atıflar.
import { useRef, useState, type CSSProperties } from "react";
import { Bell, Dices, Download, ExternalLink, Map as MapIcon, RotateCcw, Trash2, Upload } from "lucide-react";
import { CATEGORIES, DEFAULT_OSRM_URL, formatHHmm, parseHHmm, type PlaceCategory } from "@rota/core";
import { Sheet } from "../components/Sheet";
import { Button, Card, Chip, Field, PageHeader, SectionTitle, Stepper, Toggle, cx, inputClass } from "../components/ui";
import { notificationPermission, requestNotificationPermission, showNotification } from "../lib/notify";
import { clearAllData } from "../state/persist";
import { usePack } from "../state/pack";
import { BUILD_MAPBOX_TOKEN, useSettings } from "../state/settings";
import { isMapboxToken } from "../map/mapbox";
import { useTrip } from "../state/trip";
import { toast } from "../state/ui";
import { fmtDateShort } from "../lib/format";
import { AiSettingsCard } from "../features/ai";
import { VoiceSettings } from "../features/voice/VoiceSettings";

const PROX_CATS: PlaceCategory[] = [
  "antik_kent",
  "muze",
  "tarihi_yapi",
  "cami",
  "dogal_alan",
  "manzara",
  "plaj",
  "tatlici",
  "yoresel_urun",
  "cay_bahcesi",
  "carsi",
  "balikci",
];

const REPO = "https://github.com/Murat7Ay/rota-turkiye";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export default function Settings() {
  const s = useSettings();
  const plan = useTrip((t) => t.plan);
  const pack = usePack((p) => p.pack);
  const [osrm, setOsrm] = useState(s.osrmUrl);
  const [perm, setPerm] = useState(notificationPermission());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const p = s.proximity;

  function exportData() {
    const t = useTrip.getState();
    const data = {
      app: "rota-turkiye",
      format: 1,
      exportedAt: new Date().toISOString(),
      draft: t.draft,
      plan: t.plan,
      expenses: t.expenses,
      settings: { osrmUrl: s.osrmUrl, proximity: s.proximity, seed: s.seed },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rota-turkiye-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast({ kind: "success", title: "Dışa aktarıldı", body: "Gezi JSON dosyası indirildi." });
  }

  async function importData(file: File) {
    try {
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      const plan = raw.plan as { days?: unknown[]; id?: string } | null | undefined;
      if (raw.app !== "rota-turkiye" && !(plan && Array.isArray(plan.days))) throw new Error("Bu bir Rota Türkiye dışa aktarma dosyası değil.");
      if (plan && !Array.isArray(plan.days)) throw new Error("Plan biçimi tanınmadı.");
      useTrip.getState().importAll({
        plan: (plan ?? null) as never,
        expenses: Array.isArray(raw.expenses) ? (raw.expenses as never) : [],
        draft: raw.draft as never,
      });
      const st = raw.settings as Record<string, unknown> | undefined;
      if (st) {
        useSettings.getState().replaceAll({
          osrmUrl: typeof st.osrmUrl === "string" ? st.osrmUrl : s.osrmUrl,
          seed: typeof st.seed === "number" ? st.seed : s.seed,
          proximity: st.proximity ? { ...s.proximity, ...(st.proximity as object) } : s.proximity,
        });
      }
      toast({ kind: "success", title: "İçe aktarıldı", body: plan ? "Gezi planı yüklendi." : "Ayarlar yüklendi." });
    } catch (e) {
      toast({ kind: "error", title: "İçe aktarılamadı", body: e instanceof Error ? e.message : String(e) });
    }
  }

  async function deleteAll() {
    await clearAllData();
    useTrip.getState().clearTrip();
    window.location.hash = "#/olustur";
    window.location.reload();
  }

  return (
    <div className="pb-28 lg:pb-10">
      <PageHeader title="Ayarlar" subtitle="Her şey cihazında kalır; hesap yok, takip yok." />
      <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4 px-4 sm:px-6">
        {/* ------------------------------------------------ yapay zekâ (isteğe bağlı, kendi anahtarın) */}
        <AiSettingsCard />
        <VoiceSettings />

        <MapboxCard />

        {/* ------------------------------------------------ rota sunucusu */}
        <Card className="space-y-3 p-4 sm:p-5">
          <SectionTitle>Rota sunucusu (OSRM)</SectionTitle>
          <Field
            label="Sunucu adresi"
            htmlFor="osrm"
            hint={
              <>
                Varsayılan <code className="rounded bg-surface-2 px-1">{DEFAULT_OSRM_URL}</code> herkese açık bir demo sunucusudur; yalnızca hafif kullanım
                içindir. Yoğun kullanım için kendi OSRM sunucunu (repo: <code className="rounded bg-surface-2 px-1">infra/osrm</code>) kurabilirsin. Rota
                alınamazsa planlayıcı kuş uçuşu tahmine düşer.
              </>
            }
          >
            <input id="osrm" className={inputClass} value={osrm} onChange={(e) => setOsrm(e.target.value)} spellCheck={false} inputMode="url" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={osrm.trim() === s.osrmUrl}
              onClick={() => {
                s.setOsrmUrl(osrm);
                toast({ kind: "success", title: "Rota sunucusu kaydedildi" });
              }}
            >
              Kaydet
            </Button>
            <Button
              variant="ghost"
              icon={<RotateCcw className="size-4" />}
              onClick={() => {
                setOsrm(DEFAULT_OSRM_URL);
                s.setOsrmUrl(DEFAULT_OSRM_URL);
              }}
            >
              Varsayılan
            </Button>
          </div>
        </Card>

        {/* ------------------------------------------------ bildirimler */}
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionTitle
            action={
              <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => s.resetProximity()}>
                Varsayılan
              </Button>
            }
          >
            Yol üstü bildirimleri
          </SectionTitle>
          <Toggle
            checked={p.enabled}
            onChange={(v) => s.setProximity({ enabled: v })}
            label="Canlı modda bildir"
            description="Rotanın ilerisinde ya da yakınında değerli bir yer varsa haber ver."
          />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Tarayıcı bildirim izni</p>
              <p className="text-xs text-muted">
                {perm === "granted" ? "Verildi" : perm === "denied" ? "Reddedildi (tarayıcı ayarlarından açabilirsin)" : perm === "unsupported" ? "Bu tarayıcı desteklemiyor" : "Henüz sorulmadı"} · Uygulama açıkken çalışır.
              </p>
            </div>
            {perm === "default" && (
              <Button size="sm" icon={<Bell className="size-4" />} onClick={async () => setPerm(await requestNotificationPermission())}>
                İzin ver
              </Button>
            )}
            {perm === "granted" && (
              <Button size="sm" onClick={() => void showNotification("İleride: Nysa Antik Kenti", "12 km sonra · rotadan 1,8 km · deneme bildirimi", "deneme")}>
                Deneme bildirimi
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink-2">Günde en fazla</span>
              <Stepper label="Günlük bildirim" value={p.maxPerDay} min={1} max={12} onChange={(v) => s.setProximity({ maxPerDay: v })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink-2">Aralık (dk)</span>
              <Stepper label="Bildirim aralığı" value={p.cooldownMin} min={0} max={120} onChange={(v) => s.setProximity({ cooldownMin: v })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sessiz saat başlangıcı" htmlFor="q1">
              <input
                id="q1"
                type="time"
                className={inputClass}
                value={formatHHmm(p.quietHours[0])}
                onChange={(e) => e.target.value && s.setProximity({ quietHours: [parseHHmm(e.target.value), p.quietHours[1]] })}
              />
            </Field>
            <Field label="Sessiz saat bitişi" htmlFor="q2">
              <input
                id="q2"
                type="time"
                className={inputClass}
                value={formatHHmm(p.quietHours[1])}
                onChange={(e) => e.target.value && s.setProximity({ quietHours: [p.quietHours[0], parseHHmm(e.target.value)] })}
              />
            </Field>
          </div>
          <RangeRow label="İleriye bakış" unit="km" min={5} max={60} step={5} value={p.lookaheadKm} onChange={(v) => s.setProximity({ lookaheadKm: v })} />
          <RangeRow label="Rotadan en fazla sapma" unit="km" min={1} max={10} step={0.5} value={p.maxOffRouteKm} onChange={(v) => s.setProximity({ maxOffRouteKm: v })} />
          <Field label="Hangi yerler?">
            <div className="flex flex-wrap gap-2">
              {PROX_CATS.map((c) => {
                const on = p.categories.includes(c);
                return (
                  <Chip key={c} selected={on} onClick={() => s.setProximity({ categories: on ? p.categories.filter((x) => x !== c) : [...p.categories, c] })}>
                    <span aria-hidden>{CATEGORIES[c].emoji}</span> {CATEGORIES[c].label}
                  </Chip>
                );
              })}
            </div>
          </Field>
        </Card>

        {/* ------------------------------------------------ planlayıcı */}
        <Card className="space-y-3 p-4 sm:p-5">
          <SectionTitle>Planlayıcı</SectionTitle>
          <Field label="Tohum (seed)" htmlFor="seed" hint="Aynı istek + aynı tohum = aynı plan. Farklı bir plan görmek için değiştir.">
            <div className="flex gap-2">
              <input
                id="seed"
                inputMode="numeric"
                className={cx(inputClass, "tabular")}
                value={s.seed}
                onChange={(e) => s.setSeed(Number(e.target.value.replace(/\D/g, "")) || 0)}
              />
              <Button icon={<Dices className="size-4" />} onClick={() => s.setSeed(Math.floor(Math.random() * 100000))}>
                Rastgele
              </Button>
            </div>
          </Field>
        </Card>

        {/* ------------------------------------------------ veriler */}
        <Card className="space-y-3 p-4 sm:p-5">
          <SectionTitle>Veriler</SectionTitle>
          <p className="text-sm text-muted">
            Plan, harcamalar ve ayarlar yalnızca bu cihazda (IndexedDB) saklanır.
            {pack ? ` Yüklü bölge paketi: ${pack.name} (${pack.places.length} mekân, ${fmtDateShort(pack.generatedAt.slice(0, 10))}).` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Download className="size-4" />} onClick={exportData} disabled={!plan}>
              Geziyi dışa aktar
            </Button>
            <Button icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
              İçe aktar
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importData(f);
                e.target.value = "";
              }}
            />
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>
              Bütün verileri sil
            </Button>
          </div>
        </Card>

        {/* ------------------------------------------------ hakkında */}
        <Card className="space-y-3 p-4 sm:p-5">
          <SectionTitle>Hakkında ve atıflar</SectionTitle>
          <p className="text-sm text-ink-2">
            Rota Türkiye; çevrimdışı çalışan, Türkiye'ye özel, açık kaynak bir gezi planlayıcı. Bütün hesaplar telefonunda yapılır.
          </p>
          <ul className="space-y-2 text-sm text-ink-2">
            <li>
              🗺️ Harita ve mekân verisi:{" "}
              <a className="font-semibold text-sea hover:underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
                © OpenStreetMap katkıcıları (ODbL)
              </a>
            </li>
            <li>
              🧱 Harita karoları:{" "}
              <a className="font-semibold text-sea hover:underline" href="https://openfreemap.org" target="_blank" rel="noopener">
                OpenFreeMap
              </a>{" "}
              · OpenMapTiles şeması
            </li>
            <li>
              🌦️ Hava durumu:{" "}
              <a className="font-semibold text-sea hover:underline" href="https://open-meteo.com" target="_blank" rel="noopener">
                Open-Meteo (CC BY 4.0)
              </a>
            </li>
            <li>
              🛣️ Rotalar:{" "}
              <a className="font-semibold text-sea hover:underline" href="https://project-osrm.org" target="_blank" rel="noopener">
                OSRM
              </a>
            </li>
            <li>💱 Döviz: TCMB kurları (yedek)</li>
          </ul>
          <a
            href={REPO}
            target="_blank"
            rel="noopener"
            className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-surface-2 px-3.5 font-semibold text-ink hover:bg-surface-3"
          >
            <GithubMark className="size-5" />
            <span className="min-w-0 flex-1 truncate">github.com/Murat7Ay/rota-turkiye</span>
            <ExternalLink className="size-4 text-muted" aria-hidden />
          </a>
        </Card>
      </div>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Bütün veriler silinsin mi?"
        subtitle="Plan, harcamalar ve ayarlar bu cihazdan kalıcı olarak silinir. Önce dışa aktarmak isteyebilirsin."
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setConfirmDelete(false)}>
              Vazgeç
            </Button>
            <Button className="flex-1" variant="danger" icon={<Trash2 className="size-4" />} onClick={deleteAll}>
              Evet, sil
            </Button>
          </div>
        }
      >
        <p className="pb-2 text-sm text-muted">Bölge paketleri tarayıcı önbelleğinde kalır; bir sonraki gezide yeniden indirmen gerekmez.</p>
      </Sheet>
    </div>
  );
}

function RangeRow({ label, unit, min, max, step, value, onChange }: { label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-ink-2">{label}</span>
        <span className="font-bold text-brand tabular">
          {String(value).replace(".", ",")} {unit}
        </span>
      </div>
      <input
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        style={{ "--fill": `${fill}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/** Etrafım haritası: isteğe bağlı Mapbox anahtarı. Anahtar public (pk.) olmalı; gizli anahtar istenmez. */
function MapboxCard() {
  const saved = useSettings((s) => s.mapboxToken);
  const setToken = useSettings((s) => s.setMapboxToken);
  const [draft, setDraft] = useState(saved);
  const t = draft.trim();
  const secret = /^sk\./.test(t);
  const invalid = t.length > 0 && !secret && !isMapboxToken(t);
  const active = saved || BUILD_MAPBOX_TOKEN;
  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <SectionTitle>Harita görünümü</SectionTitle>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sea-soft text-sea">
          <MapIcon className="size-5" aria-hidden />
        </span>
        <p className="text-sm text-ink-2">
          Etrafım'daki 3B maket varsayılan olarak OpenFreeMap ile çizilir. Bir Mapbox <b>public</b> anahtarı (pk.…) eklersen çevrimiçiyken Mapbox
          haritası kullanılır; çevrimdışıyken ve indirilen paketlerde yine OpenFreeMap çalışır.
        </p>
      </div>
      <p className="text-sm">
        Şu an:{" "}
        <b className={active ? "text-good" : "text-ink"}>
          {active ? (saved ? "Mapbox (senin anahtarın)" : "Mapbox (uygulamanın anahtarı)") : "OpenFreeMap"}
        </b>
      </p>
      <Field
        label="Mapbox public anahtarı"
        htmlFor="mapbox-token"
        hint={
          <a href="https://console.mapbox.com/account/access-tokens/" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold text-sea hover:underline">
            Anahtar al: console.mapbox.com <ExternalLink className="size-3" aria-hidden />
          </a>
        }
      >
        <input
          id="mapbox-token"
          className={cx(inputClass, "font-mono")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="pk.eyJ1Ijoi…"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
        />
      </Field>
      {secret && <p className="text-sm font-semibold text-bad">Bu gizli (sk.) bir anahtar; tarayıcıya konmamalı. Mapbox'tan bir public (pk.) anahtar oluştur.</p>}
      {invalid && <p className="text-sm text-warn">Mapbox public anahtarları “pk.” ile başlar ve iki noktayla ayrılmış üç parçadan oluşur.</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={t === saved || secret || invalid}
          onClick={() => {
            setToken(t);
            toast({ kind: "success", title: t ? "Mapbox anahtarı kaydedildi" : "Mapbox anahtarı kaldırıldı", body: "Etrafım'ı yeniden açınca geçerli olur." });
          }}
        >
          Kaydet
        </Button>
        {saved && (
          <Button
            variant="ghost"
            icon={<Trash2 className="size-4" />}
            onClick={() => {
              setToken("");
              setDraft("");
            }}
          >
            Kaldır
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">
        Anahtarı Mapbox panelinde yalnızca bu sitenin adresiyle sınırlandırmanı öneririz (URL restriction). Harita MapLibre ile çizildiği için kullanım
        Mapbox'ta “harita yüklemesi” değil karo isteği (Vector Tiles API) olarak sayılır; ücretsiz kotayı Mapbox fiyat sayfasından kontrol et.
      </p>
    </Card>
  );
}
