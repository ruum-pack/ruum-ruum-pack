import Link from "next/link";
import { Card } from "@ruum/ui";
import {
  claveDia,
  detalleFallback,
  formatearDiaCalendario,
  formatearHora,
  nombreVehiculo,
  ZONA_HORARIA_VIAJE,
  type DetalleOperativo,
  type DiaCalendario,
  type PasaporteRow
} from "./trips-utils";
import { WeekDaySelector } from "./WeekDaySelector";

export function TripsCalendar({
  calendario,
  diaSeleccionado,
  diaHoy,
  estadisticas,
  detalles,
  hrefDetalle,
  onSelectDay
}: {
  calendario: DiaCalendario[];
  diaSeleccionado: string;
  diaHoy: string;
  estadisticas: { enCurso: number; proximos: number; porCerrar: number; disponibles: number };
  detalles: Record<string, DetalleOperativo>;
  hrefDetalle: (viaje: PasaporteRow) => string;
  onSelectDay: (clave: string) => void;
}) {
  const diaCalendarioSeleccionado = calendario.find(({ dia }) => claveDia(dia) === diaSeleccionado) ?? calendario[0];

  return (
    <section className="mt-6">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Calendario semanal</p>
            <h2 className="mt-1 font-display text-xl font-semibold">Semana actual · inicia en domingo</h2>
          </div>
          <p className="font-body text-xs leading-5 text-text-tertiary">Horario del viaje: {ZONA_HORARIA_VIAJE}</p>
        </div>

        <div className="mt-5 sm:hidden">
          <WeekDaySelector dias={calendario} seleccionado={diaSeleccionado} hoy={diaHoy} onSelect={onSelectDay} />
          {diaCalendarioSeleccionado && (
            <div className="mt-4 rounded-xl border border-border bg-surface-elevated px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-body text-sm font-bold capitalize">{formatearDiaCalendario(diaCalendarioSeleccionado.dia)}</p>
                  <p className="mt-1 font-body text-sm text-text-secondary">{diaCalendarioSeleccionado.viajes.length} viaje(s) programado(s)</p>
                </div>
                {claveDia(diaCalendarioSeleccionado.dia) === diaHoy && (
                  <span className="rounded-full border border-route-action bg-route-soft px-2.5 py-1 font-body text-xs font-bold text-route-action">
                    Hoy
                  </span>
                )}
              </div>
              <div className="mt-4 grid gap-2">
                {diaCalendarioSeleccionado.viajes.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-3 font-body text-sm text-text-tertiary">
                    No hay viajes para este día.
                  </p>
                ) : (
                  diaCalendarioSeleccionado.viajes.map(({ viaje, tipo }) => {
                    const trasladoId = viaje.traslado_id;
                    const detalle = (trasladoId ? detalles[trasladoId] : null) ?? detalleFallback(viaje);
                    if (!trasladoId) {
                      return (
                        <div
                          key={`${tipo}-sin-id-${detalle.fechaHora}`}
                          className="rounded-lg border border-border bg-surface px-3 py-3 font-body text-sm"
                        >
                          <span className="block font-semibold">{tipo}: {nombreVehiculo(viaje)}</span>
                          <span className="mt-1 block text-text-secondary">{formatearHora(detalle.fechaHora)} · {detalle.origen}</span>
                        </div>
                      );
                    }
                    return (
                      <Link
                        key={`${tipo}-${trasladoId}`}
                        href={hrefDetalle(viaje)}
                        className="rounded-lg border border-border bg-surface px-3 py-3 font-body text-sm hover:border-route-action hover:bg-route-soft"
                      >
                        <span className="block font-semibold">{tipo}: {nombreVehiculo(viaje)}</span>
                        <span className="mt-1 block text-text-secondary">{formatearHora(detalle.fechaHora)} · {detalle.origen}</span>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          )}
          <details className="mt-3 rounded-xl border border-border bg-surface">
            <summary className="cursor-pointer px-4 py-3 font-body text-sm font-bold text-route-action">
              Ver semana
            </summary>
            <div className="grid gap-2 border-t border-border px-4 py-3">
              {calendario.map(({ dia, viajes }) => (
                <button
                  key={claveDia(dia)}
                  type="button"
                  onClick={() => onSelectDay(claveDia(dia))}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left font-body text-sm"
                >
                  <span className="font-semibold capitalize">{formatearDiaCalendario(dia)}</span>
                  <span className="font-body text-xs font-semibold text-text-secondary">{viajes.length} viaje(s)</span>
                </button>
              ))}
            </div>
          </details>
        </div>

        <div className="mt-5 hidden gap-2 sm:grid sm:grid-cols-7">
          {calendario.map(({ dia, viajes }) => (
            <div
              key={claveDia(dia)}
              className={[
                "rounded-lg border px-3 py-3 sm:min-h-28",
                viajes.length > 0 ? "border-signal/50 bg-signal-soft/50" : "border-border bg-surface"
              ].join(" ")}
            >
              <p className="text-center font-body text-sm font-semibold capitalize sm:text-left sm:text-xs">
                {formatearDiaCalendario(dia)}
              </p>
              <p className="mt-1 text-center font-body text-xs text-text-tertiary sm:text-left">{viajes.length} viaje(s)</p>
              <div className="mt-3 hidden gap-1 sm:grid">
                {viajes.slice(0, 2).map(({ viaje, tipo }, index) => {
                  const trasladoId = viaje.traslado_id ?? `${claveDia(dia)}-${index}`;
                  return (
                    <span key={`${tipo}-${trasladoId}`} className="truncate rounded bg-surface px-2 py-1 font-body text-xs text-text-secondary">
                      {tipo}: {nombreVehiculo(viaje)}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <details className="mt-4 rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer px-4 py-3 font-body text-sm font-semibold text-text-secondary">
          Ver estadísticas completas
        </summary>
        <div className="grid gap-3 border-t border-border px-4 py-4 sm:grid-cols-4">
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">En curso</p>
            <p className="mt-1 font-display text-2xl font-semibold">{estadisticas.enCurso}</p>
            <p className="font-body text-xs text-text-tertiary">operando</p>
          </div>
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Próximos</p>
            <p className="mt-1 font-display text-2xl font-semibold">{estadisticas.proximos}</p>
            <p className="font-body text-xs text-text-tertiary">programados</p>
          </div>
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Por cerrar</p>
            <p className="mt-1 font-display text-2xl font-semibold">{estadisticas.porCerrar}</p>
            <p className="font-body text-xs text-text-tertiary">requieren cierre</p>
          </div>
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Disponibles</p>
            <p className="mt-1 font-display text-2xl font-semibold">{estadisticas.disponibles}</p>
            <p className="font-body text-xs text-text-tertiary">por aceptar</p>
          </div>
        </div>
      </details>
    </section>
  );
}
