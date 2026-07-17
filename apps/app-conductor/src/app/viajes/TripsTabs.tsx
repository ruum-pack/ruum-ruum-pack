import { GRUPOS_MIS_VIAJES, VISTAS, type GrupoMisViajes, type VistaViajes } from "./trips-utils";

export function TripsTabs({
  vista,
  grupo,
  estadisticas,
  aceptadosCount,
  onChange
}: {
  vista: VistaViajes;
  grupo: GrupoMisViajes;
  estadisticas: { enCurso: number; proximos: number; porCerrar: number; disponibles: number; historial: number };
  aceptadosCount: number;
  onChange: (cambios: Partial<Record<"vista" | "grupo" | "fecha" | "estado", string>>) => void;
}) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Secciones de viajes">
        {VISTAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange({ vista: item.id, grupo: item.id === "mis-viajes" ? grupo : "", estado: "todos" })}
            aria-pressed={vista === item.id}
            className={[
              "min-h-14 rounded-xl border px-4 py-3 text-left font-body text-sm font-semibold transition",
              vista === item.id ? "border-route-action bg-route-soft text-route-action" : "border-border bg-surface text-secondary hover:border-route-action"
            ].join(" ")}
          >
            <span>{item.etiqueta}</span>
            <span className="mt-1 block font-body text-xs text-text-tertiary">
              {item.id === "disponibles" && `${estadisticas.disponibles} por aceptar`}
              {item.id === "mis-viajes" && `${aceptadosCount} en seguimiento`}
              {item.id === "historial" && `${estadisticas.historial} finalizado(s)`}
            </span>
          </button>
        ))}
      </div>

      {vista === "mis-viajes" && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Mis viajes">
          {GRUPOS_MIS_VIAJES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange({ vista: "mis-viajes", grupo: item.id, estado: "todos" })}
              aria-pressed={grupo === item.id}
              className={[
                "min-h-12 rounded-lg border px-3 py-2 text-left font-body text-sm font-semibold transition",
                grupo === item.id ? "border-success bg-control-soft text-success" : "border-border bg-surface-elevated text-secondary hover:border-success"
              ].join(" ")}
            >
              {item.etiqueta}
              <span className="ml-2 font-body text-xs text-text-tertiary">
                {item.id === "en-curso" && estadisticas.enCurso}
                {item.id === "proximos" && estadisticas.proximos}
                {item.id === "por-cerrar" && estadisticas.porCerrar}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
