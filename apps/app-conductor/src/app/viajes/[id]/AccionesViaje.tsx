"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, NextOperationalAction } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { TRANSICIONES } from "@ruum/shared/states";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";
import type { TripPresentation } from "../../../lib/trip-presentation";
import { DirigeteAOrigen } from "./DirigeteAOrigen";
import { ContactoYVehiculo } from "./ContactoYVehiculo";
import { DirigeteADestino } from "./DirigeteADestino";
import { ContactoRecepcionVehiculo } from "./ContactoRecepcionVehiculo";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

// Estados donde el siguiente paso requiere evidencia completa (PRD §4.4):
// en vez de "avanzar" directo, llevan a la pantalla de captura.
export const ESTADOS_QUE_REQUIEREN_EVIDENCIA: EstadoTraslado[] = ["evidencia_inicial_en_proceso", "evidencia_final_en_proceso"];

function contextoDireccion(direccion?: string | null, ciudad?: string | null, referencias?: string | null) {
  if (!direccion && !ciudad) return null;

  return (
    <>
      {direccion}
      {ciudad && (
        <>
          <br />
          <span className="font-normal text-text-secondary">{ciudad}</span>
        </>
      )}
      {referencias && (
        <>
          <br />
          <span className="font-normal text-text-tertiary">Referencias: {referencias}</span>
        </>
      )}
    </>
  );
}

function contextoVehiculo(marca?: string | null, modelo?: string | null, anio?: number | null, placas?: string | null) {
  const nombre = [marca, modelo, anio].filter(Boolean).join(" ") || "Vehículo asignado";
  return (
    <>
      {nombre}
      {placas && (
        <>
          <br />
          <span className="font-normal text-text-secondary">Placas: {placas}</span>
        </>
      )}
    </>
  );
}

export interface AccionesViajeProps {
  trasladoId: string;
  estado: EstadoTraslado;
  presentation: TripPresentation;
  fotosCompletadas?: number;
  origenDireccion?: string | null;
  origenCiudad?: string | null;
  origenReferencias?: string | null;
  origenLat?: number | null;
  origenLng?: number | null;
  destinoDireccion?: string | null;
  destinoCiudad?: string | null;
  destinoReferencias?: string | null;
  destinoLat?: number | null;
  destinoLng?: number | null;
  contactoEntregaNombre?: string | null;
  contactoEntregaTelefono?: string | null;
  contactoRecepcionNombre?: string | null;
  contactoRecepcionTelefono?: string | null;
  vehiculoMarca?: string | null;
  vehiculoModelo?: string | null;
  vehiculoAnio?: number | null;
  vehiculoColor?: string | null;
  vehiculoPlacas?: string | null;
  vehiculoVin?: string | null;
}

