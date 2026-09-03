import Link from "next/link";
import type { ReactNode } from "react";
import {
  firmarUrlsEvidencia,
  obtenerPasaporteDigital,
  obtenerUltimaUbicacionTraslado,
  type FotoEvidenciaConUrlVisual,
  type UbicacionTraslado
} from "@ruum/api/services";
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
import { SeguimientoTrasladoTiempoReal } from "./SeguimientoTrasladoTiempoReal";
import { PasaporteTabs } from "./PasaporteTabs";
import { HeroAnsiedadCero } from "./HeroAnsiedadCero";
import { EvidenciaComparativa } from "./EvidenciaComparativa";
import { ExportarPasaportePdf } from "./ExportarPasaportePdf";
import { AceptarCotizacion } from "./AceptarCotizacion";
import { PagoRecuperable } from "./PagoRecuperable";
import { PagoTraslado } from "./PagoTraslado";

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
type FotoEvidenciaVisual = FotoEvidenciaConUrlVisual<FotoEvidencia>;
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
  try {
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return "Pendiente";
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Mexico_City"
    }).format(d);
  } catch {
    return "Pendiente";
  }
}

function formatoMoneda(monto: number | null | undefined) {
  return `$${Number(monto ?? 0).toLocaleString("es-MX")}`;
}

function pasaporteMuestraQr(estado: EstadoTraslado) {
  return [
    "conductor_en_camino_al_origen",
    "conductor_en_punto_de_recoleccion",
    "verificacion_vehiculo_en_proceso",
    "evidencia_inicial_en_proceso",
    "llegada_a_destino",
    "evidencia_final_en_proceso",
    "evidencia_final_completada",
    "entrega_confirmada"
  ].includes(estado);
}

function PatronQrPasaporte({ folio }: { folio: string }) {
  const bits = Array.from({ length: 49 }, (_, indice) => {
    const codigo = folio.charCodeAt(indice % folio.length) + indice * 17;
    return codigo % 3 !== 0;
  });

  return (
    <div className="grid size-[120px] grid-cols-7 gap-1 rounded-lg border border-ink/15 bg-mist p-2" aria-label="QR de verificación del pasaporte">
      {bits.map((activo, indice) => (
        <span key={indice} className={activo ? "rounded-[2px] bg-ink" : "rounded-[2px] bg-ink/[0.06]"} aria-hidden />
      ))}
    </div>
  );
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

function calcularHorasDesdeCierre(actualizadoEn: string | null) {
  if (!actualizadoEn) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(actualizadoEn).getTime()) / (1000 * 60 * 60);
}

async function querySegura<T>(promesa: PromiseLike<{ data: T | null; error: unknown }>): Promise<{ data: T | null }> {
  try {
    const res = await promesa;
    return { data: res.data ?? null };
  } catch {
    return { data: null };
  }
}

