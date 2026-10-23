// Bütçe: harcama ekleme (TRY/EUR/USD, kur kayıt anında dondurulur), durum özeti,
// kategori ve gün kırılımı, Müzekart/Museum Pass önerisi, harcama listesi.
import { useEffect, useMemo, useState } from "react";
import { Landmark, Plus, ReceiptText, RefreshCw, Trash2 } from "lucide-react";
import BillCheckSheet from "../features/billcheck/BillCheckSheet";
import { DEFAULT_FX, EXPENSE_LABELS, type Currency, type ExpenseCategory, type FxRates } from "@rota/core";
import { navigate } from "../app/router";
import { Sheet } from "../components/Sheet";
import { Badge, Bar, Button, Card, Chip, EmptyState, Field, PageHeader, SectionTitle, Segmented, cx, inputClass } from "../components/ui";
import * as C from "../lib/core";
import { fmtDateShort, fmtMoney, fmtRate, fmtTry, fmtWeekdayShort } from "../lib/format";
import { usePlanData, useTodayIndex } from "../state/hooks";
import { useTrip } from "../state/trip";
import { toast } from "../state/ui";

export const EXPENSE_EMOJI: Record<ExpenseCategory, string> = {
  yemek: "🍽️",
  cay_kahve: "☕",
  giris: "🎟️",
  alisveris: "🛍️",
  ulasim: "🚌",
  yakit: "⛽",
  konaklama: "🏨",
  diger: "🧾",
};

const STATUS = {
  iyi: { label: "Yolunda", tone: "good" as const, color: "text-good" },
  dikkat: { label: "Dikkat", tone: "warn" as const, color: "text-warn" },
  asim: { label: "Aşıldı", tone: "bad" as const, color: "text-bad" },
};

const FX_TTL = 6 * 60 * 60 * 1000;
let fxFetchedAt = 0;

export function useFx(): FxRates {
  const fx = useTrip((s) => s.fx);
  const setFx = useTrip((s) => s.setFx);
  useEffect(() => {
    if (Date.now() - fxFetchedAt < FX_TTL) return;
    fxFetchedAt = Date.now();
    void C.fxRates().then((r) => {
      if (r) setFx(r);
    });
  }, [setFx]);
  return fx ?? DEFAULT_FX;
}

