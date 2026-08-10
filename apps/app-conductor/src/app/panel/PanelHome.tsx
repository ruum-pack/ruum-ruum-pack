"use client";

import Link from "next/link";
import type { Conductor } from "@ruum/shared/types";
import { AlertCard, Aviso, Button, OperationalCard, TripCard } from "@ruum/ui";
import { DriverAvailabilityControl } from "./DriverAvailabilityControl";
import type { Disponibilidad } from "./usePanelData";
import { fechaViaje, folioViaje, nombreVehiculo, type PasaporteRow } from "./panel-utils";

function rutaTraslado(viaje: PasaporteRow) {
  const origen = viaje.origen_ciudad || viaje.origen_direccion || "Origen por confirmar";
  const destino = viaje.destino_ciudad || viaje.destino_direccion || "Destino por confirmar";
  return `${origen} ➔ ${destino}`;
}

export function PanelHome({
  conductor,
  disponibilidad,
  persistiendoDisponibilidad,
  viajesDisponibles,
  proximoViaje,
  documentoBloqueante,
  errorDisponibilidad,
  onSeleccionarDisponibilidad
}: {
  conductor: Conductor | null;
  disponibilidad: Disponibilidad;
  persistiendoDisponibilidad: boolean;
  viajesDisponibles: PasaporteRow[];
  proximoViaje: PasaporteRow | null;
  documentoBloqueante: boolean;
  errorDisponibilidad: string | null;
  onSeleccionarDisponibilidad: (disponibilidad: Disponibilidad) => void;
}) {
  const disponibilidadApagada = disponibilidad === "no_disponible";
  const cantidadDisponibles = viajesDisponibles.length;
  const tieneDisponibles = cantidadDisponibles > 0;

  return (
    <div className="mt-6 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" aria-label="Inicio operativo">
      {/* 1. Fila Superior: Documento Bloqueante (Si aplica) */}
      {documentoBloqueante && (
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <AlertCard>
            <p className="font-body text-xs font-bold uppercase tracking-wider text-red-500">🚨 Atención documental requerida</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-text-primary">Tienes un documento pendiente de atención</h2>
                <p className="mt-1 font-body text-sm text-text-secondary">
                  Este pendiente bloquea la recepción de traslados. Atiéndelo antes de poder operar en la plataforma.
                </p>
              </div>
              <Link href="/cuenta/documentos" className="shrink-0">
                <Button variant="primary">Revisar documentos</Button>
              </Link>
            </div>
          </AlertCard>
        </div>
      )}

      {/* 2. Control de Disponibilidad Operativa (Fila Superior) */}
      <div className="col-span-1 md:col-span-2 lg:col-span-3">
        <OperationalCard padding="sm" className="border-route-action/35 bg-surface-elevated">
          <div className="grid gap-4">
            <DriverAvailabilityControl
              value={disponibilidad}
              saving={persistiendoDisponibilidad}
              onChange={onSeleccionarDisponibilidad}
            />

            {!disponibilidadApagada && (
              <div className="flex flex-col gap-2">
                {tieneDisponibles ? (
                  <Link href="/viajes?vista=disponibles" className="w-full">
                    <Button variant="primary" className="min-h-12 w-full text-base font-extrabold shadow-md bg-signal text-slate-950 hover:bg-signal-hover">
                      🚘 Ver traslados disponibles ({cantidadDisponibles})
                    </Button>
                  </Link>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⏳</span>
                      <div>
                        <p className="font-display text-xs font-bold text-text-primary">Sin traslados disponibles por ahora</p>
                        <p className="font-body text-[11px] text-text-tertiary">El botón se activará automáticamente cuando se publiquen nuevos viajes en tu área.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="min-h-10 w-full sm:w-auto px-4 rounded-xl border border-border bg-surface text-text-tertiary text-xs font-bold cursor-not-allowed opacity-70"
                    >
                      Ver traslados disponibles (0)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {errorDisponibilidad && (
            <div className="mt-4">
              <Aviso tono="danger">{errorDisponibilidad}</Aviso>
            </div>
          )}
        </OperationalCard>
      </div>

      {/* 3. Banner para Activar Disponibilidad cuando está Apagada */}
      {disponibilidadApagada && !documentoBloqueante && (
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <OperationalCard className="border-signal/40 bg-surface-elevated" padding="lg">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="font-body text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <span>💡</span> Modo No Disponible
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold text-text-primary">Activa tu disponibilidad para recibir traslados</h2>
                <p className="mt-1 max-w-2xl font-body text-sm leading-6 text-text-tertiary">
                  Al activarte en línea, la plataforma te notificará sobre viajes disponibles cercanos a tu ubicación.
                </p>
              </div>
              <Button
                variant="primary"
                loading={persistiendoDisponibilidad}
                onClick={() => onSeleccionarDisponibilidad("disponible")}
                className="min-h-12 w-full text-sm font-bold lg:w-auto bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              >
                🟢 Activar disponibilidad
              </Button>
            </div>
          </OperationalCard>
        </div>
      )}

      {/* 4. Tarjeta: Próximo Traslado (Columna 1-2 en Escritorio) */}
      <div className="col-span-1 md:col-span-1 lg:col-span-2 flex flex-col">
        <TripCard folio={proximoViaje ? folioViaje(proximoViaje) : undefined} padding="sm" className="flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
                <span>📅</span> Próximo Traslado Programado
              </p>
              {proximoViaje && (
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 font-body text-[11px] font-bold text-emerald-500">
                  Confirmado
                </span>
              )}
            </div>

            {proximoViaje ? (
              <div className="mt-4 grid gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-text-primary sm:text-xl">{nombreVehiculo(proximoViaje)}</h2>
                  <p className="mt-1 font-body text-xs font-semibold text-text-tertiary flex items-center gap-1">
                    <span>🗓️</span> {fechaViaje(proximoViaje)}
                  </p>
                  <p className="mt-2 font-body text-xs text-text-primary font-semibold flex items-center gap-1">
                    <span>📍</span> {rutaTraslado(proximoViaje)}
                  </p>
                </div>
              </div>
            ) : (
              /* Empty State Cálido para Próximo Traslado con CTA Sutil */
              <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-surface-elevated/30 p-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-surface-elevated font-display text-xl text-text-tertiary shadow-2xs">
                  ✨
                </div>
                <h3 className="mt-3 font-display text-base font-bold text-text-primary">¡Todo listo y al día!</h3>
                <p className="mt-1 max-w-sm font-body text-xs leading-5 text-text-tertiary">
                  No tienes traslados aceptados próximos en este momento. Explora las oportunidades disponibles para agendar tu siguiente servicio.
                </p>
                <Link href="/viajes?vista=disponibles" className="mt-4">
                  <Button variant="secondary" className="text-xs">
                    🚘 Explorar catálogo de traslados
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {proximoViaje && (
            <div className="mt-4 pt-3 border-t border-border/40">
              <Link href={`/viajes/${proximoViaje.traslado_id}`}>
                <Button variant="secondary" className="w-full">Ver detalle del traslado</Button>
              </Link>
            </div>
          )}
        </TripCard>
      </div>

      {/* 5. Tarjeta: Oportunidades Cercanas (Columna 3 en Escritorio) */}
      {!documentoBloqueante && (
        <div className="col-span-1 md:col-span-1 lg:col-span-1 flex flex-col">
          <TripCard padding="sm" className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
                  <span>🗺️</span> Oportunidades Cercanas
                </p>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-body text-[11px] font-bold text-amber-500">
                  {cantidadDisponibles} activas
                </span>
              </div>

              <div className="mt-4 grid gap-2.5">
                {viajesDisponibles.slice(0, 3).map((viaje) => (
                  <Link
                    key={viaje.traslado_id}
                    href="/viajes?vista=disponibles"
                    className="grid gap-1 rounded-xl border border-border bg-surface-elevated/40 p-3 transition hover:border-signal hover:bg-signal/5 active:scale-[0.99]"
                  >
                    <p className="font-display text-xs font-bold text-text-primary truncate">{rutaTraslado(viaje)}</p>
                    <p className="font-body text-[11px] text-text-tertiary truncate">
                      {nombreVehiculo(viaje)} • Folio {folioViaje(viaje)}
                    </p>
                  </Link>
                ))}

                {/* Empty State Cálido para Oportunidades Cercanas con CTA Sutil */}
                {cantidadDisponibles === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-surface-elevated/30 p-5 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-surface-elevated text-lg text-text-tertiary shadow-2xs">
                      📍
                    </div>
                    <h3 className="mt-2 font-display text-xs font-bold text-text-primary">Sin traslados en tu área por ahora</h3>
                    <p className="mt-1 font-body text-[11px] text-text-tertiary leading-4">
                      Las nuevas solicitudes se publicarán aquí en tiempo real.
                    </p>
                    <Link href="/viajes?vista=disponibles" className="mt-3">
                      <span className="inline-flex items-center gap-1 font-display text-[11px] font-bold text-route-action hover:underline">
                        🗺️ Ver mapa de traslados →
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {tieneDisponibles && (
              <div className="mt-4 pt-3 border-t border-border/40">
                <Link href="/viajes?vista=disponibles">
                  <span className="inline-flex w-full items-center justify-center font-display text-xs font-bold text-route-action hover:underline">
                    Ver todas las oportunidades ({cantidadDisponibles}) →
                  </span>
                </Link>
              </div>
            )}
          </TripCard>
        </div>
      )}

      {/* 6. Tarjeta: Resumen de Ganancias y Pagos (Fila Inferior Completa) */}
      <div className="col-span-1 md:col-span-2 lg:col-span-3">
        <details className="group overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-2xs">
          <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-display text-xs font-bold uppercase tracking-wider text-text-primary hover:bg-surface-elevated [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <span className="text-base">💵</span> Resumen de Ganancias y Depósitos
            </span>
            <span className="font-display text-lg leading-none text-text-tertiary transition-transform group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <div className="border-t border-border/40 px-5 pb-5 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-sm font-semibold text-text-primary">Historial de Ganancias Operativas</p>
                <p className="mt-0.5 font-body text-xs text-text-tertiary">
                  Consulta el desglose detallado de importes ganados por traslado y tus depósitos semanales en cuenta CLABE.
                </p>
              </div>
              <Link href="/ganancias" className="shrink-0">
                <Button variant="secondary" className="text-xs">
                  💵 Abrir módulo de ganancias
                </Button>
              </Link>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