async function queryArraySegura<T>(promesa: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<{ data: T[] }> {
  try {
    const res = await promesa;
    return { data: res.data ?? [] };
  } catch {
    return { data: [] };
  }
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
      evidencia: [] as FotoEvidenciaVisual[],
      incidencias: [] as Incidencia[],
      disputas: [] as Disputa[],
      reclamosSeguro: [] as ReclamoSeguroUsuario[],
      calificacion: null as Calificacion | null,
      pagos: [] as Pago[],
      ultimaUbicacion: null as UbicacionTraslado | null,
    };
  }

  try {
    const { crearClienteServidor } = await import("../../../lib/supabase-server");
    const cliente = await crearClienteServidor();

    // 1. Intentar obtener el pasaporte digital desde la vista oficial
    let pasaporte: Pasaporte | null = null;
    try {
      pasaporte = await obtenerPasaporteDigital(cliente, id);
    } catch (err) {
      console.warn("[obtenerDatos] Error en obtenerPasaporteDigital, probando fallback directo:", err);
    }

    // 2. Fallback resiliente: consultar tabla traslados directamente si la vista no devuelve datos
    if (!pasaporte) {
      let tRow: Record<string, unknown> | null = null;
      try {
        const res = await cliente
          .from("traslados")
          .select(`
            *,
            vehiculos (*),
            conductores (*)
          `)
          .eq("id", id)
          .maybeSingle();
        tRow = res.data as Record<string, unknown> | null;
      } catch {
        tRow = null;
      }

      if (tRow) {
        const v = tRow.vehiculos as any;
        const c = tRow.conductores as any;
        pasaporte = {
          traslado_id: tRow.id as string,
          usuario_id: tRow.usuario_id as string,
          vehiculo_id: (tRow.vehiculo_id as string) ?? null,
          conductor_id: (tRow.conductor_id as string) ?? null,
          estado: tRow.estado as EstadoTraslado,
          tiene_incidencia_abierta: (tRow.tiene_incidencia_abierta as boolean) ?? false,
          tipo_pago: (tRow.tipo_pago as Database["public"]["Enums"]["tipo_pago"]) ?? null,
          causa_fallido: (tRow.causa_fallido as Database["public"]["Enums"]["causa_fallido"]) ?? null,
          precio_cotizado: (tRow.precio_cotizado as number) ?? null,
          precio_final: (tRow.precio_final as number) ?? null,
          creado_en: tRow.creado_en as string,
          actualizado_en: tRow.actualizado_en as string,
          vehiculo_tipo: v?.tipo ?? null,
          vehiculo_marca: v?.marca ?? null,
          vehiculo_modelo: v?.modelo ?? null,
          vehiculo_anio: v?.anio ?? null,
          conductor_nombre: c?.nombre ?? null,
          conductor_estado: c?.estado ?? null,
          conductor_nivel: c?.nivel_operativo_vigente ?? null,
          conductor_calificacion: c?.calificacion_promedio ?? null,
          evidencia_inicial_fotos_sincronizadas: 0,
          evidencia_final_fotos_sincronizadas: 0,
          incidencias_abiertas: 0,
          monto_pagado: 0,
          origen_lat: (tRow.origen_lat as number) ?? null,
          origen_lng: (tRow.origen_lng as number) ?? null,
          destino_lat: (tRow.destino_lat as number) ?? null,
          destino_lng: (tRow.destino_lng as number) ?? null,
          distancia_km: (tRow.distancia_km as number) ?? null,
          tiempo_estimado_horas: (tRow.tiempo_estimado_horas as number) ?? null,
          vehiculo_categoria_tarifa: v?.categoria_tarifa ?? null,
          vehiculo_gama: v?.gama ?? null,
          vehiculo_condicion: v?.condicion ?? null,
          origen_direccion: (tRow.origen_direccion as string) ?? null,
          origen_ciudad: (tRow.origen_ciudad as string) ?? null,
          origen_referencias: (tRow.origen_referencias as string) ?? null,
          destino_direccion: (tRow.destino_direccion as string) ?? null,
          destino_ciudad: (tRow.destino_ciudad as string) ?? null,
          destino_referencias: (tRow.destino_referencias as string) ?? null,
          contacto_entrega_nombre: (tRow.contacto_entrega_nombre as string) ?? null,
          contacto_entrega_telefono: (tRow.contacto_entrega_telefono as string) ?? null,
          contacto_recepcion_nombre: (tRow.contacto_recepcion_nombre as string) ?? null,
          contacto_recepcion_telefono: (tRow.contacto_recepcion_telefono as string) ?? null,
          vehiculo_color: v?.color ?? null,
          vehiculo_placas: v?.placas ?? null,
          vehiculo_vin: v?.vin ?? null,
          ganancia_conductor: null
        };
      }
    }

    if (!pasaporte) {
      return {
        pasaporte: null,
        traslado: null,
        vehiculo: null,
        conductor: null,
        evidencia: [] as FotoEvidenciaVisual[],
        incidencias: [] as Incidencia[],
        disputas: [] as Disputa[],
        reclamosSeguro: [] as ReclamoSeguroUsuario[],
        calificacion: null as Calificacion | null,
        pagos: [] as Pago[],
        ultimaUbicacion: null as UbicacionTraslado | null,
      };
    }

    const vehiculoId = pasaporte.vehiculo_id;
    const conductorId = pasaporte.conductor_id;

    const [
      trasladoRes,
      vehiculoRes,
      conductorRes,
      evidenciaRes,
      incidenciasRes,
      disputasRes,
      reclamosSeguroRes,
      calificacionRes,
      pagosRes,
      ultimaUbicacion
    ] = await Promise.all([
      querySegura<Traslado>(
        cliente
          .from("traslados")
          .select(
            "origen_direccion, origen_ciudad, destino_direccion, destino_ciudad, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, fecha_hora_programada, cotizacion_expira_en"
          )
          .eq("id", id)
          .maybeSingle()
      ),
      vehiculoId
        ? querySegura<Vehiculo>(
            cliente
              .from("vehiculos")
              .select(
                "tipo, marca, modelo, anio, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando"
              )
              .eq("id", vehiculoId)
              .maybeSingle()
          )
        : Promise.resolve<{ data: Vehiculo | null }>({ data: null }),
      conductorId
        ? querySegura<Conductor>(
            cliente
              .from("conductores")
              .select("id, nombre, estado, nivel_operativo_vigente, calificacion_promedio, traslados_completados")
              .eq("id", conductorId)
              .maybeSingle()
          )
        : Promise.resolve<{ data: Conductor | null }>({ data: null }),
      queryArraySegura<FotoEvidencia>(
        cliente
          .from("evidencia_fotos")
          .select("*")
          .eq("traslado_id", id)
          .order("capturada_en", { ascending: true })
      ),
      queryArraySegura<Incidencia>(
        cliente
          .from("incidencias")
          .select("*")
          .eq("traslado_id", id)
          .order("creada_en", { ascending: false })
      ),
      queryArraySegura<Disputa>(
        cliente
          .from("disputas")
          .select("*")
          .eq("traslado_id", id)
          .order("abierta_en", { ascending: false })
      ),
      queryArraySegura<ReclamoSeguroUsuario>(
        cliente
          .from("reclamos_seguro")
          .select("id, traslado_id, estado, abierto_en, resuelto_en")
          .eq("traslado_id", id)
          .order("abierto_en", { ascending: false })
      ),
      querySegura<Calificacion>(
        cliente
          .from("calificaciones_traslado")
          .select("*")
          .eq("traslado_id", id)
          .maybeSingle()
      ),
      queryArraySegura<Pago>(
        cliente
          .from("pagos")
          .select("*")
          .eq("traslado_id", id)
          .order("registrado_en", { ascending: false })
      ),
      obtenerUltimaUbicacionTraslado(cliente, id).catch(() => null)
    ]);

    let evidenciaFirmada: FotoEvidenciaVisual[] = [];
    try {
      const fotos = (evidenciaRes?.data ?? []) as FotoEvidencia[];
      evidenciaFirmada = await firmarUrlsEvidencia(cliente, fotos);
    } catch {
      evidenciaFirmada = (((evidenciaRes?.data ?? []) as FotoEvidencia[]) || []).map((f) => ({
        ...f,
        url_visual: null
      }));
    }

    return {
      pasaporte,
      traslado: trasladoRes?.data ?? null,
      vehiculo: vehiculoRes?.data ?? null,
      conductor: conductorRes?.data ?? null,
      evidencia: evidenciaFirmada,
      incidencias: (incidenciasRes?.data ?? []) as Incidencia[],
      disputas: (disputasRes?.data ?? []) as Disputa[],
      reclamosSeguro: (reclamosSeguroRes?.data ?? []) as ReclamoSeguroUsuario[],
      calificacion: calificacionRes?.data ?? null,
      pagos: (pagosRes?.data ?? []) as Pago[],
      ultimaUbicacion: ultimaUbicacion ?? null
    };
  } catch (error) {
    console.error("[obtenerDatos]", error);
    return {
      pasaporte: null,
      traslado: null,
      vehiculo: null,
      conductor: null,
      evidencia: [] as FotoEvidenciaVisual[],
      incidencias: [] as Incidencia[],
      disputas: [] as Disputa[],
      reclamosSeguro: [] as ReclamoSeguroUsuario[],
      calificacion: null as Calificacion | null,
      pagos: [] as Pago[],
      ultimaUbicacion: null as UbicacionTraslado | null,
    };
  }
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null | undefined }) {
  return (
    <div>
      <dt className="font-body text-xs uppercase tracking-wide text-ink/45">{etiqueta}</dt>
      <dd className="mt-1 font-body text-sm font-medium text-ink">{valor || "Pendiente"}</dd>
    </div>
  );
}

