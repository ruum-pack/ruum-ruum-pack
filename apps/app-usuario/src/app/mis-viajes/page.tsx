import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { TRASLADOS_DEMO } from "../../lib/datos-demo";

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
  usuario_pendiente_verificacion: "En revisión",
  usuario_verificado: "En revisión",
  solicitud_creada: "Solicitud recibida",
  documentacion_pendiente: "En revisión",
  documentacion_en_revision: "En revisión",
  documentacion_validada: "En revisión",
  cotizacion_generada: "En revisión",
  servicio_confirmado: "En revisión",
  pendiente_de_conductor: "En revisión",
  conductor_asignado: "Conductor asignado",
  conductor_en_camino_al_origen: "Conductor en camino al origen",
  conductor_en_punto_de_recoleccion: "Recolección en proceso",
  verificacion_vehiculo_en_proceso: "Recolección en proceso",
  evidencia_inicial_en_proceso: "Recolección en proceso",
  evidencia_inicial_completada: "Evidencia inicial disponible",
  vehiculo_recibido: "Vehículo recibido",
  traslado_en_curso: "Traslado en curso",
  incidencia_reportada: "En revisión por incidente",
  llegada_a_destino: "Llegando a destino",
  evidencia_final_en_proceso: "Entrega en proceso",
  evidencia_final_completada: "Evidencia final disponible",
  entrega_confirmada: "Entrega en proceso",
  pago_pendiente: "Entrega en proceso",
  pago_completado: "Entrega en proceso",
  servicio_cerrado: "Viaje finalizado",
  servicio_cancelado: "Cancelado",
  traslado_fallido: "Traslado fallido",
  dano_no_reportado_en_revision: "En revisión por incidente",
  reclamo_abierto: "En revisión por incidente",
  reclamo_resuelto: "Viaje finalizado",
  cierre_operativo_con_incidencia_abierta: "En revisión por incidente",
  disputa_abierta: "En revisión por incidente",
  disputa_resuelta: "Viaje finalizado"
};

const DEMO_RUTAS: Record<string, Traslado> = {
  "demo-0001": {
    id: "demo-0001",
    origen_direccion: "Av. Insurgentes Sur 1234",
    origen_ciudad: "Ciudad de México",
    destino_direccion: "Blvd. Manuel Ávila Camacho 88",
    destino_ciudad: "Naucalpan"
  },
  "demo-0002": {
    id: "demo-0002",
    origen_direccion: "Av. Patria 201",
    origen_ciudad: "Guadalajara",
    destino_direccion: "Av. López Mateos 1900",
    destino_ciudad: "Zapopan"
  },
  "demo-0003": {
    id: "demo-0003",
    origen_direccion: "Paseo de la Reforma 222",
    origen_ciudad: "Ciudad de México",
    destino_direccion: "Av. Universidad 3000",
    destino_ciudad: "Coyoacán"
  },
  "demo-0004": {
    id: "demo-0004",
    origen_direccion: "Blvd. Díaz Ordaz 100",
    origen_ciudad: "Monterrey",
    destino_direccion: "Carretera Nacional 500",
    destino_ciudad: "Santiago"
  },
  "demo-0005": {
    id: "demo-0005",
    origen_direccion: "Av. Juárez 45",
    origen_ciudad: "Puebla",
    destino_direccion: "Centro Comercial Angelópolis",
    destino_ciudad: "Puebla"
  },
  "demo-0006": {
    id: "demo-0006",
    origen_direccion: "Av. Constituyentes 900",
    origen_ciudad: "Querétaro",
    destino_direccion: "Parque Industrial Benito Juárez",
    destino_ciudad: "Querétaro"
  }
};

