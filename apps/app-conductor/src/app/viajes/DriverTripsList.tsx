"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, DriverEarning, EstadoBadge, TripCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO, GLOSARIO_OPERATIVO } from "@ruum/shared/constants";
import { getTripPresentation } from "../../lib/trip-presentation";
import { ESTADOS_QUE_REQUIEREN_EVIDENCIA } from "./[id]/AccionesViaje";
import {
  detalleFallback,
  formatearFecha,
  formatearHora,
  nombreVehiculo,
  type DetalleOperativo,
  type EstadoTraslado,
  type PasaporteRow
} from "./trips-utils";

function OperationalTripCard({
  viaje,
  detalles,
  hrefDetalle,
  mode
}: {
  viaje: PasaporteRow;
  detalles: Record<string, DetalleOperativo>;
  hrefDetalle: (viaje: PasaporteRow) => string;
  mode: "active" | "history";
}) {
  const router = useRouter();
  const detalle = detalles[viaje.traslado_id] ?? detalleFallback(viaje);
  const estadoActual = viaje.estado as EstadoTraslado;
  const requiereEvidencia = ESTADOS_QUE_REQUIEREN_EVIDENCIA.includes(estadoActual);
  const presentation = getTripPresentation(estadoActual);
  const etiquetaSiguientePaso = presentation.primaryAction.label;

  return (
    <TripCard folio={viaje.traslado_id.slice(0, 8).toUpperCase()}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">
            {mode === "active" ? "Viaje en seguimiento" : "Viaje finalizado"}
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold">
            {nombreVehiculo(viaje)}
            {viaje.vehiculo_tipo && (
              <span className="ml-2 font-body text-xs font-normal text-text-tertiary">
                · {ETIQUETA_TIPO_VEHICULO[viaje.vehiculo_tipo]}
              </span>
            )}
          </h2>
        </div>
        <EstadoBadge estado={viaje.estado} />
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-body text-sm font-semibold text-text-tertiary">Origen</dt>
          <dd className="mt-1 font-body text-base font-medium">{detalle.origen}</dd>
        </div>
        <div>
          <dt className="font-body text-sm font-semibold text-text-tertiary">Destino</dt>
          <dd className="mt-1 font-body text-base font-medium">{detalle.destino}</dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Fecha y hora</dt>
          <dd className="mt-1 font-body text-sm font-medium">
            {formatearFecha(detalle.fechaHora)} · {formatearHora(detalle.fechaHora)}
          </dd>
        </div>
        {mode === "active" && (
          <div>
            <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Monto conductor</dt>
            <dd className="mt-1">
              <DriverEarning
                amount={detalle.gananciaConductorOficial}
                status={detalle.estadoEconomico}
                currency="MXN"
                amountClassName="text-sm"
              />
            </dd>
          </div>
        )}
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Tipo de vehículo</dt>
          <dd className="mt-1 font-body text-sm font-medium">
            {viaje.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[viaje.vehiculo_tipo] : "Por definir"}
          </dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Tipo de servicio</dt>
          <dd className="mt-1 font-body text-sm font-medium">{detalle.tipoServicio}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Requisitos especiales</dt>
          <dd className="mt-1 font-body text-sm font-medium">{detalle.requisitos}</dd>
        </div>
      </dl>

      <div className="mt-5">
        {mode === "active" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-end">
            <div className="grid w-full gap-3 sm:max-w-xs">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => router.push(hrefDetalle(viaje))}
              >
                {etiquetaSiguientePaso}
              </Button>
              {requiereEvidencia && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => router.push(`/viajes/${viaje.traslado_id}/evidencia`)}
                >
                  Cargar registro del vehículo
                </Button>
              )}
            </div>
            <details className="relative self-end">
              <summary
                aria-label="Más acciones del viaje"
                className="flex size-11 cursor-pointer list-none items-center justify-center rounded-xl border border-border bg-surface font-display text-xl font-bold leading-none text-text-secondary shadow-sm transition hover:border-route-action hover:bg-route-soft hover:text-route-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action [&::-webkit-details-marker]:hidden"
              >
                ⋮
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-[0_14px_40px_rgba(26,31,46,0.16)]">
                <Link href={hrefDetalle(viaje)} className="block px-4 py-2.5 font-body text-sm font-medium text-text-secondary hover:bg-route-soft hover:text-route-action">
                  Ver detalles
                </Link>
                <Link href={hrefDetalle(viaje)} className="block px-4 py-2.5 font-body text-sm font-medium text-text-secondary hover:bg-route-soft hover:text-route-action">
                  {GLOSARIO_OPERATIVO.incidencia}
                </Link>
                <Link href={hrefDetalle(viaje)} className="block px-4 py-2.5 font-body text-sm font-medium text-text-secondary hover:bg-route-soft hover:text-route-action">
                  Confirmar entrega
                </Link>
              </div>
            </details>
          </div>
        ) : (
          <div className="flex justify-end">
            <Link href={hrefDetalle(viaje)} className="font-body text-sm font-medium text-text-secondary hover:text-text-primary">
              Ver viaje finalizado
            </Link>
          </div>
        )}
      </div>
    </TripCard>
  );
}

export function DriverTripsList({
  viajes,
  detalles,
  hrefDetalle
}: {
  viajes: PasaporteRow[];
  detalles: Record<string, DetalleOperativo>;
  hrefDetalle: (viaje: PasaporteRow) => string;
}) {
  return (
    <>
      {viajes.map((viaje) => (
        <OperationalTripCard key={viaje.traslado_id} viaje={viaje} detalles={detalles} hrefDetalle={hrefDetalle} mode="active" />
      ))}
    </>
  );
}

export function TripHistoryList({
  viajes,
  detalles,
  hrefDetalle
}: {
  viajes: PasaporteRow[];
  detalles: Record<string, DetalleOperativo>;
  hrefDetalle: (viaje: PasaporteRow) => string;
}) {
  return (
    <>
      {viajes.map((viaje) => (
        <OperationalTripCard key={viaje.traslado_id} viaje={viaje} detalles={detalles} hrefDetalle={hrefDetalle} mode="history" />
      ))}
    </>
  );
}
