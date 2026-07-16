"use client";

import { useEffect, useMemo, useState } from "react";
import {
  obtenerEstadoTrasladoRealtime,
  obtenerUltimaUbicacionTraslado,
  suscribirEstadoTraslado,
  suscribirUbicacionTraslado,
  type UbicacionTraslado
} from "@ruum/api/services";
import { ETIQUETA_ESTADO_TRASLADO } from "@ruum/shared/states";
import { Aviso, EstadoBadge, PassportCard } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { SkeletonMapa } from "../../components/SkeletonMapa";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

interface PuntoMapa {
  lat: number | null;
  lng: number | null;
}

interface SeguimientoTrasladoTiempoRealProps {
  trasladoId: string;
  estado: EstadoTraslado | null;
  origen: PuntoMapa;
  destino: PuntoMapa;
  ubicacionInicial: UbicacionTraslado | null;
}

const ESTADOS_VISIBLES: EstadoTraslado[] = [
  "conductor_asignado",
  "conductor_en_camino_al_origen",
  "conductor_en_punto_de_recoleccion",
  "verificacion_vehiculo_en_proceso",
  "evidencia_inicial_en_proceso",
  "evidencia_inicial_completada",
  "vehiculo_recibido",
  "traslado_en_curso",
  "incidencia_reportada",
  "llegada_a_destino",
  "evidencia_final_en_proceso",
  "evidencia_final_completada",
  "entrega_confirmada",
  "servicio_cerrado"
];

function puntoValido(punto: PuntoMapa): punto is { lat: number; lng: number } {
  return typeof punto.lat === "number" && typeof punto.lng === "number";
}

function formatoHora(fechaIso: string | null | undefined) {
  if (!fechaIso) return "Sin actualización";
  return new Intl.DateTimeFormat("es-MX", {
    timeStyle: "short",
    dateStyle: "medium",
    timeZone: "America/Mexico_City"
  }).format(new Date(fechaIso));
}

