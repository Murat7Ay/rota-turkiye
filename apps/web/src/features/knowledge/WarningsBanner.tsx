// Bölge uyarısı bandı: konumu kapsayan dolandırıcılık/tuzak uyarıları, kaynak bağlantısıyla.
// "Anladım" ile kapatılan uyarı bu cihazda bir daha gösterilmez (localStorage; erişilemezse yalnızca oturumluk).
import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Info, ShieldAlert, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { LatLng } from "@rota/core";
import { WARNING_KIND_LABEL, warningsNear, type AreaWarning, type WarningKind } from "../../../../../packages/core/src/knowledge";
import { IconButton, cx } from "../../components/ui";

export interface WarningsBannerProps {
  loc: LatLng;
  /** Saat pencereli uyarılar (ör. gece bar tuzağı) için an; verilmezse şimdi */
  date?: Date;
  className?: string;
}

const STORAGE_KEY = "rota.knowledge.dismissedWarnings";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // depolama yoksa oturumluk kalır
  }
}

const KIND_UI: Record<WarningKind, { icon: LucideIcon; box: string; iconClass: string }> = {
  dolandiricilik: { icon: ShieldAlert, box: "border-brand/40 bg-brand-soft", iconClass: "bg-brand text-brand-ink" },
  fiyat: { icon: TriangleAlert, box: "border-warn/40 bg-warn-soft", iconClass: "bg-warn text-white" },
  bilgi: { icon: Info, box: "border-sea/40 bg-sea-soft", iconClass: "bg-sea text-white" },
};

function WarningCard({ w, onDismiss }: { w: AreaWarning; onDismiss: () => void }) {
  const ui = KIND_UI[w.kind];
  const Icon = ui.icon;
  return (
    <div className={cx("animate-pop rounded-3xl border p-3.5", ui.box)} role="note" aria-label={w.title}>
      <div className="flex items-start gap-3">
        <span className={cx("grid size-8 shrink-0 place-items-center rounded-full", ui.iconClass)} aria-hidden>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {WARNING_KIND_LABEL[w.kind]} · {w.areas.map((a) => a.name).join(", ")}
          </p>
          <h3 className="font-bold leading-snug text-ink">{w.title}</h3>
          <p className="mt-1 text-sm leading-snug text-ink-2">{w.text}</p>
          <p className="mt-1.5 text-sm leading-snug text-ink">
            <span className="font-semibold">Ne yapmalı: </span>
            {w.advice}
          </p>
          <a
            href={w.source}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-sea hover:underline"
          >
            Kaynak{w.reportedAt ? ` (${w.reportedAt})` : ""}
            <ExternalLink className="size-3" aria-hidden />
            <span className="sr-only">(yeni sekmede açılır)</span>
          </a>
        </div>
        <IconButton label="Anladım, gizle" onClick={onDismiss} className="-mr-1.5 -mt-1.5 size-9 shrink-0">
          <X className="size-4" aria-hidden />
        </IconButton>
      </div>
    </div>
  );
}

export function WarningsBanner({ loc, date, className }: WarningsBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const [expanded, setExpanded] = useState(false);
  const time = date?.getTime();
  const all = useMemo(
    () => warningsNear(loc, time === undefined ? new Date() : new Date(time)),
    [loc.lat, loc.lon, time],
  );
  const active = all.filter((w) => !dismissed.has(w.id));
  if (!active.length) return null;

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    saveDismissed(next);
    setDismissed(next);
  };

  const shown = expanded ? active : active.slice(0, 1);
  const rest = active.length - shown.length;

  return (
    <section className={cx("flex flex-col gap-2", className)} aria-label="Bölge uyarıları">
      {shown.map((w) => (
        <WarningCard key={w.id} w={w} onDismiss={() => dismiss(w.id)} />
      ))}
      {rest > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex min-h-10 items-center justify-center gap-1 self-start rounded-full px-3 text-sm font-semibold text-brand hover:bg-brand-soft"
        >
          Bu bölgede {rest} uyarı daha
          <ChevronDown className="size-4" aria-hidden />
        </button>
      )}
    </section>
  );
}