export function AccionesViaje({
  trasladoId,
  estado,
  presentation,
  fotosCompletadas = 0,
  origenDireccion,
  origenCiudad,
  origenReferencias,
  origenLat = null,
  origenLng = null,
  destinoDireccion,
  destinoCiudad,
  destinoReferencias,
  destinoLat = null,
  destinoLng = null,
  contactoEntregaNombre,
  contactoEntregaTelefono,
  contactoRecepcionNombre,
  contactoRecepcionTelefono,
  vehiculoMarca = null,
  vehiculoModelo = null,
  vehiculoAnio = null,
  vehiculoColor = null,
  vehiculoPlacas = null,
  vehiculoVin = null
}: AccionesViajeProps) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estos dos estados tienen pantalla propia (PRD: flujo "Iniciar viaje") en
  // vez del botón genérico de abajo -- necesitan la dirección de origen o el
  // contacto/vehículo, datos que ese botón no sabe mostrar.
  if (estado === "conductor_en_camino_al_origen") {
    if (!origenDireccion || !origenCiudad) {
      return <Aviso tono="danger">Falta la dirección de origen para continuar.</Aviso>;
    }
    return (
      <DirigeteAOrigen
        trasladoId={trasladoId}
        title={presentation.title}
        primaryActionLabel={presentation.primaryAction.label}
        origenDireccion={origenDireccion}
        origenCiudad={origenCiudad}
        origenReferencias={origenReferencias}
        origenLat={origenLat}
        origenLng={origenLng}
      />
    );
  }

  if (estado === "conductor_en_punto_de_recoleccion") {
    if (!contactoEntregaNombre || !contactoEntregaTelefono) {
      return <Aviso tono="danger">Falta el contacto de entrega para continuar.</Aviso>;
    }
    return (
      <ContactoYVehiculo
        trasladoId={trasladoId}
        primaryActionLabel={presentation.primaryAction.label}
        contactoNombre={contactoEntregaNombre}
        contactoTelefono={contactoEntregaTelefono}
        vehiculoMarca={vehiculoMarca}
        vehiculoModelo={vehiculoModelo}
        vehiculoAnio={vehiculoAnio}
        vehiculoColor={vehiculoColor}
        vehiculoPlacas={vehiculoPlacas}
        vehiculoVin={vehiculoVin}
      />
    );
  }

  if (estado === "evidencia_inicial_completada") {
    if (!destinoDireccion || !destinoCiudad) {
      return <Aviso tono="danger">Falta la dirección de entrega para continuar.</Aviso>;
    }
    return (
      <DirigeteADestino
        trasladoId={trasladoId}
        title={presentation.title}
        destinoDireccion={destinoDireccion}
        destinoCiudad={destinoCiudad}
        destinoReferencias={destinoReferencias}
        destinoLat={destinoLat}
        destinoLng={destinoLng}
      />
    );
  }

  if (estado === "llegada_a_destino") {
    if (!contactoRecepcionNombre || !contactoRecepcionTelefono) {
      return <Aviso tono="danger">Falta el contacto de recepción para continuar.</Aviso>;
    }
    return (
      <ContactoRecepcionVehiculo
        trasladoId={trasladoId}
        primaryActionLabel={presentation.primaryAction.label}
        contactoNombre={contactoRecepcionNombre}
        contactoTelefono={contactoRecepcionTelefono}
        vehiculoMarca={vehiculoMarca}
        vehiculoModelo={vehiculoModelo}
        vehiculoAnio={vehiculoAnio}
        vehiculoColor={vehiculoColor}
        vehiculoPlacas={vehiculoPlacas}
        vehiculoVin={vehiculoVin}
      />
    );
  }

  const requiereEvidencia = ESTADOS_QUE_REQUIEREN_EVIDENCIA.includes(estado);
  const siguientePosible = TRANSICIONES[estado]?.[0];
  const etiqueta = presentation.primaryAction.label;
  const ejecutarAccionSinTransicion = () => {
    if (presentation.primaryAction.action === "review_status") {
      router.refresh();
      return;
    }

    router.push("/viajes");
  };

  if (requiereEvidencia) {
    return (
      <div>
        <p className="mb-2 font-body text-xs text-text-secondary">
          {fotosCompletadas} de 5 ángulos capturados
        </p>
        <NextOperationalAction
          title={presentation.title}
          instruction={presentation.instruction}
          context={contextoVehiculo(vehiculoMarca, vehiculoModelo, vehiculoAnio, vehiculoPlacas)}
          eta="Tiempo de registro: 3 a 5 minutos"
          primaryCta={{ label: etiqueta, onClick: () => router.push(`/viajes/${trasladoId}/evidencia`) }}
          secondaryCta={{ label: "Reportar un problema", onClick: () => router.push(`/viajes/${trasladoId}#reportar-problema`) }}
          nextStep={presentation.nextStep}
          stageLabel={`Paso ${presentation.stage} de ${presentation.totalStages}`}
        />
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
    <NextOperationalAction
      title={presentation.title}
      instruction={presentation.instruction}
      context={
        presentation.primaryAction.action === "go_origin" || presentation.primaryAction.action === "mark_arrived_origin"
          ? contextoDireccion(origenDireccion, origenCiudad, origenReferencias)
          : presentation.primaryAction.action === "go_destination" || presentation.primaryAction.action === "mark_arrived_destination"
            ? contextoDireccion(destinoDireccion, destinoCiudad, destinoReferencias)
            : contextoVehiculo(vehiculoMarca, vehiculoModelo, vehiculoAnio, vehiculoPlacas)
      }
      eta="ETA por confirmar al abrir navegación"
      primaryCta={{
        label: procesando ? TEXTOS_CARGANDO.actualizando : etiqueta,
        onClick: siguientePosible ? avanzar : ejecutarAccionSinTransicion,
        disabled: procesando,
        variant: siguientePosible ? "primary" : "secondary"
      }}
      secondaryCta={{ label: "Contactar soporte", onClick: () => router.push("/cuenta/soporte") }}
      loading={procesando}
      error={error}
      nextStep={presentation.nextStep}
      stageLabel={`Paso ${presentation.stage} de ${presentation.totalStages}`}
    />
  );
}