export default function Budget() {
  const { plan, index } = usePlanData();
  const expenses = useTrip((s) => s.expenses);
  const addExpense = useTrip((s) => s.addExpense);
  const removeExpense = useTrip((s) => s.removeExpense);
  const restoreExpense = useTrip((s) => s.restoreExpense);
  const selectedDay = useTrip((s) => s.selectedDay);
  const fx = useFx();
  const todayIdx = useTodayIndex(plan);
  const [open, setOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);

  const mine = useMemo(() => (plan ? expenses.filter((e) => e.tripId === plan.id) : []), [plan, expenses]);
  const status = useMemo(() => (plan ? C.budget(plan, mine, new Date(), index, fx) : null), [plan, mine, index, fx]);
  const pass = useMemo(() => (plan && index ? C.museumPass(plan, index, plan.request.visitor, fx) : null), [plan, index, fx]);

  if (!plan || !status) {
    return (
      <EmptyState emoji="💰" title="Bütçe takibi" action={<Button variant="primary" onClick={() => navigate("olustur")}>Gezi oluştur</Button>}>
        Bir plan oluşturduğunda planlanan maliyetle gerçek harcamalarını burada karşılaştırırsın.
      </EmptyState>
    );
  }

  const st = STATUS[status.status];
  const cats = (Object.keys(EXPENSE_LABELS) as ExpenseCategory[]).filter((c) => status.byCategory[c].plannedTry > 0 || status.byCategory[c].spentTry > 0);
  const maxDay = Math.max(1, ...status.byDay.map((d) => Math.max(d.plannedTry, d.spentTry)));

  function del(id: string) {
    const e = removeExpense(id);
    if (e) toast({ kind: "info", title: "Harcama silindi", body: `${fmtMoney(e.amount, e.currency)} · ${EXPENSE_LABELS[e.category]}`, action: { label: "Geri al", run: () => restoreExpense(e) } });
  }

  const byDayExpenses = new Map<number | "x", typeof mine>();
  for (const e of mine) {
    const k = e.dayIndex ?? "x";
    byDayExpenses.set(k, [...(byDayExpenses.get(k) ?? []), e]);
  }

  return (
    <div className="pb-28 lg:pb-10">
      <PageHeader
        eyebrow={plan.request.title}
        title="Bütçe"
        action={
          <div className="flex gap-2">
            <Button icon={<ReceiptText className="size-4" />} onClick={() => setBillOpen(true)}>
              Hesap kontrol
            </Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
              Harcama
            </Button>
          </div>
        }
      />
      <BillCheckSheet
        open={billOpen}
        onClose={() => setBillOpen(false)}
        travelers={plan.request.travelers}
        date={plan.days[todayIdx ?? selectedDay]?.date ?? plan.days[0]!.date}
        visitor={plan.request.visitor}
        fx={fx}
        onAddExpense={(amountTry, note) => {
          addExpense(C.makeExpense({ tripId: plan.id, amount: amountTry, currency: "TRY", category: "yemek", note, dayIndex: todayIdx ?? selectedDay }, fx));
          setBillOpen(false);
          toast({ kind: "success", title: "Harcamaya eklendi", body: note });
        }}
      />
      <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:px-6 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          {/* durum */}
          <Card className="overflow-hidden p-0">
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-muted">Kalan bütçe</span>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <p className={cx("mt-1 text-[40px] font-extrabold leading-none tracking-tight tabular", st.color)}>{fmtTry(status.remainingTry)}</p>
              <p className="mt-1 text-sm text-muted tabular">
                {fmtTry(status.spentTry)} harcandı · toplam {fmtTry(status.totalTry)}
              </p>
              <Bar className="mt-3 h-2.5" value={status.spentTry} max={status.totalTry} tone={st.tone} label="Harcanan" />
              <p className="mt-2 text-xs text-muted tabular">Planın tahmini toplamı {fmtTry(status.plannedTry)}</p>
            </div>
            <div className="grid grid-cols-2 border-t border-line">
              <div className="p-4">
                <p className="text-xs font-semibold text-muted">Günlük limit</p>
                <p className="text-lg font-bold text-ink tabular">{status.daysLeft > 0 ? fmtTry(status.dailyLimitTry) : "—"}</p>
                <p className="text-xs text-muted">{status.daysLeft > 0 ? `${status.daysLeft} gün kaldı` : "Gezi tamamlandı"}</p>
              </div>
              <div className="border-l border-line p-4">
                <p className="text-xs font-semibold text-muted">Bugün kalan</p>
                {status.todayIndex !== null ? (
                  <>
                    <p className={cx("text-lg font-bold tabular", status.todayLeftTry < 0 ? "text-bad" : "text-ink")}>{fmtTry(status.todayLeftTry)}</p>
                    <p className="text-xs text-muted">bugün {fmtTry(status.todaySpentTry)} harcandı</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-ink">—</p>
                    <p className="text-xs text-muted">Gezi günlerinde görünür</p>
                  </>
                )}
              </div>
            </div>
          </Card>

          {status.messages.length > 0 && (
            <ul className="grid gap-2">
              {status.messages.map((m, i) => (
                <li key={i} className={cx("rounded-2xl px-3.5 py-2.5 text-sm", status.status === "iyi" ? "bg-good-soft text-good" : status.status === "dikkat" ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad")}>
                  {m}
                </li>
              ))}
            </ul>
          )}

          {pass && (
            <Card className="flex gap-3 p-4">
              <span className={cx("grid size-11 shrink-0 place-items-center rounded-2xl", pass.worth ? "bg-good-soft text-good" : "bg-surface-2 text-muted")}>
                <Landmark className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-bold text-ink">
                  {plan.request.visitor === "yerli" ? "Müzekart" : "Museum Pass Türkiye"} {pass.worth ? "işine yarar" : "bu gezide gerekmeyebilir"}
                </p>
                <p className="mt-0.5 text-sm text-muted">{pass.message}</p>
                <p className="mt-1 text-xs text-muted">
                  {pass.visits} biletli ziyaret{pass.savingTry > 0 ? ` · tahmini tasarruf ${fmtTry(pass.savingTry)}` : ""}
                </p>
              </div>
            </Card>
          )}

          {/* kategoriler */}
          <Card className="p-4">
            <SectionTitle>Kategoriler · plan / harcanan</SectionTitle>
            <ul className="mt-3 space-y-3">
              {cats.map((c) => {
                const v = status.byCategory[c];
                const max = Math.max(v.plannedTry, v.spentTry, 1);
                const over = v.spentTry > v.plannedTry && v.plannedTry > 0;
                return (
                  <li key={c}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-semibold text-ink">
                        <span aria-hidden>{EXPENSE_EMOJI[c]}</span> {EXPENSE_LABELS[c]}
                      </span>
                      <span className={cx("tabular", over ? "font-bold text-bad" : "text-muted")}>
                        {fmtTry(v.spentTry)} / {fmtTry(v.plannedTry)}
                      </span>
                    </div>
                    <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-3">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-sea/30" style={{ width: `${(v.plannedTry / max) * 100}%` }} />
                      <div className={cx("absolute inset-y-0 left-0 rounded-full", over ? "bg-bad" : "bg-brand")} style={{ width: `${(v.spentTry / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
              {cats.length === 0 && <li className="text-sm text-muted">Henüz kalem yok.</li>}
            </ul>
            <p className="mt-3 flex gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-sea/30" /> Plan</span>
              <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-brand" /> Harcanan</span>
            </p>
          </Card>
        </div>

        <div className="grid gap-4">
          {/* günler */}
          <Card className="p-4">
            <SectionTitle>Günler</SectionTitle>
            <ul className="mt-3 space-y-3">
              {status.byDay.map((d) => (
                <li key={d.dayIndex} className={cx("rounded-2xl p-2.5", d.dayIndex === status.todayIndex && "bg-brand-soft/60")}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink">
                      {d.dayIndex + 1}. gün <span className="font-normal text-muted">· {fmtWeekdayShort(d.date)} {fmtDateShort(d.date)}</span>
                    </span>
                    <span className="text-muted tabular">
                      {fmtTry(d.spentTry)} / {fmtTry(d.plannedTry)}
                    </span>
                  </div>
                  <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-sea/30" style={{ width: `${(d.plannedTry / maxDay) * 100}%` }} />
                    <div className={cx("absolute inset-y-0 left-0 rounded-full", d.spentTry > d.plannedTry ? "bg-bad" : "bg-brand")} style={{ width: `${(d.spentTry / maxDay) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* harcamalar */}
          <Card className="p-4">
            <SectionTitle action={<span className="text-xs text-muted">{mine.length} kayıt</span>}>Harcamalar</SectionTitle>
            {mine.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-3xl" aria-hidden>🧾</p>
                <p className="mt-2 text-sm text-muted">Henüz harcama yok. Fişi aldığın an eklemek en kolayı.</p>
                <Button className="mt-3" variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
                  İlk harcamayı ekle
                </Button>
              </div>
            ) : (
              <div className="mt-2 space-y-4">
                {[...byDayExpenses.entries()]
                  .sort((a, b) => (a[0] === "x" ? 1 : b[0] === "x" ? -1 : (b[0] as number) - (a[0] as number)))
                  .map(([k, list]) => (
                    <div key={String(k)}>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                        {k === "x" ? "Gün dışı" : `${(k as number) + 1}. gün · ${fmtDateShort(plan.days[k as number]?.date ?? "")}`}
                      </p>
                      <ul className="divide-y divide-line">
                        {list.map((e) => {
                          const place = e.placeId ? index?.get(e.placeId) : undefined;
                          return (
                            <li key={e.id} className="flex items-center gap-3 py-2">
                              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-lg" aria-hidden>
                                {EXPENSE_EMOJI[e.category]}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-ink">{e.note || place?.name || EXPENSE_LABELS[e.category]}</p>
                                <p className="truncate text-xs text-muted">
                                  {EXPENSE_LABELS[e.category]}
                                  {place && e.note ? ` · ${place.name}` : ""} · {new Date(e.at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-ink tabular">{fmtTry(e.amountTry)}</p>
                                {e.currency !== "TRY" && <p className="text-xs text-muted tabular">{fmtMoney(e.amount, e.currency)} @ {fmtRate(e.fxRate)}</p>}
                              </div>
                              <button type="button" className="grid size-10 shrink-0 place-items-center rounded-2xl text-muted hover:bg-bad-soft hover:text-bad" aria-label="Harcamayı sil" onClick={() => del(e.id)}>
                                <Trash2 className="size-4" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </Card>

          <FxLine fx={fx} />
        </div>
      </div>

      <ExpenseSheet
        open={open}
        onClose={() => setOpen(false)}
        defaultDay={todayIdx ?? selectedDay}
        fx={fx}
        onSave={(input) => {
          const e = C.makeExpense({ ...input, tripId: plan.id }, fx);
          addExpense(e);
          setOpen(false);
          toast({ kind: "success", title: `${fmtTry(e.amountTry)} eklendi`, body: EXPENSE_LABELS[e.category] });
        }}
      />
    </div>
  );
}

function FxLine({ fx }: { fx: FxRates }) {
  const setFx = useTrip((s) => s.setFx);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-2 px-1 text-xs text-muted">
      <span className="min-w-0 flex-1">
        Kur: 1 € = {fmtRate(fx.tryPer.EUR)} ₺ · 1 $ = {fmtRate(fx.tryPer.USD)} ₺ · {fx.date}
        {fx === DEFAULT_FX ? " (varsayılan, TCMB)" : ""}
      </span>
      <button
        type="button"
        className="inline-flex min-h-9 items-center gap-1 rounded-xl px-2 font-semibold hover:bg-surface-2"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await C.fxRates();
          setBusy(false);
          if (r) {
            setFx(r);
            toast({ kind: "success", title: "Kur güncellendi", body: r.source });
          } else toast({ kind: "info", title: "Canlı kur alınamadı", body: "Varsayılan kur kullanılıyor." });
        }}
      >
        <RefreshCw className={cx("size-3.5", busy && "animate-spin")} aria-hidden /> Yenile
      </button>
    </div>
  );
}

interface ExpenseInput {
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  note?: string;
  placeId?: string;
  dayIndex?: number;
}

function ExpenseSheet({ open, onClose, onSave, defaultDay, fx }: { open: boolean; onClose: () => void; onSave: (e: ExpenseInput) => void; defaultDay: number; fx: FxRates }) {
  const { plan, index } = usePlanData();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [category, setCategory] = useState<ExpenseCategory>("yemek");
  const [note, setNote] = useState("");
  const [dayIndex, setDayIndex] = useState(defaultDay);
  const [stopId, setStopId] = useState("");

  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
      setStopId("");
      setDayIndex(defaultDay);
    }
  }, [open, defaultDay]);

  const value = Number(amount.replace(/\./g, "").replace(",", "."));
  const valid = Number.isFinite(value) && value > 0;
  const day = plan?.days[dayIndex];

  function pickStop(id: string) {
    setStopId(id);
    const s = day?.stops.find((x) => x.id === id);
    const p = s ? index?.get(s.placeId) : undefined;
    if (p) setCategory(C.categoryForPlace(p.cat));
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Harcama ekle"
      subtitle="Döviz harcamaları kayıt anındaki kurla TL'ye çevrilir."
      footer={
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!valid}
          onClick={() => {
            const s = day?.stops.find((x) => x.id === stopId);
            onSave({ amount: value, currency, category, note: note.trim() || undefined, placeId: s?.placeId, dayIndex });
          }}
        >
          Kaydet{valid && currency !== "TRY" ? ` · ≈ ${fmtTry(value * fx.tryPer[currency])}` : ""}
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="flex gap-2">
          <input
            autoFocus
            inputMode="decimal"
            className={cx(inputClass, "min-h-14 flex-1 text-2xl font-extrabold tabular")}
            placeholder="0"
            aria-label="Tutar"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
          />
          <Segmented<Currency>
            label="Para birimi"
            value={currency}
            onChange={setCurrency}
            className="w-40 shrink-0"
            options={[
              { value: "TRY", label: "₺" },
              { value: "EUR", label: "€" },
              { value: "USD", label: "$" },
            ]}
          />
        </div>
        <Field label="Kategori">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(EXPENSE_LABELS) as ExpenseCategory[]).map((c) => (
              <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
                <span aria-hidden>{EXPENSE_EMOJI[c]}</span> {EXPENSE_LABELS[c]}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Not (isteğe bağlı)" htmlFor="ex-note">
          <input id="ex-note" className={inputClass} placeholder="Ör. Çöp şiş + ayran" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {plan && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gün" htmlFor="ex-day">
              <select id="ex-day" className={inputClass} value={dayIndex} onChange={(e) => { setDayIndex(Number(e.target.value)); setStopId(""); }}>
                {plan.days.map((d, i) => (
                  <option key={i} value={i}>
                    {i + 1}. gün · {fmtDateShort(d.date)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Durak (isteğe bağlı)" htmlFor="ex-stop">
              <select id="ex-stop" className={inputClass} value={stopId} onChange={(e) => pickStop(e.target.value)}>
                <option value="">— Bağlama —</option>
                {day?.stops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {index?.get(s.placeId)?.name ?? s.placeId}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </div>
    </Sheet>
  );
}
