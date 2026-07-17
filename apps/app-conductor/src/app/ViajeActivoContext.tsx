"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { listarViajesAceptados, obtenerConductorActual, registrarUbicacionTraslado } from "@ruum/api/services";
import type { Database } from "@ruum/shared/types";
import { ESTADOS_TRASLADO } from "@ruum/shared/states";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import { getTripPresentation } from "../lib/trip-presentation";
import { observarUbicacionActual, obtenerUbicacionActual, type Coordenadas } from "../lib/ubicacion";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

export type ViajeActivo = {
  trasladoId: string;
  estado: EstadoTraslado;
  folio: string;
  etapa: string;
  destinoActual: string;
};

type ViajeActivoContextValue = {
  viajeActivo: ViajeActivo | null;
  registrarViajeActivo: (viaje: RegistroViajeActivoInput | null) => void;
};

const ViajeActivoContext = createContext<ViajeActivoContextValue | null>(null);

const INDICE_INICIO_EMERGENCIA = ESTADOS_TRASLADO.indexOf("conductor_asignado");
const INDICE_FIN_EMERGENCIA = ESTADOS_TRASLADO.indexOf("evidencia_final_completada");
const ESTADOS_OPERACION_ACTIVA: EstadoTraslado[] = [
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
  "entrega_confirmada"
];
const ESTADOS_SEGUIMIENTO_UBICACION: EstadoTraslado[] = [
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
  "entrega_confirmada"
];

type RegistroViajeActivoInput = Partial<ViajeActivo> & {
  trasladoId: string;
  estado: EstadoTraslado;
  origenDireccion?: string | null;
  origenCiudad?: string | null;
  destinoDireccion?: string | null;
  destinoCiudad?: string | null;
};

export function viajePermiteEmergencia(estado: EstadoTraslado) {
  const indice = ESTADOS_TRASLADO.indexOf(estado);
  return indice >= INDICE_INICIO_EMERGENCIA && indice <= INDICE_FIN_EMERGENCIA;
}

export function viajePermiteSeguimientoUbicacion(estado: EstadoTraslado) {
  return ESTADOS_SEGUIMIENTO_UBICACION.includes(estado);
}

export function viajeEsOperacionActiva(estado: EstadoTraslado) {
  return ESTADOS_OPERACION_ACTIVA.includes(estado);
}

function folioDesdeId(trasladoId: string) {
  return trasladoId.slice(0, 8).toUpperCase();
}

function direccionActualDeViaje(viaje: RegistroViajeActivoInput) {
  const presentation = getTripPresentation(viaje.estado);
  const usaDestino = ["go_destination", "mark_arrived_destination", "capture_destination_record", "confirm_delivery", "close_trip"].includes(
    presentation.primaryAction.action
  );
  const direccion = usaDestino ? viaje.destinoDireccion : viaje.origenDireccion;
  const ciudad = usaDestino ? viaje.destinoCiudad : viaje.origenCiudad;

  if (direccion && ciudad) return `${direccion} · ${ciudad}`;
  if (direccion) return direccion;
  if (ciudad) return ciudad;
  return usaDestino ? "Punto de entrega" : "Punto de recolección";
}

function normalizarViajeActivo(viaje: RegistroViajeActivoInput, previo?: ViajeActivo | null): ViajeActivo | null {
  if (!viajeEsOperacionActiva(viaje.estado)) return null;

  const presentation = getTripPresentation(viaje.estado);
  return {
    trasladoId: viaje.trasladoId,
    estado: viaje.estado,
    folio: viaje.folio ?? previo?.folio ?? folioDesdeId(viaje.trasladoId),
    etapa: viaje.etapa ?? presentation.title,
    destinoActual: viaje.destinoActual ?? previo?.destinoActual ?? direccionActualDeViaje(viaje)
  };
}

function viajeActivoDesdePasaporte(viaje: PasaporteRow): ViajeActivo | null {
  return normalizarViajeActivo({
    trasladoId: viaje.traslado_id,
    estado: viaje.estado,
    origenDireccion: viaje.origen_direccion,
    origenCiudad: viaje.origen_ciudad,
    destinoDireccion: viaje.destino_direccion,
    destinoCiudad: viaje.destino_ciudad
  });
}

function distanciaMetros(a: Coordenadas, b: Coordenadas) {
  const radioTierra = 6_371_000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * radioTierra * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function ViajeActivoProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [viajeActivo, setViajeActivo] = useState<ViajeActivo | null>(null);
  const registrarViajeActivo = useCallback((viaje: RegistroViajeActivoInput | null) => {
    setViajeActivo((previo) => (viaje ? normalizarViajeActivo(viaje, previo) : null));
  }, []);

  const value = useMemo(
    () => ({
      viajeActivo,
      registrarViajeActivo
    }),
    [registrarViajeActivo, viajeActivo]
  );

  useEffect(() => {
    if (!tieneSupabaseConfigurado()) return;
    if (pathname === "/login" || pathname === "/registro" || pathname === "/onboarding") {
      setViajeActivo(null);
      return;
    }

    let cancelado = false;

    async function cargarViajeActivo() {
      try {
        const cliente = crearClienteNavegador();
        const conductor = await obtenerConductorActual(cliente);
        if (!conductor) {
          if (!cancelado) setViajeActivo(null);
          return;
        }

        const viajes = await listarViajesAceptados(cliente, conductor.id);
        const activo = viajes.find((viaje) => viajeEsOperacionActiva(viaje.estado));
        if (!cancelado) setViajeActivo(activo ? viajeActivoDesdePasaporte(activo) : null);
      } catch {
        if (!cancelado) setViajeActivo(null);
      }
    }

    void cargarViajeActivo();
    const intervalo = window.setInterval(() => void cargarViajeActivo(), 45_000);
    const alVolver = () => {
      if (document.visibilityState === "visible") void cargarViajeActivo();
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [pathname]);

  return (
    <ViajeActivoContext.Provider value={value}>
      {children}
      <ReportadorUbicacionConductor />
    </ViajeActivoContext.Provider>
  );
}

export function useViajeActivo() {
  const contexto = useContext(ViajeActivoContext);
  if (!contexto) {
    throw new Error("useViajeActivo debe usarse dentro de ViajeActivoProvider.");
  }
  return contexto;
}

export function RegistroViajeActivo({ viaje }: { viaje: RegistroViajeActivoInput | null }) {
  const { registrarViajeActivo } = useViajeActivo();

  useEffect(() => {
    registrarViajeActivo(viaje && viajeEsOperacionActiva(viaje.estado) ? viaje : null);
    return () => registrarViajeActivo(null);
  }, [registrarViajeActivo, viaje]);

  return null;
}

function ReportadorUbicacionConductor() {
  const { viajeActivo } = useViajeActivo();

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
          trasladoId: viajeActivo!.trasladoId,
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
      return tiempoDesdeUltimoReporte >= 10_000 || distanciaMetros(ultimaReportada, ubicacion) >= 50;
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
    }, 30_000);

    return () => {
      cancelado = true;
      cancelarObservacion?.();
      window.clearInterval(respaldo);
    };
  }, [viajeActivo]);

  return null;
}
