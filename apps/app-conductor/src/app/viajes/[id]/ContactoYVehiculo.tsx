"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NextOperationalAction } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export interface ContactoYVehiculoProps {
  trasladoId: string;
  primaryActionLabel: string;
  contactoNombre: string;
  contactoTelefono: string;
  vehiculoMarca: string | null;
  vehiculoModelo: string | null;
  vehiculoAnio: number | null;
  vehiculoColor: string | null;
  vehiculoPlacas: string | null;
  vehiculoVin: string | null;
}

/**
 * Pantalla mostrada en el estado conductor_en_punto_de_recoleccion: contacto
 * de quien entrega el vehículo + datos para localizarlo, con dos
 * confirmaciones independientes. Al marcar ambas, encadena las dos
 * transiciones del "camino feliz" (verificacion_vehiculo_en_proceso ->
 * evidencia_inicial_en_proceso) y navega directo a la toma de evidencias --
 * confirmarEvidenciaCompleta exige estar exactamente en
 * evidencia_inicial_en_proceso, así que no se puede saltar ningún paso.
 */
export function ContactoYVehiculo({
  trasladoId,
  primaryActionLabel,
  contactoNombre,
  contactoTelefono,
  vehiculoMarca,
  vehiculoModelo,
  vehiculoAnio,
  vehiculoColor,
  vehiculoPlacas,
  vehiculoVin
}: ContactoYVehiculoProps) {
  const router = useRouter();
  const [contactoConfirmado, setContactoConfirmado] = useState(false);
  const [vehiculoLocalizado, setVehiculoLocalizado] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ambosConfirmados = contactoConfirmado && vehiculoLocalizado;

  async function tomarEvidencias() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const enPuntoDeRecoleccion: EstadoTraslado = "conductor_en_punto_de_recoleccion";
      const siguiente = (await avanzarEstadoTraslado(cliente, trasladoId, enPuntoDeRecoleccion)) as EstadoTraslado;
      await avanzarEstadoTraslado(cliente, trasladoId, siguiente);
      router.push(`/viajes/${trasladoId}/evidencia`);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos iniciar la verificación del vehículo. Intenta de nuevo."));
      setProcesando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <NextOperationalAction
        title="Confirma que encontraste al contacto"
        instruction="Habla con la persona de entrega y valida que el vehículo coincida antes de iniciar el registro."
        context={
          <>
            {contactoNombre}
            <br />
            <span className="font-normal text-text-secondary">{contactoTelefono}</span>
          </>
        }
        eta="Tiempo estimado: 2 a 4 minutos"
        primaryCta={{ label: primaryActionLabel, onClick: tomarEvidencias, disabled: !ambosConfirmados || procesando }}
        secondaryCta={{ label: "Llamar contacto", href: `tel:${contactoTelefono}` }}
        loading={procesando}
        error={error}
        nextStep="Después revisarás el vehículo antes de moverlo."
        stageLabel="Paso 2 de 7"
      />
      <fieldset className="rounded-xl border border-border bg-surface-elevated p-4">
        <legend className="font-body text-sm font-semibold text-text-tertiary">Confirmaciones</legend>
        <label className="mt-3 flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 font-body text-sm font-semibold">
          <input type="checkbox" checked={contactoConfirmado} onChange={(e) => setContactoConfirmado(e.target.checked)} className="size-4 accent-route" />
          Contacto encontrado
        </label>
        <label className="mt-2 flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 font-body text-sm font-semibold">
          <input type="checkbox" checked={vehiculoLocalizado} onChange={(e) => setVehiculoLocalizado(e.target.checked)} className="size-4 accent-route" />
          Vehículo localizado
        </label>
      </fieldset>
    </div>
  );
}
