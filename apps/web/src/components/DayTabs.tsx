import { useEffect, useRef } from "react";
import type { DayPlan } from "@rota/core";
import { fmtDateShort, fmtWeekdayShort } from "../lib/format";
import { dayColorCss } from "./dayColor";
import { cx } from "./ui";

export function DayTabs({ days, value, onChange, todayDate }: { days: DayPlan[]; value: number; onChange: (i: number) => void; todayDate?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const btn = ref.current?.querySelector<HTMLElement>(`[data-day="${value}"]`);
    btn?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [value]);
  return (
    <div ref={ref} role="tablist" aria-label="Günler" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
      {days.map((d, i) => {
        const active = i === value;
        const today = d.date === todayDate;
        return (
          <button
            key={d.index}
            type="button"
            role="tab"
            aria-selected={active}
            data-day={i}
            onClick={() => onChange(i)}
            className={cx(
              "flex min-h-14 shrink-0 flex-col items-start justify-center rounded-2xl border px-3.5 py-1.5 text-left transition",
              active ? "border-transparent bg-ink text-bg shadow-card" : "border-line bg-surface text-ink hover:bg-surface-2",
            )}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-bold">
              <span className="size-2.5 rounded-full" style={{ background: dayColorCss(i) }} aria-hidden />
              {i + 1}. gün
              {today && <span className={cx("rounded-full px-1.5 text-xs font-bold", active ? "bg-brand text-white" : "bg-brand-soft text-brand")}>Bugün</span>}
            </span>
            <span className={cx("text-xs", active ? "opacity-75" : "text-muted")}>
              {fmtWeekdayShort(d.date)} {fmtDateShort(d.date)} · {d.isTravelDay ? "yol" : d.to.name.split(" ")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
