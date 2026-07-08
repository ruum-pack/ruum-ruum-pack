import type { EstadoTraslado } from "@ruum/shared/types";
import { ETAPAS_TRASLADO, ESTADOS_RAMIFICADOS, indiceEtapaActual } from "../lib/etapas";

export interface EstadoStepperProps {
  estado: EstadoTraslado;
}

/**
 * Franja horizontal tipo "boarding pass" que recorre las 7 etapas del
 * traslado. Es el elemento que distingue visualmente al producto: en vez de
 * un checklist genérico, cada etapa es una celda de odómetro — pasada
 * (sellada), actual (iluminada, con pulso) o futura (atenuada).
 */
export function EstadoStepper({ estado }: EstadoStepperProps) {
  const esRamificado = ESTADOS_RAMIFICADOS.includes(estado);
  const indiceActual = indiceEtapaActual(estado);

  return (
    <div role="list" aria-label="Progreso del traslado" className="flex w-full gap-1">
      {ETAPAS_TRASLADO.map((etapa, i) => {
        const pasada = !esRamificado && i < indiceActual;
        const actual = !esRamificado && i === indiceActual;
        // Si el estado se ramificó después del cierre, todo el camino feliz
        // se muestra sellado (ya ocurrió) y el aviso se da por separado.
        const sellada = pasada || (esRamificado && etapa.id === "cierre");

        return (
          <div key={etapa.id} role="listitem" className="flex-1">
            <div
              className={[
                "h-1.5 rounded-full transition-colors",
                actual ? "bg-signal" : sellada ? "bg-ink" : "bg-ink/15"
              ].join(" ")}
            />
            <p
              className={[
                "mt-1.5 font-mono-ruum text-[10px] uppercase tracking-wide",
                actual ? "text-ink" : sellada ? "text-ink" : "text-ink/40"
              ].join(" ")}
            >
              {String(i + 1).padStart(2, "0")} {etapa.etiqueta}
            </p>
          </div>
        );
      })}
    </div>
  );
}
