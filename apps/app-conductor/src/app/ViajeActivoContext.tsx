"use client";

"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { activarSoporteEmergenciaConductor, registrarUbicacionTraslado } from "@ruum/api/services";
import type { Database } from "@ruum/shared/types";
import { ESTADOS_TRASLADO } from "@ruum/shared/states";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import { obtenerUbicacionActual } from "../lib/ubicacion";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

type ViajeActivo = {
  trasladoId: string;
  estado: EstadoTraslado;
};

type ViajeActivoContextValue = {
  viajeActivo: ViajeActivo | null;
  registrarViajeActivo: (viaje: ViajeActivo | null) => void;
};

const ViajeActivoContext = createContext<ViajeActivoContextValue | null>(null);

const INDICE_INICIO_EMERGENCIA = ESTADOS_TRASLADO.indexOf("conductor_asignado");
const INDICE_FIN_EMERGENCIA = ESTADOS_TRASLADO.indexOf("evidencia_final_completada");
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

export function viajePermiteFabEmergencia(estado: EstadoTraslado) {
  const indice = ESTADOS_TRASLADO.indexOf(estado);
  return indice >= INDICE_INICIO_EMERGENCIA && indice <= INDICE_FIN_EMERGENCIA;
}

export function viajePermiteSeguimientoUbicacion(estado: EstadoTraslado) {
  return ESTADOS_SEGUIMIENTO_UBICACION.includes(estado);
}

export function ViajeActivoProvider({ children }: { children: React.ReactNode }) {
  const [viajeActivo, setViajeActivo] = useState<ViajeActivo | null>(null);

  const value = useMemo(
    () => ({
      viajeActivo,
      registrarViajeActivo: setViajeActivo
    }),
    [viajeActivo]
  );

  return (
    <ViajeActivoContext.Provider value={value}>
      {children}
      <ReportadorUbicacionConductor />
      <FabEmergencia911 />
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

export function RegistroViajeActivo({ viaje }: { viaje: ViajeActivo | null }) {
  const { registrarViajeActivo } = useViajeActivo();

  useEffect(() => {
    registrarViajeActivo(
      viaje && (viajePermiteFabEmergencia(viaje.estado) || viajePermiteSeguimientoUbicacion(viaje.estado)) ? viaje : null
    );
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

    async function reportar() {
      const ubicacion = await obtenerUbicacionActual();
      if (!ubicacion || cancelado) return;

      try {
        await registrarUbicacionTraslado(cliente, {
          trasladoId: viajeActivo!.trasladoId,
          lat: ubicacion.lat,
          lng: ubicacion.lng,
          precisionM: ubicacion.precisionM,
          velocidadMps: ubicacion.velocidadMps
        });
      } catch {
        // El seguimiento no debe bloquear el flujo operativo del conductor.
      }
    }

    void reportar();
    const intervalo = window.setInterval(() => {
      void reportar();
    }, 30_000);

    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
    };
  }, [viajeActivo]);

  return null;
}

function FabEmergencia911() {
  const { viajeActivo } = useViajeActivo();
  const [procesando, setProcesando] = useState(false);

  if (!viajeActivo || !viajePermiteFabEmergencia(viajeActivo.estado)) {
    return null;
  }

  async function activarEmergencia() {
    if (!viajeActivo || procesando) return;

    setProcesando(true);
    try {
      if (tieneSupabaseConfigurado()) {
        const cliente = crearClienteNavegador();
        await activarSoporteEmergenciaConductor(cliente, viajeActivo.trasladoId);
      }
      window.location.href = "tel:911";
    } finally {
      setProcesando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={activarEmergencia}
      disabled={procesando}
      aria-label="Llamar al 911 y activar alerta de emergencia"
      className="fixed left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-danger bg-danger text-mist shadow-[0_14px_36px_rgba(179,38,38,0.34)] transition hover:-translate-y-0.5 hover:bg-[#8f1d1d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-60"
      style={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }}
    >
      <span aria-hidden="true" className="font-display text-lg font-extrabold leading-none">
        911
      </span>
    </button>
  );
}
