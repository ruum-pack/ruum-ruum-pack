"use client";

import Link from "next/link";
import { Aviso, Button, DriverEarning, TripCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import { esElegibleParaViaje } from "@ruum/shared/rules";
import type { Conductor } from "@ruum/shared/types";
import type { Coordenadas } from "../../lib/ubicacion";
import {
  detalleFallback,
  distanciaKmEntre,
  formatearDistanciaAproximadaAlOrigen,
  formatearDistancia,
  formatearDuracion,
  formatearFecha,
  formatearHora,
  nombreVehiculo,
  type DetalleOperativo,
  type PasaporteRow
} from "./trips-utils";

export function TripOpportunityList({
  viajes,
  detalles,
  conductor,
  aceptando,
  rechazoPendiente,
  coordenadas,
  hrefDetalle,
  onAccept
}: {
  viajes: PasaporteRow[];
  detalles: Record<string, DetalleOperativo>;
  conductor: Conductor | null;
  aceptando: string | null;
  rechazoPendiente: boolean;
  coordenadas: Coordenadas | null;
  hrefDetalle: (viaje: PasaporteRow) => string;
  onAccept: (trasladoId: string) => void;
}) {
  return (
    <>
      {viajes.map((viaje) => {
        const detalle = detalles[viaje.traslado_id] ?? detalleFallback(viaje);
        const elegibilidad = viaje.vehiculo_tipo
          ? conductor
            ? esElegibleParaViaje(conductor, viaje.vehiculo_tipo, "intraurbana")
            : { elegible: false, motivo: "Inicia sesión como conductor para validar elegibilidad." }
          : { elegible: Boolean(conductor), motivo: "Inicia sesión como conductor para aceptar viajes." };
        const requisitoExcepcional = detalle.requisitos && detalle.requisitos !== "Sin requisitos especiales." ? detalle.requisitos : null;
        const hayGanancia = detalle.gananciaConductorOficial != null;
        const etiquetaGanancia = hayGanancia
          ? detalle.estadoEconomico === "estimado" ? "Ganancia estimada" : "Ganancia confirmada"
          : "Ganancia por confirmar";
        const distanciaAlOrigenKm = coordenadas
          ? distanciaKmEntre(coordenadas, { lat: viaje.origen_lat, lng: viaje.origen_lng })
          : null;

        return (
          <TripCard key={viaje.traslado_id} folio={viaje.traslado_id.slice(0, 8).toUpperCase()}>
            <article className="grid gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Oportunidad disponible</p>
                  <h2 className="mt-1 truncate font-display text-xl font-semibold">
                    {formatearFecha(detalle.fechaHora)} · {formatearHora(detalle.fechaHora)}
                  </h2>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <p className="font-body text-sm font-semibold text-text-tertiary">Origen</p>
                      <p className="truncate font-body text-base font-semibold text-text-primary">{detalle.origen}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-body text-sm font-semibold text-text-tertiary">Destino</p>
                      <p className="truncate font-body text-base font-semibold text-text-primary">{detalle.destino}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-success bg-control-soft px-4 py-3 shadow-1 sm:min-w-56">
                  <p className="font-body text-xs uppercase tracking-wide text-success">{etiquetaGanancia}</p>
                  <DriverEarning
                    amount={detalle.gananciaConductorOficial}
                    status={detalle.estadoEconomico === "confirmado" ? "confirmado" : detalle.estadoEconomico === "estimado" ? "estimado" : "sin_calcular"}
                    currency="MXN"
                    amountClassName="font-display text-xl font-bold text-success"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2">
                  <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Distancia aproximada al origen</p>
                  <p className="font-body text-sm font-semibold">
                    {formatearDistanciaAproximadaAlOrigen(distanciaAlOrigenKm)}
                  </p>
                  <p className="font-body text-xs text-text-tertiary">
                    {distanciaAlOrigenKm != null ? "Distancia en línea recta, no ETA vial." : "Distancia a recolección"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2">
                  <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Distancia del traslado</p>
                  <p className="font-body text-sm font-semibold">{formatearDistancia(detalle.distanciaKm)}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2">
                  <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Duración estimada del traslado</p>
                  <p className="font-body text-sm font-semibold">{formatearDuracion(detalle.tiempoEstimadoHoras)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:min-w-56">
                  <Link
                    href={hrefDetalle(viaje)}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-3 py-2 text-center font-body text-sm font-semibold text-text-secondary hover:border-route-action hover:bg-route-soft hover:text-route-action"
                  >
                    Ver detalles
                  </Link>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => onAccept(viaje.traslado_id)}
                    disabled={!elegibilidad.elegible || aceptando === viaje.traslado_id || rechazoPendiente}
                  >
                    {aceptando === viaje.traslado_id ? "Aceptando..." : "Aceptar"}
                  </Button>
                </div>
              </div>

              {requisitoExcepcional && (
                <div className="rounded-lg border border-warning bg-warn-soft px-3 py-2 font-body text-sm font-semibold text-warning">
                  Requisito excepcional: {requisitoExcepcional}
                </div>
              )}

              {!elegibilidad.elegible && (
                <Aviso tono="atencion">No elegible: {elegibilidad.motivo}</Aviso>
              )}

              <details className="group rounded-lg border border-border bg-surface-elevated">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 font-body text-sm font-semibold text-text-secondary hover:text-route-action [&::-webkit-details-marker]:hidden">
                  Información de la oportunidad
                  <span className="font-display text-lg leading-none transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <div className="grid gap-4 border-t border-border px-3 py-3 font-body text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-tertiary">Vehículo</p>
                    <p className="mt-1 font-semibold">{nombreVehiculo(viaje)}</p>
                    <p className="text-text-secondary">{viaje.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[viaje.vehiculo_tipo] : "Tipo por definir"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-tertiary">Contactos</p>
                    <p className="mt-1 font-semibold">{viaje.contacto_entrega_nombre ?? "Contacto de origen por confirmar"}</p>
                    <p className="text-text-secondary">{viaje.contacto_recepcion_nombre ?? "Contacto de destino por confirmar"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-tertiary">Condiciones</p>
                    <p className="mt-1 font-semibold">{detalle.tipoServicio}</p>
                    <p className="text-text-secondary">Distancia oficial: {formatearDistancia(detalle.distanciaKm)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-tertiary">Requisitos</p>
                    <p className="mt-1 font-semibold">{detalle.requisitos}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-text-tertiary">Política de cancelación</p>
                    <p className="mt-1 text-text-secondary">
                      Al aceptar, el viaje queda en tus próximos traslados. Si necesitas cancelar después, operación revisará el motivo y puede afectar tu disponibilidad.
                    </p>
                  </div>
                </div>
              </details>
            </article>
          </TripCard>
        );
      })}
    </>
  );
}
