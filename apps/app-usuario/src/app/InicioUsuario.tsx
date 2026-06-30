import Link from "next/link";
import type { ReactNode } from "react";
import {
  Aviso,
  Button,
  EstadoBadge,
  EstadoStepper,
  PassportCard,
  CATEGORIA_POR_ESTADO,
  ETIQUETA_CATEGORIA
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
  /** Si es true, muestra el aviso obligatorio de "Datos de ejemplo" (igual que /traslados/demo-0001). */
  esDemo?: boolean;
}

function tarjetaVehiculo(t: PasaporteRow): string {
  const partes = [t.vehiculo_marca, t.vehiculo_modelo, t.vehiculo_anio ? String(t.vehiculo_anio) : null].filter(
    Boolean
  );
  return partes.length > 0 ? partes.join(" ") : "Vehículo";
}

/** Una celda de "Accesos rápidos": enlace activo, o tarjeta atenuada con el motivo si todavía no aplica. */
function AccesoRapido({
  titulo,
  descripcion,
  href
}: {
  titulo: string;
  descripcion: string;
  href?: string | undefined;
}) {
  const contenido = (
    <>
      <p className="font-display text-sm font-semibold leading-snug">{titulo}</p>
      <p className="mt-1 font-body text-xs text-ink/55">{descripcion}</p>
    </>
  );

  if (!href) {
    return <div className="rounded-card border border-ink/10 bg-paper-dim/50 p-4 opacity-60">{contenido}</div>;
  }

  return (
    <Link
      href={href}
      className="block rounded-card border border-ink/10 bg-paper p-4 transition-colors hover:border-signal/40 hover:bg-signal-soft/30"
    >
      {contenido}
    </Link>
  );
}

function SeccionTitulo({ children }: { children: ReactNode }) {
  return <h2 className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">{children}</h2>;
}

