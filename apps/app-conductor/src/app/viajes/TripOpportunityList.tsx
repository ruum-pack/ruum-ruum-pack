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

function distanciaEnKm(viaje: PasaporteRow, coordenadas: Coordenadas | null): number | null {
  if (!coordenadas) return null;
  return distanciaKmEntre(coordenadas, { lat: viaje.origen_lat, lng: viaje.origen_lng });
}

function formatoDistanciaCorta(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function badgeProximidad(viaje: PasaporteRow, coordenadas: Coordenadas | null): React.ReactNode {
  const km = distanciaEnKm(viaje, coordenadas);
  if (km == null) return null;

  if (km <= 3) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 font-display text-[11px] font-bold text-emerald-500">
        🟢 Cerca · {formatoDistanciaCorta(km)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border/40 bg-surface-elevated px-2.5 py-0.5 font-body text-[11px] font-semibold text-text-tertiary">
      📍 A {formatoDistanciaCorta(km)}
    </span>
  );
}

export function TripOpportunityList({
  viajes,
  detalles,
  conductor,
  aceptando,
  rechazoPendiente,
  coordenadas,
  hrefDetalle,
  onAccept,
  onReject
}: {
  viajes: PasaporteRow[];
  detalles: Record<string, DetalleOperativo>;
  conductor: Conductor | null;
  aceptando: string | null;
  rechazoPendiente: boolean;
  coordenadas: Coordenadas | null;
  hrefDetalle: (viaje: PasaporteRow) => string;
  onAccept: (trasladoId: string) => void;
  onReject: (viaje: PasaporteRow) => void;
}) {
  const ordenados = [...viajes].sort((a, b) => {
    const dA = distanciaEnKm(a, coordenadas);
    const dB = distanciaEnKm(b, coordenadas);
    if (dA != null && dB != null) return dA - dB;
    if (dA != null) return -1;
    if (dB != null) return 1;
    return 0;
  });

  return (
    <div className="grid gap-4">
      {ordenados.map((viaje) => {
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
          <TripCard key={trasladoId} folio={trasladoId.slice(0, 8).toUpperCase()} className="transition hover:border-signal/40">
            <article className="grid gap-4">
              {/* Encabezado con Origen y Destino de Alto Contraste */}
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
                <div className="min-w-0 rounded-2xl border border-border/60 bg-surface-elevated/40 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-3">
                    <p className="font-body text-xs font-bold uppercase tracking-wider text-signal flex items-center gap-1.5">
                      <span>🚘</span> Oportunidad Disponible
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-body text-xs font-semibold text-text-tertiary">
                        {formatearFecha(detalle.fechaHora)} · {formatearHora(detalle.fechaHora)}
                      </p>
                      {badgeProximidad(viaje, coordenadas)}
                    </div>
                  </div>

                  {/* Origen y Destino con Alto Contraste */}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0 border-l-3 border-signal pl-3">
                      <p className="font-body text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Origen (Recolección)</p>
                      <p className="mt-0.5 line-clamp-2 font-display text-lg font-bold leading-6 text-text-primary">{detalle.origen}</p>
                    </div>
                    <div className="min-w-0 border-l-3 border-emerald-500 pl-3">
                      <p className="font-body text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Destino (Entrega)</p>
                      <p className="mt-0.5 line-clamp-2 font-display text-lg font-bold leading-6 text-text-primary">{detalle.destino}</p>
                    </div>
                  </div>
                </div>

                {/* Única Tarjeta Consolidada de Ganancia Conductor */}
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 shadow-2xs flex flex-col justify-between">
                  <p className="font-body text-[11px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1">
                    <span>💵</span> {etiquetaGanancia}
                  </p>
                  <DriverEarning
                    amount={detalle.gananciaConductorOficial}
                    status={detalle.estadoEconomico === "confirmado" ? "confirmado" : detalle.estadoEconomico === "estimado" ? "estimado" : "sin_calcular"}
                    currency="MXN"
                    amountClassName="font-display text-2xl font-bold text-text-primary mt-1"
                  />
                </div>
              </div>

              {/* Metadatos de Distancia y Duración */}
              <div className="grid gap-2 sm:grid-cols-3 font-body text-xs">
                <div className="rounded-xl border border-border/40 bg-surface-elevated p-3">
                  <p className="font-body text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Distancia al origen</p>
                  <p className="font-display text-sm font-bold text-text-primary mt-0.5">
                    {formatearDistanciaAproximadaAlOrigen(distanciaAlOrigenKm)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/40 bg-surface-elevated p-3">
                  <p className="font-body text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Distancia del traslado</p>
                  <p className="font-display text-sm font-bold text-text-primary mt-0.5">{formatearDistancia(detalle.distanciaKm)}</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-surface-elevated p-3">
                  <p className="font-body text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Duración estimada</p>
                  <p className="font-display text-sm font-bold text-text-primary mt-0.5">{formatearDuracion(detalle.tiempoEstimadoHoras)}</p>
                </div>
              </div>

              {/* Acciones Simplificadas con Affordance Explícito */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/40 pt-3">
                {/* Affordance de Acción para Ver Detalle */}
                <Link
                  href={hrefDetalle(viaje)}
                  className="inline-flex items-center gap-1.5 font-display text-xs font-bold text-route-action hover:text-signal hover:underline transition"
                >
                  <span>Ver detalles de la oportunidad</span>
                  <span className="text-sm">→</span>
                </Link>

                {/* Botones de Acción Limpios (Sin ruido lateral) */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="text-xs"
                    onClick={() => onReject(viaje)}
                    disabled={aceptando === trasladoId || rechazoPendiente}
                  >
                    Rechazar
                  </Button>
                  <Button
                    variant="primary"
                    className="text-xs font-bold"
                    onClick={() => onAccept(trasladoId)}
                    disabled={!elegibilidad.elegible || aceptando === trasladoId || rechazoPendiente}
                  >
                    {aceptando === trasladoId ? "Aceptando..." : "Aceptar Traslado"}
                  </Button>
                </div>
              </div>

              {requisitoExcepcional && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 font-body text-xs font-bold text-amber-500">
                  ⚠️ Requisito especial: {requisitoExcepcional}
                </div>
              )}

              {!elegibilidad.elegible && (
                <Aviso tono="atencion">No elegible: {elegibilidad.motivo}</Aviso>
              )}
            </article>
          </TripCard>
        );
      })}
    </div>
  );
}
