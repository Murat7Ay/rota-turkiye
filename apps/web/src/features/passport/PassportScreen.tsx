// Türkiye Pasaportu ekranı: bordo kapak, krem kâğıt sayfalar, damgalar, il haritası ve
// her gezi için Wrapped kartı. Bütün hesap cihazda; yalnız "yapıldı" işaretli duraklar sayılır.
import { useMemo, useState, type CSSProperties } from "react";
import { toTrWallClock } from "@rota/core";
import type { PlaceIndex } from "@rota/core";
import { fmtDateShort } from "../../lib/format";
import {
  computeStamps,
  isTripFinished,
  provinceVisits,
  STAMP_TIERS,
  STAMPS,
  TIER_LABELS,
  type StampProgress,
  type TripRecord,
} from "../../../../../packages/core/src/stamps";
import { PROVINCE_COUNT } from "../../../../../packages/core/src/provinces";
import { ProvinceDotMap } from "./ProvinceDotMap";
import { StampSeal, TIER_COLORS } from "./StampSeal";
import { WrappedCard } from "./WrappedCard";

const PAPER: CSSProperties = {
  backgroundColor: "#F7F0E1",
  backgroundImage: [
    "radial-gradient(circle at 15% 8%, rgba(255,255,255,0.75), transparent 38%)",
    "radial-gradient(circle at 90% 95%, rgba(194,65,12,0.07), transparent 42%)",
    "repeating-linear-gradient(0deg, rgba(120,90,50,0.035) 0 1px, transparent 1px 26px)",
    "radial-gradient(rgba(120,90,50,0.08) 0.6px, transparent 0.7px)",
  ].join(", "),
  backgroundSize: "auto, auto, auto, 5px 5px",
};

const COVER: CSSProperties = {
  backgroundImage: [
    "radial-gradient(circle at 88% 12%, rgba(243,213,138,0.2), transparent 42%)",
    "repeating-radial-gradient(circle at 50% 130%, rgba(243,213,138,0.07) 0 2px, transparent 2px 13px)",
    "linear-gradient(160deg, #7F1D1D 0%, #5B0E14 58%, #3F0A0F 100%)",
  ].join(", "),
};

// Sayının okunuşundaki son kelimeye göre belirtme (iyelik) eki: 5'i, 2'si, 3'ü, 6'sı, 10'u, 40'ı…
const ONES = ["", "i", "si", "ü", "ü", "i", "sı", "si", "i", "u"] as const;
const TENS = ["ı", "u", "si", "u", "ı", "si", "ı", "i", "i", "ı"] as const;
export function numSuffix(n: number): string {
  const ones = n % 10;
  return ones ? ONES[ones]! : TENS[Math.floor(n / 10) % 10]!;
}

function trDate(iso: string): string {
  return fmtDateShort(toTrWallClock(new Date(iso)).date);
}

function Octagram({ className, color }: { className?: string; color: string }) {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const r = i % 2 === 0 ? 48 : 48 * 0.7654;
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <polygon points={pts} fill="none" stroke={color} strokeWidth="1.6" />
      <circle cx="50" cy="50" r="20" fill="none" stroke={color} strokeWidth="1.2" />
      <circle cx="50" cy="50" r="4" fill={color} />
    </svg>
  );
}

function SectionHead({ kicker, title, aside }: { kicker: string; title: string; aside?: string }) {
  return (
    <header className="mb-3 flex items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#A0582A]">{kicker}</p>
        <h2 className="text-xl font-extrabold leading-tight text-[#3B2F24]">{title}</h2>
      </div>
      {aside && <span className="shrink-0 pb-0.5 text-sm font-bold text-[#7A6A58]">{aside}</span>}
    </header>
  );
}

