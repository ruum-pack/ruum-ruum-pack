import Link from "next/link";
import Image from "next/image";
import { obtenerPasaporteDigital } from "@ruum/api/services";
import { Aviso, EstadoBadge, EstadoStepper, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_INCIDENCIA, ETIQUETA_TIPO_VEHICULO, MENSAJES_CLAVE_UX } from "@ruum/shared/constants";
import { ETIQUETA_ESTADO_TRASLADO } from "@ruum/shared/states";
import type { Database } from "@ruum/shared/types";
import { crearClienteServidor } from "../../../lib/supabase-server";
import { ChatTraslado } from "./ChatTraslado";
import { ReportarIncidenciaUsuario } from "./ReportarIncidencia";
import { CancelarTraslado } from "./CancelarTraslado";
import { CalificarTraslado } from "./CalificarTraslado";
import { AbrirDisputa } from "./AbrirDisputa";

import { NavegacionUsuario } from "../../NavegacionUsuario";
type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type Traslado = Pick<
  Database["public"]["Tables"]["traslados"]["Row"],
  | "origen_direccion"
  | "origen_ciudad"
  | "destino_direccion"
  | "destino_ciudad"
  | "contacto_entrega_nombre"
  | "contacto_entrega_telefono"
  | "contacto_recepcion_nombre"
  | "contacto_recepcion_telefono"
  | "fecha_hora_programada"
  | "cotizacion_expira_en"
>;
type Vehiculo = Pick<
  Database["public"]["Tables"]["vehiculos"]["Row"],
  | "tipo"
  | "marca"
  | "modelo"
  | "anio"
  | "tiene_tarjeta_circulacion"
  | "tiene_verificacion"
  | "tiene_placas"
  | "puede_circular_rodando"
>;
type Conductor = Pick<
  Database["public"]["Tables"]["conductores"]["Row"],
  "id" | "nombre" | "estado" | "nivel_operativo_vigente" | "calificacion_promedio" | "traslados_completados"
>;
type FotoEvidencia = Database["public"]["Tables"]["evidencia_fotos"]["Row"];
type Incidencia = Database["public"]["Tables"]["incidencias"]["Row"];
type Pago = Database["public"]["Tables"]["pagos"]["Row"];
type Calificacion = Database["public"]["Tables"]["calificaciones_traslado"]["Row"];
type Disputa = Database["public"]["Tables"]["disputas"]["Row"];
type ReclamoSeguroUsuario = Pick<
  Database["public"]["Tables"]["reclamos_seguro"]["Row"],
  "id" | "traslado_id" | "estado" | "abierto_en" | "resuelto_en"
>;
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

const LINEA_TIEMPO: { estado: EstadoTraslado; etiqueta: string }[] = [
  { estado: "solicitud_creada", etiqueta: "Solicitud creada" },
  { estado: "servicio_confirmado", etiqueta: "Solicitud aceptada por operación" },
  { estado: "conductor_asignado", etiqueta: "Conductor asignado" },
  { estado: "conductor_en_camino_al_origen", etiqueta: "Conductor en camino" },
  { estado: "vehiculo_recibido", etiqueta: "Vehículo recibido" },
  { estado: "evidencia_inicial_completada", etiqueta: "Evidencia inicial cargada" },
  { estado: "traslado_en_curso", etiqueta: "Traslado iniciado" },
  { estado: "incidencia_reportada", etiqueta: "Traslado en curso" },
  { estado: "llegada_a_destino", etiqueta: "Vehículo en destino" },
  { estado: "evidencia_final_completada", etiqueta: "Evidencia final cargada" },
  { estado: "entrega_confirmada", etiqueta: "Entrega confirmada" },
  { estado: "servicio_cerrado", etiqueta: "Viaje finalizado" }
];

