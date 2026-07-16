"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";

export interface ContactoRecepcionVehiculoProps {
  trasladoId: string;
  contactoNombre: string;
  contactoTelefono: string;
  vehiculoMarca: string | null;
  vehiculoModelo: string | null;
  vehiculoAnio: number | null;
  vehiculoColor: string | null;
  vehiculoPlacas: string | null;
  vehiculoVin: string | null;
}

function telefonoWhatsApp(telefono: string) {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length === 10) return `52${digitos}`;
  return digitos;
}

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null }) {
  return (
    <div>
      <dt className="font-mono-ruum text-[10px] uppercase tracking-widest text-ink/40">{etiqueta}</dt>
      <dd className="mt-0.5 font-body text-sm font-medium text-ink">{valor ?? "-"}</dd>
    </div>
  );
}

export function ContactoRecepcionVehiculo({
  trasladoId,
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
      setError(err instanceof Error ? err.message : "No pudimos iniciar la evidencia final. Intenta de nuevo.");
      setProcesando(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="rounded-xl border border-ink/10 bg-mist-dim/40 p-4">
        <p className="font-mono-ruum text-[10px] uppercase tracking-widest text-ink/40">Ponte en contacto con</p>
        <p className="mt-1 font-display text-base font-semibold text-ink">{contactoNombre}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="font-mono-ruum text-sm text-ink/65">{contactoTelefono}</p>
          <div className="flex gap-2">
            <a
              href={`tel:${contactoTelefono}`}
              className="rounded-lg border border-route-dark/30 bg-route-soft px-3 py-1.5 font-body text-xs font-semibold text-route-dark hover:bg-route"
            >
              Llamar
            </a>
            <a
              href={`https://wa.me/${telefonoWhatsApp(contactoTelefono)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-control/30 bg-control-soft px-3 py-1.5 font-body text-xs font-semibold text-control hover:bg-control-soft/70"
            >
              WhatsApp
            </a>
          </div>
        </div>
        <Button
          variant={contactoConfirmado ? "secundario" : "primario"}
          className="mt-3 w-full"
          onClick={() => setContactoConfirmado(true)}
          disabled={contactoConfirmado}
        >
          {contactoConfirmado ? "✓ Contacto confirmado" : "Confirmar contacto con la persona"}
        </Button>
      </div>

      <div className="rounded-xl border border-ink/10 bg-mist-dim/40 p-4">
        <p className="font-mono-ruum text-[10px] uppercase tracking-widest text-ink/40">Confirma el vehículo entregado</p>
        <dl className="mt-2 grid grid-cols-2 gap-3">
          <FilaDato etiqueta="Marca" valor={vehiculoMarca} />
          <FilaDato etiqueta="Modelo" valor={vehiculoModelo} />
          <FilaDato etiqueta="Año" valor={vehiculoAnio} />
          <FilaDato etiqueta="Color" valor={vehiculoColor} />
          <FilaDato etiqueta="Placas" valor={vehiculoPlacas} />
          <FilaDato etiqueta="Serie / VIN" valor={vehiculoVin} />
        </dl>
        <Button
          variant={vehiculoConfirmado ? "secundario" : "primario"}
          className="mt-3 w-full"
          onClick={() => setVehiculoConfirmado(true)}
          disabled={vehiculoConfirmado}
        >
          {vehiculoConfirmado ? "✓ Vehículo confirmado" : "Confirmar vehículo para entrega"}
        </Button>
      </div>

      {error && (
        <div role="status" aria-live="polite" aria-atomic="true">
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}

      <Button className="w-full" onClick={tomarEvidencias} disabled={!ambosConfirmados || procesando}>
        {procesando ? TEXTOS_CARGANDO.actualizando : "Toma evidencias"}
      </Button>
    </div>
  );
}
