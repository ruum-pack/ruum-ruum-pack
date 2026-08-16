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
              className="flex flex-col items-center gap-2 rounded-xl py-2 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00B4D8] focus-visible:rounded-xl"
            >
              <span className={`font-body text-[10px] font-bold uppercase tracking-[0.08em] ${
                activo ? "text-[#00B4D8]" : "text-text-tertiary"
              }`}>
                {nombreDia}
              </span>

              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                activo
                  ? "bg-[#00B4D8] text-white shadow-sm"
                  : "bg-surface text-text-primary hover:bg-surface-elevated"
              }`}>
                {numeroDia}
              </div>

              <div className="flex h-2.5 items-center justify-center">
                {tieneViajes && !activo && <span className="h-2 w-2 rounded-full bg-[#00B4D8]" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
