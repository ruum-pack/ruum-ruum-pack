"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NextOperationalAction } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

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
  const destinoCoordenadas = destinoLat !== null && destinoLng !== null ? `${destinoLat},${destinoLng}` : null;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinoCoordenadas ?? `${destinoDireccion}, ${destinoCiudad}`)}&travelmode=driving`;

  async function heLlegado() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const recibido = (await avanzarEstadoTraslado(cliente, trasladoId, "evidencia_inicial_completada")) as EstadoTraslado;
      const enCurso = (await avanzarEstadoTraslado(cliente, trasladoId, recibido)) as EstadoTraslado;
      await avanzarEstadoTraslado(cliente, trasladoId, enCurso);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos registrar tu llegada al punto de entrega.");
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
        primaryCta={{ label: "Abrir navegación", href: googleMapsUrl, external: true }}
        secondaryCta={{ label: procesando ? TEXTOS_CARGANDO.actualizando : "He llegado", onClick: () => void heLlegado(), disabled: procesando }}
        loading={procesando}
        error={error}
        nextStep="Confirma tu llegada al punto de entrega."
        stageLabel="Paso 5 de 7"
      />
    </div>
  );
}
