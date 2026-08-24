import type { Metadata } from "next";
import Link from "next/link";
import { Button, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { NavegacionUsuario } from "../NavegacionUsuario";

export const metadata: Metadata = {
  title: "Mis viajes — Ruum Ruum",
  robots: { index: false, follow: false },
};
type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type Traslado = Pick<
  Database["public"]["Tables"]["traslados"]["Row"],
  "id" | "origen_direccion" | "origen_ciudad" | "destino_direccion" | "destino_ciudad"
>;
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
type PestañaViajes = "activos" | "programados" | "finalizados" | "cancelados";

interface ViajeLista {
  pasaporte: Pasaporte;
  traslado: Traslado | null;
}

const PESTANAS: { id: PestañaViajes; etiqueta: string }[] = [
  { id: "activos", etiqueta: "Activos" },
  { id: "programados", etiqueta: "Programados" },
  { id: "finalizados", etiqueta: "Finalizados" },
  { id: "cancelados", etiqueta: "Cancelados" }
];

const ESTATUS_USUARIO: Record<EstadoTraslado, string> = {
  usuario_pendiente_verificacion: "Solicitud recibida",
  usuario_verificado: "Solicitud recibida",
  solicitud_creada: "Solicitud recibida",
  documentacion_pendiente: "En preparación",
  documentacion_en_revision: "En preparación",
  documentacion_validada: "En preparación",
  cotizacion_generada: "En preparación",
  cotizacion_aceptada: "Pago pendiente",
  servicio_confirmado: "En preparación",
  pendiente_de_conductor: "Buscando conductor",
  conductor_asignado: "Conductor asignado",
  conductor_en_camino_al_origen: "Conductor en camino",
  conductor_en_punto_de_recoleccion: "Recolección en proceso",
  verificacion_vehiculo_en_proceso: "Recolección en proceso",
  evidencia_inicial_en_proceso: "Recolección en proceso",
  evidencia_inicial_completada: "Evidencia inicial lista",
  vehiculo_recibido: "Vehículo recibido",
  traslado_en_curso: "En camino",
  incidencia_reportada: "Incidente reportado",
  llegada_a_destino: "Llegando a destino",
  evidencia_final_en_proceso: "Entrega en proceso",
  evidencia_final_completada: "Evidencia final lista",
  entrega_confirmada: "Entregado",
  pago_pendiente: "Pago pendiente",
  pago_completado: "Pago confirmado",
  servicio_cerrado: "Viaje finalizado",
  servicio_cancelado: "Cancelado",
  traslado_fallido: "Traslado fallido",
  dano_no_reportado_en_revision: "En revisión por incidente",
  reclamo_abierto: "Reclamo abierto",
  reclamo_resuelto: "Viaje finalizado",
  cierre_operativo_con_incidencia_abierta: "Cerrado con incidente",
  disputa_abierta: "Disputa abierta",
  disputa_resuelta: "Viaje finalizado"
};

const ESTATUS_VISIBLES = [
  "Solicitud recibida",
  "En revisión",
  "Conductor asignado",
  "Conductor en camino al origen",
  "Recolección en proceso",
  "Vehículo recibido",
  "Evidencia inicial disponible",
  "Traslado en curso",
  "Llegando a destino",
  "Entrega en proceso",
  "Evidencia final disponible",
  "Viaje finalizado",
  "Cancelado",
  "En revisión por incidente",
  "Traslado fallido"
];

function fechaHora(fecha: string | null | undefined) {
  if (!fecha) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(fecha));
}

function moneda(valor: number | null | undefined) {
  return `$${Number(valor ?? 0).toLocaleString("es-MX")}`;
}

function vehiculo(pasaporte: Pasaporte) {
  const partes = [pasaporte.vehiculo_marca, pasaporte.vehiculo_modelo, pasaporte.vehiculo_anio].filter(Boolean);
  return partes.length > 0 ? partes.join(" ") : "Vehículo";
}

function pestañaDeViaje(pasaporte: Pasaporte): PestañaViajes {
  if (!pasaporte.estado) return "activos";
  if (pasaporte.estado === "servicio_cancelado" || pasaporte.estado === "traslado_fallido") return "cancelados";
  if (["servicio_cerrado", "reclamo_resuelto", "disputa_resuelta"].includes(pasaporte.estado)) return "finalizados";
  if (["solicitud_creada", "documentacion_pendiente", "documentacion_en_revision", "documentacion_validada", "cotizacion_generada", "servicio_confirmado", "pendiente_de_conductor"].includes(pasaporte.estado)) {
    return "programados";
  }
  return "activos";
}

