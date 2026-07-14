import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mis viajes — Ruum Ruum",
  robots: { index: false, follow: false },
};
import { Button, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";

import { NavegacionUsuario } from "../NavegacionUsuario";
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

function fechaHora(fecha: string) {
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
    const ids = pasaportes.map((pasaporte) => pasaporte.traslado_id);
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
      traslado: trasladosPorId.get(pasaporte.traslado_id) ?? null
    }));
  } catch {
    return [];
  }
}

function ViajeCard({ viaje }: { viaje: ViajeLista }) {
  const { pasaporte, traslado } = viaje;
  const evidenciaDisponible =
    pasaporte.evidencia_inicial_fotos_sincronizadas > 0 || pasaporte.evidencia_final_fotos_sincronizadas > 0;

  return (
    <Link
      href={`/traslados/${pasaporte.traslado_id}`}
      className="app-card app-card-interactive group block rounded-lg bg-mist px-4 py-4 text-ink no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-dark"
      aria-label={`Ver Pasaporte Digital del viaje ${pasaporte.traslado_id.slice(0, 8).toUpperCase()}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-route/20 bg-route-soft px-2.5 py-1 font-body text-xs font-medium text-route-dark">
              {ESTATUS_USUARIO[pasaporte.estado]}
            </span>
            {pasaporte.tiene_incidencia_abierta && (
              <span className="rounded-full border border-warn/40 bg-warn-soft px-2.5 py-1 font-body text-xs font-medium text-warn">
                Incidencia abierta
              </span>
            )}
          </div>

          <h2 className="mt-3 font-display text-lg font-semibold">
            {vehiculo(pasaporte)}
            {pasaporte.vehiculo_tipo && (
              <span className="ml-2 font-body text-xs font-normal text-ink/45">
                · {ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo]}
              </span>
            )}
          </h2>
          <p className="mt-1 font-body text-sm text-ink/55">
            Folio {pasaporte.traslado_id.slice(0, 8).toUpperCase()} · {fechaHora(pasaporte.creado_en)}
          </p>
        </div>

        <span className="flex size-10 shrink-0 items-center justify-center self-end rounded-full border border-ink/10 bg-ink/[0.03] font-display text-2xl text-ink/55 transition-colors group-hover:border-signal/30 group-hover:text-ink lg:self-start" aria-hidden="true">
          ›
        </span>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Origen</dt>
          <dd className="mt-1 font-body text-sm font-medium">
            {traslado ? `${traslado.origen_ciudad} · ${traslado.origen_direccion}` : "Pendiente"}
          </dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Destino</dt>
          <dd className="mt-1 font-body text-sm font-medium">
            {traslado ? `${traslado.destino_ciudad} · ${traslado.destino_direccion}` : "Pendiente"}
          </dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Conductor asignado</dt>
          <dd className="mt-1 font-body text-sm font-medium">{pasaporte.conductor_nombre ?? "Por asignar"}</dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Tarifa</dt>
          <dd className="mt-1 font-mono-ruum text-sm font-medium">
            {moneda(pasaporte.precio_final ?? pasaporte.precio_cotizado)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 font-body text-xs text-ink/55">
        {pasaporte.tipo_pago === "anticipado" && pasaporte.estado === "cotizacion_aceptada" && (
          <span className="rounded-full bg-signal px-3 py-1 font-semibold text-ink">Continuar con el pago</span>
        )}
        <span className="rounded-full bg-ink/[0.04] px-2.5 py-1">
          Evidencia inicial: {pasaporte.evidencia_inicial_fotos_sincronizadas} fotos
        </span>
        <span className="rounded-full bg-ink/[0.04] px-2.5 py-1">
          Evidencia final: {pasaporte.evidencia_final_fotos_sincronizadas} fotos
        </span>
        <span className="rounded-full bg-ink/[0.04] px-2.5 py-1">
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
    cuerpo: "No has cancelado ningún traslado. ¡Eso es buena señal!",
  },
};

function EmptyStatePestana({ pestana }: { pestana: PestañaViajes }) {
  const estado = EMPTY_STATE[pestana];
  return (
    <div className="rounded-lg border border-dashed border-ink/15 px-6 py-10 text-center">
      <p className="font-display text-sm font-semibold text-ink/70">{estado.titulo}</p>
      <p className="mx-auto mt-2 max-w-xs font-body text-xs leading-5 text-ink/50">{estado.cuerpo}</p>
      {estado.cta && estado.ctaHref && (
        <Link
          href={estado.ctaHref}
          className="mt-4 inline-block font-body text-sm font-medium text-route-dark underline-offset-4 hover:underline"
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
      <div className="app-container py-10 sm:py-14">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="font-body text-sm text-ink/55 underline-offset-4 hover:underline">
            Inicio
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">Mis viajes</h1>
          <p className="mt-2 max-w-2xl font-body text-sm text-ink/60">
            Consulta tus viajes activos, programados, finalizados y cancelados con evidencia y detalle operativo.
          </p>
        </div>
        <Link href="/soporte">
          <Button>¿Necesitas ayuda?</Button>
        </Link>
      </header>

      <PassportCard>
        <nav className="grid gap-2 sm:grid-cols-4" aria-label="Filtros de viajes">
          {PESTANAS.map((pestaña) => {
            const activa = pestaña.id === pestañaActiva;
            const total = viajes.filter((viaje) => pestañaDeViaje(viaje.pasaporte) === pestaña.id).length;
            return (
              <Link
                key={pestaña.id}
                href={`/mis-viajes?tab=${pestaña.id}`}
                className={[
                  "rounded-lg border px-4 py-3 font-body text-sm transition-colors",
                  activa ? "border-signal bg-signal-soft text-ink" : "border-ink/10 text-ink/65 hover:border-ink/25"
                ].join(" ")}
              >
                <span className="font-medium">{pestaña.etiqueta}</span>
                <span className="ml-2 font-mono-ruum text-xs">{total}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 grid gap-4">
          {viajesPorPestaña.length > 0 ? (
            viajesPorPestaña.map((viaje) => <ViajeCard key={viaje.pasaporte.traslado_id} viaje={viaje} />)
          ) : (
            <EmptyStatePestana pestana={pestañaActiva} />
          )}
        </div>
      </PassportCard>
      </div>
    </main>
  );
}
