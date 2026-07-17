"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NextOperationalAction } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { distanciaMetrosEntre, obtenerUbicacionActual } from "../../../lib/ubicacion";
import { createNavigationOptions } from "../../../lib/navigation-launcher";
import { confirmarLlegadaDestino } from "@ruum/api/services";
import { NavigationLauncher } from "./NavigationLauncher";

const RADIO_CONFIRMACION_LLEGADA_M = 500;

export interface DirigeteADestinoProps {
  trasladoId: string;
  title: string;
  destinoDireccion: string;
  destinoCiudad: string;
  destinoReferencias?: string | null;
  destinoLat: number | null;
  destinoLng: number | null;
}

export function DirigeteADestino({
  trasladoId,
  title,
  destinoDireccion,
  destinoCiudad,
  destinoReferencias,
  destinoLat,
  destinoLng
}: DirigeteADestinoProps) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmacionLejanaM, setConfirmacionLejanaM] = useState<number | null>(null);
  const navigationTarget = {
    lat: destinoLat,
    lng: destinoLng,
    address: `${destinoDireccion}, ${destinoCiudad}`
  };
  const primaryNavigationUrl = createNavigationOptions(navigationTarget)[0].href;

  async function heLlegado(confirmarFueraDeGeocerca = false) {
    setProcesando(true);
    setError(null);
    try {
      if (!confirmarFueraDeGeocerca && destinoLat !== null && destinoLng !== null) {
        const ubicacion = await obtenerUbicacionActual();
        if (ubicacion) {
          const distanciaM = distanciaMetrosEntre(ubicacion, { lat: destinoLat, lng: destinoLng });
          if (distanciaM > RADIO_CONFIRMACION_LLEGADA_M) {
            setConfirmacionLejanaM(distanciaM);
            return;
          }
        }
      }

      setConfirmacionLejanaM(null);
      const cliente = crearClienteNavegador();
      await confirmarLlegadaDestino(cliente, trasladoId);
      router.refresh();
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos registrar tu llegada al punto de entrega."));
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <NextOperationalAction
        title={title}
        instruction="Abre navegación hacia la dirección de entrega. Cuando llegues, registra tu llegada para continuar."
        context={
          <>
            {destinoDireccion}
            <br />
            <span className="font-normal text-text-secondary">{destinoCiudad}</span>
            {destinoReferencias && (
              <>
                <br />
                <span className="font-normal text-text-tertiary">Referencias: {destinoReferencias}</span>
              </>
            )}
          </>
        }
        eta="ETA por confirmar al abrir navegación"
        primaryCta={{ label: "Abrir navegación", href: primaryNavigationUrl, external: true }}
        secondaryCta={{
          label: procesando ? TEXTOS_CARGANDO.actualizando : confirmacionLejanaM ? "Confirmar de todos modos" : "He llegado",
          variant: "quiet",
          onClick: () => void heLlegado(Boolean(confirmacionLejanaM)),
          disabled: procesando
        }}
        loading={procesando}
        error={error}
        nextStep="Confirma tu llegada al punto de entrega."
        stageLabel="Paso 5 de 7"
      />
      <NavigationLauncher target={navigationTarget} />
      {confirmacionLejanaM && (
        <div className="mt-3 rounded-xl border border-warning bg-warn-soft px-4 py-3 font-body text-sm leading-6 text-warning">
          Estás a más de {RADIO_CONFIRMACION_LLEGADA_M} m del punto de entrega
          {` (${Math.round(confirmacionLejanaM)} m aprox.)`}. ¿Deseas confirmar la llegada de todos modos?
        </div>
      )}
    </div>
  );
}
