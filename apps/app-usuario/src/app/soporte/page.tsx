import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ayuda y soporte — Ruum Ruum",
  robots: { index: false, follow: false },
};
import { Aviso, Button, PassportCard } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { esTrasladoActivo } from "../../lib/inicio";
import { AccionesCuenta } from "./AccionesCuenta";

import { NavegacionUsuario } from "../NavegacionUsuario";
type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];



const FAQ = [
  ["¿Cómo sé dónde está mi vehículo?", "Consulta el Pasaporte Digital del viaje. Ahí verás estatus, evidencia y mensajes operativos."],
  ["¿Qué hago si veo un daño?", "Reporta daño o incidente con el folio del viaje. El equipo revisará la evidencia inicial y final."],
  ["¿Puedo cancelar un traslado?", "Sí. Dependiendo del avance operativo, conductor asignado y ventana de cancelación, puede existir un cargo."],
  ["¿Dónde veo mis pagos?", "En el detalle del viaje y en Mis viajes. Ruum Ruum no acepta pagos en efectivo."],
  ["¿Por qué no veo evidencia final?", "La evidencia final aparece cuando el conductor la carga y sincroniza al llegar a destino."]
];

const TEMAS_SOPORTE = [
  ["Pagos", "Tarjeta, transferencia, pago empresarial y aclaraciones de cargos."],
  ["Evidencia", "Fotos iniciales, finales, sincronización y diferencias visibles."],
  ["Cancelaciones", "Cargos posibles según avance operativo y conductor asignado."]
];

const NOTIFICACIONES = [
  "Solicitud recibida",
  "Solicitud en revisión",
  "Conductor asignado",
  "Conductor en camino",
  "Vehículo recibido",
  "Evidencia inicial disponible",
  "Traslado iniciado",
  "Vehículo próximo a llegar",
  "Evidencia final disponible",
  "Viaje finalizado",
  "Pago confirmado",
  "Incidencia reportada"
];

async function obtenerContexto() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { usuario: null as Usuario | null, traslados: [] as Pasaporte[] };
  }

  try {
    const { crearClienteServidor } = await import("../../lib/supabase-server");
    const { obtenerUsuarioActual, listarTrasladosDeUsuario } = await import("@ruum/api/services");
    const cliente = await crearClienteServidor();
    const usuario = await obtenerUsuarioActual(cliente);
    if (!usuario) return { usuario: null as Usuario | null, traslados: [] as Pasaporte[] };
    const traslados = await listarTrasladosDeUsuario(cliente, usuario.id);
    return { usuario, traslados };
  } catch {
    return { usuario: null as Usuario | null, traslados: [] as Pasaporte[] };
  }
}

function tarjetaVehiculo(t: Pasaporte): string {
  const partes = [t.vehiculo_marca, t.vehiculo_modelo, t.vehiculo_anio ? String(t.vehiculo_anio) : null].filter(Boolean);
  return partes.length > 0 ? partes.join(" ") : "Vehículo";
}

function Seccion({
  titulo,
  descripcion,
  children
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <PassportCard>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold">{titulo}</h2>
        {descripcion && <p className="font-body text-sm text-ink/55">{descripcion}</p>}
      </div>
      <div className="mt-6">{children}</div>
    </PassportCard>
  );
}

function CampoReporte({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-body text-sm font-medium">{etiqueta}</span>
      {children}
    </label>
  );
}

function SelectBase({ children }: { children: React.ReactNode }) {
  return (
    <select className="w-full rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark">
      {children}
    </select>
  );
}

function TextAreaBase() {
  return (
    <textarea
      rows={4}
      className="w-full rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark"
      placeholder="Describe lo que pasó, incluye ubicación aproximada, hora y cualquier evidencia relevante."
    />
  );
}

function TogglePreferencia({ etiqueta, activo }: { etiqueta: string; activo: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 border-t border-ink/10 py-3 first:border-t-0">
      <span className="font-body text-sm font-semibold text-ink">{etiqueta}</span>
      <span className={`rounded-full border px-2.5 py-1 font-body text-xs ${activo ? "border-route/30 bg-route-soft text-route-dark" : "border-ink/15 bg-ink/[0.05] text-ink/60"}`}>
        {activo ? "Activa" : "Pausada"}
      </span>
    </label>
  );
}

function LinkSoporte({
  href,
  titulo,
  descripcion
}: {
  href: string;
  titulo: string;
  descripcion: string;
}) {
  return (
    <Link href={href} className="block rounded-lg border border-ink/10 bg-mist px-4 py-4 transition-colors hover:border-route/40 hover:bg-route-soft/30">
      <p className="font-display text-sm font-semibold text-ink">{titulo}</p>
      <p className="mt-1 font-body text-xs leading-5 text-ink/55">{descripcion}</p>
    </Link>
  );
}

