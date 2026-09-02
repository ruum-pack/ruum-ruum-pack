import type { EstadoTraslado } from "@ruum/shared/types";
import { ETAPAS_TRASLADO, ESTADOS_RAMIFICADOS, indiceEtapaActual } from "./etapas";

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
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-route-soft px-2.5 py-0.5 font-body text-xs font-semibold text-route-action">
          <span className="size-1.5 rounded-full bg-route-action animate-pulse" aria-hidden />
          Paso {paso} de {total}
        </span>
        <span className="font-body text-xs font-medium text-text-tertiary">
          {Math.round((paso / total) * 100)}% completado
        </span>
      </div>
      <p id="mobile-progress-title" className="mt-1.5 font-display text-base font-bold leading-tight text-text-primary">
        {nombre}
      </p>
      <div
        className="mt-3 grid grid-cols-7 gap-1.5"
        role="progressbar"
        aria-label={`Progreso del traslado: paso ${paso} de ${total}, ${nombre}`}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={paso}
        aria-valuetext={`Paso ${paso} de ${total}: ${nombre}`}
      >
        {ETAPAS_TRASLADO.map((etapa, i) => {
          const pasada = !esRamificado && i < indiceActual;
          const actual = !esRamificado && i === indiceActual;
          const activa = pasada || actual || esRamificado;
          return (
            <span
              key={etapa.id}
              className={[
                "h-2 rounded-full transition-all duration-300",
                actual
                  ? "bg-signal shadow-xs ring-1 ring-signal/40"
                  : pasada
                    ? "bg-control"
                    : "bg-surface-elevated border border-border/30"
              ].join(" ")}
              title={`Paso ${i + 1}: ${etapa.etiqueta}`}
              aria-hidden
            />
          );
        })}
      </div>
      <details className="mt-3 rounded-xl border border-border/80 bg-surface/80">
        <summary
          className="flex min-h-[44px] cursor-pointer items-center justify-between px-3.5 py-2 font-body text-xs font-semibold text-route-action hover:text-route-action-hover"
          aria-label="Ver todas las etapas del traslado"
        >
          <span>Ver desglose de etapas ({paso}/{total})</span>
          <span className="text-text-tertiary font-mono-ruum text-xs">▼</span>
        </summary>
        <ol className="grid gap-2 border-t border-border/60 px-3.5 py-3" aria-label="Etapas del traslado">
          {ETAPAS_TRASLADO.map((etapa, i) => {
            const actual = !esRamificado && i === indiceActual;
            const completa = esRamificado || i < indiceActual;
            return (
              <li
                key={etapa.id}
                aria-current={actual ? "step" : undefined}
                className="flex items-center gap-2.5 font-body text-xs text-text-secondary min-h-[32px]"
              >
                <span
                  className={[
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    actual
                      ? "border border-signal bg-signal text-slate-950 shadow-xs"
                      : completa
                        ? "border border-control bg-control text-white"
                        : "border border-border bg-surface-elevated text-text-tertiary"
                  ].join(" ")}
                  aria-hidden
                >
                  {completa && !actual ? "✓" : i + 1}
                </span>
                <span className={actual ? "font-bold text-text-primary" : completa ? "text-text-secondary" : "text-text-tertiary"}>
                  {etapa.etiqueta}
                  {actual ? " (Etapa actual)" : completa ? " (Completada)" : ""}
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
 * Franja horizontal simplificada para escritorio con indicador de paso activo y
 * distribución balanceada que previene desbordamiento.
 */
export function DesktopStateStepper({ estado, currentLabel }: EstadoStepperProps) {
  const { esRamificado, indiceActual, total, etapaActual } = getProgressData(estado);
  const paso = indiceActual + 1;
  const nombre = currentLabel ?? (esRamificado ? "Revisión operativa" : etapaActual.etiqueta);

  return (
    <nav className="hidden w-full md:block" aria-label="Progreso del traslado">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-route-soft px-2.5 py-0.5 font-body text-xs font-semibold text-route-action">
            <span className="size-1.5 rounded-full bg-route-action animate-pulse" aria-hidden />
            Paso {paso} de {total}
          </span>
          <span className="font-display text-sm font-bold text-text-primary">
            {nombre}
          </span>
        </div>
        <span className="font-mono-ruum text-xs font-bold text-text-tertiary">
          {Math.round((paso / total) * 100)}%
        </span>
      </div>

      <div role="list" aria-label="Etapas completas del traslado" className="flex w-full gap-1.5">
        {ETAPAS_TRASLADO.map((etapa, i) => {
          const actual = etapa.id === estado;
          const sellada = i < indiceActual;

          return (
            <div
              key={etapa.id}
              role="listitem"
              className="flex min-w-0 flex-1 flex-col gap-1.5"
            >
              <div
                role="progressbar"
                aria-valuenow={sellada ? 100 : actual ? 50 : 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Paso ${i + 1} de ${ETAPAS_TRASLADO.length}: ${etapa.etiqueta}${actual ? ", etapa actual" : sellada ? ", completada" : ", pendiente"}`}
                className={[
                  "h-1.5 w-full rounded-full transition-colors",
                  actual ? "bg-action-primary shadow-xs" : sellada ? "bg-signal-soft" : "bg-surface-elevated"
                ].join(" ")}
              />
              <p
                className={[
                  "truncate font-body text-[11px] font-medium leading-tight",
                  actual ? "font-bold text-text-primary" : sellada ? "text-text-secondary" : "text-text-tertiary"
                ].join(" ")}
                title={`${String(i + 1).padStart(2, "0")} ${etapa.etiqueta}`}
              >
                {String(i + 1).padStart(2, "0")} {etapa.etiqueta}
              </p>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export function EstadoStepper({ estado, currentLabel }: EstadoStepperProps) {
  return (
    <div>
      <MobileProgress estado={estado} currentLabel={currentLabel} />
      <DesktopStateStepper estado={estado} currentLabel={currentLabel} />
    </div>
  );
}
