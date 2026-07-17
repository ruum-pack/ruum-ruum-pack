"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NextOperationalAction } from "@ruum/ui";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";

export interface ContactoRecepcionVehiculoProps {
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

export function ContactoRecepcionVehiculo({
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
}: ContactoRecepcionVehiculoProps) {
  const router = useRouter();
  const [contactoConfirmado, setContactoConfirmado] = useState(false);
  const [vehiculoConfirmado, setVehiculoConfirmado] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ambosConfirmados = contactoConfirmado && vehiculoConfirmado;

  async function tomarEvidencias() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      await avanzarEstadoTraslado(cliente, trasladoId, "llegada_a_destino");
      router.push(`/viajes/${trasladoId}/evidencia`);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos iniciar el registro final del vehículo. Intenta de nuevo."));
      setProcesando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <NextOperationalAction
        title="Registra el estado final del vehículo"
        instruction="Confirma el contacto de recepción y prepara el registro final antes de entregar."
        context={
          <>
            {contactoNombre}
            <br />
            <span className="font-normal text-text-secondary">{contactoTelefono}</span>
          </>
        }
        eta="Tiempo estimado: 3 a 5 minutos"
        primaryCta={{ label: primaryActionLabel, onClick: tomarEvidencias, disabled: !ambosConfirmados || procesando }}
        secondaryCta={{ label: "Llamar contacto", href: `tel:${contactoTelefono}` }}
        loading={procesando}
        error={error}
        nextStep="Después confirmarás la entrega."
        stageLabel="Paso 6 de 7"
      />
      <fieldset className="rounded-xl border border-border bg-surface-elevated p-4">
        <legend className="font-body text-sm font-semibold text-text-tertiary">Confirmaciones</legend>
        <label className="mt-3 flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 font-body text-sm font-semibold">
          <input type="checkbox" checked={contactoConfirmado} onChange={(e) => setContactoConfirmado(e.target.checked)} className="size-4 accent-route" />
          Contacto de recepción confirmado
        </label>
        <label className="mt-2 flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 font-body text-sm font-semibold">
          <input type="checkbox" checked={vehiculoConfirmado} onChange={(e) => setVehiculoConfirmado(e.target.checked)} className="size-4 accent-route" />
          Vehículo confirmado
        </label>
      </fieldset>
    </div>
  );
}
