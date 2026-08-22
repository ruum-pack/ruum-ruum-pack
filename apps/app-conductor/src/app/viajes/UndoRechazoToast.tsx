"use client";

import type { MotivoRechazo } from "@ruum/shared/constants";
import type { PasaporteRow } from "./trips-utils";
import { nombreVehiculo } from "./trips-utils";

interface UndoRechazoToastProps {
  viaje: PasaporteRow;
  motivo: MotivoRechazo;
  onDeshacer: () => void;
}

export function UndoRechazoToast({
  viaje,
  motivo,
  onDeshacer
}: UndoRechazoToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-40 bg-surface-elevated border border-warning/40 text-text-primary p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-slideUp"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl">↩️</span>
        <div className="flex flex-col min-w-0 text-left">
          <span className="text-xs font-bold text-text-primary leading-tight truncate">
            Oferta rechazada: {nombreVehiculo(viaje)}
          </span>
          <span className="text-[10px] text-text-tertiary truncate mt-0.5">
            Motivo: {motivo}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onDeshacer}
        className="px-4 py-2 min-h-11 bg-route-action/20 hover:bg-route-action/30 border border-route-action/40 text-route-action font-display text-xs font-black rounded-xl uppercase tracking-wider transition-colors cursor-pointer shrink-0"
      >
        Deshacer
      </button>
    </div>
  );
}
