import { claveDia, formatearDiaSelector, type DiaCalendario } from "./trips-utils";

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
    <div className="sm:hidden">
      <div className="-mx-4 overflow-x-auto px-4 pb-2" aria-label="Días de la semana">
        <div className="flex min-w-max gap-2">
          {dias.map(({ dia, viajes }) => {
            const clave = claveDia(dia);
            const activo = clave === seleccionado;
            const esHoy = clave === hoy;
            return (
              <button
                key={clave}
                type="button"
                aria-current={activo ? "date" : undefined}
                onClick={() => onSelect(clave)}
                className={[
                  "min-h-28 w-32 rounded-xl border px-3 py-3 text-left transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action",
                  activo ? "border-route-action bg-route-soft shadow-[inset_0_0_0_2px_rgba(31,91,72,0.22)]" : "border-border bg-surface"
                ].join(" ")}
              >
                <span className="block font-body text-sm font-bold capitalize text-text-primary">
                  {esHoy ? "Hoy" : formatearDiaSelector(dia)}
                </span>
                <span className="mt-1 block font-body text-sm text-text-secondary">{viajes.length} viaje(s)</span>
                <span className="mt-3 block min-h-5 font-body text-xs font-semibold text-route-action">
                  {activo ? "Seleccionado" : esHoy ? "Día actual" : "Ver día"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
