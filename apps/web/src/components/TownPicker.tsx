import { useMemo, useState } from "react";
import { ChevronDown, MapPin, Search } from "lucide-react";
import type { Town } from "@rota/core";
import { Sheet } from "./Sheet";
import { cx, inputClass } from "./ui";
import { fmtNumber } from "../lib/format";

export function normTr(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const KIND_LABEL: Record<Town["kind"], string> = { city: "Şehir", town: "İlçe / kasaba", village: "Köy" };

export function TownPicker({
  towns,
  value,
  onChange,
  label,
  placeholder = "Yer seç",
  compact,
}: {
  towns: Town[];
  value: { id?: string; name: string } | null;
  onChange: (t: Town) => void;
  label: string;
  placeholder?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const nq = normTr(q.trim());
    const sorted = [...towns].sort((a, b) => {
      const k = { city: 0, town: 1, village: 2 };
      return k[a.kind] - k[b.kind] || (b.population ?? 0) - (a.population ?? 0) || a.name.localeCompare(b.name, "tr");
    });
    const filtered = nq ? sorted.filter((t) => normTr(t.name).includes(nq)) : sorted;
    if (nq) filtered.sort((a, b) => Number(!normTr(a.name).startsWith(nq)) - Number(!normTr(b.name).startsWith(nq)));
    return filtered.slice(0, 80);
  }, [towns, q]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${label}: ${value?.name ?? "seçilmedi"}`}
        className={cx(
          "flex w-full min-w-0 items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 text-left transition hover:border-sea",
          compact ? "min-h-11" : "min-h-12",
        )}
      >
        <MapPin className="size-4 shrink-0 text-brand" aria-hidden />
        <span className={cx("min-w-0 flex-1 truncate text-[15px]", value ? "font-semibold text-ink" : "text-muted")}>{value?.name ?? placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label} subtitle={`${fmtNumber(towns.length)} yerleşim`}>
        <div className="sticky top-0 z-10 -mx-1 bg-surface px-1 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              autoFocus
              className={cx(inputClass, "pl-9")}
              placeholder="Ara: Selçuk, Pamukkale…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Yerleşim ara"
            />
          </div>
        </div>
        <ul className="divide-y divide-line">
          {list.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-surface-2"
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                  setQ("");
                }}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg" aria-hidden>
                  {t.kind === "city" ? "🏙️" : t.kind === "town" ? "🏘️" : "🏡"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{t.name}</span>
                  <span className="block text-xs text-muted">
                    {KIND_LABEL[t.kind]}
                    {t.population ? ` · ${fmtNumber(t.population)} nüfus` : ""}
                  </span>
                </span>
                {value?.id === t.id && <span className="text-sm font-bold text-brand">Seçili</span>}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="py-8 text-center text-sm text-muted">Eşleşen yer yok.</li>}
        </ul>
      </Sheet>
    </>
  );
}
