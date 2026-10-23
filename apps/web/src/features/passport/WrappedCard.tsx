// Biten (ya da süren) bir gezinin Wrapped kartı: manşetler, rakamlar ve hikâye paylaşımı.
import { useMemo } from "react";
import type { Expense, PlaceIndex, TripPlan } from "@rota/core";
import { fmtDateShort, fmtNumber, fmtTry } from "../../lib/format";
import { tripWrapped } from "../../../../../packages/core/src/wrapped";
import type { TripRecord } from "../../../../../packages/core/src/stamps";
import { ShareStoryButton } from "../share/ShareStoryButton";

export function WrappedCard({
  plan,
  expenses,
  index,
  allTrips,
  now,
  ongoing,
}: {
  plan: TripPlan;
  expenses: Expense[];
  index: PlaceIndex;
  allTrips: readonly TripRecord[];
  now?: Date;
  /** Gezi sürüyor: "şimdiye kadar" etiketi */
  ongoing?: boolean;
}) {
  const w = useMemo(() => tripWrapped(plan, expenses, index, { allTrips, now }), [plan, expenses, index, allTrips, now]);
  const stats: Array<[string, string]> = [
    [fmtNumber(w.days), "gün"],
    [fmtNumber(w.totalKm), "km"],
    [fmtNumber(w.stopsDone), "durak"],
    [fmtNumber(w.cayCount), "çay"],
    [fmtNumber(w.antikKentCount), "antik kent"],
    [fmtNumber(w.provinces.length), "il"],
  ];
  const stampEmojis = [...new Set(w.stampsEarned.map((a) => a.def.emoji))];

  return (
    <article className="overflow-hidden rounded-[28px] shadow-lift">
      <div className="relative bg-gradient-to-br from-[#9A3412] via-[#C2410C] to-[#0E7490] p-5 text-white">
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, #FDBA74 0%, transparent 70%)" }}
          aria-hidden
        />
        <p className="relative text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/80">
          Gezi Wrapped{ongoing ? " · şimdiye kadar" : ""}
          {w.basis === "plan" ? " · plan özeti" : ""}
        </p>
        <h3 className="relative mt-1 text-2xl font-extrabold leading-tight">{w.title}</h3>
        <p className="relative text-sm font-medium text-white/85">
          {fmtDateShort(w.startDate)} – {fmtDateShort(w.endDate)} {w.endDate.slice(0, 4)}
          {w.provinces.length > 0 && ` · ${w.provinces.slice(0, 3).join(", ")}${w.provinces.length > 3 ? "…" : ""}`}
        </p>
        <ul className="relative mt-4 grid grid-cols-3 gap-2">
          {stats.map(([v, l]) => (
            <li key={l} className="rounded-2xl px-2 py-2 text-center" style={{ background: "rgba(255,247,237,0.14)" }}>
              <span className="block text-xl font-extrabold leading-none">{v}</span>
              <span className="mt-1 block text-[11px] font-semibold text-white/80">{l}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-3 bg-[#FFF7ED] p-5 text-[#3B1F12]">
        <ol className="space-y-2">
          {w.headlines.map((h, i) => (
            <li key={i} className={i === 0 ? "text-[17px] font-extrabold leading-snug" : "text-[15px] font-semibold leading-snug"}>
              <span className="mr-1.5 text-[#C2410C]" aria-hidden>
                ✦
              </span>
              {h}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#7A5A44]">
          <span>{w.hasExpenses ? `${fmtTry(w.spentTry)} harcandı · bütçe ${fmtTry(w.budgetTry)}` : `Planlanan ${fmtTry(w.plannedTry)}`}</span>
          {w.mostExpensiveDay && w.days > 1 && (
            <span>
              En pahalı gün: {fmtDateShort(w.mostExpensiveDay.date)} ({w.mostExpensiveDay.source === "plan" ? "~" : ""}
              {fmtTry(w.mostExpensiveDay.amountTry)})
            </span>
          )}
        </div>
        {stampEmojis.length > 0 && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#7A5A44]">
            Yeni damgalar:
            <span className="text-xl leading-none" aria-label={w.stampsEarned.map((a) => a.def.name).join(", ")}>
              {stampEmojis.join(" ")}
            </span>
          </p>
        )}
        <ShareStoryButton
          story={{ kind: "wrapped", plan, expenses, index, allTrips }}
          variant="primary"
          className="w-full"
          label="Hikâye olarak paylaş"
        />
      </div>
    </article>
  );
}