function StampDetail({ s }: { s: StampProgress }) {
  const color = s.tier ? TIER_COLORS[s.tier].ink : "#7A6A58";
  return (
    <div className="mt-4 rounded-3xl border border-[#E4D6BE] bg-[#FFFBF3]/80 p-4">
      <div className="flex items-start gap-3">
        <span className="text-4xl leading-none" aria-hidden style={{ filter: s.tier ? undefined : "grayscale(1)" }}>
          {s.def.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-[#3B2F24]">{s.def.name}</h3>
          <p className="text-sm text-[#5C4B3B]">{s.def.description}</p>
          <p className="mt-1 text-sm font-semibold" style={{ color }}>
            {s.tier ? `${TIER_LABELS[s.tier]} damga · ${s.earnedAt ? trDate(s.earnedAt) : ""}` : "Henüz kilitli"} · toplam {s.count} {s.def.unit}
          </p>
        </div>
      </div>
      <ol className="mt-3 grid grid-cols-3 gap-2">
        {STAMP_TIERS.map((t, i) => {
          const at = s.tierEarnedAt[i];
          return (
            <li
              key={t}
              className="rounded-2xl border px-2 py-2 text-center"
              style={{
                borderColor: at ? TIER_COLORS[t].ink : "#E4D6BE",
                background: at ? TIER_COLORS[t].soft : "transparent",
              }}
            >
              <span className="block text-xs font-extrabold uppercase tracking-wider" style={{ color: TIER_COLORS[t].ink }}>
                {TIER_LABELS[t]}
              </span>
              <span className="block text-sm font-bold text-[#3B2F24]">{s.def.thresholds[i]}</span>
              <span className="block text-[11px] text-[#7A6A58]">{at ? trDate(at) : s.def.unit}</span>
            </li>
          );
        })}
      </ol>
      {s.next && (
        <p className="mt-3 text-sm font-medium text-[#5C4B3B]">
          {TIER_LABELS[s.next.tier]} için {s.next.remaining} {s.def.unit} daha.
        </p>
      )}
    </div>
  );
}

export function PassportScreen({ trips, index, now }: { trips: TripRecord[]; index: PlaceIndex; now?: Date }) {
  const stamps = useMemo(() => computeStamps(trips, index, { now }), [trips, index, now]);
  const provinces = useMemo(() => provinceVisits(trips, index), [trips, index]);
  const visited = useMemo(() => new Set(provinces.map((v) => v.province.plate)), [provinces]);
  const latest = provinces[provinces.length - 1]?.province.plate ?? null;
  const earnedCount = stamps.filter((s) => s.tier !== null).length;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ordered = useMemo(() => {
    const earned = stamps.filter((s) => s.tier).sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""));
    const locked = stamps.filter((s) => !s.tier).sort((a, b) => b.progress - a.progress);
    return [...earned, ...locked];
  }, [stamps]);
  const selected = ordered.find((s) => s.def.id === selectedId) ?? null;

  const wrapped = useMemo(() => {
    const ref = now ?? new Date();
    const byId = new Map<string, TripRecord>();
    for (const t of trips) byId.set(t.plan.id, t);
    return [...byId.values()]
      .map((t) => ({
        t,
        finished: isTripFinished(t.plan, ref),
        started: t.plan.days.some((d) => d.stops.some((s) => s.status === "done")),
        end: t.plan.days[t.plan.days.length - 1]?.date ?? "",
      }))
      .filter((x) => x.finished || x.started)
      .sort((a, b) => b.end.localeCompare(a.end));
  }, [trips, now]);

  const pct = Math.round((visited.size / PROVINCE_COUNT) * 100);
  const lastAward = ordered[0]?.tier ? ordered[0] : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-10 pt-4">
      {/* kapak */}
      <section className="relative overflow-hidden rounded-[28px] p-5 text-[#F3D58A] shadow-lift" style={COVER}>
        <Octagram className="pointer-events-none absolute -right-8 -top-8 size-44 opacity-30" color="#F3D58A" />
        <p className="text-[11px] font-extrabold uppercase tracking-[0.32em] text-[#F3D58A]/80">Rota Türkiye · Gezgin defteri</p>
        <h1 className="mt-1 font-serif text-[30px] font-black leading-tight tracking-wide">Türkiye Pasaportu</h1>
        <p className="mt-0.5 text-sm text-[#F3D58A]/80">
          {lastAward
            ? `Son damga: ${lastAward.def.emoji} ${lastAward.def.name} (${TIER_LABELS[lastAward.tier!]})`
            : "Durakları “yapıldı” diye işaretle, damgalar birikmeye başlasın."}
        </p>
        <dl className="mt-5 grid grid-cols-3 gap-2">
          {(
            [
              [`${earnedCount}`, `/${STAMPS.length} damga`],
              [`${visited.size}`, "/81 il"],
              [`${wrapped.length}`, "gezi"],
            ] as const
          ).map(([v, l]) => (
            <div key={l} className="rounded-2xl border border-[#F3D58A]/25 bg-black/15 px-3 py-2.5">
              <dt className="sr-only">{l}</dt>
              <dd>
                <span className="text-2xl font-black leading-none">{v}</span>
                <span className="ml-1 text-xs font-semibold text-[#F3D58A]/75">{l}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* iller */}
      <section className="rounded-[28px] border border-[#E4D6BE] p-4 shadow-card sm:p-5" style={PAPER}>
        <SectionHead
          kicker="İl haritası"
          title={visited.size > 0 ? `81 ilden ${visited.size}'${numSuffix(visited.size)}` : "81 il seni bekliyor"}
          aside={`%${pct}`}
        />
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#E4D9C6]" role="progressbar" aria-valuemin={0} aria-valuemax={81} aria-valuenow={visited.size}>
          <div className="h-full rounded-full bg-gradient-to-r from-[#C2410C] to-[#0E7490]" style={{ width: `${Math.max(pct, visited.size ? 2 : 0)}%` }} />
        </div>
        <ProvinceDotMap visited={visited} latest={latest} />
        {provinces.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {provinces.map((v) => (
              <li
                key={v.province.plate}
                title={`İlk ziyaret: ${trDate(v.firstAt)} · ${v.visits} durak`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E4D6BE] bg-[#FFFBF3] py-1 pl-1 pr-3 text-sm font-semibold text-[#3B2F24]"
              >
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#C2410C] px-1 text-[11px] font-extrabold text-white">
                  {String(v.province.plate).padStart(2, "0")}
                </span>
                {v.province.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[#7A6A58]">Bir durağı “yapıldı” olarak işaretlediğinde ili haritada yanar.</p>
        )}
        <p className="mt-2 text-[11px] text-[#9A8B78]">İl, mekânın adresinden ya da en yakın il/ilçe merkezinden yaklaşık bulunur.</p>
      </section>

      {/* damgalar */}
      <section className="rounded-[28px] border border-[#E4D6BE] p-4 shadow-card sm:p-5" style={PAPER}>
        <SectionHead kicker="Damgalar" title="Gezgin mühürleri" aside={`${earnedCount}/${stamps.length}`} />
        <div className="grid grid-cols-3 gap-x-1 gap-y-3 sm:grid-cols-4">
          {ordered.map((s) => (
            <StampSeal
              key={s.def.id}
              stamp={s}
              i={STAMPS.findIndex((d) => d.id === s.def.id)}
              size={96}
              selected={selectedId === s.def.id}
              onClick={() => setSelectedId((cur) => (cur === s.def.id ? null : s.def.id))}
            />
          ))}
        </div>
        {selected ? (
          <StampDetail s={selected} />
        ) : (
          <p className="mt-3 text-center text-sm text-[#7A6A58]">Ayrıntı ve kademeler için bir damgaya dokun.</p>
        )}
      </section>

      {/* Wrapped */}
      <section>
        <div className="mb-3 px-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand">Gezi Wrapped</p>
          <h2 className="text-xl font-extrabold text-ink">Gezilerinin hikâyesi</h2>
        </div>
        {wrapped.length > 0 ? (
          <div className="space-y-4">
            {wrapped.map(({ t, finished }) => (
              <WrappedCard
                key={t.plan.id}
                plan={t.plan}
                expenses={t.expenses}
                index={index}
                allTrips={trips}
                now={now}
                ongoing={!finished}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-3xl border border-dashed border-line bg-surface p-5 text-sm text-muted">
            Gezin bitince burada rakamların, manşetlerin ve paylaşılabilir hikâye kartın çıkacak.
          </p>
        )}
      </section>
    </div>
  );
}
