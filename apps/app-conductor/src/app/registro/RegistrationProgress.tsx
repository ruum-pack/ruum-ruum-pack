import { PASOS_REGISTRO, TEXTO_GUARDADO_REMOTO, type EstadoGuardadoRemoto } from "./registration-types";

export function RegistrationProgress({
  paso,
  onGoToStep,
  borradorLocalGuardado,
  sesionAutenticada,
  estadoGuardadoRemoto,
  detalleGuardadoRemoto
}: {
  paso: number;
  onGoToStep: (indice: number) => void;
  borradorLocalGuardado: boolean;
  sesionAutenticada: boolean;
  estadoGuardadoRemoto: EstadoGuardadoRemoto;
  detalleGuardadoRemoto: string | null;
}) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      {/* Stepper visual adaptativo con iconos descriptivos */}
      <nav aria-label="Pasos de registro" className="w-full">
        {/* Vista Móvil: Pipeline de Iconos descriptivos con scroll horizontal */}
        <div className="flex flex-col gap-3 sm:hidden">
           <div className="flex items-center justify-between font-body text-xs text-text-tertiary/80 dark:text-gray-400/80">
            <span className="font-medium">
              Paso <strong className="font-bold text-text-primary">{paso + 1} de {PASOS_REGISTRO.length}</strong>
            </span>
            <span className="rounded-full bg-surface-elevated px-2 py-0.5 font-semibold text-text-secondary">
              ⏱ {PASOS_REGISTRO[paso].tiempo}
            </span>
          </div>

          {/* Barra de 5 iconos descriptivos - simplificada con scroll horizontal */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            {PASOS_REGISTRO.map((pasoInfo, indice) => {
              const completado = indice < paso;
              const activo = indice === paso;

              return (
                <button
                  key={pasoInfo.titulo}
                  type="button"
                  disabled={!completado}
                  onClick={() => completado && onGoToStep(indice)}
                  className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1.5 text-center transition-all ${
                    activo
                      ? "bg-route-action/10 text-route-action ring-2 ring-route-action/40 shadow-xs"
                      : completado
                      ? "bg-success/10 text-success hover:bg-success/20 cursor-pointer"
                      : "bg-surface-elevated/40 text-text-tertiary opacity-50 cursor-not-allowed"
                  }`}
                  aria-label={`Paso ${indice + 1}: ${pasoInfo.titulo}`}
                  aria-current={activo ? "step" : undefined}
                >
                  <span className="text-sm" aria-hidden="true">
                    {completado ? "✓" : pasoInfo.icono}
                  </span>
                  <span className="font-display text-[9px] font-bold">
                    {indice + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Vista Tablet / Desktop: Stepper visual completo con iconos y títulos cortos - simplificado */}
        <ol className="hidden min-w-0 gap-1.5 sm:grid sm:min-w-full sm:grid-cols-5">
          {PASOS_REGISTRO.map((pasoInfo, indice) => {
            const completado = indice < paso;
            const activo = indice === paso;

            return (
              <li key={pasoInfo.titulo} className="flex flex-col gap-1 min-w-0">
                <button
                  type="button"
                  disabled={!completado}
                  onClick={() => completado && onGoToStep(indice)}
                  className={`group flex w-full items-center gap-2 rounded-lg border p-2 text-left transition-all duration-150 ${
                    activo
                      ? "border-route-action bg-route-soft/40 shadow-sm"
                      : completado
                        ? "border-success/30 bg-success/5 hover:border-success hover:bg-success/10 cursor-pointer"
                        : "border-border bg-surface opacity-60 cursor-not-allowed"
                  }`}
                  aria-label={`Paso ${indice + 1}: ${pasoInfo.titulo}`}
                  aria-current={activo ? "step" : undefined}
                  title={pasoInfo.titulo}
                >
                  <div
                    className={`flex size-7 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold transition-colors ${
                      completado
                        ? "bg-success text-white"
                        : activo
                          ? "bg-route-action text-white"
                          : "bg-surface-elevated text-text-tertiary"
                    }`}
                  >
                    {completado ? "✓" : pasoInfo.icono}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={`font-body text-xs font-bold truncate ${
                        activo ? "text-route-action" : completado ? "text-text-primary" : "text-text-tertiary"
                      }`}
                    >
                      {pasoInfo.shortTitle}
                    </span>
                    <span className="truncate text-[9px] text-text-tertiary/80">{pasoInfo.tiempo}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Tarjeta descriptiva del paso activo */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">{PASOS_REGISTRO[paso].icono}</span>
            <h2 className="font-display text-base font-bold text-text-primary">
              {paso + 1}. {PASOS_REGISTRO[paso].titulo}
            </h2>
          </div>
          <span className="font-body text-xs text-text-secondary sm:hidden">
            ⏱ {PASOS_REGISTRO[paso].tiempo}
          </span>
        </div>
        <p className="mt-1.5 font-body text-sm leading-6 text-text-secondary">
          {PASOS_REGISTRO[paso].objetivo}
        </p>
      </div>

      {/* Aviso anticipatorio de documentos requeridos */}
      {paso === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-route-action/20 bg-route-soft/40 p-3 text-xs text-text-secondary">
          <span className="text-base" aria-hidden>📋</span>
          <div>
            <strong className="font-semibold text-text-primary">Ten a la mano tus documentos: </strong>
            Para completar los siguientes pasos necesitarás tu <span className="font-medium text-text-primary">CURP</span>, <span className="font-medium text-text-primary">Licencia de conducir vigente</span> e <span className="font-medium text-text-primary">Identificación oficial (INE o Pasaporte)</span>.
          </div>
        </div>
      )}

      {/* Estado de guardado local / remoto */}
      {!sesionAutenticada && borradorLocalGuardado && (
        <output className="block font-body text-xs font-medium text-text-secondary" aria-live="polite">
          💾 Progreso guardado automáticamente en este dispositivo
        </output>
      )}

      {sesionAutenticada && estadoGuardadoRemoto !== "inactivo" && (
        <div className="flex items-center gap-2">
          {estadoGuardadoRemoto === "guardado" && (
            <span className="flex size-4 items-center justify-center rounded-full bg-success/10 text-xs text-success" aria-hidden="true">
              ✓
            </span>
          )}
          <output
            className={`font-body text-xs font-medium ${
              estadoGuardadoRemoto === "error"
                ? "text-danger-action"
                : estadoGuardadoRemoto === "sin_conexion"
                ? "text-warning"
                : "text-text-secondary"
            }`}
            aria-live="polite"
            title={detalleGuardadoRemoto ?? undefined}
          >
            {TEXTO_GUARDADO_REMOTO[estadoGuardadoRemoto]}
            {estadoGuardadoRemoto === "error" && detalleGuardadoRemoto ? `: ${detalleGuardadoRemoto}` : ""}
          </output>
        </div>
      )}
    </div>
  );
}
