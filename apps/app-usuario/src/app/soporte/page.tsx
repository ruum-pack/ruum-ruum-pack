import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { TRASLADOS_DEMO, USUARIO_DEMO } from "../../lib/datos-demo";
import { esTrasladoActivo } from "../../lib/inicio";
import { AccionesCuenta } from "./AccionesCuenta";

type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];

const FAQ = [
  ["¿Cómo sé dónde está mi vehículo?", "Consulta el Pasaporte Digital del viaje. Ahí verás estatus, evidencia y mensajes operativos."],
  ["¿Qué hago si veo un daño?", "Reporta daño o incidente desde soporte y adjunta el folio del viaje. El equipo revisará evidencia inicial y final."],
  ["¿Puedo cancelar un traslado?", "Sí, pero puede existir cargo según avance operativo, conductor asignado y ventana de cancelación."],
  ["¿Dónde veo mis pagos?", "En el detalle del viaje y en la sección Mis viajes. No aceptamos pagos en efectivo."],
  ["¿Por qué no veo evidencia final?", "La evidencia final aparece cuando el conductor la carga y sincroniza al llegar a destino."]
];

const NOTIFICACIONES_159 = [
  "Solicitud recibida",
  "Solicitud en revisión",
  "Conductor asignado",
  "Conductor en camino",
  "Vehículo recibido",
  "Evidencia inicial disponible",
  "Traslado iniciado",
  "Actualización importante del viaje",
  "Vehículo próximo a llegar",
  "Evidencia final disponible",
  "Viaje finalizado",
  "Pago confirmado",
  "Incidencia / incidente reportado",
  "Solicitud de información adicional"
];

async function obtenerContexto() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { usuario: USUARIO_DEMO, traslados: TRASLADOS_DEMO, esDemo: true };
  }

  try {
    const { crearClienteServidor } = await import("../../lib/supabase-server");
    const { obtenerUsuarioActual, listarTrasladosDeUsuario } = await import("@ruum/api/services");
    const cliente = await crearClienteServidor();
    const usuario = await obtenerUsuarioActual(cliente);
    if (!usuario) return { usuario: USUARIO_DEMO, traslados: TRASLADOS_DEMO, esDemo: true };
    const traslados = await listarTrasladosDeUsuario(cliente, usuario.id);
    return { usuario, traslados, esDemo: false };
  } catch {
    return { usuario: USUARIO_DEMO, traslados: TRASLADOS_DEMO, esDemo: true };
  }
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
      <div>
        <h2 className="font-display text-xl font-semibold">{titulo}</h2>
        {descripcion && <p className="mt-1 font-body text-sm text-ink/55">{descripcion}</p>}
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
  return <select className="rounded-lg border border-ink/15 bg-paper px-3.5 py-2.5 font-body text-sm">{children}</select>;
}

function TextAreaBase() {
  return (
    <textarea
      rows={4}
      className="rounded-lg border border-ink/15 bg-paper px-3.5 py-2.5 font-body text-sm"
      placeholder="Describe lo que pasó, incluye ubicación aproximada, hora y cualquier evidencia relevante."
    />
  );
}

function TogglePreferencia({ etiqueta, activo }: { etiqueta: string; activo: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 border-t border-ink/10 py-3 first:border-t-0">
      <span className="font-body text-sm text-ink">{etiqueta}</span>
      <input type="checkbox" defaultChecked={activo} className="size-5 rounded border-ink/30 text-signal" />
    </label>
  );
}

