import type { ReactNode } from "react";

/** EmptyState — título que explica + 1 línea de qué ocurrirá. Sin CTA duplicado. */
export function EmptyState({
  titulo,
  descripcion,
  children,
  className = "",
}: {
  titulo: string;
  descripcion: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center rounded-[20px] border border-[var(--ruum-border)] bg-white px-6 py-10 text-center ${className}`}>
      <span aria-hidden className="mb-3 flex size-12 items-center justify-center rounded-full bg-[var(--ruum-neutral-bg)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M6 2h9l5 5v15H6ZM14 2v6h6" stroke="var(--ruum-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h3 className="font-body text-lg font-semibold text-[var(--ruum-navy)]">{titulo}</h3>
      <p className="mt-1 max-w-md font-body text-sm leading-5 text-[var(--ruum-muted)]">{descripcion}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

/** Skeleton — carga en listas; spinner solo para <3s. Respeta reduced-motion. */
export function Skeleton({ tipo = "text", className = "" }: { tipo?: "text" | "card" | "list"; className?: string }) {
  if (tipo === "card") {
    return (
      <div role="status" aria-label="Cargando…" className={`animate-pulse rounded-[20px] border border-[var(--ruum-border)] bg-white p-5 ${className}`}>
        <div className="h-4 w-2/3 rounded bg-[var(--ruum-neutral-bg)]" />
        <div className="mt-2 h-4 w-1/2 rounded bg-[var(--ruum-neutral-bg)]" />
        <div className="mt-4 h-24 rounded-[12px] bg-[var(--ruum-neutral-bg)]" />
      </div>
    );
  }
  if (tipo === "list") {
    return (
      <div role="status" aria-label="Cargando…" className={`animate-pulse space-y-2 ${className}`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 rounded-[12px] bg-[var(--ruum-neutral-bg)]" />
        ))}
      </div>
    );
  }
  return (
    <div role="status" aria-label="Cargando…" className={`animate-pulse space-y-2 ${className}`}>
      <div className="h-4 w-3/4 rounded bg-[var(--ruum-neutral-bg)]" />
      <div className="h-4 w-1/2 rounded bg-[var(--ruum-neutral-bg)]" />
    </div>
  );
}
