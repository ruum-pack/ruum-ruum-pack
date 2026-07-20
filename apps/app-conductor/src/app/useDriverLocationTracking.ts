"use client";

import { useEffect } from "react";
import { registrarUbicacionTraslado } from "@ruum/api/services";
import { createLogger, errorCode } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import { iniciarTrackingNativo, detenerTrackingNativo, soportaTrackingNativo } from "../lib/background-tracking";
import { distanciaMetrosEntre, observarUbicacionActual, obtenerUbicacionActual, type Coordenadas } from "../lib/ubicacion";
import { type ViajeActivo, viajePermiteSeguimientoUbicacion } from "./active-trip-state";

const INTERVALO_RESPALDO_UBICACION_MS = 30_000;
const INTERVALO_MINIMO_REPORTE_MS = 10_000;
const DISTANCIA_MINIMA_REPORTE_M = 50;
const logger = createLogger("driver_location");

function isOnline() {
  if (typeof navigator === "undefined") return null;
  return navigator.onLine;
}

export function useDriverLocationTracking(viajeActivo: ViajeActivo | null) {
  useEffect(() => {
    const autorizado = Boolean(viajeActivo && viajePermiteSeguimientoUbicacion(viajeActivo.estado));
    if (!autorizado || !tieneSupabaseConfigurado()) {
      if (soportaTrackingNativo()) void detenerTrackingNativo().catch(() => undefined);
      return;
    }

    let cancelado = false;
    const viaje = viajeActivo!;
    const cliente = crearClienteNavegador();

    if (soportaTrackingNativo()) {
      void cliente.auth.getSession().then(({ data }) => {
        const accessToken = data.session?.access_token;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!accessToken || !supabaseUrl || !anonKey || cancelado) return;
        return iniciarTrackingNativo({
          tripId: viaje.trasladoId,
          tripCode: viaje.folio,
          tripState: viaje.estado,
          supabaseUrl,
          anonKey,
          accessToken,
          refreshToken: data.session?.refresh_token
        });
      }).catch((error) => logger.warn("native_tracking_start_failed", { tripId: viaje.trasladoId, errorCode: errorCode(error) }, "device"));

      return () => { cancelado = true; };
    }

    let ultimaReportada: Coordenadas | null = null;
    let ultimoReporteMs = 0;
    async function reportar(ubicacion: Coordenadas | null) {
      if (!ubicacion || cancelado) return;
      try {
        await registrarUbicacionTraslado(cliente, {
          trasladoId: viaje.trasladoId,
          lat: ubicacion.lat,
          lng: ubicacion.lng,
          precisionM: ubicacion.precisionM,
          velocidadMps: ubicacion.velocidadMps
        });
        ultimaReportada = ubicacion;
        ultimoReporteMs = Date.now();
      } catch (error) {
        logger.warn("driver_location_report_failed", { tripId: viaje.trasladoId, isOnline: isOnline(), errorCode: errorCode(error), precisionM: ubicacion.precisionM ?? null }, "connectivity");
      }
    }
    function debeReportar(ubicacion: Coordenadas) {
      if (!ultimaReportada) return true;
      const tiempo = Date.now() - ultimoReporteMs;
      return tiempo >= INTERVALO_MINIMO_REPORTE_MS || distanciaMetrosEntre(ultimaReportada, ubicacion) >= DISTANCIA_MINIMA_REPORTE_M;
    }
    void obtenerUbicacionActual().then(reportar);
    let cancelarObservacion: (() => void) | null = null;
    void observarUbicacionActual((ubicacion) => { if (debeReportar(ubicacion)) void reportar(ubicacion); }).then((cancelar) => { cancelarObservacion = cancelar; });
    const respaldo = window.setInterval(() => void obtenerUbicacionActual().then(reportar), INTERVALO_RESPALDO_UBICACION_MS);
    return () => { cancelado = true; cancelarObservacion?.(); window.clearInterval(respaldo); };
  }, [viajeActivo]);
}
