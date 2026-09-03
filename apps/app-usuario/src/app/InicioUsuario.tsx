"use client";

import { useState } from "react";
import Link from "next/link";
import type { Database } from "@ruum/shared/types";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import { esTrasladoActivo, obtenerViajeActivo } from "../lib/inicio";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type FiltroTraslados = "activo" | "programados" | "historial";

export interface InicioUsuarioProps {
  usuario: UsuarioRow | null;
  traslados: PasaporteRow[];
}

const ESTADOS_PROGRAMADOS = new Set([
  "solicitud_creada",
  "documentacion_pendiente",
  "documentacion_en_revision",
  "cotizacion_generada",
  "cotizacion_aceptada",
  "servicio_confirmado",
  "pendiente_de_conductor",
]);

function tarjetaVehiculo(traslado: PasaporteRow): string {
  const partes = [
    traslado.vehiculo_marca,
    traslado.vehiculo_modelo,
    traslado.vehiculo_anio ? String(traslado.vehiculo_anio) : null,
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(" ") : "Vehículo";
}

function fechaCorta(fecha: string | null): string {
  if (!fecha) return "Traslado registrado";

  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(fecha));
}

function primerNombre(nombre: string | null | undefined): string {
  const valor = nombre?.trim().split(/\s+/)[0];
  if (!valor) return "Luis";
  return valor.charAt(0).toUpperCase() + valor.slice(1).toLowerCase();
}

function trasladosParaFiltro(traslados: PasaporteRow[], filtro: FiltroTraslados): PasaporteRow[] {
  return traslados.filter((traslado) => {
    if (!traslado.estado) return false;

    if (filtro === "historial") return !esTrasladoActivo(traslado.estado);
    if (filtro === "programados") return ESTADOS_PROGRAMADOS.has(traslado.estado);
    return esTrasladoActivo(traslado.estado);
  });
}

function IconoCarro({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.2 10.5 6.7 6.8A2 2 0 0 1 8.55 5.5h6.9a2 2 0 0 1 1.85 1.3l1.5 3.7c1.05.32 1.7 1.28 1.7 2.38v4.37a1 1 0 0 1-1 1h-1.4a1 1 0 0 1-1-1v-.75H6.9v.75a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-4.37c0-1.1.65-2.06 1.7-2.38Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M6.5 10.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="7.2" cy="14.4" r="1.3" fill="currentColor" />
      <circle cx="16.8" cy="14.4" r="1.3" fill="currentColor" />
    </svg>
  );
}

