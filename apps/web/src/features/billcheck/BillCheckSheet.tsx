// "Hesap kontrol" alt sayfası: toplamı (ve istenirse kalemleri) gir, yasak ek ücret satırlarını,
// toplam tutarsızlığını ve tahminle kıyası gör, tek dokunuşla harcamaya ekle.
import { useId, useState } from "react";
import { TriangleAlert, CircleCheck, ExternalLink, Plus, ReceiptText, Scale, ShieldAlert, Trash } from "lucide-react";
import { CATEGORIES, type FxRates, type Place, type Visitor } from "@rota/core";
import { checkBill, parseAmountTr, type BillCheck, type BillFlag } from "../../../../../packages/core/src/billcheck";
import { Sheet } from "../../components/Sheet";
import { Badge, Button, IconButton, Stepper, cx, inputClass } from "../../components/ui";
import { fmtTry } from "../../lib/format";

export interface BillCheckPanelProps {
  place?: Place;
  travelers: number;
  /** YYYY-MM-DD */
  date: string;
  visitor: Visitor;
  fx?: FxRates;
  /** "Harcamaya ekle": hesabın TRY toplamı ve kısa not */
  onAddExpense?: (amountTry: number, note: string) => void;
}

export interface BillCheckSheetProps extends BillCheckPanelProps {
  open: boolean;
  onClose: () => void;
}

interface Row {
  key: number;
  label: string;
  amount: string;
}

const VERDICT_STYLE: Record<BillCheck["verdict"], { box: string; iconClass: string; icon: typeof CircleCheck; tone: "good" | "warn" | "bad"; label: string }> = {
  iyi: { box: "border-good/40 bg-good-soft", iconClass: "text-good", icon: CircleCheck, tone: "good", label: "Sorun görünmüyor" },
  dikkat: { box: "border-warn/40 bg-warn-soft", iconClass: "text-warn", icon: TriangleAlert, tone: "warn", label: "Göz at" },
  sorun: { box: "border-bad/40 bg-bad-soft", iconClass: "text-bad", icon: ShieldAlert, tone: "bad", label: "Sorulmalı" },
};

const LEVEL_TONE = { makul: "good", biraz_yuksek: "warn", cok_yuksek: "warn" } as const;

let rowSeq = 0;
const newRow = (): Row => ({ key: ++rowSeq, label: "", amount: "" });

