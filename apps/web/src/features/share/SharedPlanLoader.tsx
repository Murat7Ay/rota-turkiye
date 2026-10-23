// Paylaşılan plan karşılama penceresi. `#/paylas/…` ile açılınca planın özetini gösterir;
// "Planı aç" denince yükü çağırana verir (yeniden planlama koordinatöre aittir).
import { useState } from "react";
import { CalendarDays, MapPin, TriangleAlert, Users, Wallet } from "lucide-react";
import type { Interest, Pace, TransportMode } from "@rota/core";
import { Sheet } from "../../components/Sheet";
import { Button } from "../../components/ui";
import { fmtDateLong, fmtMoney } from "../../lib/format";
import { toast } from "../../state/ui";
import type { SharePayload } from "../../../../../packages/core/src/share";
import { useSharedPlanFromHash } from "./useSharedPlanFromHash";

const PACE: Record<Pace, string> = { sakin: "Sakin tempo", dengeli: "Dengeli tempo", yogun: "Yoğun tempo" };
const TRANSPORT: Record<TransportMode, string> = { araba: "Araba", yuruyus: "Yürüyüş", toplu: "Toplu taşıma" };
const TRANSPORT_EMOJI: Record<TransportMode, string> = { araba: "🚗", yuruyus: "🚶", toplu: "🚌" };
const INTEREST: Record<Interest, string> = {
  tarih: "Tarih",
  yemek: "Yemek",
  tatli: "Tatlı",
  doga: "Doğa",
  deniz: "Deniz",
  alisveris: "Alışveriş",
  kultur: "Kültür",
  fotograf: "Fotoğraf",
};

function Summary({ p, packMismatch, versionMismatch }: { p: SharePayload; packMismatch: boolean; versionMismatch: boolean }) {
  const r = p.request;
  const nights = r.stays.reduce((a, s) => a + s.nights, 0);
  const days = nights + (r.end ? 1 : 0);
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-[#C2410C] via-[#EA580C] to-[#0E7490] p-4 text-white shadow-card">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">Paylaşılan rota</p>
        <h3 className="mt-1 text-xl font-extrabold leading-tight">{r.title || "İsimsiz gezi"}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm font-medium text-white/90">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span>{r.start.name}</span>
          {r.stays.map((s) => (
            <span key={s.id}>
              → {s.name} <span className="text-white/70">({s.nights} gece)</span>
            </span>
          ))}
          {r.end && <span>→ {r.end.name}</span>}
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-2 text-sm">
        <li className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-ink-2">
          <CalendarDays className="size-4 shrink-0 text-brand" aria-hidden />
          <span>
            {fmtDateLong(r.startDate)} · {days} gün
          </span>
        </li>
        <li className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-ink-2">
          <Users className="size-4 shrink-0 text-brand" aria-hidden />
          <span>
            {r.travelers} kişi · {PACE[r.pace]}
          </span>
        </li>
        <li className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-ink-2">
          <Wallet className="size-4 shrink-0 text-brand" aria-hidden />
          <span>Bütçe {fmtMoney(r.budget.amount, r.budget.currency)}</span>
        </li>
        <li className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-ink-2">
          <span aria-hidden>{TRANSPORT_EMOJI[r.transport]}</span>
          <span>{TRANSPORT[r.transport]}</span>
        </li>
      </ul>

      {r.interests.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {r.interests.map((i) => (
            <span key={i} className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium text-ink-2">
              {INTEREST[i]}
            </span>
          ))}
        </div>
      )}

      {(packMismatch || versionMismatch) && (
        <p className="flex gap-2 rounded-2xl bg-warn-soft px-3 py-2.5 text-sm text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {packMismatch
            ? `Bu plan "${p.packId}" bölge paketiyle hazırlanmış. Aynı planı görmek için o paketi yüklemen gerekebilir.`
            : "Bölge paketinin sürümü farklı; birkaç durak paylaşan kişininkinden farklı çıkabilir."}
        </p>
      )}
      <p className="text-sm text-muted">
        Plan bu cihazda, aynı istek ve aynı tohumla yeniden kurulur. Bağlantı yalnızca gezi isteğini taşır; hiçbir sunucuya veri
        gönderilmez.
      </p>
    </div>
  );
}

export function SharedPlanLoader({
  onOpen,
  currentPackId,
  currentPackVersion,
  hasCurrentPlan,
}: {
  /** Kullanıcı "Planı aç" deyince çağrılır; planı yeniden kurar ve uygun sekmeye gider */
  onOpen: (payload: SharePayload) => void | Promise<void>;
  currentPackId?: string | null;
  currentPackVersion?: string | null;
  /** Açık bir plan varsa yerine geçeceği belirtilir */
  hasCurrentPlan?: boolean;
}) {
  const shared = useSharedPlanFromHash();
  const [busy, setBusy] = useState(false);
  const p = shared.payload;

  if (shared.status === "invalid") {
    return (
      <Sheet
        open
        onClose={() => shared.dismiss()}
        title="Bağlantı açılamadı"
        footer={
          <Button variant="primary" className="w-full" onClick={() => shared.dismiss()}>
            Tamam
          </Button>
        }
      >
        <p className="text-[15px] text-ink-2">
          Bu paylaşım bağlantısı bozuk ya da eksik görünüyor. Bağlantının tamamını kopyaladığından emin olup yeniden dene.
        </p>
      </Sheet>
    );
  }
  if (shared.status !== "ready" || !p) return null;

  const packMismatch = !!currentPackId && currentPackId !== p.packId;
  const versionMismatch = !packMismatch && !!p.packVersion && !!currentPackVersion && p.packVersion !== currentPackVersion;

  async function open() {
    if (!p) return;
    setBusy(true);
    try {
      await onOpen(p);
      shared.dismiss();
    } catch (err) {
      toast({ kind: "error", title: "Plan kurulamadı", body: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={() => shared.dismiss()}
      title="Sana bir rota paylaşıldı"
      subtitle={hasCurrentPlan ? "Açarsan mevcut planının yerini alır." : "Bir dokunuşla aynı planı kur."}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => shared.dismiss()} disabled={busy}>
            Vazgeç
          </Button>
          <Button variant="primary" className="flex-[2]" loading={busy} onClick={() => void open()}>
            Planı aç
          </Button>
        </div>
      }
    >
      <Summary p={p} packMismatch={packMismatch} versionMismatch={versionMismatch} />
    </Sheet>
  );
}