const ORDEN_ESTADOS: EstadoTraslado[] = [
  "usuario_pendiente_verificacion",
  "usuario_verificado",
  "solicitud_creada",
  "documentacion_pendiente",
  "documentacion_en_revision",
  "documentacion_validada",
  "cotizacion_generada",
  "servicio_confirmado",
  "pendiente_de_conductor",
  "conductor_asignado",
  "conductor_en_camino_al_origen",
  "conductor_en_punto_de_recoleccion",
  "verificacion_vehiculo_en_proceso",
  "evidencia_inicial_en_proceso",
  "evidencia_inicial_completada",
  "vehiculo_recibido",
  "traslado_en_curso",
  "incidencia_reportada",
  "llegada_a_destino",
  "evidencia_final_en_proceso",
  "evidencia_final_completada",
  "entrega_confirmada",
  "pago_pendiente",
  "pago_completado",
  "servicio_cerrado"
];

const ETIQUETA_ANGULO: Record<FotoEvidencia["angulo"], string> = {
  frente: "Frente",
  lado_piloto: "Lado piloto",
  lado_copiloto: "Lado copiloto",
  trasera: "Trasera",
  tablero: "Tablero",
  dano_previo: "Daño visible",
  adicional: "Adicional"
};

function formatoFecha(fecha: string | null | undefined) {
  if (!fecha) return "Pendiente";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(fecha));
}

function formatoMoneda(monto: number | null | undefined) {
  return `$${Number(monto ?? 0).toLocaleString("es-MX")}`;
}

function iniciales(nombre: string | null | undefined) {
  if (!nombre) return "RR";
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

function estadoDePaso(estadoActual: EstadoTraslado, estadoPaso: EstadoTraslado) {
  const indiceActual = ORDEN_ESTADOS.indexOf(estadoActual);
  const indicePaso = ORDEN_ESTADOS.indexOf(estadoPaso);
  if (indiceActual < 0 || indicePaso < 0) return "pendiente";
  if (indiceActual > indicePaso) return "completado";
  if (indiceActual === indicePaso) return "actual";
  return "pendiente";
}

function calcularHorasDesdeCierre(actualizadoEn: string) {
  return (Date.now() - new Date(actualizadoEn).getTime()) / (1000 * 60 * 60);
}

async function obtenerDatos(id: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return {
      pasaporte: null,
      traslado: null,
      vehiculo: null,
      conductor: null,
      evidencia: [] as FotoEvidencia[],
      incidencias: [] as Incidencia[],
      disputas: [] as Disputa[],
      reclamosSeguro: [] as ReclamoSeguroUsuario[],
      calificacion: null as Calificacion | null,
      pagos: [] as Pago[]
    };
  }

  const cliente = await crearClienteServidor();
  const pasaporte = await obtenerPasaporteDigital(cliente, id);
  if (!pasaporte) {
    return {
      pasaporte: null,
      traslado: null,
      vehiculo: null,
      conductor: null,
      evidencia: [] as FotoEvidencia[],
      incidencias: [] as Incidencia[],
      disputas: [] as Disputa[],
      reclamosSeguro: [] as ReclamoSeguroUsuario[],
      calificacion: null as Calificacion | null,
      pagos: [] as Pago[]
    };
  }

  const [trasladoRes, vehiculoRes, conductorRes, evidenciaRes, incidenciasRes, disputasRes, reclamosSeguroRes, calificacionRes, pagosRes] = await Promise.all([
    cliente
      .from("traslados")
      .select(
        "origen_direccion, origen_ciudad, destino_direccion, destino_ciudad, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, fecha_hora_programada, cotizacion_expira_en"
      )
      .eq("id", id)
      .maybeSingle(),
    cliente
      .from("vehiculos")
      .select(
        "tipo, marca, modelo, anio, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando"
      )
      .eq("id", pasaporte.vehiculo_id)
      .maybeSingle(),
    pasaporte.conductor_id
      ? cliente
          .from("conductores")
          .select("id, nombre, estado, nivel_operativo_vigente, calificacion_promedio, traslados_completados")
          .eq("id", pasaporte.conductor_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    cliente.from("evidencia_fotos").select("*").eq("traslado_id", id).order("capturada_en", { ascending: true }),
    cliente.from("incidencias").select("*").eq("traslado_id", id).order("creada_en", { ascending: false }),
    cliente.from("disputas").select("*").eq("traslado_id", id).order("abierta_en", { ascending: false }),
    cliente
      .from("reclamos_seguro")
      .select("id, traslado_id, estado, abierto_en, resuelto_en")
      .eq("traslado_id", id)
      .order("abierto_en", { ascending: false }),
    cliente.from("calificaciones_traslado").select("*").eq("traslado_id", id).maybeSingle(),
    cliente.from("pagos").select("*").eq("traslado_id", id).order("registrado_en", { ascending: false })
  ]);

  for (const resultado of [trasladoRes, vehiculoRes, conductorRes, evidenciaRes, incidenciasRes, disputasRes, reclamosSeguroRes, calificacionRes, pagosRes]) {
    if (resultado.error) throw resultado.error;
  }

  return {
    pasaporte,
    traslado: trasladoRes.data,
    vehiculo: vehiculoRes.data,
    conductor: conductorRes.data,
    evidencia: evidenciaRes.data ?? [],
    incidencias: incidenciasRes.data ?? [],
    disputas: disputasRes.data ?? [],
    reclamosSeguro: reclamosSeguroRes.data ?? [],
    calificacion: calificacionRes.data ?? null,
    pagos: pagosRes.data ?? []
  };
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null | undefined }) {
  return (
    <div>
      <dt className="font-body text-xs uppercase tracking-wide text-ink/45">{etiqueta}</dt>
      <dd className="mt-1 font-body text-sm font-medium text-ink">{valor || "Pendiente"}</dd>
    </div>
  );
}

