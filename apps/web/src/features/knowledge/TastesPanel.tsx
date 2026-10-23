// "Bu bölgenin tadı": bir noktanın çevresindeki coğrafi işaretli ürünler (TÜRKPATENT kayıtları),
// tür simgesi, coğrafi işaret rozeti ve tescil kaydına bağlantıyla.
import { useMemo, useState } from "react";
import { BadgeCheck, CakeSlice, CupSoda, ExternalLink, MapPin, Palette, ShoppingBasket, Utensils, type LucideIcon } from "lucide-react";
import type { LatLng } from "@rota/core";
import {
  GI_KIND_LABEL,
  GI_TYPE_LABEL,
  provinceAt,
  tastesNear,
  type GiKind,
  type GiProduct,
} from "../../../../../packages/core/src/knowledge";
import { Badge, Card, cx } from "../../components/ui";

export interface TastesPanelProps {
  loc: LatLng;
  /** İlçeye bağlı ürünler için arama yarıçapı, km (varsayılan 25) */
  radiusKm?: number;
  /** Başta gösterilecek ürün sayısı (varsayılan 6) */
  initialCount?: number;
  className?: string;
}

const KIND_ICON: Record<GiKind, LucideIcon> = {
  yemek: Utensils,
  tatli: CakeSlice,
  icecek: CupSoda,
  urun: ShoppingBasket,
  el_sanati: Palette,
};

const KIND_STYLE: Record<GiKind, string> = {
  yemek: "bg-brand-soft text-brand",
  tatli: "bg-brand-soft text-brand-strong",
  icecek: "bg-sea-soft text-sea",
  urun: "bg-good-soft text-good",
  el_sanati: "bg-sea-soft text-sea",
};

/** "2026-10-24" → "24.10.2026" */
function trDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

function TasteRow({ item }: { item: GiProduct }) {
  const Icon = KIND_ICON[item.kind];
  return (
    <li className="flex gap-3 py-3">
      <span className={cx("grid size-10 shrink-0 place-items-center rounded-2xl", KIND_STYLE[item.kind])} aria-hidden>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-ink">{item.name}</span>
          <Badge tone="sea" className="gap-1">
            <BadgeCheck className="size-3.5" aria-hidden />
            Coğrafi işaret
          </Badge>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>{GI_KIND_LABEL[item.kind]}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="size-3" aria-hidden />
            {item.place ? `${item.place}, ${item.province}` : `${item.province} geneli`}
          </span>
        </div>
        <p className="mt-1 text-sm leading-snug text-ink-2">{item.description}</p>
        <a
          href={item.source}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sea hover:underline"
        >
          {GI_TYPE_LABEL[item.giType]} · tescil no {item.regNo}
          <ExternalLink className="size-3" aria-hidden />
          <span className="sr-only">(TÜRKPATENT kaydı, yeni sekmede açılır)</span>
        </a>
        {item.basis === "kayit" && (
          <p className="mt-0.5 text-[11px] text-muted">Tanım yalnızca sicil kaydından; ayrıntılı belge okunamadı.</p>
        )}
      </div>
    </li>
  );
}

export function TastesPanel({ loc, radiusKm = 25, initialCount = 6, className }: TastesPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const { items, province } = useMemo(
    () => ({ items: tastesNear(loc, radiusKm), province: provinceAt(loc) }),
    [loc.lat, loc.lon, radiusKm],
  );
  const visible = showAll ? items : items.slice(0, initialCount);
  const checkedAt = items[0]?.checkedAt;

  return (
    <Card className={cx("px-4 pb-2 pt-4", className)}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ink">Bu bölgenin tadı</h3>
          <p className="text-xs text-muted">{province} ve çevresi · tescilli coğrafi işaretler</p>
        </div>
        {items.length > 0 && <Badge tone="brand">{items.length}</Badge>}
      </header>

      {items.length === 0 ? (
        <p className="py-4 text-sm text-muted">Bu çevre için henüz doğrulanmış coğrafi işaret kaydımız yok.</p>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((item) => (
            <TasteRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      {items.length > initialCount && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="min-h-11 w-full rounded-2xl text-sm font-semibold text-brand hover:bg-brand-soft"
        >
          {showAll ? "Daha az göster" : `Tümünü göster (${items.length})`}
        </button>
      )}

      {checkedAt && (
        <p className="pb-2 pt-1 text-[11px] text-muted">
          Kaynak:{" "}
          <a href="https://ci.turkpatent.gov.tr/" target="_blank" rel="noopener noreferrer" className="underline">
            TÜRKPATENT Coğrafi İşaretler Portalı
          </a>{" "}
          · kontrol {trDate(checkedAt)}
        </p>
      )}
    </Card>
  );
}