/** Sayfa içine gömülebilen hesap kontrol paneli (Sheet'siz) */
export function BillCheckPanel({ place, travelers: initialTravelers, date, visitor, fx, onAddExpense }: BillCheckPanelProps) {
  const ids = useId();
  const [total, setTotal] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [travelers, setTravelers] = useState(Math.max(1, initialTravelers));
  const [added, setAdded] = useState(false);

  const totalNum = parseAmountTr(total);
  const hasTotal = Number.isFinite(totalNum) && totalNum > 0;
  // Tutarı boş ama adı yazılmış satır da (ör. "Kuver") kontrol edilsin: tutar 0 sayılır.
  const passed = rows
    .map((r) => ({ key: r.key, label: r.label, amount: r.amount.trim() === "" ? 0 : parseAmountTr(r.amount) }))
    .filter((l) => Number.isFinite(l.amount) && (l.amount !== 0 || l.label.trim() !== ""));

  // Hesap ucuz; her render'da yeniden yapılır.
  const result: BillCheck | null =
    !hasTotal && passed.length === 0
      ? null
      : checkBill({
          lines: passed.map(({ label, amount }) => ({ label, amount })),
          ...(hasTotal ? { total: totalNum } : {}),
          ...(place ? { place } : {}),
          travelers,
          date,
          visitor,
          ...(fx ? { fx } : {}),
        });

  const setRow = (key: number, patch: Partial<Row>) => {
    setAdded(false);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  // checkBill satır indeksleri gönderilen diziye göredir; satır anahtarına eşle
  const flagByKey = new Map<number, BillFlag>();
  for (const f of result?.flags ?? []) {
    const k = passed[f.lineIndex]?.key;
    if (k !== undefined) flagByKey.set(k, f);
  }

  const v = result ? VERDICT_STYLE[result.verdict] : null;
  const VIcon = v?.icon ?? CircleCheck;

  return (
    <div className="space-y-4">
      {place && (
        <p className="text-sm text-muted">
          <span aria-hidden>{CATEGORIES[place.cat].emoji}</span> {place.name}
        </p>
      )}

      {/* Toplam ve kişi sayısı */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor={`${ids}-total`} className="block text-sm font-semibold text-ink-2">
            Hesap toplamı
          </label>
          <div className="relative">
            <input
              id={`${ids}-total`}
              inputMode="decimal"
              autoComplete="off"
              placeholder="örn. 1.850"
              className={cx(inputClass, "pr-9 text-lg font-semibold tabular")}
              value={total}
              onChange={(e) => {
                setAdded(false);
                setTotal(e.target.value);
              }}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">₺</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-ink-2">Kişi</span>
          <Stepper label="Kişi sayısı" value={travelers} min={1} max={30} onChange={setTravelers} />
        </div>
      </div>

      {/* Kalemler (isteğe bağlı) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-2">Kalemler <span className="font-normal text-muted">(isteğe bağlı)</span></span>
          <Button size="sm" variant="ghost" icon={<Plus className="size-4" aria-hidden />} onClick={() => setRows((rs) => [...rs, newRow()])}>
            satır
          </Button>
        </div>
        {rows.length === 0 && <p className="text-xs text-muted">Fişte "servis", "kuver" ya da "masa ücreti" gibi bir satır varsa ekle; kontrol edelim.</p>}
        {rows.map((r) => {
          const f = flagByKey.get(r.key);
          return (
            <div key={r.key} className="space-y-1">
              <div className="flex items-center gap-2">
                <input
                  aria-label="Kalem adı"
                  placeholder="Kalem (örn. Kuver)"
                  className={cx(inputClass, "min-w-0 flex-1", f && (f.legal ? "border-bad/60" : "border-warn/60"))}
                  value={r.label}
                  onChange={(e) => setRow(r.key, { label: e.target.value })}
                />
                <input
                  aria-label="Tutar"
                  inputMode="decimal"
                  placeholder="₺"
                  className={cx(inputClass, "w-28 text-right tabular")}
                  value={r.amount}
                  onChange={(e) => setRow(r.key, { amount: e.target.value })}
                />
                <IconButton label="Satırı sil" className="size-10 shrink-0" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                  <Trash className="size-4" />
                </IconButton>
              </div>
              {f && <p className={cx("pl-1 text-xs font-medium", f.legal ? "text-bad" : "text-warn")}>{f.message}</p>}
            </div>
          );
        })}
      </div>

      {/* Sonuç */}
      {result && v && (
        <div className={cx("space-y-3 rounded-3xl border p-4", v.box)} aria-live="polite">
          <div className="flex items-start gap-3">
            <VIcon className={cx("mt-0.5 size-6 shrink-0", v.iconClass)} aria-hidden />
            <div className="min-w-0 flex-1">
              <Badge tone={v.tone}>{v.label}</Badge>
              <p className="mt-1 font-semibold leading-snug text-ink">{result.headline}</p>
              <p className="mt-0.5 text-sm text-ink-2 tabular">
                Toplam {fmtTry(result.totalTry)} · kişi başı {fmtTry(result.perPersonTry)}
              </p>
            </div>
          </div>

          {result.mismatch && (
            <p className="rounded-2xl bg-surface/70 px-3 py-2 text-sm text-ink-2 tabular">
              Girdiğin satırlar {fmtTry(result.mismatch.linesSumTry)}, hesap toplamı {fmtTry(result.mismatch.totalTry)} (fark{" "}
              {result.mismatch.diffTry > 0 ? "+" : "−"}
              {fmtTry(Math.abs(result.mismatch.diffTry))}). Tüm satırları girdiysen fişi kalem kalem kontrol et.
            </p>
          )}

          {result.comparison && (
            <div className="rounded-2xl bg-surface/70 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <Scale className="size-4 text-sea" aria-hidden />
                <span className="font-semibold text-ink">Tahminle kıyas:</span>
                <Badge tone={LEVEL_TONE[result.comparison.level]}>
                  {result.comparison.label} · {result.comparison.ratio.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}×
                </Badge>
              </div>
              <RatioBar ratio={result.comparison.ratio} />
              <p className="mt-1.5 text-xs text-muted">{result.comparison.note}</p>
            </div>
          )}

          {result.legalNote && (
            <div className="rounded-2xl border border-line bg-surface px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <ReceiptText className="size-4 text-brand" aria-hidden />
                {result.legalNote.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">{result.legalNote.text}</p>
              <a
                href={result.legalNote.source}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-sea underline-offset-2 hover:underline"
              >
                Kaynak: {result.legalNote.sourceLabel}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </div>
          )}

          {result.advice.length > 0 && (
            <ul className="space-y-1 text-sm text-ink-2">
              {result.advice.map((a) => (
                <li key={a} className="flex gap-2">
                  <span aria-hidden className="text-brand">•</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          )}

          {onAddExpense && result.totalTry > 0 && (
            <Button
              variant={added ? "secondary" : "primary"}
              className="w-full"
              disabled={added}
              icon={added ? <CircleCheck className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              onClick={() => {
                onAddExpense(result.totalTry, `${place?.name ?? "Restoran"} hesabı`);
                setAdded(true);
              }}
            >
              {added ? "Harcamaya eklendi" : `Harcamaya ekle (${fmtTry(result.totalTry)})`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** 0–3× ölçeğinde oran çubuğu; 1× ve eşik işaretli */
function RatioBar({ ratio }: { ratio: number }) {
  const max = 3;
  const pct = Math.min(100, (Math.max(0, ratio) / max) * 100);
  const tone = ratio <= 1.5 ? "bg-good" : "bg-warn";
  return (
    <div className="relative mt-2 h-2 rounded-full bg-surface-3" role="meter" aria-label="Tahmine oran" aria-valuemin={0} aria-valuemax={max} aria-valuenow={ratio}>
      <div className={cx("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${pct}%` }} />
      <div className="absolute inset-y-[-3px] w-0.5 rounded bg-ink/50" style={{ left: `${100 / max}%` }} title="Tahmin (1×)" aria-hidden />
    </div>
  );
}

/** Alt sayfa (mobil) / pencere (masaüstü) olarak hesap kontrol */
export default function BillCheckSheet({ open, onClose, ...panel }: BillCheckSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Hesap kontrol" subtitle="Ek ücret, toplam ve fiyat tahmini kontrolü">
      <BillCheckPanel {...panel} />
    </Sheet>
  );
}
