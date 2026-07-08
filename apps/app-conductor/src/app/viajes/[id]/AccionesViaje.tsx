"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { TRANSICIONES } from "@ruum/shared/states";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

// Estados donde el siguiente paso requiere evidencia completa (PRD §4.4):
// en vez de "avanzar" directo, llevan a la pantalla de captura.
export const ESTADOS_QUE_REQUIEREN_EVIDENCIA: EstadoTraslado[] = ["evidencia_inicial_en_proceso", "evidencia_final_en_proceso"];

// Próximo paso "del camino feliz" en lenguaje llano, para el botón. No es
// una traducción de los 32 nombres técnicos (PRD §6) — solo de los que un
// conductor puede disparar él mismo desde esta pantalla.
export const ETIQUETA_SIGUIENTE_PASO: Partial<Record<EstadoTraslado, string>> = {
  conductor_asignado: "Voy en camino",
  conductor_en_camino_al_origen: "Llegué al punto de recolección",
  conductor_en_punto_de_recoleccion: "Iniciar verificación del vehículo",
  verificacion_vehiculo_en_proceso: "Iniciar evidencia inicial",
  // Bug real: faltaban estos dos. El estado de "...en_proceso" es donde la
  // pantalla SÍ necesita mostrar el botón hacia /evidencia (lo decide
  // requiereEvidencia más abajo) — sin una etiqueta aquí, el bail-out
  // `if (!etiqueta) return null` ocultaba el botón justo cuando debía
  // aparecer, no solo en el paso anterior que lleva hasta aquí.
  evidencia_inicial_en_proceso: "Continuar evidencia inicial",
  vehiculo_recibido: "Iniciar traslado",
  traslado_en_curso: "Llegué a destino",
  llegada_a_destino: "Iniciar evidencia final",
  evidencia_final_en_proceso: "Continuar evidencia final",
  evidencia_final_completada: "Confirmar entrega"
};

export interface AccionesViajeProps {
  trasladoId: string;
  estado: EstadoTraslado;
  fotosCompletadas?: number;
}

export function AccionesViaje({ trasladoId, estado, fotosCompletadas = 0 }: AccionesViajeProps) {
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
        <p className="mb-2 font-body text-xs text-ink/55">
          {fotosCompletadas} de 5 ángulos capturados
        </p>
        <Button onClick={() => router.push(`/viajes/${trasladoId}/evidencia`)}>{etiqueta}</Button>
      </div>
    );
  }

  async function avanzar() {
    setProcesando(true);
    setError(null);

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
        <div className="mb-3" role="status" aria-live="polite" aria-atomic="true">
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}
      <Button onClick={avanzar} disabled={procesando}>
        {procesando ? TEXTOS_CARGANDO.actualizando : etiqueta}
      </Button>
    </div>
  );
}
