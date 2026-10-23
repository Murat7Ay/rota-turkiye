// Alt sayfa (mobil) / ortalanmış pencere (masaüstü).
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./ui";

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => ref.current?.focus(), 30);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative flex max-h-[88dvh] w-full animate-slide-up flex-col rounded-t-[28px] bg-surface shadow-lift outline-none sm:max-w-lg sm:animate-pop sm:rounded-[28px]"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-surface-3 sm:hidden" aria-hidden />
        <div className="flex items-start gap-3 px-5 pb-2 pt-3 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-snug text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <IconButton label="Kapat" onClick={onClose} className="-mr-2 -mt-1">
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="safe-bottom border-t border-line px-5 py-3">{footer}</div>}
        {!footer && <div className="safe-bottom" />}
      </div>
    </div>,
    document.body,
  );
}
