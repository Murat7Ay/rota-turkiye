// Hikâye kartı düğmesi: kartı çizer; destekleniyorsa Web Share ile dosya olarak paylaşır,
// yoksa PNG indirir. Tarayıcı "kullanıcı hareketi" süresini aşarsa kart hazır tutulur ve
// ikinci dokunuşta doğrudan paylaşılır.
import { useState } from "react";
import { ImageDown, Share2 } from "lucide-react";
import type { Expense, PlaceIndex, TripPlan } from "@rota/core";
import { Button } from "../../components/ui";
import { toast } from "../../state/ui";
import { renderStoryCard, storyFileName } from "./renderStoryCard";
import { dayStoryData, wrappedStoryData } from "./storyData";
import type { TripRecord } from "../../../../../packages/core/src/stamps";

export type StorySource =
  | { kind: "day"; plan: TripPlan; dayIndex: number; index: PlaceIndex }
  | { kind: "wrapped"; plan: TripPlan; expenses: Expense[]; index: PlaceIndex; allTrips?: readonly TripRecord[] };

function errText(err: unknown): string {
  return err instanceof Error ? err.message : "Bilinmeyen hata";
}

function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  toast({ kind: "success", title: "Hikâye kartı indirildi", body: `${file.name} · 1080×1920` });
}

async function buildFile(story: StorySource): Promise<{ file: File; title: string }> {
  if (story.kind === "day") {
    const data = dayStoryData(story.plan, story.dayIndex, story.index);
    const blob = await renderStoryCard("day", data);
    return { file: new File([blob], storyFileName("day", data.title, data.badge), { type: "image/png" }), title: data.title };
  }
  const data = wrappedStoryData(story.plan, story.expenses, story.index, { allTrips: story.allTrips });
  const blob = await renderStoryCard("wrapped", data);
  return { file: new File([blob], storyFileName("wrapped", data.title), { type: "image/png" }), title: data.title };
}

export function ShareStoryButton({
  story,
  label,
  variant = "secondary",
  size = "md",
  className,
}: {
  story: StorySource;
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "sea";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<{ file: File; title: string } | null>(null);

  async function deliver(item: { file: File; title: string }) {
    if (canShareFile(item.file)) {
      try {
        await navigator.share({ files: [item.file], title: item.title, text: `${item.title} · Rota Türkiye` });
        setReady(null);
        return;
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "AbortError") {
          setReady(null);
          return;
        }
        if (name === "NotAllowedError") {
          setReady(item);
          toast({ kind: "info", title: "Kart hazır", body: "Paylaşmak için düğmeye bir kez daha dokun." });
          return;
        }
        // başka bir paylaşım hatası: indirmeye düş
      }
    }
    download(item.file);
    setReady(null);
  }

  async function onClick() {
    if (ready) {
      await deliver(ready);
      return;
    }
    setBusy(true);
    try {
      await deliver(await buildFile(story));
    } catch (err) {
      toast({ kind: "error", title: "Hikâye kartı oluşturulamadı", body: errText(err) });
    } finally {
      setBusy(false);
    }
  }

  const shareable = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  const text = ready ? "Kart hazır · Paylaş" : (label ?? (story.kind === "day" ? "Hikâye kartı" : "Wrapped'i paylaş"));
  return (
    <Button
      variant={ready ? "primary" : variant}
      size={size}
      loading={busy}
      onClick={() => void onClick()}
      className={className}
      icon={shareable ? <Share2 className="size-4" aria-hidden /> : <ImageDown className="size-4" aria-hidden />}
      aria-label={story.kind === "day" ? "Günün hikâye kartını paylaş" : "Gezi Wrapped kartını paylaş"}
    >
      {text}
    </Button>
  );
}
