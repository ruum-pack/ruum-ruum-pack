"use client";

import { claveDia, type DiaCalendario } from "./trips-utils";

export function WeekDaySelector({
  dias,
  seleccionado,
  hoy,
  onSelect
}: {
  dias: DiaCalendario[];
  seleccionado: string;
  hoy: string;
  onSelect: (clave: string) => void;
}) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-1" aria-label="Días de la semana">
        {dias.map(({ dia, viajes }) => {
          const clave = claveDia(dia);
          const activo = clave === seleccionado;
          
          // Day name: Mi, Ju, Vi, Sá, Do, Lu, Ma
          const nombreDia = new Intl.DateTimeFormat("es-MX", { weekday: "short", timeZone: "America/Mexico_City" })
            .format(dia)
            .slice(0, 2)
            .replace(/^\w/, (c) => c.toUpperCase());
            
          const numeroDia = dia.getDate();
          const tieneViajes = viajes.length > 0;

          return (
            <button
              key={clave}
              type="button"
              aria-current={activo ? "date" : undefined}
              onClick={() => onSelect(clave)}
              className="flex flex-col items-center gap-2 py-2 group cursor-pointer focus:outline-hidden"
            >
              {/* Day name (e.g. Mi, Ju) */}
              <span className="font-body text-xs font-semibold text-text-tertiary">
                {nombreDia}
              </span>
              
              {/* Day number (e.g. 23) in a circle if active */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-display text-sm font-bold transition-all ${
                activo 
                  ? "bg-[#00B4D8] text-white shadow-xs scale-105" 
                  : "text-text-primary hover:bg-surface-elevated"
              }`}>
                {numeroDia}
              </div>
              
              {/* Indicator dot below */}
              <div className="h-1.5 w-1.5 flex items-center justify-center">
                {tieneViajes && !activo && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00B4D8]" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
