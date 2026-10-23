import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Ekran adı (ör. "Etrafım"); verilirse yalnızca o bölüm yedek arayüze düşer */
  scope?: string;
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.scope ?? "uygulama"}]`, error, info.componentStack);
  }

  override componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-bad-soft text-3xl" aria-hidden>
          🧭
        </div>
        <h2 className="text-lg font-bold text-ink">
          {this.props.scope ? `${this.props.scope} şu an açılamadı` : "Bir şeyler ters gitti"}
        </h2>
        <p className="mt-2 text-[15px] text-muted">Verilerin güvende; sorun yalnızca bu ekranda. Yeniden denemek çoğu zaman yeter.</p>
        <pre className="mt-4 max-h-32 overflow-auto whitespace-pre-wrap rounded-2xl bg-surface-2 p-3 text-left text-xs text-ink-2">
          {error.message}
        </pre>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            className="min-h-11 rounded-2xl bg-brand px-4 font-semibold text-brand-ink"
            onClick={() => this.setState({ error: null })}
          >
            Yeniden dene
          </button>
          <button
            type="button"
            className="min-h-11 rounded-2xl border border-line bg-surface px-4 font-semibold text-ink"
            onClick={() => window.location.reload()}
          >
            Sayfayı yenile
          </button>
        </div>
      </div>
    );
  }
}
