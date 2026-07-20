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
import { desactivarPushDelDispositivo } from "../../lib/push-notifications";

function PanelLoadingSkeleton() {
  return (
    <section className="mt-8 grid gap-5" role="status" aria-label="Cargando panel operativo" aria-busy="true">
      <div className="rounded-2xl border border-route-action/35 bg-surface-elevated p-5">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div className="grid gap-3">
            <div className="h-3 w-40 animate-pulse rounded bg-text-secondary/18" />
            <div className="h-7 w-48 animate-pulse rounded bg-text-primary/20" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-text-secondary/14" />
          </div>
          <div className="h-14 w-full animate-pulse rounded-lg bg-action-primary/22" />
        </div>
      </div>
      {[1, 2, 3].map((item) => (
        <div key={item} className="rounded-2xl border border-border/22 bg-surface p-5">
          <div className="h-3 w-32 animate-pulse rounded bg-text-secondary/18" />
          <div className="mt-3 h-6 w-56 animate-pulse rounded bg-text-primary/18" />
          <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded bg-text-secondary/14" />
        </div>
      ))}
    </section>
  );
}

export default function PaginaPanel() {
  const router = useRouter();
  const {
    cargando,
    conductor,
    disponibilidad,
    disponibilidadPendiente,
    persistiendoDisponibilidad,
    viajesDisponibles,
    enRevision,
    viajeActivoPrincipal,
    proximoViaje,
    documentoBloqueante,
    errorDisponibilidad,
    seleccionarDisponibilidad,
    persistirDisponibilidad,
    setDisponibilidadPendiente
  } = usePanelData();

  async function cerrarSesion() {
    const cliente = crearClienteNavegador();
    await desactivarPushDelDispositivo();
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-14">
      <RegistroViajeActivo
        viaje={viajeActivoPrincipal ? registroViajeActivoDesdePasaporte(viajeActivoPrincipal) : null}
      />

      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-body text-sm font-medium text-text-tertiary">Hola,</p>
          <h1 className="font-display text-2xl font-semibold leading-tight text-text-primary sm:text-3xl">
            {conductor?.nombre ?? "conductor"}
          </h1>
        </div>
        <div className="hidden flex-wrap items-center gap-3 md:flex">
          <Link href="/cuenta" aria-label="Ir a configuración de cuenta">
            <Button variant="quiet">Configuración</Button>
          </Link>
          {conductor ? (
            <button 
              onClick={cerrarSesion} 
              className="inline-flex min-h-11 items-center font-body text-sm text-text-secondary hover:text-text-primary"
              aria-label="Cerrar sesión actual"
            >
              Cerrar sesión
            </button>
          ) : (
            <Link href="/login" className="font-body text-sm font-medium text-text-secondary hover:text-text-primary" aria-label="Iniciar sesión">
              Iniciar sesión
            </Link>
          )}
        </div>
      </header>

      {cargando ? (
        <PanelLoadingSkeleton />
      ) : viajeActivoPrincipal ? (
        <PanelActiveTrip viaje={viajeActivoPrincipal} />
      ) : (
        <PanelHome
          conductor={conductor}
          disponibilidad={disponibilidad}
          persistiendoDisponibilidad={persistiendoDisponibilidad}
          viajesDisponibles={viajesDisponibles}
          proximoViaje={proximoViaje}
          documentoBloqueante={documentoBloqueante}
          errorDisponibilidad={errorDisponibilidad}
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
