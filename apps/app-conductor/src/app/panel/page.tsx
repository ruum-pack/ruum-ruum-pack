"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@ruum/ui";
import { crearClienteNavegador } from "../../lib/supabase-browser";
import { limpiarBorradorRegistroLocal } from "../../lib/borrador-registro";
import { ConfirmarDisponibilidad } from "../ConfirmarDisponibilidad";
import { RegistroViajeActivo } from "../ViajeActivoContext";
import { EstadoRevisionConductor } from "./EstadoRevisionConductor";
import { PanelActiveTrip } from "./PanelActiveTrip";
import { PanelHome } from "./PanelHome";
import { usePanelData } from "./usePanelData";
import { registroViajeActivoDesdePasaporte } from "../active-trip-state";

export default function PaginaPanel() {
  const router = useRouter();
  const {
    conductor,
    disponibilidad,
    disponibilidadPendiente,
    persistiendoDisponibilidad,
    viajesDisponibles,
    enRevision,
    viajeActivoPrincipal,
    proximoViaje,
    documentoBloqueante,
    avisoPrioritario,
    seleccionarDisponibilidad,
    persistirDisponibilidad,
    setDisponibilidadPendiente
  } = usePanelData();

  async function cerrarSesion() {
    const cliente = crearClienteNavegador();
    await cliente.auth.signOut();
    limpiarBorradorRegistroLocal();
    router.push("/onboarding");
    router.refresh();
  }

  if (enRevision) {
    return (
      <EstadoRevisionConductor
        conductorId={enRevision.conductorId}
        solicitudId={enRevision.solicitudId}
        nombre={enRevision.nombre}
        documentosIniciales={enRevision.documentos}
        estadoExpediente={enRevision.estado}
        enviadoEn={enRevision.enviadoEn}
        onSalir={cerrarSesion}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-14">
      <RegistroViajeActivo
        viaje={viajeActivoPrincipal ? registroViajeActivoDesdePasaporte(viajeActivoPrincipal) : null}
      />

      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight">Panel</h1>
          <p className="mt-1 font-body text-sm text-text-secondary">Hola, {conductor?.nombre ?? "conductor"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/cuenta">
            <Button variant="quiet">Configuración</Button>
          </Link>
          {conductor ? (
            <button onClick={cerrarSesion} className="inline-flex min-h-11 items-center font-body text-sm text-text-secondary hover:text-text-primary">
              Cerrar sesión
            </button>
          ) : (
            <Link href="/login" className="font-body text-sm font-medium text-text-secondary hover:text-text-primary">
              Iniciar sesión
            </Link>
          )}
        </div>
      </header>

      {viajeActivoPrincipal ? (
        <PanelActiveTrip viaje={viajeActivoPrincipal} />
      ) : (
        <PanelHome
          conductor={conductor}
          disponibilidad={disponibilidad}
          persistiendoDisponibilidad={persistiendoDisponibilidad}
          viajesDisponibles={viajesDisponibles}
          proximoViaje={proximoViaje}
          documentoBloqueante={documentoBloqueante}
          avisoPrioritario={avisoPrioritario}
          onSeleccionarDisponibilidad={seleccionarDisponibilidad}
        />
      )}

      <ConfirmarDisponibilidad
        abierto={disponibilidadPendiente === "no_disponible"}
        persistiendo={persistiendoDisponibilidad}
        onCancelar={() => {
          if (!persistiendoDisponibilidad) setDisponibilidadPendiente(null);
        }}
        onConfirmar={() => void persistirDisponibilidad("no_disponible")}
      />
    </div>
  );
}
