// Pasaport damgası: halka yazılı, kademe renkli yuvarlak mühür. Kilitliyse gri ve soluk.
import { useId } from "react";
import type { StampProgress, StampTier } from "../../../../../packages/core/src/stamps";
import { STAMP_TIERS, TIER_LABELS } from "../../../../../packages/core/src/stamps";

export const TIER_COLORS: Record<StampTier, { ink: string; soft: string }> = {
  bronz: { ink: "#A0582A", soft: "#F3E0CF" },
  gumus: { ink: "#6B7689", soft: "#E6E9EF" },
  altin: { ink: "#B7860B", soft: "#F8EBC4" },
};
const LOCKED = { ink: "#A99D8E", soft: "#EDE6DA" };

/** Damgalar hafif eğik basılmış gibi dursun (deterministik) */
const TILTS = [-8, 5, -3, 7, -6, 4, -2, 9];

export function StampSeal({
  stamp,
  i = 0,
  size = 112,
  selected,
  onClick,
}: {
  stamp: StampProgress;
  i?: number;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const pathId = `seal-${stamp.def.id}-${rawId}`;
  const earned = stamp.tier !== null;
  const color = stamp.tier ? TIER_COLORS[stamp.tier] : LOCKED;
  const tierText = stamp.tier ? TIER_LABELS[stamp.tier] : "Kilitli";
  const ring = `${stamp.def.name} • ${tierText} •`.toLocaleUpperCase("tr-TR");
  const tilt = TILTS[i % TILTS.length]!;
  const next = stamp.next;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${stamp.def.name}: ${earned ? `${tierText} damga` : "kilitli"}, ${stamp.count} ${stamp.def.unit}`}
      className="group flex flex-col items-center gap-1.5 rounded-2xl p-1.5 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-[#0E7490]"
    >
      <span
        className="relative grid place-items-center transition group-active:scale-95"
        style={{ width: size, height: size, transform: `rotate(${tilt}deg)` }}
      >
        <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden className="absolute inset-0" style={{ opacity: earned ? 0.92 : 0.6 }}>
          <defs>
            {/* alttan başlayıp saat yönünde dönen çember: %50 tepe noktası, uzun yazı da sığar */}
            <path id={pathId} d="M 60,105 a 45,45 0 1,1 0,-90 a 45,45 0 1,1 0,90" />
          </defs>
          <circle cx="60" cy="60" r="57" fill={earned ? color.soft : "transparent"} fillOpacity={earned ? 0.55 : 0} stroke={color.ink} strokeWidth="3" />
          <circle cx="60" cy="60" r="52" fill="none" stroke={color.ink} strokeWidth="1" />
          <circle cx="60" cy="60" r="36" fill="none" stroke={color.ink} strokeWidth="1.5" strokeDasharray={earned ? "0" : "3 4"} />
          <text fontSize="9.2" fontWeight={800} letterSpacing="1.4" fill={color.ink} style={{ fontFamily: "system-ui, sans-serif" }}>
            <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
              {ring}
            </textPath>
          </text>
          {earned && (
            <g fill={color.ink}>
              {[0, 1, 2].map((k) => (
                <circle key={k} cx={52 + k * 8} cy="89" r={k <= STAMP_TIERS.indexOf(stamp.tier!) ? 2.4 : 1.2} />
              ))}
            </g>
          )}
        </svg>
        <span
          className="relative text-[34px] leading-none"
          style={{ filter: earned ? "saturate(0.9)" : "grayscale(1)", opacity: earned ? 1 : 0.45 }}
          aria-hidden
        >
          {stamp.def.emoji}
        </span>
        {selected && <span className="absolute -inset-1 rounded-full ring-2 ring-[#0E7490]/60" aria-hidden />}
      </span>
      <span className="line-clamp-2 min-h-[2.5em] max-w-[8.5rem] text-[12.5px] font-bold leading-tight text-[#3B2F24]">{stamp.def.name}</span>
      {next ? (
        <span className="w-full max-w-[7rem]">
          <span className="block h-1.5 overflow-hidden rounded-full bg-[#E4D9C6]">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.round(stamp.progress * 100)}%`, background: earned ? color.ink : "#C2410C" }}
            />
          </span>
          <span className="mt-0.5 block text-[11px] font-medium text-[#7A6A58]">
            {stamp.count}/{next.target}
          </span>
        </span>
      ) : (
        <span className="text-[11px] font-bold text-[#B7860B]">Tamamlandı</span>
      )}
    </button>
  );
}
