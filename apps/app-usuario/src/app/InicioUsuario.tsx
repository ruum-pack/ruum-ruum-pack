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
import { formatearFechaRelativa, formatearPrecio } from "@ruum/shared/utils";
import type { Database } from "@ruum/shared/types";
import { construirNotificaciones, obtenerHistorial, obtenerViajeActivo } from "../lib/inicio";
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


 
function AccesoRapido({
  titulo,
  descripcion,
  href,
  ctaVacio,
  ctaHref,
}: {
  titulo: string;
  descripcion: string;
  href?: string;
  ctaVacio?: string;
  ctaHref?: string;
}) {
  const contenido = (
    <>
      <p className="font-display text-sm font-semibold leading-snug">{titulo}</p>
      <p className="mt-1 font-body text-xs text-ink/55">{descripcion}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="app-card app-card-interactive block rounded-card bg-mist p-4 hover:border-signal/60 hover:bg-signal-soft/40"
      >
        {contenido}
      </Link>
    );
  }

  /* Estado vacío: card visible con CTA contextual — nunca solo opacidad */
  return (
    <div className="app-card rounded-card bg-mist-dim/30 p-4">
      {contenido}
      {ctaVacio && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-3 inline-block font-body text-xs font-medium text-route-dark underline-offset-4 hover:underline"
        >
          {ctaVacio} →
        </Link>
      )}
    </div>
  );
}

function SeccionTitulo({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">
      {children}
    </h2>
  );
}

export function InicioUsuario({ usuario, traslados }: InicioUsuarioProps) {
  const viajeActivo = obtenerViajeActivo(traslados);
  const viajeActivoVisible = viajeActivo?.traslado_id && viajeActivo.estado
    ? { ...viajeActivo, traslado_id: viajeActivo.traslado_id, estado: viajeActivo.estado }
    : null;
  const historial = obtenerHistorial(traslados).filter(
    (t) => t.traslado_id !== viajeActivoVisible?.traslado_id
  );
  const notificaciones = construirNotificaciones(usuario, traslados);
  const primerNombre = usuario?.nombre?.trim().split(" ")[0];

  return (
    <div>
      {/* Hero + CTA principal */}
      <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-body text-sm text-ink/55">
            {primerNombre ? `Hola, ${primerNombre}` : "Hola"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
            Mueve tu auto sin soltar el control.
          </h1>
          <p className="mt-3 max-w-md font-body text-sm text-ink/65">
            Solicita un traslado, sigue cada paso en tiempo real y consulta el
            Pasaporte Digital cuando quieras.
          </p>
        </div>
        <Link href="/traslados/nuevo" className="sm:shrink-0">
          <Button className="w-full sm:w-auto">Solicitar traslado</Button>
        </Link>
      </section>

      {/* Traslado activo */}
      <section className="mt-10">
        <SeccionTitulo>Traslado activo</SeccionTitulo>

        {viajeActivoVisible ? (
          <Link href={`/traslados/${viajeActivoVisible.traslado_id}`} className="mt-3 block">
            <PassportCard
              className="app-card-interactive"
              folio={viajeActivoVisible.traslado_id.slice(0, 8).toUpperCase()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-base font-semibold">
                    {tarjetaVehiculo(viajeActivoVisible)}
                  </p>
                  <p className="mt-0.5 font-body text-xs text-ink/50">
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
          <div className="mt-3 rounded-card border border-dashed border-ink/15 px-6 py-8 text-center">
            <p className="font-body text-sm text-ink/60">
              Aún no tienes ningún traslado en curso.
            </p>
            <Link
              href="/traslados/nuevo"
              className="mt-2 inline-block font-body text-sm font-medium text-route-dark underline-offset-4 hover:underline"
            >
              Solicita un traslado →
            </Link>
          </div>
        )}
      </section>

      {/* Notificaciones */}
      {notificaciones.length > 0 && (
        <section className="mt-10">
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

      {/* Accesos rápidos — nunca deshabilitados, siempre con CTA */}
      <section className="mt-10">
        <SeccionTitulo>Accesos rápidos</SeccionTitulo>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <AccesoRapido
            titulo="Pasaporte Digital"
            descripcion={
              viajeActivoVisible
                ? "Consulta tu Pasaporte Digital"
                : "Disponible con un traslado activo"
            }
            href={viajeActivoVisible ? `/traslados/${viajeActivoVisible.traslado_id}` : undefined}
            ctaVacio="Ver mis traslados"
            ctaHref="/mis-viajes"
          />
          <AccesoRapido
            titulo="Mis traslados"
            descripcion="Activos, programados e historial"
            href="/mis-viajes"
          />
          <AccesoRapido
            titulo="Centro de ayuda"
            descripcion={
              viajeActivoVisible
                ? "Reporta pagos, evidencia o incidentes"
                : "Contacta con el equipo de soporte"
            }
            href={
              viajeActivoVisible ? `/soporte?viaje=${viajeActivoVisible.traslado_id}` : "/soporte"
            }
          />
        </div>
      </section>

      {/* Últimos traslados */}
      <section id="ultimos-viajes" className="mt-10">
        <SeccionTitulo>Últimos traslados</SeccionTitulo>
        {historial.length === 0 ? (
          <p className="mt-3 font-body text-sm text-ink/55">
            Cuando completes tu primer traslado, aparecerá aquí.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-ink/10 rounded-card border border-ink/10">
            {historial.slice(0, 6).map((t, index) => {
              const trasladoId = t.traslado_id;
              const contenido = (
                <>
                <div>
                  <p className="font-body text-sm font-medium">
                    {tarjetaVehiculo(t)}
                    {t.vehiculo_tipo && (
                      <span className="ml-2 font-body text-xs text-ink/45">
                        · {ETIQUETA_TIPO_VEHICULO[t.vehiculo_tipo]}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono-ruum text-xs text-ink/45">
                    {formatearFechaRelativa(t.creado_en ?? t.actualizado_en ?? new Date().toISOString())} ·{" "}
                    {formatearPrecio(t.precio_final ?? t.precio_cotizado ?? 0)}
                  </p>
                </div>
                {t.estado ? <EstadoBadge estado={t.estado} conTexto={false} /> : null}
                </>
              );

              return trasladoId ? (
                <Link
                  key={trasladoId}
                  href={`/traslados/${trasladoId}`}
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-ink/[0.03]"
                >
                  {contenido}
                </Link>
              ) : (
                <div key={`historial-${index}`} className="flex items-center justify-between gap-4 p-4">
                  {contenido}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pilares de confianza */}
      <section className="mt-12 grid gap-8 border-t border-ink/10 pt-10 sm:grid-cols-3">
        {PILARES_CONFIANZA.map((pilar) => (
          <div key={pilar.titulo}>
            <h3 className="font-display text-sm font-semibold">{pilar.titulo}</h3>
            <p className="mt-2 font-body text-xs leading-relaxed text-ink/60">
              {pilar.cuerpo}
            </p>
          </div>
        ))}
      </section>

    </div>
  );
}
