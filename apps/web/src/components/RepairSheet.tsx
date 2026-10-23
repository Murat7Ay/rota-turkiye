import { useState, type ReactNode } from "react";
import { Check, ShieldCheck } from "lucide-react";
import type { RepairOption } from "@rota/core";
import { Sheet } from "./Sheet";
import { Bar, Button, cx } from "./ui";
import { pct } from "../lib/format";

export function RepairSheet({
  open,
  onClose,
  title,
  subtitle,
  options,
  onApply,
  emptyText,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  options: RepairOption[];
  onApply: (o: RepairOption) => void;
  emptyText?: string;
  extra?: ReactNode;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const sel = options.find((o) => o.id === picked) ?? options[0];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          {sel && (
            <Button variant="primary" size="lg" className="flex-1" icon={<Check className="size-5" />} onClick={() => onApply(sel)}>
              Bu seçeneği uygula
            </Button>
          )}
          {extra}
        </div>
      }
    >
      {options.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 p-4 text-[15px] text-ink-2">{emptyText ?? "Uygun bir seçenek bulunamadı."}</p>
      ) : (
        <ul className="space-y-2.5" role="radiogroup" aria-label="Seçenekler">
          {options.map((o, i) => {
            const active = (sel?.id ?? null) === o.id;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPicked(o.id)}
                  className={cx(
                    "w-full rounded-2xl border p-4 text-left transition",
                    active ? "border-brand bg-brand-soft/60 ring-1 ring-brand" : "border-line bg-surface hover:bg-surface-2",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cx(
                        "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 text-xs font-bold",
                        active ? "border-brand bg-brand text-white" : "border-line text-muted",
                      )}
                      aria-hidden
                    >
                      {active ? <Check className="size-3.5" /> : String.fromCharCode(65 + i)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold leading-snug text-ink">{o.label}</p>
                      <p className="mt-1 text-sm text-ink-2">{o.description}</p>
                      {o.changes.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {o.changes.map((c, k) => (
                            <li key={k} className="flex gap-2 text-sm text-muted">
                              <span aria-hidden className="text-brand">
                                •
                              </span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <ShieldCheck className="size-4 shrink-0 text-good" aria-hidden />
                        <Bar value={o.keptRatio} max={1} tone="good" className="flex-1" label="Korunan plan oranı" />
                        <span className="text-xs font-semibold text-good tabular">Korunan plan {pct(o.keptRatio)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
