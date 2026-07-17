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
    <>
      <div className="mt-6 grid grid-cols-5 gap-2" aria-label="Progreso de registro">
        {PASOS_REGISTRO.map((pasoInfo, indice) => (
          <button
            key={pasoInfo.titulo}
            type="button"
            onClick={() => indice < paso && onGoToStep(indice)}
            className={[
              "h-2 rounded-full transition-colors",
              indice <= paso ? "bg-signal" : "bg-surface-elevated",
              indice < paso ? "cursor-pointer" : "cursor-default"
            ].join(" ")}
            aria-label={`Paso ${indice + 1}: ${pasoInfo.titulo}`}
          />
        ))}
      </div>
      <p className="mt-3 font-body text-sm font-semibold text-text-tertiary">
        Paso {paso + 1} de {PASOS_REGISTRO.length} · {PASOS_REGISTRO[paso].tiempo}
      </p>
      <div className="mt-2 rounded-xl border border-border bg-surface px-4 py-3">
        <p className="font-body text-sm font-semibold text-text-primary">{PASOS_REGISTRO[paso].titulo}</p>
        <p className="mt-1 font-body text-sm leading-6 text-text-secondary">{PASOS_REGISTRO[paso].objetivo}</p>
      </div>
      {!sesionAutenticada && borradorLocalGuardado && (
        <p className="mt-2 font-body text-xs font-medium text-text-secondary" role="status" aria-live="polite">
          Guardado en este dispositivo
        </p>
      )}
      {sesionAutenticada && estadoGuardadoRemoto !== "inactivo" && (
        <p
          className={`mt-2 font-body text-xs font-medium ${estadoGuardadoRemoto === "error" ? "text-danger-action" : estadoGuardadoRemoto === "sin_conexion" ? "text-warning" : "text-secondary"}`}
          role="status"
          aria-live="polite"
          title={detalleGuardadoRemoto ?? undefined}
        >
          {TEXTO_GUARDADO_REMOTO[estadoGuardadoRemoto]}
          {estadoGuardadoRemoto === "error" && detalleGuardadoRemoto ? `: ${detalleGuardadoRemoto}` : ""}
        </p>
      )}
    </>
  );
}
