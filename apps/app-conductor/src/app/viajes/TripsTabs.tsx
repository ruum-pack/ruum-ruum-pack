"use client";

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
        {VISTAS.map((item) => {
          const isActive = vista === item.id;
          const countText =
            item.id === "disponibles"
              ? `${estadisticas.disponibles} por aceptar`
              : item.id === "mis-viajes"
                ? `${aceptadosCount} en seguimiento`
                : `${estadisticas.historial} finalizados`;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange({ vista: item.id, grupo: item.id === "mis-viajes" ? grupo : "", estado: "todos" })}
              aria-pressed={isActive}
              className={[
                "min-h-14 rounded-2xl border px-4 py-3 text-left font-display transition-all duration-150 flex flex-col justify-between",
                isActive
                  ? "border-signal bg-signal/15 text-text-primary shadow-xs"
                  : "border-border/60 bg-surface text-text-tertiary hover:border-signal/50 hover:text-text-primary"
              ].join(" ")}
            >
              <span className="text-sm font-bold text-text-primary">{item.etiqueta}</span>
              <div className="mt-2 flex items-center justify-between">
                {/* Badge de Conteo de Alto Contraste y Fácil Lectura */}
                <span
                  className={[
                    "inline-flex items-center rounded-full px-2.5 py-0.5 font-display text-xs font-bold transition",
                    isActive
                      ? "bg-signal text-slate-950 font-extrabold shadow-2xs"
                      : "bg-surface-elevated text-text-primary border border-border/60"
                  ].join(" ")}
                >
                  {countText}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {vista === "mis-viajes" && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Mis viajes">
          {GRUPOS_MIS_VIAJES.map((item) => {
            const isActive = grupo === item.id;
            const count =
              item.id === "en-curso"
                ? estadisticas.enCurso
                : item.id === "proximos"
                  ? estadisticas.proximos
                  : estadisticas.porCerrar;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange({ vista: "mis-viajes", grupo: item.id, estado: "todos" })}
                aria-pressed={isActive}
                className={[
                  "min-h-12 rounded-xl border px-3 py-2 text-left font-display text-xs font-bold transition flex items-center justify-between",
                  isActive
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                    : "border-border/60 bg-surface-elevated text-text-tertiary hover:border-emerald-500/40 hover:text-text-primary"
                ].join(" ")}
              >
                <span>{item.etiqueta}</span>
                <span
                  className={[
                    "inline-flex size-5 items-center justify-center rounded-full text-[11px] font-extrabold",
                    isActive ? "bg-emerald-500 text-slate-950" : "bg-surface text-text-tertiary border border-border/40"
                  ].join(" ")}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
