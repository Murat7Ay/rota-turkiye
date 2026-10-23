// Yapay zekâ bileşenlerinin ortak küçük parçaları (uygulamanın geri kalanından bağımsız).
// Renkler index.css'teki tema belirteçlerinden: brand = kiremit, sea = turkuaz, bg = krem.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CircleAlert, KeyRound, LoaderCircle } from "lucide-react";
import type { AiError } from "./core";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "sea" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-strong shadow-sm",
  sea: "bg-sea text-white hover:brightness-110 shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2",
};

export function AiButton({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 font-semibold transition active:scale-[0.98] disabled:opacity-50",
        size === "sm" ? "min-h-9 rounded-xl px-3 text-sm" : "min-h-11 rounded-2xl px-4 text-[15px]",
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/** Anahtar yokken gösterilen ipucu */
export function NoKeyHint({ onOpenSettings, children }: { onOpenSettings?: () => void; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-surface-2 p-3 text-sm text-ink-2">
      <KeyRound className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
      <p>
        {children ?? "Bu özellik için Ayarlar'dan kendi Anthropic API anahtarını ekle. Uygulamanın geri kalanı anahtarsız da tam çalışır."}
        {onOpenSettings && (
          <>
            {" "}
            <button type="button" onClick={onOpenSettings} className="font-semibold text-brand underline-offset-2 hover:underline">
              Ayarlara git
            </button>
          </>
        )}
      </p>
    </div>
  );
}

/** Türkçe hata mesajı satırı */
export function AiErrorText({ error, className }: { error: AiError | null; className?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className={cx("flex items-start gap-2 rounded-2xl bg-warn-soft p-3 text-sm text-warn", className)}>
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{error.message}</span>
    </p>
  );
}

/** 30000 → "30.000" (ICU'dan bağımsız) */
export function fmtNum(n: number): string {
  const r = Math.round(n);
  const s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return r < 0 ? `-${s}` : s;
}

/** Bugünün Türkiye tarihi (UTC+3), YYYY-MM-DD */
export function todayTrDate(): string {
  return new Date(Date.now() + 180 * 60_000).toISOString().slice(0, 10);
}
