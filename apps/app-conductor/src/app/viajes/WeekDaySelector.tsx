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
          
          // Day name in uppercase, cleaning dot abbreviations
          let nombreDia = new Intl.DateTimeFormat("es-MX", { weekday: "short", timeZone: "America/Mexico_City" })
            .format(dia)
            .replace(".", "")
            .slice(0, 2)
            .toUpperCase();
            
          if (nombreDia === "SA") nombreDia = "SÁ";

          const numeroDia = dia.getDate();
          const tieneViajes = viajes.length > 0;

          return (
            <button
              key={clave}
              type="button"
              aria-current={activo ? "date" : undefined}
              onClick={() => onSelect(clave)}
              className="flex flex-col items-center gap-1.5 rounded-lg py-1 transition-all duration-200 select-none cursor-pointer"
            >
              <span className={`font-body text-[9px] font-black uppercase tracking-wider ${
                activo ? "text-[#00B4D8]" : "text-text-tertiary/80"
              }`}>
                {nombreDia}
              </span>

              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all relative ${
                activo
                  ? "bg-[#00B4D8] text-white shadow-md shadow-cyan-950/20 scale-105"
                  : "bg-[#0C1220] hover:bg-[#131B2C] text-white border border-border/10"
              }`}>
                {numeroDia}
                {tieneViajes && !activo && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#00B4D8]" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
