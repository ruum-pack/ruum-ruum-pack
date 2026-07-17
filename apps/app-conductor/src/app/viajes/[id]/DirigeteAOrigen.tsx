"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NextOperationalAction } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { distanciaMetrosEntre, obtenerUbicacionActual } from "../../../lib/ubicacion";
import { createNavigationOptions } from "../../../lib/navigation-launcher";
import { avanzarEstadoTraslado } from "@ruum/api/services";
import { NavigationLauncher } from "./NavigationLauncher";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
const RADIO_CONFIRMACION_LLEGADA_M = 500;

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
  const [confirmacionLejanaM, setConfirmacionLejanaM] = useState<number | null>(null);
  const navigationTarget = {
    lat: origenLat,
    lng: origenLng,
    address: `${origenDireccion}, ${origenCiudad}`
  };
  const primaryNavigationUrl = createNavigationOptions(navigationTarget)[0].href;

  async function heLlegado(confirmarFueraDeGeocerca = false) {
    setProcesando(true);
    setError(null);
    try {
      if (!confirmarFueraDeGeocerca && origenLat !== null && origenLng !== null) {
        const ubicacion = await obtenerUbicacionActual();
        if (ubicacion) {
          const distanciaM = distanciaMetrosEntre(ubicacion, { lat: origenLat, lng: origenLng });
          if (distanciaM > RADIO_CONFIRMACION_LLEGADA_M) {
            setConfirmacionLejanaM(distanciaM);
            return;
          }
        }
      }

      setConfirmacionLejanaM(null);
      const cliente = crearClienteNavegador();
      const estadoActual: EstadoTraslado = "conductor_en_camino_al_origen";
      await avanzarEstadoTraslado(cliente, trasladoId, estadoActual);
      router.refresh();
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos registrar tu llegada. Intenta de nuevo."));
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
        primaryCta={{ label: "Abrir navegación", href: primaryNavigationUrl, external: true }}
        secondaryCta={{
          label: procesando ? TEXTOS_CARGANDO.actualizando : confirmacionLejanaM ? "Confirmar de todos modos" : primaryActionLabel,
          variant: "quiet",
          onClick: () => void heLlegado(Boolean(confirmacionLejanaM)),
          disabled: procesando
        }}
        loading={procesando}
        error={error}
        nextStep={primaryActionLabel}
        stageLabel="Paso 1 de 7"
      />
      <NavigationLauncher target={navigationTarget} />
      {confirmacionLejanaM && (
        <div className="mt-3 rounded-xl border border-warning bg-warn-soft px-4 py-3 font-body text-sm leading-6 text-warning">
          Estás a más de {RADIO_CONFIRMACION_LLEGADA_M} m del punto de recolección
          {` (${Math.round(confirmacionLejanaM)} m aprox.)`}. ¿Deseas confirmar la llegada de todos modos?
        </div>
      )}
    </div>
  );
}
