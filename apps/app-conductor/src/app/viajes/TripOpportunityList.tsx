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
        if (!viaje.traslado_id) return null;

        const trasladoId = viaje.traslado_id;
        const detalle = detalles[trasladoId] ?? detalleFallback(viaje);
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
          <TripCard key={trasladoId} folio={trasladoId.slice(0, 8).toUpperCase()}>
            <article className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
                <div className="min-w-0 rounded-xl border border-[rgba(77,163,255,0.24)] bg-[#101A2C] px-4 py-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-body text-xs uppercase tracking-wide text-[#8EC5FF]">Oportunidad disponible</p>
                    <p className="font-body text-sm font-semibold text-[#B7C2D4]">
                      {formatearFecha(detalle.fechaHora)} · {formatearHora(detalle.fechaHora)}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="min-w-0 border-l-2 border-[#4DA3FF] pl-3">
                      <p className="font-body text-xs uppercase tracking-wide text-[#B7C2D4]">Origen</p>
                      <p className="mt-1 line-clamp-2 font-display text-xl font-semibold leading-6 text-[#E8EDF6]">{detalle.origen}</p>
                    </div>
                    <div className="min-w-0 border-l-2 border-[#F5A623] pl-3">
                      <p className="font-body text-xs uppercase tracking-wide text-[#B7C2D4]">Destino</p>
                      <p className="mt-1 line-clamp-2 font-display text-xl font-semibold leading-6 text-[#E8EDF6]">{detalle.destino}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-[rgba(61,220,151,0.36)] bg-[rgba(61,220,151,0.10)] px-4 py-4 shadow-1 lg:min-w-60">
                  <p className="font-body text-xs uppercase tracking-wide text-[#65E3AD]">{etiquetaGanancia}</p>
                  <DriverEarning
                    amount={detalle.gananciaConductorOficial}
                    status={detalle.estadoEconomico === "confirmado" ? "confirmado" : detalle.estadoEconomico === "estimado" ? "estimado" : "sin_calcular"}
                    currency="MXN"
                    amountClassName="font-display text-2xl font-bold text-[#E8EDF6]"
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
                    onClick={() => onAccept(trasladoId)}
                    disabled={!elegibilidad.elegible || aceptando === trasladoId || rechazoPendiente}
                  >
                    {aceptando === trasladoId ? "Aceptando..." : "Aceptar"}
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