function EvidenciaMomento({
  titulo,
  descripcion,
  fotos
}: {
  titulo: string;
  descripcion: string;
  fotos: FotoEvidencia[];
}) {
  return (
    <div className="border-t border-ink/10 pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-body text-sm font-semibold">{titulo}</h3>
          <p className="mt-1 font-body text-xs leading-5 text-ink/55">{descripcion}</p>
        </div>
        <span className="shrink-0 font-mono-ruum text-xs text-ink/50">{fotos.length} fotos</span>
      </div>

      {fotos.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fotos.map((foto) => (
            <div key={foto.id} className="overflow-hidden rounded-lg border border-ink/10 bg-mist">
              {foto.url?.startsWith("http") ? (
                <Image src={foto.url} alt={ETIQUETA_ANGULO[foto.angulo]} width={400} height={300} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-ink/5 px-3 text-center font-body text-xs text-ink/45">
                  Foto registrada
                </div>
              )}
              <div className="border-t border-ink/10 px-3 py-2">
                <p className="font-body text-xs font-medium">{ETIQUETA_ANGULO[foto.angulo]}</p>
                <p className="mt-0.5 font-body text-[11px] text-ink/45">
                  {foto.sincronizada ? "Sincronizada" : "Pendiente de sincronizar"} · {formatoFecha(foto.capturada_en)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-ink/15 px-3 py-3 font-body text-sm text-ink/50">
          Aún no hay evidencia cargada para este momento.
        </p>
      )}
    </div>
  );
}

function EvidenciaDurante({
  pasaporte,
  traslado,
  incidencias
}: {
  pasaporte: Pasaporte;
  traslado: Traslado | null;
  incidencias: Incidencia[];
}) {
  return (
    <div className="border-t border-ink/10 pt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-body text-sm font-semibold">Evidencia durante el traslado</h3>
          <p className="mt-1 font-body text-xs leading-5 text-ink/55">
            Actualizaciones de estatus, ubicación general, hitos del recorrido, paradas autorizadas, incidencias y
            mensajes operativos relevantes.
          </p>
        </div>
        <span className="shrink-0 font-mono-ruum text-xs text-ink/50">{incidencias.length} incidencias</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-ink/10 px-3 py-3">
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Estatus</p>
          <p className="mt-1 font-body text-sm font-medium">{ETIQUETA_ESTADO_TRASLADO[pasaporte.estado]}</p>
        </div>
        <div className="rounded-lg border border-ink/10 px-3 py-3">
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Último hito</p>
          <p className="mt-1 font-body text-sm font-medium">{formatoFecha(pasaporte.actualizado_en)}</p>
        </div>
        <div className="rounded-lg border border-ink/10 px-3 py-3">
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Ruta general</p>
          <p className="mt-1 font-body text-sm font-medium">
            {traslado ? `${traslado.origen_ciudad} → ${traslado.destino_ciudad}` : "Pendiente"}
          </p>
        </div>
      </div>
      {incidencias.length > 0 && (
        <div className="mt-4 space-y-2">
          {incidencias.slice(0, 2).map((incidencia) => (
            <div key={incidencia.id} className="rounded-lg border border-warn/25 bg-warn-soft/40 px-3 py-2">
              <p className="font-body text-sm font-medium">{ETIQUETA_TIPO_INCIDENCIA[incidencia.tipo]}</p>
              <p className="mt-1 font-body text-xs text-ink/55">{incidencia.descripcion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function PaginaTraslado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pasaporte, traslado, vehiculo, conductor, evidencia, incidencias, disputas, reclamosSeguro, calificacion, pagos } = await obtenerDatos(id);

  if (!pasaporte) {
    return (
      <main className="app-page">
        <NavegacionUsuario />
        <div className="app-container py-20 text-center">
          <p className="font-mono-ruum text-xs font-medium uppercase tracking-widest text-ink/35">
            Traslado no encontrado
          </p>
          <h1 className="mt-4 font-display text-2xl font-semibold">No encontramos ese traslado</h1>
          <p className="mt-3 max-w-sm mx-auto font-body text-sm leading-6 text-ink/60">
            Revisa el enlace o el folio. Si recién lo creaste, puede tardar unos segundos en aparecer.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/mis-viajes"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-signal px-4 py-2 font-display text-sm font-bold text-ink transition hover:bg-signal/90"
            >
              Ver mis viajes
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/20 bg-mist px-4 py-2 font-body text-sm font-medium text-ink transition hover:border-ink/40"
            >
              Inicio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const evidenciaInicial = evidencia.filter((foto) => foto.tipo === "inicial");
  const evidenciaFinal = evidencia.filter((foto) => foto.tipo === "final");
  const precioBase = pasaporte.precio_final ?? pasaporte.precio_cotizado ?? 0;
  const vehiculoNombre = [pasaporte.vehiculo_marca, pasaporte.vehiculo_modelo, pasaporte.vehiculo_anio]
    .filter(Boolean)
    .join(" ");
  const horasDesdeCierre = calcularHorasDesdeCierre(pasaporte.actualizado_en);
  const dentroDeVentanaPostCierre = horasDesdeCierre <= 72;
  const mostrarPromptCalificacion =
    pasaporte.estado === "servicio_cerrado" && !calificacion && Boolean(pasaporte.conductor_id) && dentroDeVentanaPostCierre;
  const puedeAbrirDisputa =
    ["servicio_cerrado", "reclamo_resuelto", "cierre_operativo_con_incidencia_abierta"].includes(pasaporte.estado) &&
    dentroDeVentanaPostCierre;

  return (
    <main className="app-page">
      <NavegacionUsuario />
      <div className="app-container py-12">
      <PassportCard folio={pasaporte.traslado_id.slice(0, 8).toUpperCase()}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Detalle del viaje y Pasaporte Digital</p>
            <h1 className="mt-1 font-display text-2xl font-semibold">
              {vehiculoNombre || "Traslado de vehículo"}
              {pasaporte.vehiculo_tipo && (
                <span className="ml-2 align-middle font-body text-sm font-normal text-ink/50">
                  · {ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo]}
                </span>
              )}
            </h1>
            <p className="mt-2 font-body text-sm text-ink/60">
              Folio {pasaporte.traslado_id.slice(0, 8).toUpperCase()} · Actualizado {formatoFecha(pasaporte.actualizado_en)}
            </p>
          </div>
          <EstadoBadge estado={pasaporte.estado} />
        </div>

        <div className="mt-8">
          <EstadoStepper estado={pasaporte.estado} />
        </div>

        {pasaporte.tiene_incidencia_abierta && (
          <div className="mt-6">
            <Aviso tono="atencion">
              Este traslado tiene una incidencia abierta. Nuestro equipo te mantendrá informado.
            </Aviso>
          </div>
        )}

        {pasaporte.estado === "servicio_cerrado" && (
          <div className="mt-6">
            <Aviso tono="info">{MENSAJES_CLAVE_UX.cierre}</Aviso>
          </div>
        )}

        <dl className="mt-8 grid gap-4 border-t border-ink/10 pt-6 sm:grid-cols-4">
          <Dato etiqueta="Estado actual" valor={ETIQUETA_ESTADO_TRASLADO[pasaporte.estado]} />
          <Dato etiqueta="Conductor" valor={pasaporte.conductor_nombre ?? "Por asignar"} />
          <Dato etiqueta="Evidencia" valor={`${evidenciaInicial.length} inicial · ${evidenciaFinal.length} final`} />
          <Dato etiqueta="Pago" valor={`${formatoMoneda(pasaporte.monto_pagado)} pagado`} />
        </dl>
      </PassportCard>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Información completa del traslado</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="Origen" valor={traslado ? `${traslado.origen_direccion}, ${traslado.origen_ciudad}` : null} />
            <Dato
              etiqueta="Destino"
              valor={traslado ? `${traslado.destino_direccion}, ${traslado.destino_ciudad}` : null}
            />
            <Dato etiqueta="Entrega" valor={traslado?.contacto_entrega_nombre} />
            <Dato etiqueta="Recibe" valor={traslado?.contacto_recepcion_nombre} />
            <Dato etiqueta="Teléfono entrega" valor={traslado?.contacto_entrega_telefono} />
            <Dato etiqueta="Teléfono recepción" valor={traslado?.contacto_recepcion_telefono} />
          </dl>

          <div className="mt-6 rounded-lg border border-route/20 bg-route-soft/40 px-4 py-4">
            <p className="font-body text-xs uppercase tracking-wide text-route-dark">Ruta general</p>
            <p className="mt-2 font-body text-sm text-ink">
              {traslado
                ? `${traslado.origen_ciudad} → ${traslado.destino_ciudad}`
                : "La ruta se mostrará cuando operación confirme origen y destino."}
            </p>
          </div>
        </PassportCard>

        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Conductor asignado</h2>
          <div className="mt-5 flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-ink text-mist font-display text-xl">
              {iniciales(conductor?.nombre ?? pasaporte.conductor_nombre)}
            </div>
            <div>
              <p className="font-body text-base font-semibold">{conductor?.nombre ?? pasaporte.conductor_nombre ?? "Por asignar"}</p>
              <p className="mt-1 font-body text-sm text-ink/55">
                {conductor ? `ID interno ${conductor.id.slice(0, 8).toUpperCase()}` : "Se mostrará cuando sea asignado"}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="Certificación" valor={conductor?.nivel_operativo_vigente ?? pasaporte.conductor_nivel} />
            <Dato
              etiqueta="Calificación"
              valor={
                pasaporte.conductor_calificacion ? `${pasaporte.conductor_calificacion.toFixed(1)} / 5` : "Sin calificación"
              }
            />
            <Dato etiqueta="Estatus" valor={conductor?.estado ?? pasaporte.conductor_estado} />
            <Dato etiqueta="Canal autorizado" valor={conductor ? "Chat y llamada enmascarada" : "Pendiente"} />
          </dl>
          <p className="mt-5 font-body text-xs leading-5 text-ink/50">
            {pasaporte.conductor_id ? MENSAJES_CLAVE_UX.conductor_asignado : "Se mostrará cuando sea asignado."}
          </p>
          <CalificarTraslado
            trasladoId={pasaporte.traslado_id}
            conductorId={pasaporte.conductor_id}
            mostrar={mostrarPromptCalificacion}
          />
        </PassportCard>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Datos del vehículo</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="Marca" valor={vehiculo?.marca ?? pasaporte.vehiculo_marca} />
            <Dato etiqueta="Modelo" valor={vehiculo?.modelo ?? pasaporte.vehiculo_modelo} />
            <Dato etiqueta="Año" valor={vehiculo?.anio ?? pasaporte.vehiculo_anio} />
            <Dato
              etiqueta="Tipo"
              valor={(vehiculo?.tipo ?? pasaporte.vehiculo_tipo) ? ETIQUETA_TIPO_VEHICULO[vehiculo?.tipo ?? pasaporte.vehiculo_tipo!] : null}
            />
          </dl>
          <div className="mt-5 grid gap-2 font-body text-sm">
            {[
              ["Tarjeta de circulación", vehiculo?.tiene_tarjeta_circulacion],
              ["Verificación vehicular", vehiculo?.tiene_verificacion],
              ["Placas instaladas", vehiculo?.tiene_placas],
              ["Puede circular rodando", vehiculo?.puede_circular_rodando]
            ].map(([etiqueta, listo]) => (
              <div key={String(etiqueta)} className="flex items-center justify-between border-t border-ink/10 py-2 first:border-t-0">
                <span>{etiqueta}</span>
                <span className={listo ? "text-control" : "text-ink/45"}>{listo ? "Confirmado" : "Pendiente"}</span>
              </div>
            ))}
          </div>
        </PassportCard>

        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Línea de tiempo del viaje</h2>
          <ol className="mt-5 space-y-3">
            {LINEA_TIEMPO.map((paso) => {
              const estado = estadoDePaso(pasaporte.estado, paso.estado);
              return (
                <li key={paso.etiqueta} className="flex gap-3">
                  <span
                    className={[
                      "mt-0.5 size-3 shrink-0 rounded-full border",
                      estado === "completado"
                        ? "border-control bg-control"
                        : estado === "actual"
                          ? "border-signal bg-signal"
                          : "border-ink/20 bg-mist"
                    ].join(" ")}
                  />
                  <div>
                    <p className={estado === "pendiente" ? "font-body text-sm text-ink/45" : "font-body text-sm font-medium"}>
                      {paso.etiqueta}
                    </p>
                    {estado === "actual" && <p className="mt-0.5 font-body text-xs text-ink">Estado actual</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </PassportCard>
      </section>

      <section className="mt-6">
        <PassportCard>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">15.6 Sección: Evidencia</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Documentación visual y operativa</h2>
            </div>
            <p className="font-body text-sm text-ink/55">La evidencia debe sentirse como tranquilidad, no como trámite.</p>
          </div>

          <div className="mt-6 space-y-6">
            <EvidenciaMomento
              titulo="Evidencia inicial"
              descripcion={MENSAJES_CLAVE_UX.evidencia_inicial}
              fotos={evidenciaInicial}
            />
            <EvidenciaDurante pasaporte={pasaporte} traslado={traslado} incidencias={incidencias} />
            <EvidenciaMomento
              titulo="Evidencia final"
              descripcion="Fotos finales exteriores e interiores, kilometraje y combustible final, confirmación de entrega, observaciones finales y aceptación del receptor cuando aplique."
              fotos={evidenciaFinal}
            />
          </div>
        </PassportCard>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Reportes e incidencias</h2>
          {incidencias.length > 0 ? (
            <div className="mt-5 space-y-4">
              {incidencias.map((incidencia) => (
                <div key={incidencia.id} className="rounded-lg border border-ink/10 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-body text-sm font-semibold">{ETIQUETA_TIPO_INCIDENCIA[incidencia.tipo]}</p>
                    <span className={incidencia.resuelta ? "font-body text-xs text-control" : "font-body text-xs text-warn"}>
                      {incidencia.resuelta ? "Resuelta" : "Abierta"}
                    </span>
                  </div>
                  <p className="mt-2 font-body text-sm text-ink/65">{incidencia.descripcion}</p>
                  <p className="mt-2 font-body text-xs text-ink/45">
                    {incidencia.momento.replaceAll("_", " ")} · {formatoFecha(incidencia.creada_en)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-ink/15 px-3 py-3 font-body text-sm text-ink/50">
              No hay incidencias reportadas para este traslado.
            </p>
          )}
          <ReportarIncidenciaUsuario trasladoId={pasaporte.traslado_id} />
          <AbrirDisputa trasladoId={pasaporte.traslado_id} disponible={puedeAbrirDisputa} />
          <CancelarTraslado
            trasladoId={pasaporte.traslado_id}
            estado={pasaporte.estado}
            precio={precioBase}
            fechaProgramada={traslado?.fecha_hora_programada ?? null}
            conductorAsignado={Boolean(pasaporte.conductor_id)}
          />
        </PassportCard>

        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Pago y soporte</h2>
          <p className="mt-1 font-body text-sm text-ink/55">{MENSAJES_CLAVE_UX.pago}</p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="Tipo de pago" valor={pasaporte.tipo_pago.replaceAll("_", " ")} />
            <Dato etiqueta="Precio cotizado" valor={formatoMoneda(pasaporte.precio_cotizado)} />
            <Dato etiqueta="Precio final" valor={formatoMoneda(pasaporte.precio_final ?? precioBase)} />
            <Dato etiqueta="Monto pagado" valor={formatoMoneda(pasaporte.monto_pagado)} />
          </dl>
          {pagos.length > 0 && (
            <div className="mt-5 space-y-3">
              {pagos.map((pago) => (
                <div key={pago.id} className="flex items-center justify-between border-t border-ink/10 pt-3 font-body text-sm">
                  <span>{pago.metodo} · {pago.momento.replaceAll("_", " ")}</span>
                  <span className="font-mono-ruum">{formatoMoneda(pago.monto)}</span>
                </div>
              ))}
            </div>
          )}
          {pasaporte.estado === "pago_pendiente" && (
            <div className="mt-6">
              <Aviso tono="atencion">
                Pago pendiente. El cobro al cierre se realiza desde la app, fuera de esta pantalla de consulta.
              </Aviso>
            </div>
          )}
          {pasaporte.estado === "cotizacion_generada" && pasaporte.precio_cotizado != null && (
            <div className="mt-6">
              <Aviso tono="info">
                Tarifa enviada, pendiente de aceptación. La aceptación de la tarifa y el pago se realizan desde el flujo de creación del traslado.
              </Aviso>
            </div>
          )}
          {pasaporte.estado === "cotizacion_aceptada" && pasaporte.tipo_pago === "anticipado" && precioBase > 0 && traslado?.cotizacion_expira_en && (
            <div className="mt-6">
              <Aviso tono="info">
                Tarifa asignada, pago anticipado pendiente. Esta pantalla es solo de consulta; el cobro se completa desde el flujo de creación del traslado.
              </Aviso>
            </div>
          )}
          <div className="mt-6 rounded-lg border border-ink/10 px-4 py-4">
            <p className="font-body text-sm font-semibold">Contacto con soporte</p>
            <p className="mt-1 font-body text-sm text-ink/60">
              {MENSAJES_CLAVE_UX.comunicacion} Si hay una incidencia abierta, soporte dará seguimiento desde este mismo expediente.
            </p>
            <div className="mt-4">
              <Link href={`/soporte?viaje=${pasaporte.traslado_id}`} className="font-body text-sm font-medium text-route-dark">
                Abrir soporte del traslado
              </Link>
            </div>
          </div>
        </PassportCard>
      </section>

      {(disputas.length > 0 || reclamosSeguro.length > 0) && (
        <section className="mt-6">
          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Disputas, reclamos y resoluciones</h2>
            <div className="mt-5 space-y-3">
              {disputas.map((disputa) => (
                <div key={disputa.id} className="rounded-lg border border-ink/10 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-body text-sm font-semibold">{disputa.tipo.replaceAll("_", " ")}</p>
                    <span className="font-body text-xs text-ink/50">{disputa.estado.replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-2 font-body text-sm text-ink/65">{disputa.descripcion}</p>
                  {disputa.resolucion && (
                    <p className="mt-2 font-body text-sm text-control">
                      Resolución: {disputa.resolucion.replaceAll("_", " ")}
                      {disputa.resolucion_detalle ? ` · ${disputa.resolucion_detalle}` : ""}
                    </p>
                  )}
                </div>
              ))}
              {reclamosSeguro.map((reclamo) => (
                <div key={reclamo.id} className="rounded-lg border border-ink/10 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-body text-sm font-semibold">Reclamo de seguro</p>
                    <span className="font-body text-xs text-ink/50">{reclamo.estado.replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-2 font-body text-sm text-ink/65">
                    Abierto {formatoFecha(reclamo.abierto_en)}
                    {reclamo.resuelto_en ? ` · Resuelto ${formatoFecha(reclamo.resuelto_en)}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </PassportCard>
        </section>
      )}

      <ChatTraslado trasladoId={pasaporte.traslado_id} estado={pasaporte.estado} />
      </div>
    </main>
  );
}
