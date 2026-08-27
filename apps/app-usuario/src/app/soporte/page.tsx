import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { esTrasladoActivo } from "../../lib/inicio";
import { NavegacionUsuario } from "../NavegacionUsuario";
import { FormularioSoporte } from "./FormularioSoporte";

export const metadata: Metadata = {
  title: "Ayuda y soporte — Ruum Ruum",
  robots: { index: false, follow: false },
};
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
        <h2 className="font-display text-xl font-bold text-text-primary">{titulo}</h2>
        {descripcion && <p className="font-body text-sm text-text-secondary">{descripcion}</p>}
      </div>
      <div className="mt-6">{children}</div>
    </PassportCard>
  );
}

function CampoReporte({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-body text-xs font-semibold uppercase tracking-wider text-text-tertiary">{etiqueta}</span>
      {children}
    </label>
  );
}

function TogglePreferencia({ etiqueta, activo }: { etiqueta: string; activo: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 border-t border-border/40 py-3 first:border-t-0">
      <span className="font-body text-sm font-semibold text-text-primary">{etiqueta}</span>
      <span className={`rounded-full border px-2.5 py-1 font-body text-xs ${activo ? "border-route-action/30 bg-route-action/10 text-route-action font-semibold" : "border-border bg-surface-elevated text-text-secondary"}`}>
        {activo ? "Activa" : "Pausada"}
      </span>
    </label>
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
      <div className="app-container py-6 sm:py-10 lg:py-14">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="font-body text-xs font-medium text-text-tertiary underline-offset-4 hover:text-text-primary hover:underline">
            ← Volver al inicio
          </Link>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-black leading-tight text-text-primary">Soporte</h1>
          <p className="mt-1 max-w-2xl font-body text-sm text-text-secondary">
            Resuelve dudas, reporta problemas y revisa la configuración de ayuda para tus traslados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/mis-viajes">
            <Button variant="secondary" className="font-display font-semibold text-xs">Mis viajes</Button>
          </Link>
          <Link href="/cuenta">
            <Button className="font-display font-semibold text-xs">Mi cuenta</Button>
          </Link>
        </div>
      </header>

      {viajeActivoVisible && (
        <section className="mb-6">
          <PassportCard folio={viajeActivoVisible.traslado_id.slice(0, 8).toUpperCase()}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-text-tertiary font-medium">Soporte durante viaje activo</p>
                <h2 className="mt-1 font-display text-lg sm:text-xl font-bold text-text-primary">{tarjetaVehiculo(viajeActivoVisible)}</h2>
                <p className="mt-1 font-body text-sm text-text-secondary">
                  Usa este acceso si necesitas ayuda con evidencia, pagos, conductor, daño o incidente.
                </p>
              </div>
              <Link href={`/traslados/${viajeActivoVisible.traslado_id}`}>
                <Button className="w-full sm:w-auto font-display font-bold">Ver viaje activo</Button>
              </Link>
            </div>
          </PassportCard>
        </section>
      )}

      {/* Acción principal: contactar soporte — Sprint 1 funcional */}
      <section className="mb-6">
        <Seccion titulo="Contactar soporte" descripcion="Elige el motivo para orientar mejor la respuesta. Respondemos en <30 min.">
          <FormularioSoporte
            traslados={traslados.filter((t) => t.traslado_id).map((t) => ({ id: t.traslado_id as string, label: `${(t.traslado_id as string).slice(0, 8).toUpperCase()} · ${tarjetaVehiculo(t)}` }))}
            preseleccionado={viajeActivoVisible?.traslado_id ?? undefined}
            emailUsuario={usuario?.correo_facturacion ?? usuario?.telefono ?? null}
          />
          <div className="mt-4 rounded-xl border border-border bg-surface p-4">
            <p className="font-display text-sm font-bold text-text-primary">Canales de atención directa</p>
            <p className="mt-1 font-body text-xs leading-5 text-text-secondary">Si prefieres contacto directo, también puedes escribirnos. Horario: 8:00–22:00 MX, todos los días.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="mailto:soporte@ruumruum.mx" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-2 font-body text-xs font-semibold text-text-primary transition hover:border-route-action hover:text-route-action">✉️ soporte@ruumruum.mx</a>
              <a href="https://wa.me/5215500000000" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-signal text-slate-950 px-4 py-2 font-display text-xs font-bold shadow-sm transition hover:bg-signal/90">💬 WhatsApp Soporte</a>
            </div>
          </div>
        </Seccion>
      </section>

      {/* Temas de soporte comunes */}
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        {TEMAS_SOPORTE.map(([titulo, descripcion]) => (
          <div key={titulo} className="app-card rounded-xl border border-border bg-surface p-4">
            <p className="font-display text-sm font-bold text-text-primary">{titulo}</p>
            <p className="mt-1 font-body text-xs leading-5 text-text-secondary">{descripcion}</p>
          </div>
        ))}
      </section>

      {/* FAQ */}
      <section className="mb-6">
        <Seccion titulo="Preguntas frecuentes">
          <div className="divide-y divide-border">
            {FAQ.map(([pregunta, respuesta]) => (
              <details key={pregunta} className="py-3">
                <summary className="cursor-pointer font-display text-sm font-bold text-text-primary hover:text-signal">{pregunta}</summary>
                <p className="mt-2 font-body text-xs leading-relaxed text-text-secondary">{respuesta}</p>
              </details>
            ))}
          </div>
        </Seccion>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Seccion titulo="Notificaciones" descripcion="Eventos operativos que Ruum Ruum puede comunicarte.">
          <div className="flex flex-wrap gap-1.5">
            {NOTIFICACIONES.map((notificacion) => (
              <span key={notificacion} className="rounded-full border border-border bg-surface-elevated px-2.5 py-1 font-body text-xs text-text-secondary">
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