const TRASLADOS_DEMO_MIS_VIAJES: Pasaporte[] = [
  ...TRASLADOS_DEMO,
  {
    traslado_id: "demo-0005",
    usuario_id: "demo-usuario",
    vehiculo_id: "demo-vehiculo-5",
    conductor_id: null,
    estado: "servicio_confirmado",
    tiene_incidencia_abierta: false,
    tipo_pago: "anticipado",
    causa_fallido: null,
    precio_cotizado: 1350,
    precio_final: null,
    creado_en: new Date(Date.now() + 1000 * 60 * 60 * 22).toISOString(),
    actualizado_en: new Date().toISOString(),
    vehiculo_tipo: "van",
    vehiculo_marca: "Toyota",
    vehiculo_modelo: "Hiace",
    vehiculo_anio: 2023,
    conductor_nombre: null,
    conductor_estado: null,
    conductor_nivel: null,
    conductor_calificacion: null,
    evidencia_inicial_fotos_sincronizadas: 0,
    evidencia_final_fotos_sincronizadas: 0,
    incidencias_abiertas: 0,
    monto_pagado: 1350
  },
  {
    traslado_id: "demo-0006",
    usuario_id: "demo-usuario",
    vehiculo_id: "demo-vehiculo-6",
    conductor_id: null,
    estado: "servicio_cancelado",
    tiene_incidencia_abierta: false,
    tipo_pago: "anticipado",
    causa_fallido: null,
    precio_cotizado: 780,
    precio_final: null,
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 24 * 16).toISOString(),
    actualizado_en: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    vehiculo_tipo: "sedan",
    vehiculo_marca: "Mazda",
    vehiculo_modelo: "3",
    vehiculo_anio: 2020,
    conductor_nombre: null,
    conductor_estado: null,
    conductor_nivel: null,
    conductor_calificacion: null,
    evidencia_inicial_fotos_sincronizadas: 0,
    evidencia_final_fotos_sincronizadas: 0,
    incidencias_abiertas: 0,
    monto_pagado: 0
  }
];

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

async function obtenerViajes(): Promise<{ viajes: ViajeLista[]; esDemo: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      viajes: TRASLADOS_DEMO_MIS_VIAJES.map((pasaporte) => ({
        pasaporte,
        traslado: DEMO_RUTAS[pasaporte.traslado_id] ?? null
      })),
      esDemo: true
    };
  }

  try {
    const { crearClienteServidor } = await import("../../lib/supabase-server");
    const { obtenerUsuarioActual, listarTrasladosDeUsuario } = await import("@ruum/api/services");
    const cliente = await crearClienteServidor();
    const usuario = await obtenerUsuarioActual(cliente);

    if (!usuario) {
      return {
        viajes: TRASLADOS_DEMO_MIS_VIAJES.map((pasaporte) => ({
          pasaporte,
          traslado: DEMO_RUTAS[pasaporte.traslado_id] ?? null
        })),
        esDemo: true
      };
    }

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
    return {
      viajes: pasaportes.map((pasaporte) => ({
        pasaporte,
        traslado: trasladosPorId.get(pasaporte.traslado_id) ?? null
      })),
      esDemo: false
    };
  } catch {
    return {
      viajes: TRASLADOS_DEMO_MIS_VIAJES.map((pasaporte) => ({
        pasaporte,
        traslado: DEMO_RUTAS[pasaporte.traslado_id] ?? null
      })),
      esDemo: true
    };
  }
}

function ViajeCard({ viaje }: { viaje: ViajeLista }) {
  const { pasaporte, traslado } = viaje;
  const evidenciaDisponible =
    pasaporte.evidencia_inicial_fotos_sincronizadas > 0 || pasaporte.evidencia_final_fotos_sincronizadas > 0;

  return (
    <div className="rounded-lg border border-ink/10 bg-mist px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-route/20 bg-route-soft px-2.5 py-1 font-body text-xs font-medium text-route">
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

        <Link href={`/traslados/${pasaporte.traslado_id}`} className="shrink-0">
          <Button variant="secundario" className="w-full lg:w-auto">
            Ver detalle
          </Button>
        </Link>
        <Link href={`/soporte?viaje=${pasaporte.traslado_id}`} className="shrink-0">
          <Button variant="fantasma" className="w-full lg:w-auto">
            Soporte
          </Button>
        </Link>
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
  const { viajes, esDemo } = await obtenerViajes();
  const viajesPorPestaña = viajes.filter((viaje) => pestañaDeViaje(viaje.pasaporte) === pestañaActiva);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
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
        <Link href="/traslados/nuevo">
          <Button>Solicitar traslado</Button>
        </Link>
      </header>

      {esDemo && (
        <div className="mb-6">
          <Aviso tono="info">Estás viendo viajes de ejemplo. Inicia sesión para consultar tus viajes reales.</Aviso>
        </div>
      )}

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
                  activa ? "border-signal bg-signal-soft text-signal" : "border-ink/10 text-ink/65 hover:border-ink/25"
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
            <div className="rounded-lg border border-dashed border-ink/15 px-4 py-8 text-center">
              <p className="font-body text-sm text-ink/55">No hay viajes en esta pestaña.</p>
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-ink/10 pt-6">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">
            Estatus visibles para el usuario
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ESTATUS_VISIBLES.map((estatus) => (
              <span key={estatus} className="rounded-full bg-ink/[0.04] px-2.5 py-1 font-body text-xs text-ink/60">
                {estatus}
              </span>
            ))}
          </div>
        </div>
      </PassportCard>
    </main>
  );
}
