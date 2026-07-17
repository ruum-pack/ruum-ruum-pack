"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NextOperationalAction } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export interface DirigeteAOrigenProps {
  trasladoId: string;
  title: string;
  primaryActionLabel: string;
  origenDireccion: string;
  origenCiudad: string;
  origenReferencias?: string | null;
  origenLat: number | null;
  origenLng: number | null;
}

/**
 * Pantalla mostrada en el estado conductor_en_camino_al_origen: reemplaza el
 * botón plano por la dirección de recolección, un mapa de ruta y el botón
 * "He llegado" que avanza a conductor_en_punto_de_recoleccion.
 */
export function DirigeteAOrigen({
  trasladoId,
  title,
  primaryActionLabel,
  origenDireccion,
  origenCiudad,
  origenReferencias,
  origenLat,
  origenLng
}: DirigeteAOrigenProps) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const destinoCoordenadas = origenLat !== null && origenLng !== null ? `${origenLat},${origenLng}` : null;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinoCoordenadas ?? `${origenDireccion}, ${origenCiudad}`)}&travelmode=driving`;

  async function heLlegado() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const estadoActual: EstadoTraslado = "conductor_en_camino_al_origen";
      await avanzarEstadoTraslado(cliente, trasladoId, estadoActual);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos registrar tu llegada. Intenta de nuevo.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <NextOperationalAction
        title={title}
        instruction="Abre navegación hacia la dirección de recolección. Cuando estés en el punto, confirma tu llegada."
        context={
          <>
            {origenDireccion}
            <br />
            <span className="font-normal text-text-secondary">{origenCiudad}</span>
            {origenReferencias && (
              <>
                <br />
                <span className="font-normal text-text-tertiary">Referencias: {origenReferencias}</span>
              </>
            )}
          </>
        }
        eta="ETA por confirmar al abrir navegación"
        primaryCta={{ label: "Abrir navegación", href: googleMapsUrl, external: true }}
        secondaryCta={{ label: procesando ? TEXTOS_CARGANDO.actualizando : primaryActionLabel, onClick: () => void heLlegado(), disabled: procesando }}
        loading={procesando}
        error={error}
        nextStep={primaryActionLabel}
        stageLabel="Paso 1 de 7"
      />
    </div>
  );
}
