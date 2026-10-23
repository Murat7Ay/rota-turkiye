import { CircleAlert, CircleCheck, Info, Sparkles, X } from "lucide-react";
import { useUi } from "../state/ui";
import { cx } from "./ui";

const ICONS = {
  info: <Info className="size-5 text-sea" aria-hidden />,
  success: <CircleCheck className="size-5 text-good" aria-hidden />,
  error: <CircleAlert className="size-5 text-bad" aria-hidden />,
  discovery: <Sparkles className="size-5 text-brand" aria-hidden />,
};

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div
      className="safe-top pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-3 lg:left-auto lg:right-4 lg:items-end"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={cx(
            "pointer-events-auto flex w-full max-w-md animate-pop items-start gap-3 rounded-2xl border bg-surface/95 p-3.5 shadow-lift backdrop-blur",
            t.kind === "discovery" ? "border-brand/40" : "border-line",
          )}
        >
          <div className="mt-0.5 shrink-0">{ICONS[t.kind]}</div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-snug text-ink">{t.title}</p>
            {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
            {t.action && (
              <button
                type="button"
                className="mt-1.5 text-sm font-bold text-brand hover:underline"
                onClick={() => {
                  t.action?.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
          <button type="button" aria-label="Kapat" className="-m-1 grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2" onClick={() => dismiss(t.id)}>
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
