"use client";

import Link from "next/link";
import { Aviso, Button } from "@ruum/ui";
import { ConfirmarDisponibilidad } from "../ConfirmarDisponibilidad";
import { RegistroViajeActivo } from "../ViajeActivoContext";
import { EstadoRevisionConductor } from "./EstadoRevisionConductor";
import { PanelActiveTrip } from "./PanelActiveTrip";
import { PanelHome } from "./PanelHome";
import { usePanelData } from "./usePanelData";
import { registroViajeActivoDesdePasaporte } from "../active-trip-state";
import { useCerrarSesion } from "../../lib/use-cerrar-sesion";

function PanelLoadingSkeleton() {
  return (
    <output className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Cargando panel operativo" aria-busy="true">
      <div className="rounded-2xl border border-route-action/35 bg-surface-elevated p-5 sm:col-span-2 lg:col-span-3">
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
    </output>
  );
}

export default function PaginaPanel() {
  const { cerrarSesion, cerrandoSesion, errorCerrarSesion } = useCerrarSesion();
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

  if (enRevision) {
    return (
      <EstadoRevisionConductor
        conductorId={enRevision.conductorId}
        solicitudId={enRevision.solicitudId}
        nombre={enRevision.nombre}
        documentosIniciales={enRevision.documentos}
        estadoExpediente={enRevision.estado}
        enviadoEn={enRevision.enviadoEn}
        onSalir={() => void cerrarSesion()}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <RegistroViajeActivo
        viaje={viajeActivoPrincipal ? registroViajeActivoDesdePasaporte(viajeActivoPrincipal) : null}
      />

      {/* Encabezado con Jerarquía Tipográfica Unificada y Alto Contraste */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/40 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            <span className="font-normal text-text-tertiary">Hola, </span>
            {conductor?.nombre ?? "conductor"}
          </h1>
          <p className="mt-1 font-body text-xs text-text-tertiary">
            Bienvenido a tu panel de control operativo de traslados.
          </p>
        </div>

        {/* Acciones de Cabecera con Alto Contraste y Accesibilidad Visibles */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/cuenta" aria-label="Ir a configuración de cuenta">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-elevated px-3.5 py-2 font-display text-xs font-bold text-text-primary transition hover:border-signal hover:bg-surface active:scale-95">
              ⚙️ Ajustes de Cuenta
            </span>
          </Link>

          {conductor ? (
            <button
              type="button"
              onClick={() => void cerrarSesion()}
              disabled={cerrandoSesion}
              aria-label="Cerrar sesión actual"
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 font-display text-xs font-bold text-red-500 transition hover:border-red-500/60 hover:bg-red-500/20 active:scale-95 disabled:opacity-50"
            >
              🚪 {cerrandoSesion ? "Cerrando..." : "Cerrar sesión"}
            </button>
          ) : (
            <Link href="/login" aria-label="Iniciar sesión">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-signal px-3.5 py-2 font-display text-xs font-bold text-slate-950 transition hover:bg-signal-hover active:scale-95">
                🔑 Iniciar sesión
              </span>
            </Link>
          )}
        </div>
      </header>

      {errorCerrarSesion ? <div className="mt-4"><Aviso tono="danger">{errorCerrarSesion}</Aviso></div> : null}

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