function IconoPortapapeles({ className = "size-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="7" y="5" width="18" height="23" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 5.5V4h8v1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 11h10M11 15h10M11 19h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="23.5" cy="22.5" r="6" fill="var(--user-color-brand)" stroke="var(--user-color-surface)" strokeWidth="1.5" />
      <path d="m20.8 22.5 1.8 1.8 3.4-3.8" stroke="var(--user-color-surface)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoPregunta({ className = "size-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M6 7.5A3.5 3.5 0 0 1 9.5 4h13A3.5 3.5 0 0 1 26 7.5v10a3.5 3.5 0 0 1-3.5 3.5H15l-5.7 4v-4.2A3.5 3.5 0 0 1 6 17.5v-10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M11 10h10M11 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18.5 25.5c.8-1.7 2.3-2.1 2.3-3.6 0-1.1-.8-2-2-2-1 0-1.8.6-2.1 1.5M18.5 27.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconoAyuda({ className = "size-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12.8 12.5a3.4 3.4 0 1 1 5.9 2.3c-1.1 1.2-2.7 1.8-2.7 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="22" r="1" fill="currentColor" />
    </svg>
  );
}

function IconoChevron({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoCalendario({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 3.5v3M17 3.5v3M3.5 9h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconoReloj({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoHistorial({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 8.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.5 5.5v3.4h3.4M12 8v4l2.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FILTROS: { id: FiltroTraslados; etiqueta: string; Icono: typeof IconoReloj }[] = [
  { id: "activo", etiqueta: "Activo", Icono: IconoReloj },
  { id: "programados", etiqueta: "Programados", Icono: IconoCalendario },
  { id: "historial", etiqueta: "Historial", Icono: IconoHistorial },
];

function ListaFiltrada({ traslados, filtro }: { traslados: PasaporteRow[]; filtro: FiltroTraslados }) {
  if (filtro === "activo") return null;

  const titulo = filtro === "programados" ? "No tienes traslados programados" : "Aún no tienes historial";
  const descripcion = filtro === "programados"
    ? "Aquí aparecerán tus próximos traslados."
    : "Tus traslados completados aparecerán aquí.";

  if (traslados.length === 0) {
    return (
      <div className="user-v2-card px-4 py-5 text-center">
        <p className="user-v2-heading-3">{titulo}</p>
        <p className="user-v2-caption user-v2-muted mt-1">{descripcion}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-label={filtro === "programados" ? "Traslados programados" : "Historial de traslados"}>
      {traslados.slice(0, 3).map((traslado) => (
        <li key={traslado.traslado_id ?? `${traslado.creado_en}-${traslado.estado}`}>
          <Link
            href={traslado.traslado_id ? `/traslados/${traslado.traslado_id}` : "/mis-viajes"}
            className="user-v2-card user-v2-card-interactive flex min-h-14 items-center justify-between gap-3 px-4 py-3"
          >
            <span className="min-w-0">
              <span className="user-v2-card-title block truncate">{tarjetaVehiculo(traslado)}</span>
              <span className="user-v2-caption user-v2-muted mt-0.5 block">{fechaCorta(traslado.creado_en)}</span>
            </span>
            <IconoChevron className="size-4 shrink-0 text-[var(--user-color-brand-dark)]" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function InicioUsuario({ usuario, traslados }: InicioUsuarioProps) {
  const [filtro, setFiltro] = useState<FiltroTraslados>("activo");
  const viajeActivo = obtenerViajeActivo(traslados);
  const trasladosFiltrados = trasladosParaFiltro(traslados, filtro);
  const nombre = primerNombre(usuario?.nombre);

  return (
    <div className="user-v2-screen">
      <section id="greetingBlock" aria-labelledby="saludo-usuario">
        <h1 id="saludo-usuario" className="user-v2-heading-1">Hola, {nombre}</h1>
        <p className="user-v2-body user-v2-muted mt-1">Gestiona tus traslados fácilmente.</p>
      </section>

      <Link id="requestTransferButton" href="/traslados/nuevo" className="user-v2-primary-button group flex items-center justify-between px-4">
        <span className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-white text-[var(--user-color-primary)]">
            <IconoCarro className="size-6" />
          </span>
          <span>Solicitar traslado</span>
        </span>
        <IconoChevron className="size-6 transition-transform group-hover:translate-x-0.5" />
      </Link>

      <section id="activeTransferCard" aria-labelledby="traslado-activo" className="user-v2-card p-5">
        <div className="flex items-center gap-4">
          <span className="user-v2-icon-well">
            <IconoPortapapeles className="size-8" />
          </span>
          <div className="min-w-0">
            <h2 id="traslado-activo" className="user-v2-card-title">Su traslado activo</h2>
            {viajeActivo ? (
              <p className="user-v2-caption user-v2-muted mt-1 truncate">{tarjetaVehiculo(viajeActivo)}</p>
            ) : (
              <p className="user-v2-caption user-v2-muted mt-1">No tiene traslados activos.</p>
            )}
          </div>
        </div>

        {viajeActivo ? (
          <Link
            href={viajeActivo.traslado_id ? `/traslados/${viajeActivo.traslado_id}` : "/mis-viajes"}
            className="user-v2-secondary-button group mt-5 flex items-center justify-between px-3.5"
          >
            <span>{viajeActivo.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[viajeActivo.vehiculo_tipo] ?? "Ver seguimiento" : "Ver seguimiento"}</span>
            <IconoChevron className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <Link id="upcomingTransfersButton" href="/mis-viajes?tab=programados" className="user-v2-secondary-button group mt-5 flex items-center justify-between px-3.5">
            <span>Explorar próximos traslados</span>
            <IconoChevron className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </section>

      <section id="transferTabs" aria-labelledby="mis-traslados">
        <h2 id="mis-traslados" className="user-v2-heading-2">Mis traslados</h2>
        <div className="mt-3 grid grid-cols-3 gap-2" role="tablist" aria-label="Filtrar mis traslados">
          {FILTROS.map(({ id, etiqueta, Icono }) => {
            const activo = filtro === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activo}
                aria-controls="transfer-filter-panel"
                onClick={() => setFiltro(id)}
                className="user-v2-tab flex items-center justify-center gap-1.5"
              >
                <Icono className="size-4" />
                {etiqueta}
              </button>
            );
          })}
        </div>
        <div id="transfer-filter-panel" role="tabpanel" aria-label={`Contenido de ${filtro}`} className="mt-3">
          <ListaFiltrada traslados={trasladosFiltrados} filtro={filtro} />
        </div>
      </section>

      <section id="quickActions" aria-labelledby="acciones-rapidas">
        <h2 id="acciones-rapidas" className="user-v2-heading-2">Acciones rápidas</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link id="quickActionPreguntaDigital" href="/soporte" className="user-v2-card user-v2-card-interactive group flex min-h-[144px] flex-col p-4">
            <span className="user-v2-icon-well size-11 text-[var(--user-color-brand-dark)]">
              <IconoPregunta className="size-7" />
            </span>
            <span className="mt-auto block">
              <span className="user-v2-card-title block">Pregunta Digital</span>
              <span className="user-v2-caption user-v2-muted mt-1 block">Resuelve tus dudas sobre el traslado.</span>
            </span>
            <span className="mt-2 flex justify-end text-[var(--user-color-brand-dark)] transition-transform group-hover:translate-x-0.5"><IconoChevron className="size-4" /></span>
          </Link>

          <Link id="quickActionHelpCenter" href="/soporte" className="user-v2-card user-v2-card-interactive group flex min-h-[144px] flex-col p-4">
            <span className="user-v2-icon-well size-11">
              <IconoAyuda className="size-7" />
            </span>
            <span className="mt-auto block">
              <span className="user-v2-card-title block">Centro de ayuda</span>
              <span className="user-v2-caption user-v2-muted mt-1 block">Encuentra respuestas y asistencia rápida.</span>
            </span>
            <span className="mt-2 flex justify-end text-[var(--user-color-brand-dark)] transition-transform group-hover:translate-x-0.5"><IconoChevron className="size-4" /></span>
          </Link>
        </div>
      </section>
    </div>
  );
}
