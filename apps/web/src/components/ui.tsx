// Küçük, tutarlı arayüz parçaları. Dokunma hedefleri en az 44 px.
import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle, Minus, Plus } from "lucide-react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "sea";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-strong shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2",
  danger: "bg-bad-soft text-bad hover:brightness-95",
  sea: "bg-sea text-white hover:brightness-110 shadow-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}) {
  const sizes = { sm: "min-h-9 px-3 text-sm gap-1.5 rounded-xl", md: "min-h-11 px-4 text-[15px] gap-2 rounded-2xl", lg: "min-h-13 px-5 text-base gap-2 rounded-2xl" };
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center font-semibold transition active:scale-[0.98] disabled:opacity-50 select-none",
        sizes[size],
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        "inline-grid size-11 place-items-center rounded-2xl transition active:scale-95 disabled:opacity-40",
        active ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, as: As = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" }) {
  return <As className={cx("rounded-3xl border border-line bg-surface shadow-card", className)}>{children}</As>;
}

export function Chip({
  selected,
  onClick,
  children,
  className,
  title,
  disabled,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={selected}
      className={cx(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition active:scale-[0.97] disabled:opacity-50",
        selected ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-ink-2 hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode; hint?: string }>;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("flex gap-1 rounded-2xl bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold transition",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx("flex min-h-12 cursor-pointer items-center gap-3", disabled && "opacity-50")}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-7 w-12 rounded-full bg-surface-3 transition peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-sea" />
        <span className="absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border border-line bg-surface p-1" role="group" aria-label={label}>
      <IconButton label={`${label} azalt`} className="size-9" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        <Minus className="size-4" />
      </IconButton>
      <span className="min-w-12 text-center text-[15px] font-semibold tabular" aria-live="polite">
        {value}
        {suffix ? <span className="ml-1 text-sm font-medium text-muted">{suffix}</span> : null}
      </span>
      <IconButton label={`${label} artır`} className="size-9" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
        <Plus className="size-4" />
      </IconButton>
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "w-full min-h-11 rounded-2xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted/70 outline-none transition focus:border-sea focus:ring-2 focus:ring-sea/25";

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "good" | "warn" | "bad" | "brand" | "sea"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2",
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    brand: "bg-brand-soft text-brand",
    sea: "bg-sea-soft text-sea",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function EmptyState({ emoji, title, children, action }: { emoji: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid size-20 place-items-center rounded-full bg-brand-soft text-4xl" aria-hidden>
        {emoji}
      </div>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {children && <div className="text-[15px] text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-center justify-between gap-3", className)}>
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cx("size-5 animate-spin text-brand", className)} aria-label="Yükleniyor" />;
}

export function Bar({ value, max, tone = "brand", className, label }: { value: number; max: number; tone?: "brand" | "sea" | "good" | "warn" | "bad"; className?: string; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const tones = { brand: "bg-brand", sea: "bg-sea", good: "bg-good", warn: "bg-warn", bad: "bg-bad" };
  return (
    <div className={cx("h-2 overflow-hidden rounded-full bg-surface-3", className)} role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={Math.round(max)}>
      <div className={cx("h-full rounded-full transition-[width] duration-500", tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, action, eyebrow }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-5 sm:px-6 lg:pt-8">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[13px] font-semibold text-brand">{eyebrow}</div>}
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
