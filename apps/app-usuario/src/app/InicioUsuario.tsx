"use client";

import Link from "next/link";
import type { Database } from "@ruum/shared/types";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import { obtenerViajeActivo } from "../lib/inicio";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];

export interface InicioUsuarioProps {
  usuario: UsuarioRow | null;
  traslados: PasaporteRow[];
}

function tarjetaVehiculo(traslado: PasaporteRow): string {
  const partes = [
    traslado.vehiculo_marca,
    traslado.vehiculo_modelo,
    traslado.vehiculo_anio ? String(traslado.vehiculo_anio) : null,
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(" ") : "Vehículo";
}

function primerNombre(nombre: string | null | undefined): string {
  const valor = nombre?.trim().split(/\s+/)[0];
  if (!valor) return "Luis";
  return valor.charAt(0).toUpperCase() + valor.slice(1).toLowerCase();
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

export function InicioUsuario({ usuario, traslados }: InicioUsuarioProps) {
  const viajeActivo = obtenerViajeActivo(traslados);
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

      <section id="activeTransferCard" aria-labelledby="traslados-activos" className="user-v2-card p-5">
        {viajeActivo ? (
          <>
            <div className="flex items-center gap-4">
              <span className="user-v2-icon-well">
                <IconoCarro className="size-8" />
              </span>
              <div className="min-w-0">
                <h2 id="traslados-activos" className="user-v2-card-title">Traslado activo</h2>
                <p className="user-v2-caption user-v2-muted mt-1 truncate">{tarjetaVehiculo(viajeActivo)}</p>
              </div>
            </div>
            <Link
              href={viajeActivo.traslado_id ? `/traslados/${viajeActivo.traslado_id}` : "/mis-viajes"}
              className="user-v2-secondary-button group mt-5 flex items-center justify-between px-3.5"
            >
              <span>{viajeActivo.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[viajeActivo.vehiculo_tipo] ?? "Ver seguimiento" : "Ver seguimiento"}</span>
              <IconoChevron className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </>
        ) : (
          <div className="flex flex-col items-center text-center">
            <span className="user-v2-icon-well" aria-hidden="true">
              <IconoCarro className="size-8" />
            </span>
            <h2 id="traslados-activos" className="user-v2-heading-2 mt-4">Sin traslados activos</h2>
            <p className="user-v2-caption user-v2-muted mt-1">Tu próximo traslado aparecerá aquí.</p>
            <Link id="firstTransferButton" href="/traslados/nuevo" className="user-v2-secondary-button mt-5 flex w-full items-center justify-center gap-2 px-3.5">
              <span>Solicitar mi primer traslado</span>
              <IconoChevron className="size-4" />
            </Link>
          </div>
        )}
      </section>

      <section id="quickActions" aria-labelledby="acciones-rapidas">
        <h2 id="acciones-rapidas" className="user-v2-heading-2">Acciones rápidas</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link id="quickActionPassport" href="/pasaporte" className="user-v2-card user-v2-card-interactive group flex min-h-[144px] flex-col p-4">
            <span className="user-v2-icon-well size-11 text-[var(--user-color-brand-dark)]">
              <IconoPortapapeles className="size-7" />
            </span>
            <span className="mt-auto block">
              <span className="user-v2-card-title block">Pasaporte Digital</span>
              <span className="user-v2-caption user-v2-muted mt-1 block">Consulta el estado de tus traslados.</span>
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
