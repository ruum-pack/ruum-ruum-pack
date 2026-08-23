import { useEffect, useRef } from "react";
import { MOTIVOS_RECHAZO, type MotivoRechazo } from "@ruum/shared/constants";
import { nombreVehiculo, type PasaporteRow } from "./trips-utils";

export function RejectTripDialog({
  viaje,
  onClose,
  onConfirm
}: {
  viaje: PasaporteRow | null;
  onClose: () => void;
  onConfirm: (motivo: MotivoRechazo) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (viaje) {
      // Foco programático controlado — evita autoFocus y respeta prefers-reduced-motion / TalkBack
      const id = requestAnimationFrame(() => closeRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [viaje]);

  if (!viaje) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end justify-center">
      <button
        type="button"
        aria-label="Cerrar diálogo"
        onClick={onClose}
        className="absolute inset-0 w-full h-full bg-transparent border-none cursor-default"
      />
      <dialog
        open
        aria-modal="true"
        aria-labelledby="rechazo-viaje-titulo"
        className="relative w-full max-w-md rounded-t-3xl border-t border-border/30 bg-surface-elevated p-6 shadow-2xl animate-in slide-in-from-bottom-5 duration-200 m-0 block"
      >
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-border/15">
          <div>
            <p id="rechazo-viaje-titulo" className="font-display text-lg font-black text-text-primary">
              Motivo de rechazo
            </p>
            <p className="mt-0.5 font-body text-xs text-text-secondary">
              {nombreVehiculo(viaje)}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-11 px-4 py-2 rounded-xl border border-border/40 bg-surface hover:bg-surface-elevated font-body text-sm font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
          >
            Cerrar
          </button>
        </div>
        <div className="mt-4 grid gap-2.5">
          {MOTIVOS_RECHAZO.map((motivo) => (
            <button
              key={motivo}
              type="button"
              onClick={() => onConfirm(motivo)}
              className="min-h-11 rounded-2xl border border-border/30 bg-surface px-4 py-3 text-left font-body text-sm font-semibold text-text-primary transition-all hover:border-danger/60 hover:bg-danger/5 active:scale-[0.99] cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
            >
              {motivo}
            </button>
          ))}
        </div>
      </dialog>
    </div>
  );
}