function AcordeonPasaporte({
  titulo,
  descripcion,
  children,
  abierto = false
}: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  abierto?: boolean;
}) {
  return (
    <details open={abierto} className="group rounded-card border border-ink/15 bg-mist shadow-1">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-dark sm:px-6">
        <span>
          <span className="block font-display text-base font-semibold text-ink">{titulo}</span>
          {descripcion && <span className="mt-1 block font-body text-xs leading-5 text-ink/55">{descripcion}</span>}
        </span>
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-ink/15 font-body text-lg leading-none text-ink/65 transition group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="border-t border-ink/10 px-5 py-5 sm:px-6">{children}</div>
    </details>
  );
}

function AccionesRapidasPasaporte({ trasladoId, estado }: { trasladoId: string; estado: EstadoTraslado }) {
  const enCurso = ["conductor_asignado","conductor_en_camino_al_origen","conductor_en_punto_de_recoleccion","traslado_en_curso","llegada_a_destino"].includes(estado);
  const primario = estado === "cotizacion_generada"
    ? { href: "#pago-soporte", label: "Aceptar cotización", clase: "bg-signal text-ink border-signal hover:bg-signal/90" }
    : estado === "cotizacion_aceptada"
    ? { href: "#pago-soporte", label: "Pagar traslado", clase: "bg-signal text-ink border-signal hover:bg-signal/90" }
    : estado === "pago_pendiente"
    ? { href: "#pago-soporte", label: "Completar pago", clase: "bg-signal text-ink border-signal hover:bg-signal/90" }
    : enCurso 
    ? { href: "#chat-conductor", label: "Chatear con conductor", clase: "bg-signal text-ink border-signal hover:bg-signal/90" }
    : { href: "#acciones-incidencia", label: "Reportar incidencia", clase: "bg-surface-elevated border-border text-text-primary hover:border-signal/40" };
  
  // Solo mostrar 1 CTA primario contextual + menú de más opciones
  return (
    <nav aria-label="Acciones rápidas del traslado" className="sticky top-0 z-30 mt-4 rounded-[var(--ruum-radius-modal)] border border-border bg-surface/95 p-2 shadow-3 backdrop-blur">
      <div className="flex gap-2">
        {/* CTA Primario - siempre visible */}
        <a 
          href={primario.href} 
          className={`flex-1 inline-flex min-h-11 items-center justify-center rounded-[var(--ruum-radius-field)] border px-3 text-center font-body text-xs font-bold transition focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action ${primario.clase}`}
        >
          {primario.label}
        </a>
        
        {/* Menú de acciones secundarias */}
        <div className="relative">
          <button 
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--ruum-radius-field)] border border-border bg-surface-elevated px-3 text-center font-body text-xs font-bold text-text-secondary hover:border-border-strong transition"
          >
            Más
          </button>
        </div>
      </div>
    </nav>
  );
}

