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
  if (!viaje.traslado_id || !viaje.estado) return null;

  const detalle = detalles[viaje.traslado_id] ?? detalleFallback(viaje);
  const estadoActual = viaje.estado as EstadoTraslado;
  const requiereEvidencia = ESTADOS_QUE_REQUIEREN_EVIDENCIA.includes(estadoActual);
  const presentation = getTripPresentation(estadoActual);
  const etiquetaSiguientePaso = presentation.primaryAction.label;

  return (
    <TripCard folio={viaje.traslado_id.slice(0, 8).toUpperCase()} className="transition hover:border-signal/40">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between border-b border-border/40 pb-4">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">
            {mode === "active" ? "Viaje en seguimiento" : "Viaje finalizado"}
          </p>
          <h2 className="mt-1 font-display text-xl font-bold text-text-primary">
            {nombreVehiculo(viaje)}
            {viaje.vehiculo_tipo && (
              <span className="ml-2 font-body text-xs font-normal text-text-tertiary">
                · {ETIQUETA_TIPO_VEHICULO[viaje.vehiculo_tipo]}
              </span>
            )}
          </h2>
        </div>
        {/* Única etiqueta de estado consolidada */}
        <EstadoBadge estado={viaje.estado} />
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 font-body text-xs">
        {/* Origen y Destino con Alto Contraste */}
        <div className="rounded-xl border border-border/40 bg-surface-elevated/40 p-3">
          <dt className="font-body text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Origen</dt>
          <dd className="mt-1 font-display text-sm font-bold text-text-primary">{detalle.origen}</dd>
        </div>

        <div className="rounded-xl border border-border/40 bg-surface-elevated/40 p-3">
          <dt className="font-body text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Destino</dt>
          <dd className="mt-1 font-display text-sm font-bold text-text-primary">{detalle.destino}</dd>
        </div>

        <div className="rounded-xl border border-border/40 bg-surface-elevated/40 p-3">
          <dt className="font-body text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Fecha y hora</dt>
          <dd className="mt-1 font-display text-sm font-bold text-text-primary">
            {formatearFecha(detalle.fechaHora)} · {formatearHora(detalle.fechaHora)}
          </dd>
        </div>

        {mode === "active" ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <dt className="font-body text-[11px] font-bold uppercase tracking-wider text-emerald-500">Monto Conductor</dt>
            <dd className="mt-1">
              <DriverEarning
                amount={detalle.gananciaConductorOficial}
                status={detalle.estadoEconomico}
                currency="MXN"
                amountClassName="text-sm font-bold"
              />
            </dd>
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 bg-surface-elevated/40 p-3">
            <dt className="font-body text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Tipo de Servicio</dt>
            <dd className="mt-1 font-display text-sm font-bold text-text-primary">{detalle.tipoServicio}</dd>
          </div>
        )}
      </dl>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/40 pt-4">
        {/* Affordance de Acción Explicita para Ver Detalles */}
        <Link
          href={hrefDetalle(viaje)}
          className="inline-flex items-center gap-1.5 font-display text-xs font-bold text-route-action hover:text-signal hover:underline transition"
        >
          <span>Ver detalles completos del viaje</span>
          <span className="text-sm">→</span>
        </Link>

        {mode === "active" && (
          <div className="flex flex-wrap items-center gap-2">
            {requiereEvidencia && (
              <Button
                variant="secondary"
                className="text-xs"
                onClick={() => router.push(`/viajes/${viaje.traslado_id}/evidencia`)}
              >
                📷 Registrar vehículo
              </Button>
            )}
            <Button
              variant="primary"
              className="text-xs font-bold"
              onClick={() => router.push(hrefDetalle(viaje))}
            >
              {etiquetaSiguientePaso}
            </Button>
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
    <div className="grid gap-4">
      {viajes.map((viaje, index) => (
        <OperationalTripCard key={viaje.traslado_id ?? `activo-${index}`} viaje={viaje} detalles={detalles} hrefDetalle={hrefDetalle} mode="active" />
      ))}
    </div>
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
    <div className="grid gap-4">
      {viajes.map((viaje, index) => (
        <OperationalTripCard key={viaje.traslado_id ?? `historial-${index}`} viaje={viaje} detalles={detalles} hrefDetalle={hrefDetalle} mode="history" />
      ))}
    </div>
  );
}
