"use client";

import { claveDia, type DiaCalendario } from "./trips-utils";
import { WeekDaySelector } from "./WeekDaySelector";

interface ViajesDateNavigatorProps {
  calendario: DiaCalendario[];
  diaSeleccionado: string;
  diaHoy: string;
  onSelectDia: (clave: string) => void;
}

export function ViajesDateNavigator({
  calendario,
  diaSeleccionado,
  diaHoy,
  onSelectDia
}: ViajesDateNavigatorProps) {
  const diaCalendarioSeleccionado = calendario.find(({ dia }) => claveDia(dia) === diaSeleccionado) ?? calendario[0];

  const handlePrevDay = () => {
    const idx = calendario.findIndex((c) => claveDia(c.dia) === diaSeleccionado);
    if (idx > 0) onSelectDia(claveDia(calendario[idx - 1].dia));
  };

  const handleNextDay = () => {
    const idx = calendario.findIndex((c) => claveDia(c.dia) === diaSeleccionado);
    if (idx >= 0 && idx < calendario.length - 1) onSelectDia(claveDia(calendario[idx + 1].dia));
  };

  return (
    <div className="flex flex-col gap-2 mt-4">
      {/* Selector Semanal de 7 Días */}
      <WeekDaySelector
        dias={calendario}
        seleccionado={diaSeleccionado}
        hoy={diaHoy}
        onSelect={onSelectDia}
      />

      {/* Barra de Día Actual con Flechas de Navegación Accesibles */}
      <div className="flex items-center justify-between bg-surface-elevated border border-border/20 rounded-xl px-2 py-1 select-none">
        <button
          type="button"
          onClick={handlePrevDay}
          aria-label="Día anterior"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer active:scale-95 transition-all rounded-lg hover:bg-surface"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-display text-xs font-black uppercase tracking-wider text-text-primary">
            {diaCalendarioSeleccionado
              ? new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Mexico_City" }).format(diaCalendarioSeleccionado.dia).replace(".", "").toUpperCase()
              : "HOY"}
          </span>
          {claveDia(diaCalendarioSeleccionado?.dia ?? new Date()) === diaHoy && (
            <span className="bg-route-action/20 text-route-action border border-route-action/30 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase">
              Hoy
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleNextDay}
          aria-label="Día siguiente"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer active:scale-95 transition-all rounded-lg hover:bg-surface"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
