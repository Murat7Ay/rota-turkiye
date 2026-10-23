// Sabah rehberi kartı: günün yerel ipuçları (coğrafi işaret, bölge uyarısı, görgü kuralı).
// Metinler çekirdekteki localTipsForDay(...) çıktısıdır; bu bileşen yalnızca gösterir.
import { Lightbulb } from "lucide-react";
import { Card, cx } from "../../components/ui";

export interface LocalTipsCardProps {
  tips: string[];
  className?: string;
}

export function LocalTipsCard({ tips, className }: LocalTipsCardProps) {
  if (!tips.length) return null;
  return (
    <Card className={cx("overflow-hidden", className)}>
      <div className="flex items-center gap-2 border-b border-line bg-brand-soft px-4 py-2.5">
        <span className="grid size-7 place-items-center rounded-full bg-brand text-brand-ink" aria-hidden>
          <Lightbulb className="size-4" />
        </span>
        <h3 className="text-sm font-bold text-brand">Yerel rehberden</h3>
      </div>
      <ul className="flex flex-col gap-2.5 px-4 py-3">
        {tips.map((tip) => (
          <li key={tip} className="flex gap-2.5 text-[15px] leading-snug text-ink-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-sea" aria-hidden />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