async function obtenerViajes(): Promise<ViajeLista[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return [];

  try {
    const { crearClienteServidor } = await import("../../lib/supabase-server");
    const { obtenerUsuarioActual, listarTrasladosDeUsuario } = await import("@ruum/api/services");
    const cliente = await crearClienteServidor();
    const usuario = await obtenerUsuarioActual(cliente);

    if (!usuario) return [];

    const pasaportes = await listarTrasladosDeUsuario(cliente, usuario.id);
    const ids = pasaportes.map((pasaporte) => pasaporte.traslado_id).filter((id): id is string => Boolean(id));
    const trasladosRes =
      ids.length > 0
        ? await cliente
            .from("traslados")
            .select("id, origen_direccion, origen_ciudad, destino_direccion, destino_ciudad")
            .in("id", ids)
        : { data: [], error: null };

    if (trasladosRes.error) throw trasladosRes.error;

    const trasladosPorId = new Map((trasladosRes.data ?? []).map((traslado) => [traslado.id, traslado]));
    return pasaportes.map((pasaporte) => ({
      pasaporte,
      traslado: pasaporte.traslado_id ? trasladosPorId.get(pasaporte.traslado_id) ?? null : null
    }));
  } catch {
    return [];
  }
}

function ViajeCard({ viaje }: { viaje: ViajeLista }) {
  const { pasaporte, traslado } = viaje;
  if (!pasaporte.traslado_id) return null;

  const estadoVisible = pasaporte.estado ? ESTATUS_USUARIO[pasaporte.estado] : "Estado por confirmar";
  const evidenciaDisponible =
    (pasaporte.evidencia_inicial_fotos_sincronizadas ?? 0) > 0 || (pasaporte.evidencia_final_fotos_sincronizadas ?? 0) > 0;

  return (
    <Link
      href={`/traslados/${pasaporte.traslado_id}`}
      className="app-card app-card-interactive group block rounded-xl bg-surface px-4 py-4 text-text-primary no-underline border border-border shadow-sm focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action hover:border-route-action"
      aria-label={`Ver Pasaporte Digital del viaje ${pasaporte.traslado_id.slice(0, 8).toUpperCase()}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-route-action/30 bg-route-action/10 px-2.5 py-1 font-body text-xs font-semibold text-route-action">
              {estadoVisible}
            </span>
            {pasaporte.tiene_incidencia_abierta && (
              <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 font-body text-xs font-semibold text-warning">
                Incidencia abierta
              </span>
            )}
          </div>

          <h2 className="mt-2.5 font-display text-base sm:text-lg font-bold text-text-primary">
            {vehiculo(pasaporte)}
            {pasaporte.vehiculo_tipo && (
              <span className="ml-2 font-body text-xs font-normal text-text-tertiary">
                · {ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo]}
              </span>
            )}
          </h2>
          <p className="mt-0.5 font-body text-xs text-text-secondary">
            Folio <span className="font-mono-ruum font-semibold text-text-primary">{pasaporte.traslado_id.slice(0, 8).toUpperCase()}</span> · {fechaHora(pasaporte.creado_en)}
          </p>
        </div>

        <span className="flex size-9 shrink-0 items-center justify-center self-end rounded-full border border-border bg-surface-elevated font-display text-lg text-text-secondary transition-colors group-hover:border-signal/40 group-hover:text-signal lg:self-start" aria-hidden="true">
          ›
        </span>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t border-border/40 pt-3">
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary font-medium">Origen</dt>
          <dd className="mt-0.5 font-body text-sm font-semibold text-text-primary truncate">
            {traslado ? `${traslado.origen_ciudad} · ${traslado.origen_direccion}` : "Pendiente"}
          </dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary font-medium">Destino</dt>
          <dd className="mt-0.5 font-body text-sm font-semibold text-text-primary truncate">
            {traslado ? `${traslado.destino_ciudad} · ${traslado.destino_direccion}` : "Pendiente"}
          </dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary font-medium">Conductor asignado</dt>
          <dd className="mt-0.5 font-body text-sm font-semibold text-text-primary">{pasaporte.conductor_nombre ?? "Por asignar"}</dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary font-medium">Tarifa</dt>
          <dd className="mt-0.5 font-mono-ruum text-sm font-bold text-signal">
            {moneda(pasaporte.precio_final ?? pasaporte.precio_cotizado)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 font-body text-xs text-text-secondary">
        {pasaporte.tipo_pago === "anticipado" && pasaporte.estado === "cotizacion_aceptada" && (
          <span className="rounded-full bg-signal px-3 py-1 font-bold text-slate-950">Continuar con el pago</span>
        )}
        <span className="rounded-full bg-surface-elevated border border-border/40 px-2.5 py-1">
          Evidencia inicial: {pasaporte.evidencia_inicial_fotos_sincronizadas ?? 0} fotos
        </span>
        <span className="rounded-full bg-surface-elevated border border-border/40 px-2.5 py-1">
          Evidencia final: {pasaporte.evidencia_final_fotos_sincronizadas ?? 0} fotos
        </span>
        <span className="rounded-full bg-surface-elevated border border-border/40 px-2.5 py-1">
          Evidencia {evidenciaDisponible ? "disponible" : "pendiente"}
        </span>
      </div>
    </Link>
  );
}

const EMPTY_STATE: Record<PestañaViajes, { titulo: string; cuerpo: string; cta?: string; ctaHref?: string }> = {
  activos: {
    titulo: "Sin traslados en curso",
    cuerpo: "Solicita un traslado para verlo aquí con su estatus y Pasaporte Digital en tiempo real.",
    cta: "Solicitar traslado",
    ctaHref: "/traslados/nuevo",
  },
  programados: {
    titulo: "Sin traslados programados",
    cuerpo: "Cuando agendes un traslado con fecha futura, aparecerá en esta sección.",
    cta: "Programar traslado",
    ctaHref: "/traslados/nuevo",
  },
  finalizados: {
    titulo: "Sin traslados finalizados",
    cuerpo: "Tus traslados completados aparecerán aquí con evidencia inicial, final y resumen del viaje.",
  },
  cancelados: {
    titulo: "Sin traslados cancelados",
    cuerpo: "No has cancelado ningún traslado.",
  },
};

function EmptyStatePestana({ pestana }: { pestana: PestañaViajes }) {
  const estado = EMPTY_STATE[pestana];
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/30 px-6 py-10 text-center">
      <p className="font-display text-sm font-bold text-text-primary">{estado.titulo}</p>
      <p className="mx-auto mt-2 max-w-xs font-body text-xs leading-5 text-text-secondary">{estado.cuerpo}</p>
      {estado.cta && estado.ctaHref && (
        <Link
          href={estado.ctaHref}
          className="mt-4 inline-flex items-center gap-1 font-body text-sm font-semibold text-route-action underline-offset-4 hover:underline"
        >
          {estado.cta} →
        </Link>
      )}
    </div>
  );
}

export default async function PaginaMisViajes({
  searchParams
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const pestañaActiva = PESTANAS.some((pestaña) => pestaña.id === tab) ? (tab as PestañaViajes) : "activos";
  const viajes = await obtenerViajes();
  const viajesPorPestaña = viajes.filter((viaje) => pestañaDeViaje(viaje.pasaporte) === pestañaActiva);

  return (
    <main className="app-page">
      <NavegacionUsuario />
      <div className="app-container py-6 sm:py-10 lg:py-14">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="font-body text-xs font-medium text-text-tertiary underline-offset-4 hover:text-text-primary hover:underline">
              ← Volver al inicio
            </Link>
            <h1 className="mt-2 font-display text-2xl sm:text-3xl font-black leading-tight text-text-primary">Mis viajes</h1>
            <p className="mt-1 max-w-2xl font-body text-sm text-text-secondary">
              Consulta tus viajes activos, programados, finalizados y cancelados con evidencia y detalle operativo.
            </p>
          </div>
          <Link href="/soporte" className="self-start sm:self-auto">
            <Button variant="secondary" className="font-display font-semibold text-xs">¿Necesitas ayuda?</Button>
          </Link>
        </header>

        <PassportCard>
          <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Filtros de viajes">
            {PESTANAS.map((pestaña) => {
              const activa = pestaña.id === pestañaActiva;
              const total = viajes.filter((viaje) => pestañaDeViaje(viaje.pasaporte) === pestaña.id).length;
              return (
                <Link
                  key={pestaña.id}
                  href={`/mis-viajes?tab=${pestaña.id}`}
                  className={[
                    "rounded-xl border px-3.5 py-2.5 font-body text-xs sm:text-sm transition-all flex items-center justify-between",
                    activa
                      ? "border-signal bg-signal/15 text-signal font-bold shadow-xs"
                      : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary"
                  ].join(" ")}
                >
                  <span className="font-semibold">{pestaña.etiqueta}</span>
                  <span className="font-mono-ruum text-xs px-1.5 py-0.5 rounded-full bg-surface-elevated text-text-secondary">{total}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 grid gap-4">
            {viajesPorPestaña.length > 0 ? (
              viajesPorPestaña.map((viaje, index) => <ViajeCard key={viaje.pasaporte.traslado_id ?? `viaje-${index}`} viaje={viaje} />)
            ) : (
              <EmptyStatePestana pestana={pestañaActiva} />
            )}
          </div>
        </PassportCard>
      </div>
    </main>
  );
}
