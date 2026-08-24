"use client";

import React from "react";
import Link from "next/link";
import { recordOperationalEvent } from "../lib/observability";

type Props = {
  children: React.ReactNode;
  /** Identificador para logging (ej: "panel", "evidencia", "global") */
  scope: string;
  /** Fallback opcional — si no se provee, se usa UI por defecto */
  fallback?: (props: { error: Error; reset: () => void }) => React.ReactNode;
};

type State = { hasError: boolean; error: Error | null };

export class ErrorBoundaryConductor extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // No rompe operación — reporta a observability + Sentry (si existe)
    void recordOperationalEvent("native_crash", {
      scope: this.props.scope,
      message: error.message.slice(0, 240),
      stack: error.stack?.slice(0, 500),
      componentStack: info.componentStack?.slice(0, 500),
    }, "error");

    // Sentry mirror si está cargado en window
    try {
      const w = window as unknown as { Sentry?: { captureException: (e: unknown, ctx?: unknown) => void } };
      w.Sentry?.captureException(error, { extra: { scope: this.props.scope, componentStack: info.componentStack } });
    } catch {}

    console.error(`[ErrorBoundary:${this.props.scope}]`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.handleReset });
      }
      return <FallbackConductor error={this.state.error} reset={this.handleReset} scope={this.props.scope} />;
    }
    return this.props.children;
  }
}

function FallbackConductor({ error, reset, scope }: { error: Error; reset: () => void; scope: string }) {
  const isDev = process.env.NODE_ENV === "development";
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center" role="alert" aria-live="assertive">
      <div className="rounded-2xl border border-border/40 bg-surface p-6 shadow-sm w-full">
        <h1 className="font-display text-lg font-black text-text-primary">Algo salió mal{scope !== "global" ? ` en ${scope}` : ""}</h1>
        <p className="mt-2 font-body text-sm leading-6 text-text-secondary">
          Ocurrió un error inesperado. No se perdió tu información — puedes reintentar o volver al panel.
        </p>
        {isDev && (
          <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-surface-elevated p-3 text-left font-mono text-xs text-danger/80 border border-danger/20">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-signal px-5 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-signal/90 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            Reintentar
          </button>
          <Link
            href="/panel"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 py-2.5 font-body text-sm font-medium text-text-primary hover:border-border-strong"
          >
            Ir al panel
          </Link>
          <Link
            href="/viajes"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 py-2.5 font-body text-sm font-medium text-text-primary hover:border-border-strong"
          >
            Ver viajes
          </Link>
        </div>
        <p className="mt-4 font-body text-xs text-text-tertiary">
          Si el problema persiste, contacta soporte desde el panel. Error registrado automáticamente.
        </p>
      </div>
    </div>
  );
}

export default ErrorBoundaryConductor;
