import Link from "next/link";
import type { ReactNode } from "react";
import {
  Aviso,
  Button,
  EstadoBadge,
  EstadoStepper,
  PassportCard,
  CATEGORIA_POR_ESTADO,
  ETIQUETA_CATEGORIA,
} from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import { formatearFechaRelativa } from "@ruum/shared/utils";
import type { Database } from "@ruum/shared/types";
import { construirNotificaciones, obtenerViajeActivo } from "../lib/inicio";
import { PILARES_CONFIANZA } from "../lib/pilares-confianza";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];

export interface InicioUsuarioProps {
  usuario: UsuarioRow | null;
  traslados: PasaporteRow[];
}

function tarjetaVehiculo(t: PasaporteRow): string {
  const partes = [
    t.vehiculo_marca,
    t.vehiculo_modelo,
    t.vehiculo_anio ? String(t.vehiculo_anio) : null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" ") : "Vehículo";
}


/* Íconos ilustrativos SVG para accesos rápidos, estados y vehículos */
function IconoEscudoPasaporte({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconoRutaViajes({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </svg>
  );
}

function IconoCentroAyuda({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r=".5" fill="currentColor" />
    </svg>
  );
}

function IconoChevron({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function AccesoRapido({
  titulo,
  descripcion,
  href,
  icono,
  ctaVacio,
  ctaHref,
  colorVariante = "default",
}: {
  titulo: string;
  descripcion: string;
  href?: string;
  icono: ReactNode;
  ctaVacio?: string;
  ctaHref?: string;
  colorVariante?: "route" | "warning" | "success" | "default";
}) {
  const estiloIcono = {
    route: "bg-route-soft text-route-action border-route-action/20",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    default: "bg-surface-elevated text-text-primary border-border",
  }[colorVariante];

  const contenido = (
    <div className="flex items-start gap-3.5 w-full">
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${estiloIcono} shadow-2xs`}>
        {icono}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold text-text-primary leading-snug group-hover:text-route-action transition-colors">
          {titulo}
        </p>
        <p className="mt-1 font-body text-xs text-text-secondary leading-relaxed line-clamp-2">
          {descripcion}
        </p>
      </div>
      <div className="flex size-12 shrink-0 items-center justify-center -mr-2 text-text-tertiary group-hover:text-route-action group-hover:translate-x-0.5 transition-all">
        <IconoChevron className="size-5" />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="app-card app-card-interactive group flex min-h-[88px] items-center rounded-card bg-surface p-4 border border-border shadow-xs hover:border-route-action/60 hover:bg-surface-elevated active:scale-[0.98] transition-all"
      >
        {contenido}
      </Link>
    );
  }

  /* Estado vacío: card visible con CTA contextual */
  return (
    <div className="app-card rounded-card bg-surface/50 p-4 border border-border/40 min-h-[88px]">
      <div className="flex items-start gap-3.5">
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${estiloIcono} opacity-70`}>
          {icono}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-text-primary leading-snug">{titulo}</p>
          <p className="mt-1 font-body text-xs text-text-secondary leading-relaxed">{descripcion}</p>
          {ctaVacio && ctaHref && (
            <Link
              href={ctaHref}
              className="mt-2.5 inline-flex items-center gap-1 font-body text-xs font-semibold text-route-action underline-offset-4 hover:underline"
            >
              {ctaVacio} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function SeccionTitulo({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-xs font-bold uppercase tracking-wider text-text-tertiary">
      {children}
    </h2>
  );
}

export function InicioUsuario({ usuario, traslados }: InicioUsuarioProps) {
  const viajeActivo = obtenerViajeActivo(traslados);
  const viajeActivoVisible = viajeActivo?.traslado_id && viajeActivo.estado
    ? { ...viajeActivo, traslado_id: viajeActivo.traslado_id, estado: viajeActivo.estado }
    : null;
  const notificaciones = construirNotificaciones(usuario, traslados);
  const primerNombre = usuario?.nombre?.trim().split(" ")[0];

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Hero + CTA principal único destacado */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-body text-sm font-medium text-text-secondary">
            {primerNombre ? `Hola, ${primerNombre}` : "Hola"}
          </p>
          <h1 className="mt-1 font-display text-2xl font-black leading-tight tracking-tight sm:text-4xl text-text-primary">
            Mueve tu auto sin soltar el control.
          </h1>
          <p className="mt-2 max-w-md font-body text-sm text-text-secondary">
            Solicita un traslado, sigue cada paso en tiempo real y consulta el
            Pasaporte Digital cuando quieras.
          </p>
        </div>
        <Link href="/traslados/nuevo" className="sm:shrink-0">
          <Button variant="primary" className="w-full sm:w-auto font-display font-bold shadow-md">
            Solicitar traslado
          </Button>
        </Link>
      </section>

      {/* Traslado activo */}
      <section>
        <SeccionTitulo>Traslado activo</SeccionTitulo>

        {viajeActivoVisible ? (
          <Link href={`/traslados/${viajeActivoVisible.traslado_id}`} className="mt-3 block">
            <PassportCard
              className="app-card-interactive shadow-lg"
              folio={viajeActivoVisible.traslado_id.slice(0, 8).toUpperCase()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-base font-bold text-text-primary sm:text-lg">
                    {tarjetaVehiculo(viajeActivoVisible)}
                    {viajeActivoVisible.vehiculo_tipo && (
                      <span className="ml-2 font-body text-xs font-normal text-text-tertiary">
                        · {ETIQUETA_TIPO_VEHICULO[viajeActivoVisible.vehiculo_tipo]}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 font-body text-xs text-text-secondary">
                    {ETIQUETA_CATEGORIA[CATEGORIA_POR_ESTADO[viajeActivoVisible.estado]]} ·{" "}
                    {formatearFechaRelativa(viajeActivoVisible.creado_en ?? viajeActivoVisible.actualizado_en ?? new Date().toISOString())}
                  </p>
                </div>
                <EstadoBadge estado={viajeActivoVisible.estado} />
              </div>

              {viajeActivoVisible.tiene_incidencia_abierta && (
                <div className="mt-4">
                  <Aviso tono="atencion">Este traslado tiene una incidencia abierta.</Aviso>
                </div>
              )}

              <div className="mt-6">
                <EstadoStepper estado={viajeActivoVisible.estado} />
              </div>
            </PassportCard>
          </Link>
        ) : (
          <div className="mt-3 rounded-card border border-dashed border-border bg-surface/30 px-6 py-8 text-center">
            <p className="font-body text-sm text-text-secondary">
              Aún no tienes ningún traslado en curso.
            </p>
            <Link
              href="/traslados/nuevo"
              className="mt-3 inline-flex items-center gap-1 font-body text-sm font-semibold text-route-action underline-offset-4 hover:underline"
            >
              Solicita un traslado →
            </Link>
          </div>
        )}
      </section>

      {/* Notificaciones */}
      {notificaciones.length > 0 && (
        <section>
          <SeccionTitulo>Notificaciones</SeccionTitulo>
          <div className="mt-3 grid gap-2.5">
            {notificaciones.map((n) => {
              const aviso = <Aviso tono={n.tono}>{n.mensaje}</Aviso>;
              return n.href ? (
                <Link key={n.id} href={n.href} className="block">
                  {aviso}
                </Link>
              ) : (
                <div key={n.id}>{aviso}</div>
              );
            })}
          </div>
        </section>
      )}

      {/* Accesos rápidos en cuadrícula táctil */}
      <section>
        <SeccionTitulo>Accesos rápidos</SeccionTitulo>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <AccesoRapido
            titulo="Pasaporte Digital"
            descripcion={
              viajeActivoVisible
                ? "Consulta el estatus, evidencia y trazabilidad de tu traslado"
                : "Disponible con un traslado activo"
            }
            icono={<IconoEscudoPasaporte className="size-5" />}
            colorVariante="route"
            href={viajeActivoVisible ? `/traslados/${viajeActivoVisible.traslado_id}` : undefined}
            ctaVacio="Ver mis traslados"
            ctaHref="/mis-viajes"
          />
          <AccesoRapido
            titulo="Mis traslados"
            descripcion="Activos, programados e historial completo"
            icono={<IconoRutaViajes className="size-5" />}
            colorVariante="warning"
            href="/mis-viajes"
          />
          <AccesoRapido
            titulo="Centro de ayuda"
            descripcion={
              viajeActivoVisible
                ? "Reporta pagos, evidencia o incidentes"
                : "Contacta con el equipo de soporte 24/7"
            }
            icono={<IconoCentroAyuda className="size-5" />}
            colorVariante="success"
            href={
              viajeActivoVisible ? `/soporte?viaje=${viajeActivoVisible.traslado_id}` : "/soporte"
            }
          />
        </div>
      </section>

      {/* Pilares de confianza */}
      <section className="mt-10 grid gap-6 border-t border-border pt-8 sm:grid-cols-3">
        {PILARES_CONFIANZA.map((pilar) => (
          <div key={pilar.titulo} className="rounded-xl border border-border/40 bg-surface/40 p-4">
            <h3 className="font-display text-sm font-bold text-text-primary">{pilar.titulo}</h3>
            <p className="mt-2 font-body text-xs leading-relaxed text-text-secondary">
              {pilar.cuerpo}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