export default async function PaginaSoporte({
  searchParams
}: {
  searchParams: Promise<{ viaje?: string }>;
}) {
  const { viaje } = await searchParams;
  const { usuario, traslados, esDemo } = await obtenerContexto();
  const viajeActivo = traslados.find((t) => t.traslado_id === viaje) ?? traslados.find((t) => esTrasladoActivo(t.estado));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="font-body text-sm text-ink/55 underline-offset-4 hover:underline">
            Inicio
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">Soporte</h1>
          <p className="mt-2 max-w-2xl font-body text-sm text-ink/60">
            Resuelve dudas, reporta problemas y configura notificaciones de tus traslados.
          </p>
        </div>
        <Link href="/mis-viajes">
          <Button variant="secundario">Mis viajes</Button>
        </Link>
      </header>

      {esDemo && (
        <div className="mb-6">
          <Aviso tono="info">Estás viendo soporte con datos de ejemplo. Inicia sesión para levantar solicitudes reales.</Aviso>
        </div>
      )}

      {viajeActivo && (
        <section className="mb-6">
          <PassportCard folio={viajeActivo.traslado_id.slice(0, 8).toUpperCase()}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-signal">Soporte durante viaje activo</p>
                <h2 className="mt-1 font-display text-xl font-semibold">
                  {viajeActivo.vehiculo_marca} {viajeActivo.vehiculo_modelo} {viajeActivo.vehiculo_anio}
                </h2>
                <p className="mt-1 font-body text-sm text-ink/55">
                  Usa este acceso si necesitas ayuda con evidencia, pagos, conductor, daño o incidente.
                </p>
              </div>
              <Link href={`/traslados/${viajeActivo.traslado_id}`}>
                <Button>Ver viaje activo</Button>
              </Link>
            </div>
          </PassportCard>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Seccion titulo="Preguntas frecuentes">
          <div className="divide-y divide-ink/10">
            {FAQ.map(([pregunta, respuesta]) => (
              <details key={pregunta} className="py-3">
                <summary className="cursor-pointer font-body text-sm font-semibold">{pregunta}</summary>
                <p className="mt-2 font-body text-sm leading-6 text-ink/60">{respuesta}</p>
              </details>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Contactar soporte" descripcion="Elige el motivo para orientar mejor la respuesta.">
          <div className="grid gap-4">
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
                {traslados.map((t) => (
                  <option key={t.traslado_id} value={t.traslado_id}>
                    {t.traslado_id.slice(0, 8).toUpperCase()} · {t.vehiculo_marca} {t.vehiculo_modelo}
                  </option>
                ))}
              </SelectBase>
            </CampoReporte>
            <CampoReporte etiqueta="Descripción">
              <TextAreaBase />
            </CampoReporte>
            <Button disabled>Enviar solicitud</Button>
          </div>
        </Seccion>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <Seccion titulo="Pagos" descripcion="Tarjeta, transferencia y pagos al cierre.">
          <p className="font-body text-sm leading-6 text-ink/60">
            Si un cargo no coincide, reporta el folio del viaje. No compartas datos completos de tarjeta por chat.
          </p>
        </Seccion>
        <Seccion titulo="Evidencia" descripcion="Fotos iniciales, finales y sincronización.">
          <p className="font-body text-sm leading-6 text-ink/60">
            Si falta una foto o ves una diferencia, soporte revisa el Pasaporte Digital y las incidencias asociadas.
          </p>
        </Seccion>
        <Seccion titulo="Cancelaciones" descripcion="Antes de cancelar revisa cargos posibles.">
          <p className="font-body text-sm leading-6 text-ink/60">
            La cancelación puede generar cargos según avance operativo, conductor asignado y etapa del servicio.
          </p>
        </Seccion>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Seccion titulo="15.9 Notificaciones" descripcion="Eventos operativos que Ruum Ruum puede comunicarte.">
          <div className="flex flex-wrap gap-2">
            {NOTIFICACIONES_159.map((notificacion) => (
              <span key={notificacion} className="rounded-full bg-ink/[0.04] px-2.5 py-1 font-body text-xs text-ink/60">
                {notificacion}
              </span>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Configuración de notificaciones">
          <div>
            <TogglePreferencia etiqueta="Push" activo={usuario.notificaciones_push} />
            <TogglePreferencia etiqueta="Correo electrónico" activo={usuario.notificaciones_email} />
            <TogglePreferencia etiqueta="SMS / WhatsApp" activo={usuario.notificaciones_sms_whatsapp} />
            <TogglePreferencia etiqueta="Alertas de viaje" activo={usuario.alertas_viaje} />
            <TogglePreferencia etiqueta="Alertas de pago" activo={usuario.alertas_pago} />
            <TogglePreferencia etiqueta="Alertas de evidencia" activo={usuario.alertas_evidencia} />
            <TogglePreferencia etiqueta="Promocionales" activo={usuario.notificaciones_promocionales} />
          </div>
        </Seccion>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Seccion titulo="Legal">
          <div className="grid gap-3 font-body text-sm">
            <Link href="#terminos" className="rounded-lg border border-ink/10 px-4 py-3 hover:border-ink/25">
              Términos y condiciones
            </Link>
            <Link href="#privacidad" className="rounded-lg border border-ink/10 px-4 py-3 hover:border-ink/25">
              Aviso de privacidad
            </Link>
            <p id="terminos" className="pt-3 text-ink/60">
              Los términos completos se publicarán aquí antes de operar servicios productivos.
            </p>
            <p id="privacidad" className="text-ink/60">
              El aviso de privacidad debe explicar tratamiento de identidad, vehículos, pagos, evidencia y soporte.
            </p>
          </div>
        </Seccion>

        <Seccion titulo="Cuenta y seguridad" descripcion="Acciones sensibles con confirmación y advertencias.">
          <AccionesCuenta esDemo={esDemo} />
        </Seccion>
      </section>
    </main>
  );
}