function LineaTiempoVisual({ estadoActual }: { estadoActual: EstadoTraslado }) {
  return (
    <ol className="mt-5">
      {LINEA_TIEMPO.map((paso, indice) => {
        const estado = estadoDePaso(estadoActual, paso.estado);
        const esUltimo = indice === LINEA_TIEMPO.length - 1;

        return (
          <li key={paso.etiqueta} className="relative grid grid-cols-[28px_1fr] gap-3 pb-5 last:pb-0">
            {!esUltimo && (
              <span
                aria-hidden
                className={[
                  "absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5",
                  estado === "pendiente" ? "bg-ink/12" : "bg-control/45"
                ].join(" ")}
              />
            )}
            <span
              className={[
                "relative z-10 mt-0.5 grid size-7 place-items-center rounded-full border font-mono-ruum text-[11px] font-semibold",
                estado === "completado"
                  ? "border-control bg-control text-mist"
                  : estado === "actual"
                    ? "border-signal bg-signal text-ink shadow-2"
                    : "border-ink/20 bg-mist text-ink/35"
              ].join(" ")}
              aria-hidden
            >
              {indice + 1}
            </span>
            <div className={estado === "pendiente" ? "pt-0.5 text-ink/45" : "pt-0.5 text-ink"}>
              <p className="font-body text-sm font-semibold">{paso.etiqueta}</p>
              <p className="mt-0.5 font-body text-xs">
                {estado === "actual" ? "Estado actual" : estado === "completado" ? "Completado" : "Pendiente"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function EvidenciaMomento({
  titulo,
  descripcion,
  fotos
}: {
  titulo: string;
  descripcion: string;
  fotos: FotoEvidenciaVisual[];
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
              {foto.url_visual?.startsWith("http") ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage.
                <img src={foto.url_visual} alt={ETIQUETA_ANGULO[foto.angulo]} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-ink/5 px-3 text-center font-body text-xs text-ink/45">
                  Foto registrada
                </div>
              )}
              <div className="border-t border-ink/10 px-3 py-2">
                <p className="font-body text-xs font-medium">{ETIQUETA_ANGULO[foto.angulo]}</p>
                <p className="mt-0.5 font-body text-xs text-ink/45">
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
          <p className="mt-1 font-body text-sm font-medium">
            {pasaporte.estado ? ETIQUETA_ESTADO_TRASLADO[pasaporte.estado] : "Estado por confirmar"}
          </p>
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
  const { pasaporte, traslado, vehiculo, conductor, evidencia, incidencias, disputas, reclamosSeguro, calificacion, pagos, ultimaUbicacion } = await obtenerDatos(id);

  if (!pasaporte) {
    return (
      <main className="min-h-screen bg-[#070D18] text-[#F8F8F5]">
        <NavegacionUsuario />
        <div className="w-full max-w-md mx-auto py-20 px-4 text-center">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[#FFC400]">
            Traslado no encontrado
          </p>
          <h1 className="mt-3 font-display text-2xl font-black text-white">No encontramos ese traslado</h1>
          <p className="mt-3 max-w-sm mx-auto font-body text-xs leading-relaxed text-[#8E9CAE]">
            Revisa el enlace o el folio. Si recién lo creaste, puede tardar unos segundos en sincronizarse con la plataforma.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/mis-viajes"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#FFC400] px-5 py-2.5 font-display text-xs font-black uppercase tracking-wider text-[#0B111B] shadow-md transition hover:bg-[#e6b000]"
            >
              Ver mis traslados
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#1C2A3E] bg-[#0A1220] px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-[#FFC400]/40 hover:text-white"
            >
              Inicio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!pasaporte.traslado_id || !pasaporte.estado) {
    return (
      <main className="min-h-screen bg-[#070D18] text-[#F8F8F5]">
        <NavegacionUsuario />
        <div className="w-full max-w-md mx-auto py-20 px-4 text-center">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[#FFC400]">
            Traslado incompleto
          </p>
          <h1 className="mt-3 font-display text-2xl font-black text-white">No pudimos cargar el estado del traslado</h1>
          <p className="mt-3 max-w-sm mx-auto font-body text-xs leading-relaxed text-[#8E9CAE]">
            Vuelve a intentarlo. Si el problema continúa, contacta a nuestro equipo de soporte.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/mis-viajes"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#FFC400] px-5 py-2.5 font-display text-xs font-black uppercase tracking-wider text-[#0B111B] shadow-md transition hover:bg-[#e6b000]"
            >
              Ver mis traslados
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
    <main className="min-h-screen bg-[#070D18] text-[#F8F8F5]">
      <NavegacionUsuario />
      <div className="w-full max-w-2xl mx-auto px-4 py-4 sm:py-8 pb-28">
      <PassportCard folio={`#RM-${pasaporte.traslado_id.slice(0, 4).toUpperCase()}`}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/55">RUUM — PASAPORTE DIGITAL</p>
            <h1 className="mt-3 font-display text-lg font-bold leading-tight text-ink">
              {vehiculoNombre || "Traslado de vehículo"}
              {pasaporte.vehiculo_tipo && (
                <span className="ml-2 align-middle font-body text-sm font-normal text-ink/50">
                  · {ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo]}
                </span>
              )}
            </h1>
            <p className="mt-1 font-mono-ruum text-xs text-ink/60">
              Placas {pasaporte.vehiculo_placas ?? "Pendiente"}
              {pasaporte.vehiculo_color ? ` · ${pasaporte.vehiculo_color}` : ""}
            </p>
            <p className="mt-3 font-body text-xs text-ink/60">
              Actualizado {formatoFecha(pasaporte.actualizado_en)}
            </p>
          </div>
          <div className="rounded-lg border border-ink/10 bg-mist/80 px-3 py-2">
            <EstadoBadge estado={pasaporte.estado} />
          </div>
        </div>

        <dl className="mt-8 grid gap-4 border-t border-ink/10 pt-6 sm:grid-cols-2">
          <Dato etiqueta="Origen" valor={pasaporte.origen_ciudad} />
          <Dato etiqueta="Destino" valor={pasaporte.destino_ciudad} />
        </dl>

        {pasaporteMuestraQr(pasaporte.estado) && (
          <div className="mt-6 flex flex-col gap-4 border-t border-ink/10 pt-6 sm:flex-row sm:items-end sm:justify-between">
            <PatronQrPasaporte folio={pasaporte.traslado_id} />
            <div className="font-body text-sm text-ink/60">
              <p className="font-semibold text-ink">Verificación de identidad</p>
              <p className="mt-1">Válido hasta entrega.</p>
            </div>
          </div>
        )}

        {pasaporte.tiene_incidencia_abierta && (
          <div className="mt-6">
            <Aviso tono="atencion">
              Este traslado tiene una incidencia abierta. Nuestro equipo te mantendrá informado.
            </Aviso>
          </div>
        )}

        {pasaporte.estado === "servicio_cerrado" && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Aviso tono="info">{MENSAJES_CLAVE_UX.cierre}</Aviso>
            <ExportarPasaportePdf />
          </div>
        )}

        <dl className="mt-8 grid gap-4 border-t border-ink/10 pt-6 sm:grid-cols-4">
          <Dato etiqueta="Estado actual" valor={ETIQUETA_ESTADO_TRASLADO[pasaporte.estado]} />
          <Dato etiqueta="Conductor" valor={pasaporte.conductor_nombre ?? "Por asignar"} />
          <Dato etiqueta="Evidencia" valor={`${evidenciaInicial.length} inicial · ${evidenciaFinal.length} final`} />
          <Dato etiqueta="Pago" valor={`${formatoMoneda(pasaporte.monto_pagado)} pagado`} />
        </dl>
      </PassportCard>

      <HeroAnsiedadCero pasaporte={pasaporte} conductor={conductor} traslado={traslado} trasladoId={pasaporte.traslado_id} />

      <AccionesRapidasPasaporte trasladoId={pasaporte.traslado_id} estado={pasaporte.estado} />

      <section id="chat-conductor" className="mt-4 scroll-mt-28">
        <AcordeonPasaporte 
          titulo="Chat con el conductor" 
          descripcion="Comunicación autorizada y llamada enmascarada."
          abierto={["conductor_asignado","conductor_en_camino_al_origen","conductor_en_punto_de_recoleccion","traslado_en_curso","llegada_a_destino"].includes(pasaporte.estado)}
        >
          <ChatTraslado trasladoId={pasaporte.traslado_id} estado={pasaporte.estado} />
        </AcordeonPasaporte>
      </section>

      <section id="acciones-incidencia" className="mt-4 scroll-mt-28">
        <AcordeonPasaporte titulo="Reportar incidencia" descripcion="Da aviso a soporte sin buscar el formulario al final de la página.">
          <ReportarIncidenciaUsuario trasladoId={pasaporte.traslado_id} />
        </AcordeonPasaporte>
      </section>

      <PasaporteTabs
        trazabilidad={
          <div id="trazabilidad" className="space-y-6">
            <SeguimientoTrasladoTiempoReal
              trasladoId={pasaporte.traslado_id ?? id}
              estado={pasaporte.estado}
              origen={{ lat: pasaporte.origen_lat, lng: pasaporte.origen_lng }}
              destino={{ lat: pasaporte.destino_lat, lng: pasaporte.destino_lng }}
              ubicacionInicial={ultimaUbicacion}
            />

            <PassportCard>
              <h2 className="font-display text-xl font-semibold">Progreso del traslado</h2>
              <p className="mt-1 font-body text-sm leading-6 text-ink/60">
                Los pasos completados quedan sellados, el punto actual queda resaltado y los pasos futuros permanecen en gris.
              </p>
              <div className="mt-6">
                <EstadoStepper estado={pasaporte.estado} />
              </div>
              <LineaTiempoVisual estadoActual={pasaporte.estado} />
            </PassportCard>
          </div>
        }
        evidencias={
          <section id="evidencias" className="space-y-6">
            <PassportCard>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-body text-xs uppercase tracking-wide text-ink/45">Evidencia documental</p>
                  <h2 className="mt-1 font-display text-xl font-semibold">Fotos y bitácora operativa</h2>
                </div>
                <p className="font-body text-sm text-ink/55">La evidencia se consulta por momento, sin mezclarla con soporte o pago.</p>
              </div>

              <div className="mt-6 space-y-6">
                <EvidenciaMomento
                  titulo="Evidencia inicial"
                  descripcion={MENSAJES_CLAVE_UX.evidencia_inicial}
                  fotos={evidenciaInicial}
                />
                <EvidenciaComparativa
                  inicial={evidenciaInicial}
                  final={evidenciaFinal}
                  tieneIncidenciaAbierta={incidencias.some((i) => !i.resuelta)}
                />
                <EvidenciaDurante pasaporte={pasaporte} traslado={traslado} incidencias={incidencias} />
                <EvidenciaMomento
                  titulo="Evidencia final"
                  descripcion="Fotos finales exteriores e interiores, kilometraje y combustible final, confirmación de entrega, observaciones finales y aceptación del receptor cuando aplique."
                  fotos={evidenciaFinal}
                />
                <div className="flex justify-end">
                  <ExportarPasaportePdf />
                </div>
              </div>
            </PassportCard>
          </section>
        }
        detalles={
          <section id="detalles" className="space-y-4">
            <AcordeonPasaporte titulo="Ruta y contactos" descripcion="Origen, destino y personas autorizadas." abierto>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Dato etiqueta="Origen" valor={traslado ? `${traslado.origen_direccion}, ${traslado.origen_ciudad}` : null} />
                <Dato etiqueta="Destino" valor={traslado ? `${traslado.destino_direccion}, ${traslado.destino_ciudad}` : null} />
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
            </AcordeonPasaporte>

            <AcordeonPasaporte titulo="Conductor asignado" descripcion="Identidad, certificación y canal autorizado.">
              <div className="flex items-center gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-ink font-display text-xl text-mist">
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
                    pasaporte.conductor_calificacion != null ? `${Number(pasaporte.conductor_calificacion).toFixed(1)} / 5` : "Sin calificación"
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
            </AcordeonPasaporte>

            <AcordeonPasaporte titulo="Datos del vehículo" descripcion="Ficha técnica y documentos declarados.">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Dato etiqueta="Marca" valor={vehiculo?.marca ?? pasaporte.vehiculo_marca} />
                <Dato etiqueta="Modelo" valor={vehiculo?.modelo ?? pasaporte.vehiculo_modelo} />
                <Dato etiqueta="Año" valor={vehiculo?.anio ?? pasaporte.vehiculo_anio} />
                <Dato
                  etiqueta="Tipo"
                  valor={
                    (vehiculo?.tipo ?? pasaporte.vehiculo_tipo)
                      ? ETIQUETA_TIPO_VEHICULO[(vehiculo?.tipo ?? pasaporte.vehiculo_tipo) as keyof typeof ETIQUETA_TIPO_VEHICULO] ?? (vehiculo?.tipo ?? pasaporte.vehiculo_tipo)
                      : null
                  }
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
            </AcordeonPasaporte>

            <AcordeonPasaporte titulo="Reportes e incidencias" descripcion="Acciones disponibles durante y después del traslado.">
              <div>
                {incidencias.length > 0 ? (
                  <div className="space-y-4">
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
                          {incidencia.momento ? String(incidencia.momento).replaceAll("_", " ") : "Traslado"} · {formatoFecha(incidencia.creada_en)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-ink/15 px-3 py-3 font-body text-sm text-ink/50">
                    No hay incidencias reportadas para este traslado.
                  </p>
                )}
                <AbrirDisputa trasladoId={pasaporte.traslado_id} disponible={puedeAbrirDisputa} />
                <CancelarTraslado
                  trasladoId={pasaporte.traslado_id}
                  estado={pasaporte.estado}
                  precio={precioBase}
                  fechaProgramada={traslado?.fecha_hora_programada ?? null}
                  conductorAsignado={Boolean(pasaporte.conductor_id)}
                />
              </div>
            </AcordeonPasaporte>

            <section id="pago-soporte" className="scroll-mt-28">
              <AcordeonPasaporte
                titulo="Pago y soporte"
                descripcion="Tarifa, pagos registrados y contacto de ayuda."
                abierto={["cotizacion_generada", "cotizacion_aceptada", "pago_pendiente"].includes(pasaporte.estado)}
              >
                <p className="font-body text-sm text-ink/55">{MENSAJES_CLAVE_UX.pago}</p>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Dato etiqueta="Tipo de pago" valor={(pasaporte.tipo_pago ? String(pasaporte.tipo_pago) : "por_definir").replaceAll("_", " ")} />
                  <Dato etiqueta="Precio cotizado" valor={formatoMoneda(pasaporte.precio_cotizado)} />
                  <Dato etiqueta="Precio final" valor={formatoMoneda(pasaporte.precio_final ?? precioBase)} />
                  <Dato etiqueta="Monto pagado" valor={formatoMoneda(pasaporte.monto_pagado)} />
                </dl>
                {pagos.length > 0 && (
                  <div className="mt-5 space-y-3">
                    {pagos.map((pago) => (
                      <div key={pago.id} className="flex items-center justify-between border-t border-ink/10 pt-3 font-body text-sm">
                        <span>{pago.metodo} · {pago.momento ? String(pago.momento).replaceAll("_", " ") : ""}</span>
                        <span className="font-mono-ruum">{formatoMoneda(pago.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {pasaporte.estado === "cotizacion_generada" && pasaporte.precio_cotizado != null && (
                  <div className="mt-6 rounded-xl border border-[#FFC400]/40 bg-[#FFC400]/10 p-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-[#FFC400] text-xs font-black text-slate-950">
                        $
                      </span>
                      <p className="font-display text-sm font-bold text-white">Cotización lista para confirmación</p>
                    </div>
                    <p className="mt-2 font-body text-xs text-[#d7dce5]">
                      El equipo operativo calculó la tarifa de tu traslado:{" "}
                      <strong className="text-[#FFC400] font-bold text-sm">
                        {formatoMoneda(pasaporte.precio_cotizado)} MXN
                      </strong>
                      . Revisa los detalles y acéptala para continuar con la asignación del conductor.
                    </p>
                    <AceptarCotizacion
                      trasladoId={pasaporte.traslado_id}
                      tipoPago={pasaporte.tipo_pago ?? "anticipado"}
                    />
                  </div>
                )}
                {pasaporte.estado === "cotizacion_aceptada" && pasaporte.tipo_pago === "anticipado" && precioBase > 0 && (
                  <div className="mt-6 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
                    <p className="font-display text-sm font-bold text-white">Cotización aceptada · Pago anticipado</p>
                    <p className="mt-1 font-body text-xs text-[#d7dce5]">
                      Para que nuestro equipo confirme y asigne un conductor certificado a tu traslado, completa el pago con tarjeta.
                    </p>
                    {traslado?.cotizacion_expira_en ? (
                      <PagoRecuperable
                        trasladoId={pasaporte.traslado_id}
                        monto={precioBase}
                        cotizacionExpiraEn={traslado.cotizacion_expira_en}
                      />
                    ) : (
                      <PagoTraslado trasladoId={pasaporte.traslado_id} monto={precioBase} />
                    )}
                  </div>
                )}
                {pasaporte.estado === "pago_pendiente" && (
                  <div className="mt-6">
                    {precioBase > 0 ? (
                      <div className="rounded-xl border border-[#FFC400]/40 bg-[#FFC400]/10 p-4">
                        <p className="font-display text-sm font-bold text-white">Pago pendiente del traslado</p>
                        <p className="mt-1 font-body text-xs text-[#d7dce5]">
                          El servicio ha llegado a su destino. Completa el pago pendiente para finalizar el servicio.
                        </p>
                        <PagoTraslado trasladoId={pasaporte.traslado_id} monto={precioBase} />
                      </div>
                    ) : (
                      <Aviso tono="atencion">
                        Pago pendiente. El cobro al cierre se activará en cuanto operación confirme el precio final.
                      </Aviso>
                    )}
                  </div>
                )}
                <div id="soporte-pasaporte" className="mt-6 rounded-lg border border-ink/10 px-4 py-4">
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
              </AcordeonPasaporte>
            </section>

            {(disputas.length > 0 || reclamosSeguro.length > 0) && (
              <AcordeonPasaporte titulo="Disputas, reclamos y resoluciones" descripcion="Historial de resolución posterior al servicio.">
                <div className="space-y-3">
                  {disputas.map((disputa) => (
                    <div key={disputa.id} className="rounded-lg border border-ink/10 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-body text-sm font-semibold">{disputa.tipo ? String(disputa.tipo).replaceAll("_", " ") : "Disputa"}</p>
                        <span className="font-body text-xs text-ink/50">{disputa.estado ? String(disputa.estado).replaceAll("_", " ") : ""}</span>
                      </div>
                      <p className="mt-2 font-body text-sm text-ink/65">{disputa.descripcion}</p>
                      {disputa.resolucion && (
                        <p className="mt-2 font-body text-sm text-control">
                          Resolución: {String(disputa.resolucion).replaceAll("_", " ")}
                          {disputa.resolucion_detalle ? ` · ${disputa.resolucion_detalle}` : ""}
                        </p>
                      )}
                    </div>
                  ))}
                  {reclamosSeguro.map((reclamo) => (
                    <div key={reclamo.id} className="rounded-lg border border-ink/10 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-body text-sm font-semibold">Reclamo de seguro</p>
                        <span className="font-body text-xs text-ink/50">{reclamo.estado ? String(reclamo.estado).replaceAll("_", " ") : ""}</span>
                      </div>
                      <p className="mt-2 font-body text-sm text-ink/65">
                        Abierto {formatoFecha(reclamo.abierto_en)}
                        {reclamo.resuelto_en ? ` · Resuelto ${formatoFecha(reclamo.resuelto_en)}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </AcordeonPasaporte>
            )}
          </section>
        }
      />
      </div>
    </main>
  );
}
