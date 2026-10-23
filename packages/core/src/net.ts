// Ağ yardımcıları (iç modül, index'ten dışa açılmaz).

/** İstek zaman aşımı; AbortSignal.timeout yoksa boş seçenek */
export function timeoutInit(ms: number): RequestInit {
  const AS = globalThis.AbortSignal as (typeof AbortSignal & { timeout?: (ms: number) => AbortSignal }) | undefined;
  return AS?.timeout ? { signal: AS.timeout(ms) } : {};
}

/** Verilmezse global fetch (this bağlamı kaybolmasın diye sarmalanmış) */
export function resolveFetch(fetchFn?: typeof fetch): typeof fetch {
  return fetchFn ?? ((input, init) => fetch(input, init));
}
