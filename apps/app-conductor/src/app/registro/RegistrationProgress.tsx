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
      {/* Stepper visual con nombre de pasos e indicadores interactivos */}
      <nav aria-label="Pasos de registro" className="w-full">
        {/* Vista móvil (Compact Stepper) */}
        <div className="flex flex-col gap-2 sm:hidden">
          <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
            <span>
              Paso {paso + 1} de {PASOS_REGISTRO.length}: <strong className="text-text-primary">{PASOS_REGISTRO[paso].titulo}</strong>
            </span>
            <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-text-tertiary">
              ⏱ {PASOS_REGISTRO[paso].tiempo}
            </span>
          </div>
          <div className="flex h-2.5 gap-1.5 overflow-hidden rounded-full bg-surface-elevated p-0.5">
            {PASOS_REGISTRO.map((p, idx) => (
              <div
                key={p.titulo}
                className={`h-full flex-1 rounded-full transition-all duration-300 ${
                  idx < paso
                    ? "bg-success"
                    : idx === paso
                    ? "bg-route-action"
                    : "bg-transparent"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Vista Desktop y Tablet (Full Stepper Pipeline) */}
        <ol className="hidden sm:grid sm:grid-cols-5 sm:gap-2">
          {PASOS_REGISTRO.map((pasoInfo, indice) => {
            const completado = indice < paso;
            const activo = indice === paso;

            return (
              <li key={pasoInfo.titulo} className="flex flex-col gap-1.5">
                <button
                  type="button"
                  disabled={!completado}
                  onClick={() => completado && onGoToStep(indice)}
                  className={`group flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all duration-150 ${
                    activo
                      ? "border-route-action bg-route-soft/30 shadow-sm"
                      : completado
                      ? "border-success/30 bg-success/5 hover:border-success hover:bg-success/10 cursor-pointer"
                      : "border-border bg-surface opacity-60 cursor-not-allowed"
                  }`}
                  aria-label={`Paso ${indice + 1}: ${pasoInfo.titulo}`}
                  aria-current={activo ? "step" : undefined}
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-lg font-display text-xs font-bold transition-colors ${
                      completado
                        ? "bg-success text-white"
                        : activo
                        ? "bg-route-action text-white"
                        : "bg-surface-elevated text-text-tertiary"
                    }`}
                  >
                    {completado ? "✓" : indice + 1}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`truncate font-body text-xs font-bold ${
                        activo ? "text-route-action" : completado ? "text-text-primary" : "text-text-tertiary"
                      }`}
                    >
                      {pasoInfo.titulo}
                    </span>
                    <span className="text-[10px] text-text-tertiary">{pasoInfo.tiempo}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Tarjeta descriptiva del paso activo */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-text-primary">
            {paso + 1}. {PASOS_REGISTRO[paso].titulo}
          </h2>
          <span className="font-body text-xs text-text-tertiary sm:hidden">
            ⏱ {PASOS_REGISTRO[paso].tiempo}
          </span>
        </div>
        <p className="mt-1 font-body text-sm leading-6 text-text-secondary">
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
