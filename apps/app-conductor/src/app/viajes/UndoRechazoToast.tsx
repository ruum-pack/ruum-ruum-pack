"use client";

import { useEffect, useState } from "react";
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
  const [segundosRestantes, setSegundosRestantes] = useState(8);

  useEffect(() => {
    const inicio = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - inicio;
      const remaining = Math.max(0, 8 - Math.ceil(elapsed / 1000));
      setSegundosRestantes(remaining);
      if (remaining === 0) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  return (
    <output
      aria-live="assertive"
      aria-atomic="true"
      className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-4 right-4 max-w-md mx-auto z-40 bg-surface-elevated border border-warning/40 text-text-primary p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-slideUp block sm:left-auto sm:right-6"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl" aria-hidden>
          ↩️
        </span>
        <div className="flex flex-col min-w-0 text-left">
          <span className="text-xs font-bold text-text-primary leading-tight truncate">
            Oferta rechazada: {nombreVehiculo(viaje)}
          </span>
          <span className="text-[10px] text-text-tertiary truncate mt-0.5">
            Motivo: {motivo} · se registrará en {segundosRestantes}s
          </span>
          <div className="mt-1.5 h-1 w-full rounded-full bg-surface overflow-hidden" aria-hidden>
            <div
              className="h-full bg-warning transition-all duration-250 ease-linear"
              style={{ width: `${(segundosRestantes / 8) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onDeshacer}
        aria-label={`Deshacer rechazo, quedan ${segundosRestantes} segundos`}
        className="px-4 py-2 min-h-11 bg-route-action/20 hover:bg-route-action/30 border border-route-action/40 text-route-action font-display text-xs font-black rounded-xl uppercase tracking-wider transition-colors cursor-pointer shrink-0 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
      >
        Deshacer ({segundosRestantes}s)
      </button>
    </output>
  );
}
