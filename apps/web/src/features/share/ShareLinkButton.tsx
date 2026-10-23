// Plan paylaşım bağlantısı: sunucu yok; bağlantı isteği + paket + tohumu taşır, alıcı planı
// kendi cihazında yeniden kurar. Dokunmatik cihazda Web Share, masaüstünde panoya kopyalama.
import { useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "../../components/ui";
import { toast } from "../../state/ui";
import { shareUrl, type SharePayload } from "../../../../../packages/core/src/share";

function defaultBase(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

function preferNativeShare(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // eski yol: gizli metin alanı
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function ShareLinkButton({
  payload,
  baseUrl,
  label = "Bağlantıyı paylaş",
  variant = "secondary",
  size = "md",
  className,
}: {
  /** Yük ya da tıklamada üretilecek yük (ör. () => sharePayloadFromPlan(plan, seed)) */
  payload: SharePayload | (() => SharePayload);
  /** Varsayılan: geçerli sayfa adresi (# hariç) */
  baseUrl?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "sea";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const p = typeof payload === "function" ? payload() : payload;
      const url = await shareUrl(baseUrl ?? defaultBase(), p);
      const title = p.request.title || "Rota Türkiye planı";
      if (preferNativeShare()) {
        try {
          await navigator.share({ title, text: `${title} — bu rotayı Rota Türkiye'de aç.`, url });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          // paylaşım sayfası açılamadı: kopyalamaya düş
        }
      }
      if (await copyText(url)) {
        toast({
          kind: "success",
          title: "Bağlantı kopyalandı",
          body: "Açan kişi aynı planı kendi cihazında kurar; hesap ya da sunucu gerekmez.",
        });
      } else {
        window.prompt("Bağlantıyı kopyala:", url);
      }
    } catch (err) {
      toast({ kind: "error", title: "Bağlantı oluşturulamadı", body: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} size={size} loading={busy} onClick={() => void onClick()} className={className} icon={<Link2 className="size-4" aria-hidden />}>
      {label}
    </Button>
  );
}
