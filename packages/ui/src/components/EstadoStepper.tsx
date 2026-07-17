import type { EstadoTraslado } from "@ruum/shared/types";
import { ETAPAS_TRASLADO, ESTADOS_RAMIFICADOS, indiceEtapaActual } from "../lib/etapas";

export interface EstadoStepperProps {
  estado: EstadoTraslado;
  currentLabel?: string;
}

function getProgressData(estado: EstadoTraslado) {
  const esRamificado = ESTADOS_RAMIFICADOS.includes(estado);
  const indiceEncontrado = indiceEtapaActual(estado);
  const indiceActual = indiceEncontrado >= 0 ? indiceEncontrado : ETAPAS_TRASLADO.length - 1;
  const total = ETAPAS_TRASLADO.length;
  const etapaActual = ETAPAS_TRASLADO[indiceActual] ?? ETAPAS_TRASLADO[total - 1];

  return { esRamificado, indiceActual, total, etapaActual };
}

/**
 * Progreso compacto para móvil. Evita comprimir las 7 etiquetas en 320 px y
 * mantiene una alternativa accesible con el listado completo bajo demanda.
 */
export function MobileProgress({ estado, currentLabel }: EstadoStepperProps) {
  const { esRamificado, indiceActual, total, etapaActual } = getProgressData(estado);
  const paso = indiceActual + 1;
  const nombre = currentLabel ?? (esRamificado ? "Revisión operativa" : etapaActual.etiqueta);

  return (
    <section className="md:hidden" aria-labelledby="mobile-progress-title">
      <p id="mobile-progress-title" className="font-body text-sm font-semibold text-route-action">
        Paso {paso} de {total}
      </p>
      <p className="mt-1 font-display text-lg font-semibold leading-6 text-text-primary">{nombre}</p>
      <div
        className="mt-3 grid grid-cols-7 gap-1"
        role="progressbar"
        aria-label={`Progreso del traslado: paso ${paso} de ${total}, ${nombre}`}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={paso}
        aria-valuetext={`Paso ${paso} de ${total}: ${nombre}`}
      >
        {ETAPAS_TRASLADO.map((etapa, i) => {
          const activa = i <= indiceActual || esRamificado;
          return (
            <span
              key={etapa.id}
              className={["h-2 rounded-full", activa ? "bg-route-action" : "bg-surface-elevated"].join(" ")}
              aria-hidden
            />
          );
        })}
      </div>
      <details className="mt-3 rounded-xl border border-border bg-surface">
        <summary
          className="cursor-pointer px-3 py-2 font-body text-sm font-semibold text-route-action"
          aria-label="Ver todas las etapas del traslado"
        >
          Ver etapas
        </summary>
        <ol className="grid gap-2 border-t border-border px-3 py-3" aria-label="Etapas del traslado">
          {ETAPAS_TRASLADO.map((etapa, i) => {
            const actual = !esRamificado && i === indiceActual;
            const completa = esRamificado || i < indiceActual;
            return (
              <li
                key={etapa.id}
                aria-current={actual ? "step" : undefined}
                className="flex items-center gap-2 font-body text-sm text-text-secondary"
              >
                <span
                  className={[
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    actual ? "border-route-action bg-route-soft text-route-action" : completa ? "border-success bg-control-soft text-success" : "border-border bg-surface-elevated text-text-tertiary"
                  ].join(" ")}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className={actual ? "font-semibold text-text-primary" : ""}>
                  {etapa.etiqueta}
                  {actual ? " actual" : completa ? " completada" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}

/**
 * Franja horizontal completa para escritorio. En móvil se sustituye por
 * MobileProgress para no comprimir etiquetas.
 */
export function DesktopStateStepper({ estado }: EstadoStepperProps) {
  const { esRamificado, indiceActual } = getProgressData(estado);

  return (
    <div role="list" aria-label="Etapas completas del traslado" className="hidden w-full gap-1 md:flex">
      {ETAPAS_TRASLADO.map((etapa, i) => {
        const pasada = !esRamificado && i < indiceActual;
        const actual = !esRamificado && i === indiceActual;
        // Si el estado se ramificó después del cierre, todo el camino feliz
        // se muestra sellado (ya ocurrió) y el aviso se da por separado.
        const sellada = pasada || (esRamificado && etapa.id === "cierre");

        return (
          <div
            key={etapa.id}
            role="listitem"
            aria-label={`Paso ${i + 1} de ${ETAPAS_TRASLADO.length}: ${etapa.etiqueta}${actual ? ", etapa actual" : sellada ? ", completada" : ", pendiente"}`}
            className="flex-1"
          >
            <div
              className={[
                "h-1.5 rounded-full transition-colors",
                actual ? "bg-signal" : sellada ? "bg-surface-strong" : "bg-surface-elevated"
              ].join(" ")}
            />
            <p
              className={[
                "mt-1.5 font-body text-xs font-semibold",
                actual ? "text-text-primary" : sellada ? "text-text-primary" : "text-text-tertiary"
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

export function EstadoStepper({ estado, currentLabel }: EstadoStepperProps) {
  return (
    <div>
      <MobileProgress estado={estado} currentLabel={currentLabel} />
      <DesktopStateStepper estado={estado} />
    </div>
  );
}
