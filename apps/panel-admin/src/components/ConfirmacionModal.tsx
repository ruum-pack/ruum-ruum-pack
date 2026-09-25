"use client";
import type { ReactNode } from "react";
export function ConfirmacionModal({ abierto, titulo, children, confirmar, cancelar, destructiva = false }: { abierto: boolean; titulo: string; children: ReactNode; confirmar: () => void; cancelar: () => void; destructiva?: boolean }) {
  if (!abierto) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--ruum-overlay)] p-4" role="presentation" onMouseDown={cancelar}>
    <section role="dialog" aria-modal="true" aria-labelledby="confirmacion-titulo" className="w-full max-w-md rounded-[20px] border border-[var(--ruum-border)] bg-white p-6 shadow-[var(--ruum-elevation-2)]" onMouseDown={(e) => e.stopPropagation()}>
      <h2 id="confirmacion-titulo" className="font-body text-xl font-semibold text-[var(--ruum-navy)]">{titulo}</h2>
      <div className="mt-3 font-body text-sm text-[var(--ruum-muted)]">{children}</div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={cancelar} className="min-h-[var(--ruum-button-height)] rounded-[14px] border border-[var(--ruum-action)] px-4 py-2 font-body text-base font-semibold text-[var(--ruum-action)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--ruum-focus)]">Cancelar</button>
        <button type="button" onClick={confirmar} className={`min-h-[var(--ruum-button-height)] rounded-[14px] px-4 py-2 font-body text-base font-semibold text-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--ruum-focus)] ${destructiva ? "bg-[var(--ruum-error)]" : "ruum-button-primary"}`}>Continuar</button>
      </div>
    </section>
  </div>;
}
