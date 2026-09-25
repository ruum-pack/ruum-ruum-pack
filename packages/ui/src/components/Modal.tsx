"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Modal V1.0: default / loading / error. Foco atrapado, overlay navy 60%, respeta reduced-motion. */
export interface ModalProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  estado?: "default" | "loading" | "error";
  className?: string;
}

export function Modal({ abierto, onCerrar, titulo, children, estado = "default", className = "" }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const el = ref.current;
    el?.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--ruum-overlay)] p-4 sm:items-center"
      role="presentation"
      onClick={onCerrar}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        aria-busy={estado === "loading" || undefined}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-[20px] border border-[var(--ruum-border)] bg-white p-5 shadow-[var(--ruum-elevation-2)] sm:p-6 ${className}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-body text-lg font-semibold text-[var(--ruum-navy)]">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar diálogo"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] text-[var(--ruum-muted)] hover:bg-[var(--ruum-neutral-bg)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--ruum-focus)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {estado === "loading" ? (
          <div className="flex items-center gap-3 py-4" role="status">
            <span className="size-5 animate-spin rounded-full border-2 border-[var(--ruum-action)] border-t-transparent" aria-hidden />
            <span className="font-body text-sm text-[var(--ruum-muted)]">Cargando…</span>
          </div>
        ) : estado === "error" ? (
          <div role="alert" className="mb-3 rounded-[12px] border border-[var(--ruum-error)]/30 bg-[var(--ruum-error-bg)] px-3 py-2 text-sm text-[var(--ruum-error-text)]">
            No pudimos completar esta acción. Inténtalo de nuevo o pide ayuda a soporte.
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