export function InicioUsuario({ usuario, traslados, esDemo = false }: InicioUsuarioProps) {
  const viajeActivo = obtenerViajeActivo(traslados);
  const historial = obtenerHistorial(traslados).filter((t) => t.traslado_id !== viajeActivo?.traslado_id);
  const notificaciones = construirNotificaciones(usuario, traslados);
  const primerNombre = usuario?.nombre?.trim().split(" ")[0];

  return (
    <div>
      {esDemo && (
        <div className="mb-8">
          <Aviso tono="info">
            Estás viendo el Inicio con datos de ejemplo, no traslados reales.{" "}
            <Link href="/login" className="font-medium underline underline-offset-2">
              Inicia sesión
            </Link>{" "}
            para ver los tuyos.
          </Aviso>
        </div>
      )}

      {/* Mensaje central + botón principal */}
      <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-body text-sm text-ink/55">{primerNombre ? `Hola, ${primerNombre}` : "Hola"}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
            Mueve tu auto sin soltar el control.
          </h1>
          <p className="mt-3 max-w-md font-body text-sm text-ink/65">
            Solicita un traslado, sigue cada paso en tiempo real y consulta el Pasaporte Digital cuando quieras.
          </p>
        </div>
        <Link href="/traslados/nuevo" className="sm:shrink-0">
          <Button className="w-full sm:w-auto">Solicitar traslado</Button>
        </Link>
      </section>

      {/* Viaje activo + estatus */}
      <section className="mt-10">
        <SeccionTitulo>Viaje activo</SeccionTitulo>

        {viajeActivo ? (
          <Link href={`/traslados/${viajeActivo.traslado_id}`} className="mt-3 block">
            <PassportCard folio={viajeActivo.traslado_id.slice(0, 8).toUpperCase()}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-base font-semibold">{tarjetaVehiculo(viajeActivo)}</p>
                  <p className="mt-0.5 font-body text-xs text-ink/50">
                    {ETIQUETA_CATEGORIA[CATEGORIA_POR_ESTADO[viajeActivo.estado]]} ·{" "}
                    {formatearFechaRelativa(viajeActivo.creado_en)}
                  </p>
                </div>
                <EstadoBadge estado={viajeActivo.estado} />
              </div>

              {viajeActivo.tiene_incidencia_abierta && (
                <div className="mt-4">
                  <Aviso tono="atencion">Este traslado tiene una incidencia abierta.</Aviso>
                </div>
              )}

              <div className="mt-6">
                <EstadoStepper estado={viajeActivo.estado} />
              </div>
            </PassportCard>
          </Link>
        ) : (
          <div className="mt-3 rounded-card border border-dashed border-ink/15 px-6 py-8 text-center">
            <p className="font-body text-sm text-ink/60">Aún no tienes ningún traslado en curso.</p>
            <Link
              href="/traslados/nuevo"
              className="mt-2 inline-block font-body text-sm font-medium text-signal hover:underline"
            >
              Solicita tu primer traslado
            </Link>
          </div>
        )}
      </section>

      {/* Notificaciones importantes */}
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

      {/* Accesos rápidos */}
      <section className="mt-10">
        <SeccionTitulo>Accesos rápidos</SeccionTitulo>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <AccesoRapido titulo="Solicitar traslado" descripcion="Pide un nuevo servicio" href="/traslados/nuevo" />
          <AccesoRapido titulo="Cuenta" descripcion="Perfil, vehículos y facturación" href="/cuenta" />
          <AccesoRapido titulo="Mis viajes" descripcion="Activos, programados e historial" href="/mis-viajes" />
          <AccesoRapido
            titulo="Soporte"
            descripcion={viajeActivo ? "Ayuda visible durante tu viaje" : "Preguntas y reportes"}
            href={viajeActivo ? `/soporte?viaje=${viajeActivo.traslado_id}` : "/soporte"}
          />
          <AccesoRapido
            titulo="Ver viaje activo"
            descripcion={viajeActivo ? "Sigue su progreso" : "No tienes uno en curso"}
            href={viajeActivo ? `/traslados/${viajeActivo.traslado_id}` : undefined}
          />
          <AccesoRapido
            titulo="Consultar evidencia"
            descripcion={viajeActivo ? "Fotos del Pasaporte Digital" : "Disponible con un viaje activo"}
            href={viajeActivo ? `/traslados/${viajeActivo.traslado_id}` : undefined}
          />
          <AccesoRapido
            titulo="Contactar soporte"
            descripcion={viajeActivo ? "Reporta pagos, evidencia o incidentes" : "Centro de ayuda"}
            href={viajeActivo ? `/soporte?viaje=${viajeActivo.traslado_id}` : "/soporte"}
          />
          <AccesoRapido
            titulo="Ver historial"
            descripcion={historial.length > 0 ? `${historial.length} traslado(s)` : "Aún no tienes traslados"}
            href={historial.length > 0 ? "#ultimos-viajes" : undefined}
          />
        </div>
      </section>

      {/* Últimos viajes */}
      <section id="ultimos-viajes" className="mt-10">
        <SeccionTitulo>Últimos viajes</SeccionTitulo>

        {historial.length === 0 ? (
          <p className="mt-3 font-body text-sm text-ink/55">Cuando completes tu primer traslado, aparecerá aquí.</p>
        ) : (
          <div className="mt-3 divide-y divide-ink/10 rounded-card border border-ink/10">
            {historial.slice(0, 6).map((t) => (
              <Link
                key={t.traslado_id}
                href={`/traslados/${t.traslado_id}`}
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-ink/[0.03]"
              >
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
                    {formatearFechaRelativa(t.creado_en)} · {formatearPrecio(t.precio_final ?? t.precio_cotizado ?? 0)}
                  </p>
                </div>
                <EstadoBadge estado={t.estado} conTexto={false} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Mensajes de seguridad / confianza */}
      <section className="mt-12 grid gap-8 border-t border-ink/10 pt-10 sm:grid-cols-3">
        {PILARES_CONFIANZA.map((pilar) => (
          <div key={pilar.titulo}>
            <h3 className="font-display text-sm font-semibold">{pilar.titulo}</h3>
            <p className="mt-2 font-body text-xs leading-relaxed text-ink/60">{pilar.cuerpo}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
