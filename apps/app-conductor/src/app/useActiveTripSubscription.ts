"use client";

import { useCallback, useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { listarViajesAceptados, obtenerConductorActual } from "@ruum/api/services";
import { createLogger, errorCode } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import { esNativo } from "../lib/capacitor";
import {
  normalizarViajeActivo,
  type RegistroViajeActivoInput,
  type ViajeActivo,
  viajeActivoDesdePasaporte,
  viajeEsOperacionActiva
} from "./active-trip-state";
import { leerCacheViajeActivo } from "../lib/offline-active-trip-cache";

const RUTAS_SIN_VIAJE_ACTIVO = new Set(["/login", "/registro", "/onboarding"]);
const INTERVALO_REFRESCO_VIAJE_ACTIVO_MS = 45_000;
const logger = createLogger("active_trip");

export function useActiveTripSubscription(pathname: string) {
  const [viajeActivo, setViajeActivo] = useState<ViajeActivo | null>(null);
  const [viajeActivoSinActualizar, setViajeActivoSinActualizar] = useState(false);
  const [pasaporteActivo, setPasaporteActivo] = useState<Awaited<ReturnType<typeof listarViajesAceptados>>[number] | null>(null);
  const rutaSinViajeActivo = RUTAS_SIN_VIAJE_ACTIVO.has(pathname);
  const registrarViajeActivo = useCallback((viaje: RegistroViajeActivoInput | null) => {
    setViajeActivo((previo) => (viaje ? normalizarViajeActivo(viaje, previo) : null));
    setViajeActivoSinActualizar(false);
  }, []);

  useEffect(() => {
    if (!tieneSupabaseConfigurado()) return;
    if (rutaSinViajeActivo) return;

    let cancelado = false;

    async function cargarViajeActivo() {
      try {
        const cliente = crearClienteNavegador();
        const conductor = await obtenerConductorActual(cliente);
        if (!conductor) {
          if (!cancelado) {
            setViajeActivo(null);
            setPasaporteActivo(null);
            setViajeActivoSinActualizar(false);
          }
          return;
        }

        const viajes = await listarViajesAceptados(cliente, conductor.id);
        const activo = viajes.find((viaje) => viaje.estado && viajeEsOperacionActiva(viaje.estado));
        if (!cancelado) {
          setViajeActivo(activo ? viajeActivoDesdePasaporte(activo) : null);
          setPasaporteActivo(activo ?? null);
          setViajeActivoSinActualizar(false);
        }
      } catch (error) {
        const cache = await leerCacheViajeActivo();
        logger.warn(
          "active_trip_refresh_failed",
          {
            errorCode: errorCode(error),
            isOnline: typeof navigator === "undefined" ? null : navigator.onLine
          },
          "connectivity"
        );
        if (!cancelado) {
          if (cache) {
            setViajeActivo({
              trasladoId: cache.trasladoId,
              estado: cache.estado,
              folio: cache.folio,
              etapa: cache.siguienteAccion.label,
              destinoActual: cache.siguienteAccion.nextStep ?? cache.siguienteAccion.instruction
            });
          }
          setViajeActivoSinActualizar(true);
        }
      }
    }

    void cargarViajeActivo();
    const intervalo = window.setInterval(() => void cargarViajeActivo(), INTERVALO_REFRESCO_VIAJE_ACTIVO_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") void cargarViajeActivo();
    };
    document.addEventListener("visibilitychange", alVolver);

    let limpiarAppState: (() => void) | null = null;
    if (esNativo()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void cargarViajeActivo();
      }).then((handle) => {
        if (cancelado) {
          void handle.remove();
        } else {
          limpiarAppState = () => handle.remove();
        }
      });
    }

    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      limpiarAppState?.();
    };
  }, [rutaSinViajeActivo]);

  return {
    viajeActivo: rutaSinViajeActivo ? null : viajeActivo,
    viajeActivoSinActualizar: rutaSinViajeActivo ? false : viajeActivoSinActualizar,
    pasaporteActivo: rutaSinViajeActivo ? null : pasaporteActivo,
    registrarViajeActivo
  };
}
