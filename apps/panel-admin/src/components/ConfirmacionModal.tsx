"use client";
import type { ReactNode } from "react";
export function ConfirmacionModal({ abierto, titulo, children, confirmar, cancelar, destructiva = false }: { abierto: boolean; titulo: string; children: ReactNode; confirmar: () => void; cancelar: () => void; destructiva?: boolean }) {
  if (!abierto) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onMouseDown={cancelar}>
    <section role="dialog" aria-modal="true" aria-labelledby="confirmacion-titulo" className="w-full max-w-md rounded-xl bg-surface-primary p-6 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
      <h2 id="confirmacion-titulo" className="font-heading text-xl font-semibold">{titulo}</h2>
      <div className="mt-3 font-body text-sm text-text-secondary">{children}</div>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={cancelar} className="rounded-lg border px-4 py-2">Cancelar</button><button type="button" onClick={confirmar} className={`rounded-lg px-4 py-2 text-white ${destructiva ? "bg-status-danger" : "bg-ink"}`}>Continuar</button></div>
    </section>
  </div>;
}