export default async function PaginaSoporte({ searchParams }: { searchParams: Promise<{ viaje?: string }> }) {
  const { viaje } = await searchParams;
  const { usuario, traslados } = await obtenerContexto();
  const viajeActivo = traslados.find((t) => t.traslado_id === viaje) ?? traslados.find((t) => t.estado && esTrasladoActivo(t.estado));
  const viajeActivoVisible = viajeActivo?.traslado_id ? { ...viajeActivo, traslado_id: viajeActivo.traslado_id } : null;

  return (
    <main className="app-page">
      {usuario ? <NavegacionUsuario /> : null}
      <div className="app-container py-10 sm:py-14">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="font-body text-sm text-ink/55 underline-offset-4 hover:underline">
            Inicio
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">Soporte</h1>
          <p className="mt-2 max-w-2xl font-body text-sm text-ink/60">
            Resuelve dudas, reporta problemas y revisa la configuración de ayuda para tus traslados.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/mis-viajes">
            <Button variant="secondary">Mis viajes</Button>
          </Link>
          <Link href="/cuenta">
            <Button>Mi cuenta</Button>
          </Link>
        </div>
      </header>

      {viajeActivoVisible && (
        <section className="mb-6">
          <PassportCard folio={viajeActivoVisible.traslado_id.slice(0, 8).toUpperCase()}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-ink/45">Soporte durante viaje activo</p>
                <h2 className="mt-1 font-display text-xl font-semibold">{tarjetaVehiculo(viajeActivoVisible)}</h2>
                <p className="mt-1 font-body text-sm text-ink/55">
                  Usa este acceso si necesitas ayuda con evidencia, pagos, conductor, daño o incidente.
                </p>
              </div>
              <Link href={`/traslados/${viajeActivoVisible.traslado_id}`}>
                <Button>Ver viaje activo</Button>
              </Link>
            </div>
          </PassportCard>
        </section>
      )}

      {/* Acción principal: contactar soporte — siempre lo primero */}
      <section className="mb-6">
        <Seccion titulo="Contactar soporte" descripcion="Elige el motivo para orientar mejor la respuesta.">
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoReporte etiqueta="Motivo">
              <SelectBase>
                <option>Reportar problema con un viaje</option>
                <option>Reportar daño o incidente</option>
                <option>Ayuda con pagos</option>
                <option>Ayuda con evidencia</option>
                <option>Cancelaciones</option>
              </SelectBase>
            </CampoReporte>
            <CampoReporte etiqueta="Viaje relacionado">
              <SelectBase>
                <option value="">Selecciona un viaje</option>
                {traslados.filter((t) => t.traslado_id).map((t) => {
                  const trasladoId = t.traslado_id as string;
                  return (
                    <option key={trasladoId} value={trasladoId}>
                      {trasladoId.slice(0, 8).toUpperCase()} · {tarjetaVehiculo(t)}
                    </option>
                  );
                })}
              </SelectBase>
            </CampoReporte>
            <div className="sm:col-span-2">
              <CampoReporte etiqueta="Descripción">
                <TextAreaBase />
              </CampoReporte>
            </div>
            <div className="sm:col-span-2">
              {/* Endpoint de soporte en desarrollo — se muestra canal alternativo en lugar
                  de botón deshabilitado sin contexto, para no bloquear al usuario */}
              <div className="rounded-lg border border-ink/10 bg-mist px-4 py-4">
                <p className="font-body text-sm font-semibold text-ink">
                  Envío por formulario disponible próximamente
                </p>
                <p className="mt-1 font-body text-xs leading-5 text-ink/60">
                  Mientras tanto contáctanos directamente y te respondemos en menos de 24 horas.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="mailto:soporte@ruumruum.mx"
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-ink/20 bg-mist px-3 py-2 font-body text-sm font-medium text-ink transition hover:border-route-dark hover:text-route-dark"
                  >
                    Enviar correo
                  </a>
                  <a
                    href="https://wa.me/5215500000000"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-ink/20 bg-mist px-3 py-2 font-body text-sm font-medium text-ink transition hover:border-route-dark hover:text-route-dark"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Seccion>
      </section>

      {/* Temas de soporte comunes — contexto antes del FAQ */}
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        {TEMAS_SOPORTE.map(([titulo, descripcion]) => (
          <div key={titulo} className="app-card rounded-card p-4">
            <p className="font-display text-sm font-semibold">{titulo}</p>
            <p className="mt-1 font-body text-xs leading-5 text-ink/60">{descripcion}</p>
          </div>
        ))}
      </section>

      {/* FAQ — después del contacto, como respaldo de autoservicio */}
      <section className="mb-6">
        <Seccion titulo="Preguntas frecuentes">
          <div className="divide-y divide-ink/10">
            {FAQ.map(([pregunta, respuesta]) => (
              <details key={pregunta} className="py-3">
                <summary className="cursor-pointer font-body text-sm font-semibold text-ink">{pregunta}</summary>
                <p className="mt-2 font-body text-sm leading-6 text-ink/60">{respuesta}</p>
              </details>
            ))}
          </div>
        </Seccion>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Seccion titulo="Notificaciones" descripcion="Eventos operativos que Ruum Ruum puede comunicarte.">
          <div className="flex flex-wrap gap-2">
            {NOTIFICACIONES.map((notificacion) => (
              <span key={notificacion} className="rounded-full border border-ink/10 bg-mist px-2.5 py-1 font-body text-xs text-ink/60">
                {notificacion}
              </span>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Configuración de notificaciones">
          <div>
            {usuario ? (
              <>
                <TogglePreferencia etiqueta="Push" activo={usuario.notificaciones_push} />
                <TogglePreferencia etiqueta="Correo electrónico" activo={usuario.notificaciones_email} />
                <TogglePreferencia etiqueta="SMS / WhatsApp" activo={usuario.notificaciones_sms_whatsapp} />
                <TogglePreferencia etiqueta="Alertas de viaje" activo={usuario.alertas_viaje} />
                <TogglePreferencia etiqueta="Alertas de pago" activo={usuario.alertas_pago} />
                <TogglePreferencia etiqueta="Alertas de evidencia" activo={usuario.alertas_evidencia} />
                <TogglePreferencia etiqueta="Promocionales" activo={usuario.notificaciones_promocionales} />
              </>
            ) : (
              <Aviso tono="info">Inicia sesión para consultar y actualizar tus preferencias.</Aviso>
            )}
          </div>
        </Seccion>
      </section>

      </div>
    </main>
  );
}
