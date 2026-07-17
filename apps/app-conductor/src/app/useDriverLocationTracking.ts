"use client";

import { useEffect } from "react";
import { registrarUbicacionTraslado } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import {
  distanciaMetrosEntre,
  observarUbicacionActual,
  obtenerUbicacionActual,
  type Coordenadas
} from "../lib/ubicacion";
import { type ViajeActivo, viajePermiteSeguimientoUbicacion } from "./active-trip-state";

const INTERVALO_RESPALDO_UBICACION_MS = 30_000;
const INTERVALO_MINIMO_REPORTE_MS = 10_000;
const DISTANCIA_MINIMA_REPORTE_M = 50;

export function useDriverLocationTracking(viajeActivo: ViajeActivo | null) {
  useEffect(() => {
    if (!viajeActivo || !viajePermiteSeguimientoUbicacion(viajeActivo.estado) || !tieneSupabaseConfigurado()) {
      return;
    }

    let cancelado = false;
    const cliente = crearClienteNavegador();
    let ultimaReportada: Coordenadas | null = null;
    let ultimoReporteMs = 0;

    async function reportar(ubicacion: Coordenadas | null) {
      if (!ubicacion || cancelado) return;

      try {
        await registrarUbicacionTraslado(cliente, {
          trasladoId: viajeActivo.trasladoId,
          lat: ubicacion.lat,
          lng: ubicacion.lng,
          precisionM: ubicacion.precisionM,
          velocidadMps: ubicacion.velocidadMps
        });
        ultimaReportada = ubicacion;
        ultimoReporteMs = Date.now();
      } catch {
        // El seguimiento no debe bloquear el flujo operativo del conductor.
      }
    }

    function debeReportar(ubicacion: Coordenadas) {
      if (!ultimaReportada) return true;

      const tiempoDesdeUltimoReporte = Date.now() - ultimoReporteMs;
      return tiempoDesdeUltimoReporte >= INTERVALO_MINIMO_REPORTE_MS || distanciaMetrosEntre(ultimaReportada, ubicacion) >= DISTANCIA_MINIMA_REPORTE_M;
    }

    void obtenerUbicacionActual().then((ubicacion) => reportar(ubicacion));

    let cancelarObservacion: (() => void) | null = null;
    void observarUbicacionActual((ubicacion) => {
      if (debeReportar(ubicacion)) {
        void reportar(ubicacion);
      }
    }).then((cancelar) => {
      cancelarObservacion = cancelar;
    });

    const respaldo = window.setInterval(() => {
      void obtenerUbicacionActual().then((ubicacion) => reportar(ubicacion));
    }, INTERVALO_RESPALDO_UBICACION_MS);

    return () => {
      cancelado = true;
      cancelarObservacion?.();
      window.clearInterval(respaldo);
    };
  }, [viajeActivo]);
}