function construirMapa(origen: PuntoMapa, destino: PuntoMapa, ubicacion: UbicacionTraslado | null) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  const marcadores: string[] = [];
  if (puntoValido(origen)) marcadores.push(`pin-s-o+2563eb(${origen.lng},${origen.lat})`);
  if (puntoValido(destino)) marcadores.push(`pin-s-d+16a34a(${destino.lng},${destino.lat})`);
  if (ubicacion) marcadores.push(`pin-l-c+f59e0b(${Number(ubicacion.lng)},${Number(ubicacion.lat)})`);
  if (marcadores.length === 0) return null;

  const overlay = marcadores.join(",");
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlay}/auto/900x320@2x?padding=70&access_token=${encodeURIComponent(token)}`;
}

export function SeguimientoTrasladoTiempoReal({
  trasladoId,
  estado,
  origen,
  destino,
  ubicacionInicial
}: SeguimientoTrasladoTiempoRealProps) {
  const [ubicacion, setUbicacion] = useState<UbicacionTraslado | null>(ubicacionInicial);
  const [estadoRealtime, setEstadoRealtime] = useState<EstadoTraslado | null>(null);
  const [estadoActualizadoEn, setEstadoActualizadoEn] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mapaCargadoUrl, setMapaCargadoUrl] = useState<string | null>(null);

  const estadoEnVivo = estadoRealtime ?? estado;
  const mapaUrl = useMemo(() => construirMapa(origen, destino, ubicacion), [destino, origen, ubicacion]);
  const mapaCargado = mapaUrl != null && mapaCargadoUrl === mapaUrl;
  const visible = estadoEnVivo ? ESTADOS_VISIBLES.includes(estadoEnVivo) : false;

  useEffect(() => {
    if (!tieneSupabaseConfigurado()) return;

    const cliente = crearClienteNavegador();
    const canalEstado = suscribirEstadoTraslado(cliente, trasladoId, (traslado) => {
      setEstadoRealtime(traslado.estado);
      setEstadoActualizadoEn(traslado.actualizado_en);
    });
    const canalUbicacion = suscribirUbicacionTraslado(cliente, trasladoId, setUbicacion);

    void obtenerEstadoTrasladoRealtime(cliente, trasladoId).then((traslado) => {
      if (!traslado) return;
      setEstadoRealtime(traslado.estado);
      setEstadoActualizadoEn(traslado.actualizado_en);
    });

    return () => {
      void cliente.removeChannel(canalEstado);
      void cliente.removeChannel(canalUbicacion);
    };
  }, [trasladoId]);

  async function refrescar() {
    if (!tieneSupabaseConfigurado()) return;

    setCargando(true);
    try {
      const cliente = crearClienteNavegador();
      const [ultimaUbicacion, estadoActual] = await Promise.all([
        obtenerUltimaUbicacionTraslado(cliente, trasladoId),
        obtenerEstadoTrasladoRealtime(cliente, trasladoId)
      ]);
      setUbicacion(ultimaUbicacion);
      if (estadoActual) {
        setEstadoRealtime(estadoActual.estado);
        setEstadoActualizadoEn(estadoActual.actualizado_en);
      }
    } finally {
      setCargando(false);
    }
  }

  if (!visible) return null;

  return (
    <section className="mt-6">
      <PassportCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Trazabilidad en tiempo real</p>
            <h2 className="mt-1 font-display text-xl font-semibold">Sigue tu traslado</h2>
            <p className="mt-2 font-body text-sm leading-6 text-ink/60">
              La ubicación se actualiza automáticamente mientras el conductor mantiene abierta la app.
            </p>
          </div>
          {estadoEnVivo && <EstadoBadge estado={estadoEnVivo} />}
        </div>

        <div className="mt-5 rounded-[var(--ruum-radius-field)] border border-route/20 bg-route-soft px-4 py-3">
          <p className="font-body text-xs uppercase tracking-wide text-route-dark/80">Estado en vivo</p>
          <p className="mt-1 font-display text-base font-semibold text-ink">
            {estadoEnVivo ? ETIQUETA_ESTADO_TRASLADO[estadoEnVivo] : "Esperando actualización"}
          </p>
          <p className="mt-1 font-body text-xs text-ink/60">
            Actualizado {formatoHora(estadoActualizadoEn ?? ubicacion?.registrado_en)}
          </p>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={refrescar}
            disabled={cargando}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/20 bg-mist px-4 py-2 font-body text-sm font-medium text-ink transition hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargando ? "Actualizando" : "Actualizar"}
          </button>
        </div>

        {mapaUrl ? (
          <div className="mt-5 overflow-hidden rounded-lg border border-ink/10 bg-ink/5">
            {!mapaCargado && <SkeletonMapa className="h-72 rounded-lg" />}
            {/* eslint-disable-next-line @next/next/no-img-element -- Mapa estático generado por Mapbox para render ligero. */}
            <img
              src={mapaUrl}
              alt="Mapa con la ruta y la última ubicación del conductor"
              onLoad={() => setMapaCargadoUrl(mapaUrl)}
              className={mapaCargado ? "h-72 w-full object-cover" : "hidden"}
            />
          </div>
        ) : (
          <div className="mt-5">
            <Aviso tono="info">
              El mapa se mostrará cuando exista token de Mapbox y coordenadas de la ruta. El seguimiento seguirá registrando la última ubicación disponible.
            </Aviso>
          </div>
        )}

        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Última ubicación</dt>
            <dd className="mt-1 font-body text-sm font-medium text-ink">
              {ubicacion ? `${Number(ubicacion.lat).toFixed(5)}, ${Number(ubicacion.lng).toFixed(5)}` : "Aún no recibida"}
            </dd>
          </div>
          <div>
            <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Actualizado</dt>
            <dd className="mt-1 font-body text-sm font-medium text-ink">{formatoHora(ubicacion?.registrado_en)}</dd>
          </div>
          <div>
            <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Precisión</dt>
            <dd className="mt-1 font-body text-sm font-medium text-ink">
              {ubicacion?.precision_m ? `${Math.round(Number(ubicacion.precision_m))} m` : "Pendiente"}
            </dd>
          </div>
        </dl>
      </PassportCard>
    </section>
  );
}
