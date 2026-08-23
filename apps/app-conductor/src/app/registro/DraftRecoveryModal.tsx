"use client";

import { Button } from "@ruum/ui";

interface DraftRecoveryModalProps {
  isOpen: boolean;
  guardadoEn?: string;
  onRestore: () => void;
  onDiscard: () => void;
}

export function DraftRecoveryModal({
  isOpen,
  guardadoEn,
  onRestore,
  onDiscard
}: DraftRecoveryModalProps) {
  if (!isOpen) return null;

  const fechaFormateada = guardadoEn
    ? new Date(guardadoEn).toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-[100dvh] w-[100vw] max-h-none max-w-none items-center justify-center border-0 bg-overlay/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      aria-modal="true"
      aria-labelledby="modal-borrador-titulo"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl transition-all sm:p-7">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-route-soft text-route-action" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div>
            <h2 id="modal-borrador-titulo" className="font-display text-lg font-bold text-text-primary">
              Registro sin terminar
            </h2>
            <p className="font-body text-xs text-text-tertiary">Progreso guardado automáticamente</p>
          </div>
        </div>

        <p className="mt-4 font-body text-sm leading-6 text-text-secondary">
          Encontramos información de tu registro anterior
          {fechaFormateada ? ` del ${fechaFormateada}` : ""}. Puedes continuar desde donde te quedaste o iniciar una solicitud nueva.
        </p>

        <div className="mt-4 rounded-xl bg-surface-elevated p-3 text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">🔒 Seguridad: </span>
          Tus datos se transmiten y almacenan con cifrado de grado bancario (SSL/TLS).
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button type="button" variant="quiet" onClick={onDiscard} className="w-full sm:w-auto">
            Empezar de cero
          </Button>
          <Button type="button" onClick={onRestore} className="w-full sm:w-auto">
            Continuar borrador
          </Button>
        </div>
      </div>
    </dialog>
  );
}
