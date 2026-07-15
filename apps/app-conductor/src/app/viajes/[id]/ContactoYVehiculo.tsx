"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export interface ContactoYVehiculoProps {
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

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null }) {
  return (
    <div>
      <dt className="font-mono-ruum text-[10px] uppercase tracking-widest text-ink/40">{etiqueta}</dt>
      <dd className="mt-0.5 font-body text-sm font-medium text-ink">{valor ?? "—"}</dd>
    </div>
  );
}

function telefonoWhatsApp(telefono: string) {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length === 10) return `52${digitos}`;
  return digitos;
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
      setError(err instanceof Error ? err.message : "No pudimos iniciar la verificación del vehículo. Intenta de nuevo.");
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
        <p className="font-mono-ruum text-[10px] uppercase tracking-widest text-ink/40">Localiza el vehículo</p>
        <dl className="mt-2 grid grid-cols-2 gap-3">
          <FilaDato etiqueta="Marca" valor={vehiculoMarca} />
          <FilaDato etiqueta="Modelo" valor={vehiculoModelo} />
          <FilaDato etiqueta="Año" valor={vehiculoAnio} />
          <FilaDato etiqueta="Color" valor={vehiculoColor} />
          <FilaDato etiqueta="Placas" valor={vehiculoPlacas} />
          <FilaDato etiqueta="Serie / VIN" valor={vehiculoVin} />
        </dl>
        <Button
          variant={vehiculoLocalizado ? "secundario" : "primario"}
          className="mt-3 w-full"
          onClick={() => setVehiculoLocalizado(true)}
          disabled={vehiculoLocalizado}
        >
          {vehiculoLocalizado ? "✓ Vehículo localizado" : "Confirmar que localicé el vehículo"}
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
