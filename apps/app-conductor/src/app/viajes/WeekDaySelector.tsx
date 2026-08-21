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

          const ofertasCount = viajes.filter((v) => v.tipo === "Ofertado").length;
          return (
            <button
              key={clave}
              type="button"
              aria-current={activo ? "date" : undefined}
              aria-label={`${nombreDia} ${numeroDia} · ${viajes.length} traslados${ofertasCount ? `, ${ofertasCount} ofertas` : ""}${clave === hoy ? ", hoy" : ""}`}
              onClick={() => onSelect(clave)}
              className="flex flex-col items-center gap-1 rounded-lg py-1 transition-all duration-200 select-none cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action min-w-[44px]"
            >
              <span className={`font-body text-[10px] font-bold uppercase tracking-wider ${activo ? "text-route-action" : "text-text-tertiary"}`}>
                {nombreDia}
              </span>

              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all relative border ${
                activo
                  ? "bg-signal text-slate-950 border-signal shadow-md shadow-signal/20 scale-105"
                  : "bg-surface-elevated hover:bg-surface text-text-primary border-border/20"
              }`}>
                {numeroDia}
                {tieneViajes && !activo && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-route-action text-white text-[10px] font-black flex items-center justify-center border-2 border-surface shadow-xs tabular-nums" aria-hidden>
                    {viajes.length > 9 ? "9+" : viajes.length}
                  </span>
                )}
                {tieneViajes && activo && viajes.length > 1 && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-slate-950" aria-hidden />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
