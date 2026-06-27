"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Aviso } from "@ruum/ui";
import { TRANSICIONES } from "@ruum/shared/states";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

// Estados donde el siguiente paso requiere evidencia completa (PRD §4.4):
// en vez de "avanzar" directo, llevan a la pantalla de captura.
const ESTADOS_QUE_REQUIEREN_EVIDENCIA: EstadoTraslado[] = ["evidencia_inicial_en_proceso", "evidencia_final_en_proceso"];

// Próximo paso "del camino feliz" en lenguaje llano, para el botón. No es
// una traducción de los 32 nombres técnicos (PRD §6) — solo de los que un
// conductor puede disparar él mismo desde esta pantalla.
const ETIQUETA_SIGUIENTE_PASO: Partial<Record<EstadoTraslado, string>> = {
  conductor_asignado: "Voy en camino",
  conductor_en_camino_al_origen: "Llegué al punto de recolección",
  conductor_en_punto_de_recoleccion: "Iniciar verificación del vehículo",
  verificacion_vehiculo_en_proceso: "Iniciar evidencia inicial",
  vehiculo_recibido: "Iniciar traslado",
  traslado_en_curso: "Llegué a destino",
  llegada_a_destino: "Iniciar evidencia final",
  evidencia_final_completada: "Confirmar entrega"
};

export interface AccionesViajeProps {
  trasladoId: string;
  estado: EstadoTraslado;
  esDemo: boolean;
}

export function AccionesViaje({ trasladoId, estado, esDemo }: AccionesViajeProps) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiereEvidencia = ESTADOS_QUE_REQUIEREN_EVIDENCIA.includes(estado);
  const siguientePosible = TRANSICIONES[estado]?.[0];
  const etiqueta = ETIQUETA_SIGUIENTE_PASO[estado];

  if (!siguientePosible || !etiqueta) {
    return null; // Estado terminal o que no corresponde a una acción del conductor.
  }

  if (requiereEvidencia) {
    return (
      <div className="mt-6">
        <Button onClick={() => router.push(`/viajes/${trasladoId}/evidencia`)}>{etiqueta}</Button>
      </div>
    );
  }

  async function avanzar() {
    setProcesando(true);
    setError(null);

    if (esDemo || !tieneSupabaseConfigurado()) {
      await new Promise((r) => setTimeout(r, 400));
      setProcesando(false);
      router.refresh();
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      await avanzarEstadoTraslado(cliente, trasladoId, estado);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos actualizar el viaje. Intenta de nuevo.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="mt-6">
      {error && (
        <div className="mb-3">
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}
      <Button onClick={avanzar} disabled={procesando}>
        {procesando ? "Actualizando…" : etiqueta}
      </Button>
    </div>
  );
}
