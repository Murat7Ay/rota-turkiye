// Onarım seçeneği için "Neden bu seçenek?" — çözücünün ürettiği seçeneği 1–3 cümleyle açıklar.
// Anahtar yoksa ya da hata olursa seçeneğin kendi şablon açıklaması yeterlidir.
import { useEffect, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import type { RepairOption } from "@rota/core";
import { explainRepair, type AiError } from "./core";
import { AiButton, AiErrorText, cx } from "./parts";
import { useAiConfig } from "./useAiConfig";

export interface RepairExplainButtonProps {
  option: RepairOption;
  /** Olay özeti, ör. "Efes kapalı çıktı" */
  eventText?: string;
  hideWhenNoKey?: boolean;
  className?: string;
}

export function RepairExplainButton({ option, eventText, hideWhenNoKey = true, className }: RepairExplainButtonProps) {
  const { hasKey, callOptions } = useAiConfig();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setText(null);
    setError(null);
  }, [option.id]);
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!hasKey && hideWhenNoKey) return null;

  async function explain() {
    if (!callOptions || loading) return;
    const ctl = new AbortController();
    abortRef.current = ctl;
    setLoading(true);
    setError(null);
    const res = await explainRepair(option, { ...callOptions, signal: ctl.signal, ...(eventText ? { eventText } : {}) });
    if (ctl.signal.aborted) return;
    setLoading(false);
    if (res.ok) setText(res.value);
    else setError(res.error);
  }

  return (
    <div className={cx("space-y-2", className)}>
      {text ? (
        <p className="flex items-start gap-2 rounded-2xl bg-sea-soft p-3 text-sm leading-relaxed text-ink">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-sea" aria-hidden />
          <span>{text}</span>
        </p>
      ) : (
        <AiButton variant="ghost" size="sm" icon={<Lightbulb className="size-4 text-sea" aria-hidden />} loading={loading} disabled={!hasKey} onClick={() => void explain()}>
          Neden bu seçenek?
        </AiButton>
      )}
      <AiErrorText error={error} />
    </div>
  );
}
