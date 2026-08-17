"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import type { Conductor, Database } from "@ruum/shared/types";
import type { MotivoRechazo } from "@ruum/shared/constants";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { obtenerUbicacionActualConEstado, type Coordenadas } from "../../lib/ubicacion";
import {
  listarViajesDisponibles,
  listarViajesAceptados,
  aceptarViaje,
  obtenerConductorActual,
  listarHistorialViajesConductor,
  registrarEvento
} from "@ruum/api/services";
import { RejectTripDialog } from "./RejectTripDialog";
import { WeekDaySelector } from "./WeekDaySelector";
import {
  claveDia,
  crearCalendario,
  detalleFallback,
  normalizarVista,
  formatearDuracion,
  type DetalleOperativo,
  type PasaporteRow,
} from "./trips-utils";

type RechazoPendiente = {
  viaje: PasaporteRow;
  motivo: MotivoRechazo;
};

function TripsLoadingList() {
  return (
    <output aria-label="Cargando viajes" aria-busy="true" className="w-full flex flex-col gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-48 w-full animate-pulse rounded-3xl bg-surface-elevated" />
      ))}
    </output>
  );
}

function getEstadoCardInfo(estado: string, esOferta: boolean) {
  if (esOferta) {
    return {
      dotColor: "bg-[#a8e820]",
      textColor: "text-[#a8e820]",
      titulo: "TRASLADO DISPONIBLE",
      descripcion: "Traslado disponible para aceptar."
    };
  }

  switch (estado) {
    case "conductor_asignado":
      return {
        dotColor: "bg-amber-500",
        textColor: "text-amber-500",
        titulo: "PENDIENTE DE INICIO",
        descripcion: "Prepara tu unidad y dirígete al origen."
      };
    case "conductor_en_camino_al_origen":
      return {
        dotColor: "bg-emerald-500",
        textColor: "text-[#10B981]",
        titulo: "EN CAMINO AL ORIGEN",
        descripcion: "Dirígete al punto de recolección."
      };
    case "conductor_en_punto_de_recoleccion":
    case "verificacion_vehiculo_en_proceso":
    case "evidencia_inicial_en_proceso":
    case "evidencia_inicial_completada":
    case "vehiculo_recibido":
      return {
        dotColor: "bg-emerald-500",
        textColor: "text-[#10B981]",
        titulo: "EN PUNTO DE ORIGEN",
        descripcion: "Realiza la entrega del vehículo."
      };
    case "traslado_en_curso":
      return {
        dotColor: "bg-emerald-500",
        textColor: "text-[#10B981]",
        titulo: "TRASLADO EN CURSO",
        descripcion: "Conduce de forma segura al destino."
      };
    case "llegada_a_destino":
    case "evidencia_final_en_proceso":
    case "evidencia_final_completada":
      return {
        dotColor: "bg-emerald-500",
        textColor: "text-[#10B981]",
        titulo: "LLEGADA A DESTINO",
        descripcion: "Por entregar la unidad al receptor."
      };
    case "entrega_confirmada":
    case "servicio_cerrado":
      return {
        dotColor: "bg-emerald-500",
        textColor: "text-[#10B981]",
        titulo: "TRASLADO FINALIZADO",
        descripcion: "El traslado ha sido concluido."
      };
    default:
      return {
        dotColor: "bg-amber-500",
        textColor: "text-amber-500",
        titulo: "PENDIENTE DE INICIO",
        descripcion: "Prepara tu unidad y dirígete al origen."
      };
  }
}

function CustomTripCard({
  viaje,
  detalle,
  esOferta,
  onReject,
  hrefDetalle
}: {
  viaje: PasaporteRow;
  detalle: DetalleOperativo;
  esOferta: boolean;
  onReject: (viaje: PasaporteRow) => void;
  hrefDetalle: string;
}) {
  const folio = viaje.traslado_id ? viaje.traslado_id.slice(0, 8).toUpperCase() : "POR CONFIRMAR";
  const ganancia = viaje.ganancia_conductor != null 
    ? `$${viaje.ganancia_conductor.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
    : "$0.00";

  const origen = (viaje.origen_ciudad || "Por confirmar");
  const destino = (viaje.destino_ciudad || "Por confirmar");

  // Helper to parse states
  const parseEstado = (dir: string | null) => {
    if (!dir) return "México";
    const parts = dir.split(",");
    if (parts.length > 1) {
      return parts[1].trim();
    }
    return "México";
  };

  const origenEstado = parseEstado(viaje.origen_direccion);
  const destinoEstado = parseEstado(viaje.destino_direccion);

  const horaInicio = detalle.fechaHora 
    ? new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Mexico_City" }).format(new Date(detalle.fechaHora)) 
    : "10:32";
  
  const duracionHoras = viaje.tiempo_estimado_horas || null;
  const duracionTexto = formatearDuracion(duracionHoras);
  const distanciaTexto = viaje.distancia_km != null ? `${viaje.distancia_km.toFixed(1)} km` : "62.5 km";

  const cardInfo = getEstadoCardInfo(viaje.estado || "", esOferta);

  return (
    <div className="w-full rounded-[2rem] border border-border/10 bg-[#0E1524]/60 p-5 shadow-xs flex flex-col gap-4 text-left select-none">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-[10px] font-black uppercase tracking-wider ${
          esOferta 
            ? "bg-[#a8e820]/15 text-[#a8e820] border border-[#a8e820]/25" 
            : "bg-emerald-500/10 text-[#10B981] border border-emerald-500/25"
        }`}>
          {!esOferta && (
            <svg className="w-3 h-3 shrink-0 text-[#10B981]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {esOferta ? "DISPONIBLE" : "ACEPTADO"}
        </span>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-text-tertiary tracking-wider font-semibold">ID {folio}</span>
          {!esOferta && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReject(viaje);
              }}
              className="p-1 text-text-tertiary hover:text-text-primary transition-colors shrink-0 cursor-pointer"
              aria-label="Opciones de traslado"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Status and Payment row */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${cardInfo.dotColor} animate-pulse shrink-0`} />
            <span className={`font-display text-xs font-black tracking-wider uppercase ${cardInfo.textColor}`}>
              {cardInfo.titulo}
            </span>
          </div>
          <p className="font-body text-[10px] text-text-secondary mt-1 leading-snug">
            {cardInfo.descripcion}
          </p>
        </div>

        <div className="flex flex-col text-right shrink-0">
          <span className="font-display text-lg font-black text-white leading-none">
            {ganancia}
          </span>
          <span className="font-body text-[8px] font-bold text-text-tertiary mt-1 tracking-wider uppercase">
            PAGO DEL TRASLADO
          </span>
        </div>
      </div>

      {/* Horizontal Route Component */}
      <div className="flex items-center justify-between gap-4 py-1">
        <div className="flex flex-col text-left">
          <span className="font-display text-[9px] font-bold text-[#10B981] tracking-widest uppercase">Origen</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[#10B981] text-xs">📍</span>
            <span className="font-display text-xs font-black text-white leading-tight">{origen}</span>
          </div>
          <span className="font-body text-[9px] text-text-tertiary mt-0.5 leading-none">{origenEstado}</span>
        </div>
        
        <div className="flex items-center justify-center shrink-0 text-text-secondary select-none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>

        <div className="flex flex-col text-right">
          <span className="font-display text-[9px] font-bold text-[#00B4D8] tracking-widest uppercase">Destino</span>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <span className="font-display text-xs font-black text-white leading-tight text-right">{destino}</span>
            <span className="text-[#00B4D8] text-xs">📍</span>
          </div>
          <span className="font-body text-[9px] text-text-tertiary mt-0.5 leading-none text-right">{destinoEstado}</span>
        </div>
      </div>

      {/* Horizontal Divider */}
      <div className="border-t border-border/10" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 select-none">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-text-tertiary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div className="flex flex-col text-left">
            <span className="text-text-tertiary text-[7.5px] font-bold uppercase tracking-wider leading-none">Hora</span>
            <span className="text-white text-[11px] font-extrabold mt-0.5 leading-none">{horaInicio}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-l border-border/10 pl-3">
          <svg className="w-4 h-4 text-text-tertiary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 15 15" />
          </svg>
          <div className="flex flex-col text-left">
            <span className="text-text-tertiary text-[7.5px] font-bold uppercase tracking-wider leading-none">Duración</span>
            <span className="text-white text-[11px] font-extrabold mt-0.5 leading-none">{duracionTexto}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-l border-border/10 pl-3">
          <svg className="w-4 h-4 text-text-tertiary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 22 L9 2 L15 2 L21 22" />
            <path d="M12 2 L12 22" strokeDasharray="2 2" />
            <path d="M6 14 L18 14" />
          </svg>
          <div className="flex flex-col text-left">
            <span className="text-text-tertiary text-[7.5px] font-bold uppercase tracking-wider leading-none">Distancia</span>
            <span className="text-white text-[11px] font-extrabold mt-0.5 leading-none">{distanciaTexto}</span>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <Link
        href={hrefDetalle}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#00B4D8] hover:bg-[#0092B0] px-4 py-2.5 font-display text-xs font-black tracking-widest text-white transition-all shadow-md select-none cursor-pointer mt-1"
      >
        {esOferta ? "VER OFERTA" : "CONTINUAR TRASLADO"}
        <svg className="w-4 h-4 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nueva tarjeta de oferta — diseño compacto de dos columnas
// ---------------------------------------------------------------------------
function extraerColonia(direccion: string | null): string {
  if (!direccion) return "";
  // Formato típico: "Calle Nro, Colonia, Ciudad, Estado, CP"
  const partes = direccion.split(",").map((p) => p.trim());
  // La colonia suele estar en la 2da parte (índice 1)
  return partes[1] ?? partes[0] ?? "";
}

function extraerCiudad(ciudad: string | null, direccion: string | null): string {
  if (ciudad) return ciudad;
  if (!direccion) return "";
  const partes = direccion.split(",").map((p) => p.trim());
  return partes[2] ?? partes[1] ?? partes[0] ?? "";
}

function OfertaCard({
  viaje,
  detalle,
  hrefDetalle
}: {
  viaje: PasaporteRow;
  detalle: DetalleOperativo;
  hrefDetalle: string;
}) {
  const folio = viaje.traslado_id ? viaje.traslado_id.slice(0, 8).toUpperCase() : "SIN ID";

  const ganancia = viaje.ganancia_conductor != null
    ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(viaje.ganancia_conductor)
    : "Por confirmar";

  const coloniaOrigen = extraerColonia(viaje.origen_direccion);
  const ciudadOrigen = extraerCiudad(viaje.origen_ciudad, viaje.origen_direccion);
  const coloniaDestino = extraerColonia(viaje.destino_direccion);
  const ciudadDestino = extraerCiudad(viaje.destino_ciudad, viaje.destino_direccion);

  const usuarioNombre = viaje.contacto_recepcion_nombre || viaje.contacto_entrega_nombre || null;

  const horaInicio = detalle.fechaHora
    ? new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Mexico_City" }).format(new Date(detalle.fechaHora))
    : null;

  const distanciaTexto = viaje.distancia_km != null
    ? `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: viaje.distancia_km < 10 ? 1 : 0 }).format(viaje.distancia_km)} km`
    : null;

  const duracionTexto = formatearDuracion(viaje.tiempo_estimado_horas);

  return (
    <div className="w-full rounded-2xl border border-border/15 bg-[#0C1120] overflow-hidden shadow-sm select-none text-left">

      {/* — Cabecera: ID + precio — */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/10">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#a8e820] animate-pulse shrink-0" />
          <span className="font-mono text-[10px] font-extrabold text-text-tertiary tracking-widest uppercase">
            {folio}
          </span>
        </div>
        <span className="font-display text-base font-black text-[#a8e820] leading-none tabular-nums">
          {ganancia}
        </span>
      </div>

      {/* — Ruta: origen → destino — */}
      <div className="px-4 py-3 flex flex-col gap-3">

        {/* Origen */}
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 shrink-0 flex flex-col items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-[#10B981] bg-transparent" />
            <span className="w-[1px] h-4 bg-border/20" />
          </div>
          <div className="flex flex-col min-w-0">
            {coloniaOrigen && (
              <span className="font-display text-sm font-black text-text-primary leading-tight truncate">
                {coloniaOrigen}
              </span>
            )}
            <span className="font-body text-[11px] text-text-secondary leading-tight truncate mt-0.5">
              {ciudadOrigen || "Origen por confirmar"}
            </span>
          </div>
        </div>

        {/* Destino */}
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-[#00B4D8] flex-none block" />
          </div>
          <div className="flex flex-col min-w-0">
            {coloniaDestino && (
              <span className="font-display text-sm font-black text-text-primary leading-tight truncate">
                {coloniaDestino}
              </span>
            )}
            <span className="font-body text-[11px] text-text-secondary leading-tight truncate mt-0.5">
              {ciudadDestino || "Destino por confirmar"}
            </span>
          </div>
        </div>
      </div>

      {/* — Usuario / contacto — */}
      {usuarioNombre && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-surface-elevated/60 border border-border/10 px-3 py-2">
          <svg className="w-3.5 h-3.5 text-text-tertiary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="font-body text-[10px] text-text-tertiary font-bold uppercase tracking-wider leading-none">Usuario:</span>
          <span className="font-body text-[11px] text-text-primary font-semibold leading-none truncate">{usuarioNombre}</span>
        </div>
      )}

      {/* — Stats: hora · distancia · duración — */}
      <div className="flex items-center divide-x divide-border/10 border-t border-border/10">
        {horaInicio ? (
          <div className="flex flex-1 flex-col items-center gap-0.5 py-2.5">
            <span className="text-text-tertiary text-[8px] font-extrabold uppercase tracking-widest leading-none">Inicio</span>
            <span className="font-display text-[13px] font-black text-text-primary mt-1 tabular-nums leading-none">{horaInicio}</span>
          </div>
        ) : null}
        {distanciaTexto ? (
          <div className="flex flex-1 flex-col items-center gap-0.5 py-2.5">
            <span className="text-text-tertiary text-[8px] font-extrabold uppercase tracking-widest leading-none">Distancia</span>
            <span className="font-display text-[13px] font-black text-text-primary mt-1 tabular-nums leading-none">{distanciaTexto}</span>
          </div>
        ) : null}
        <div className="flex flex-1 flex-col items-center gap-0.5 py-2.5">
          <span className="text-text-tertiary text-[8px] font-extrabold uppercase tracking-widest leading-none">Duración</span>
          <span className="font-display text-[13px] font-black text-text-primary mt-1 tabular-nums leading-none">{duracionTexto}</span>
        </div>
      </div>

      {/* — CTA — */}
      <div className="px-4 pb-4 pt-3">
        <Link
          href={hrefDetalle}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#00B4D8] hover:bg-[#0092B0] active:scale-[0.98] px-4 font-display text-[11px] font-black tracking-widest text-white uppercase transition-all shadow-sm cursor-pointer"
        >
          Ver oferta
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

export default function PaginaViajes() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [diaSeleccionado, setDiaSeleccionado] = useState("");
  const [diaHoy, setDiaHoy] = useState("");
  const [disponibles, setDisponibles] = useState<PasaporteRow[]>([]);
  const [rechazados, setRechazados] = useState<string[]>([]);
  const [aceptados, setAceptados] = useState<PasaporteRow[]>([]);
  const [historial, setHistorial] = useState<PasaporteRow[]>([]);
  const [detalles, setDetalles] = useState<Record<string, DetalleOperativo>>({});
  const [cargando, setCargando] = useState(true);
  const [aceptando, setAceptando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [viajeParaRechazar, setViajeParaRechazar] = useState<PasaporteRow | null>(null);
  const [rechazoPendiente, setRechazoPendiente] = useState<RechazoPendiente | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [soporteAbierto, setSoporteAbierto] = useState(false);
  const timeoutRechazoRef = useRef<number | null>(null);

  const vista = normalizarVista(searchParams.get("vista"));
  const queryActual = searchParams.toString();
  const rutaActual = queryActual ? `/viajes?${queryActual}` : "/viajes";

  function actualizarUrl(cambios: Partial<Record<"vista" | "grupo" | "fecha" | "estado", string>>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(cambios).forEach(([clave, valor]) => {
      if (!valor || valor === "todos") {
        params.delete(clave);
      } else {
        params.set(clave, valor);
      }
    });
    params.delete("grupo");
    const query = params.toString();
    router.replace(query ? `/viajes?${query}` : "/viajes", { scroll: false });
  }

  function hrefDetalle(viaje: PasaporteRow) {
    return `/viajes/${viaje.traslado_id}?volver=${encodeURIComponent(rutaActual)}`;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hoy = claveDia(new Date());
      setDiaHoy(hoy);
      setDiaSeleccionado((actual) => actual || hoy);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRechazoRef.current) {
        window.clearTimeout(timeoutRechazoRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setAviso("Supabase no está configurado. No se pueden consultar viajes reales.");
        setCargando(false);
        return;
      }

      try {
        const cliente = crearClienteNavegador();
        const real = await obtenerConductorActual(cliente);
        const conductorActual: Conductor | null = real
          ? {
              id: real.id,
              nombre: real.nombre,
              estado: real.estado,
              calificacion_promedio: real.calificacion_promedio,
              traslados_completados: real.traslados_completados,
              suspensiones_activas: real.suspensiones_activas,
              no_presentaciones_6m: real.no_presentaciones_6m,
              cancelaciones_sin_justificacion_count: real.cancelaciones_sin_justificacion_count,
              documentos_vigentes: real.documentos_vigentes,
              certificaciones: [],
              incidencias_graves_6m: real.incidencias_graves_6m,
              incidencias_graves_12m: real.incidencias_graves_12m,
              creado_en: real.creado_en
            }
          : null;

        if (conductorActual) setConductor(conductorActual);

        const [listaDisponibles, listaAceptados, historialViajes] = await Promise.all([
          listarViajesDisponibles(cliente),
          conductorActual ? listarViajesAceptados(cliente, conductorActual.id) : Promise.resolve([]),
          conductorActual ? listarHistorialViajesConductor(cliente, conductorActual.id) : Promise.resolve([])
        ]);

        const todos = [...listaDisponibles, ...listaAceptados];
        if (todos.length > 0) {
          const ids = todos.map((viaje) => viaje.traslado_id).filter((id): id is string => Boolean(id));
          if (ids.length > 0) {
            const { data } = await cliente
              .from("traslados")
              .select("id, origen_ciudad, origen_direccion, destino_ciudad, destino_direccion, fecha_hora_programada, tipo_servicio, motivo_servicio, instrucciones_especiales")
              .in("id", ids);
            const detallesReales = Object.fromEntries(
              (data ?? []).map((fila) => {
                const viaje = todos.find((item) => item.traslado_id === fila.id);
                return [
                  fila.id,
                  {
                    origen: `${fila.origen_ciudad} · ${fila.origen_direccion}`,
                    destino: `${fila.destino_ciudad} · ${fila.destino_direccion}`,
                    fechaHora: fila.fecha_hora_programada ?? new Date().toISOString(),
                    tipoServicio: fila.motivo_servicio ?? fila.tipo_servicio ?? "Traslado estándar",
                    requisitos: fila.instrucciones_especiales ?? "Sin requisitos especiales.",
                    distanciaKm: viaje?.distancia_km ?? null,
                    tiempoEstimadoHoras: viaje?.tiempo_estimado_horas ?? null,
                    gananciaConductorOficial: viaje?.ganancia_conductor ?? null,
                    estadoEconomico: "sin_calcular"
                  } satisfies DetalleOperativo
                ];
              })
            );
            setDetalles((prev) => ({ ...prev, ...detallesReales }));
          }
        }

        setDisponibles(listaDisponibles);
        setAceptados(listaAceptados);
        setHistorial(historialViajes);
        if (!conductorActual) {
          setAviso("Inicia sesión como conductor para aceptar y ver tus traslados.");
        }
      } catch (err) {
        setAviso(traducirErrorOperativo(err, "No pudimos cargar los traslados."));
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [refreshCount]);

  async function aceptar(trasladoId: string) {
    setAceptando(trasladoId);
    setAviso(null);

    try {
      if (!conductor) throw new Error("Inicia sesión como conductor para aceptar viajes.");
      const cliente = crearClienteNavegador();
      await aceptarViaje(cliente, trasladoId, conductor.id);
      const aceptado = disponibles.find((v) => v.traslado_id === trasladoId);
      setDisponibles((prev) => prev.filter((v) => v.traslado_id !== trasladoId));
      if (aceptado) setAceptados((prev) => [{ ...aceptado, estado: "conductor_asignado" }, ...prev]);
      setAviso("Traslado aceptado exitosamente.");
    } catch (err) {
      setAviso(traducirErrorOperativo(err, "No pudimos aceptar el traslado. Intenta de nuevo."));
    } finally {
      setAceptando(null);
    }
  }

  async function persistirRechazo(pendiente: RechazoPendiente) {
    if (!conductor) throw new Error("Inicia sesión como conductor para registrar el rechazo.");
    if (!pendiente.viaje.traslado_id) throw new Error("No se pudo identificar el traslado.");
    const cliente = crearClienteNavegador();
    await registrarEvento(cliente, "modificacion_traslado_activo", "conductor", conductor.id, {
      traslado_id: pendiente.viaje.traslado_id,
      accion: "rechazo_oferta_conductor",
      motivo: pendiente.motivo
    });
    setRechazoPendiente(null);
    setAviso("Rechazo registrado.");
  }

  function confirmarRechazo(motivo: MotivoRechazo) {
    if (!viajeParaRechazar || rechazoPendiente) return;
    if (!viajeParaRechazar.traslado_id) {
      setAviso("No se pudo identificar el traslado para rechazarlo.");
      setViajeParaRechazar(null);
      return;
    }

    const trasladoId = viajeParaRechazar.traslado_id;
    const pendiente = { viaje: viajeParaRechazar, motivo };
    setViajeParaRechazar(null);
    setRechazados((prev) => [...prev, trasladoId]);
    setDisponibles((prev) => prev.filter((viaje) => viaje.traslado_id !== trasladoId));
    setRechazoPendiente(pendiente);
    setAviso(null);

    timeoutRechazoRef.current = window.setTimeout(() => {
      void persistirRechazo(pendiente).catch((err) => {
        setAviso(traducirErrorOperativo(err, "No pudimos registrar el rechazo."));
      });
    }, 8000);
  }

  function deshacerRechazo() {
    if (!rechazoPendiente) return;
    if (timeoutRechazoRef.current) {
      window.clearTimeout(timeoutRechazoRef.current);
      timeoutRechazoRef.current = null;
    }

    const { viaje } = rechazoPendiente;
    setDisponibles((prev) => prev.some((item) => item.traslado_id === viaje.traslado_id) ? prev : [viaje, ...prev]);
    setRechazados((prev) => prev.filter((id) => id !== viaje.traslado_id));
    setRechazoPendiente(null);
    setAviso("Rechazo deshecho. El traslado volvió a estar disponible.");
  }

  const disponiblesVisibles = disponibles.filter((viaje) => viaje.traslado_id && !rechazados.includes(viaje.traslado_id));
  const calendario = crearCalendario(disponiblesVisibles, aceptados, detalles);

  const diaCalendarioSeleccionado = calendario.find(({ dia }) => claveDia(dia) === diaSeleccionado) ?? calendario[0];

  const listToRender = diaCalendarioSeleccionado
    ? diaCalendarioSeleccionado.viajes
        .filter((item) => {
          if (vista === "disponibles") return item.tipo === "Ofertado";
          return item.tipo !== "Ofertado";
        })
    : [];

  const startDay = calendario[0]?.dia;
  const endDay = calendario[calendario.length - 1]?.dia;

  const totalGanancia = listToRender.reduce((sum, item) => {
    const det = (item.viaje.traslado_id ? detalles[item.viaje.traslado_id] : null) ?? detalleFallback(item.viaje);
    return sum + (det.gananciaConductorOficial ?? 582.96);
  }, 0);

  const totalViajesTexto = listToRender.length === 1 ? "1 traslado" : `${listToRender.length} traslados`;

  const tieneOfertasOtrosDias = calendario.some(
    ({ dia, viajes }) => claveDia(dia) !== diaSeleccionado && viajes.some((v) => v.tipo === "Ofertado")
  );

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-10 flex flex-col justify-between min-h-[calc(100vh-100px)] text-text-primary">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes listFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-list-fade {
          animation: listFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      ` }} />

      <div className="w-full flex flex-col flex-1 pb-16">
        
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-border/20 pb-4">
          <div className="min-w-0 flex-1">
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-text-primary leading-none">
              Traslados
            </h1>
            <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-bold text-text-tertiary">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Actualizado ahora</span>
              <button
                type="button"
                onClick={() => {
                  setCargando(true);
                  setRefreshCount((prev) => prev + 1);
                }}
                className="text-[#00B4D8] underline-offset-2 hover:underline cursor-pointer select-none ml-1 flex items-center gap-0.5"
              >
                Recargar
                <span className="text-[11px]">↻</span>
              </button>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 select-none">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => setSoporteAbierto(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border/15 bg-[#0E1524]/60 hover:bg-[#0E1524] text-text-primary hover:text-[#00B4D8] transition-colors cursor-pointer shadow-xs"
                aria-label="Soporte rápido"
              >
                <span className="font-display text-sm font-black">?</span>
              </button>
              <span className="font-body text-[9px] font-bold text-text-tertiary mt-1">Ayuda</span>
            </div>
            
            <div className="flex flex-col items-center">
              <Link
                href="/cuenta"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border/15 bg-[#0E1524]/60 hover:bg-[#0E1524] text-text-primary hover:text-[#00B4D8] transition-colors shadow-xs"
                aria-label="Ajustes de cuenta"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Link>
              <span className="h-4.5 w-1" />
            </div>
          </div>
        </header>

        {/* Tab switch OFERTAS / ACEPTADOS */}
        <div className="mt-6 flex w-full rounded-full border border-border/10 bg-[#090D1A] p-1 select-none">
          <button
            type="button"
            onClick={() => actualizarUrl({ vista: "disponibles" })}
            className={`flex-1 rounded-full px-3 py-2.5 text-center text-[11px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer ${
              vista === "disponibles"
                ? "bg-[#00B4D8] text-white shadow-md scale-[1.02]"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Ofertas
          </button>
          <button
            type="button"
            onClick={() => actualizarUrl({ vista: "mis-viajes" })}
            className={`flex-1 rounded-full px-3 py-2.5 text-center text-[11px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer ${
              vista === "mis-viajes"
                ? "bg-[#00B4D8] text-white shadow-md scale-[1.02]"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Aceptados
          </button>
        </div>

        {/* Calendar Row with inline WeekDaySelector */}
        <div className="mt-6 flex items-center justify-between gap-4 bg-[#0E1524]/40 border border-border/10 rounded-2xl p-4 relative">
          
          {diaSeleccionado !== diaHoy && (
            <button
              type="button"
              onClick={() => setDiaSeleccionado(diaHoy)}
              className="absolute -top-3.5 left-5 bg-[#0E1524] border border-[#00B4D8]/30 px-2.5 py-1 rounded-full text-[8.5px] font-black text-[#00B4D8] uppercase tracking-wider hover:bg-[#131B2C] cursor-pointer select-none transition-all shadow-md active:scale-95"
            >
              Volver a Hoy
            </button>
          )}

          {/* Left: Date Range info */}
          <div className="flex items-center gap-2 shrink-0 select-none">
            {/* Calendar Icon */}
            <div className="w-8 h-8 rounded-xl bg-[#00B4D8]/10 flex items-center justify-center text-[#00B4D8] border border-[#00B4D8]/20">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="flex flex-col text-left">
              <span className="font-body text-[9px] font-extrabold uppercase tracking-wider text-text-tertiary leading-none">Semana</span>
              <span className="font-display text-[10px] font-black text-white mt-1 leading-none">
                {startDay && endDay ? (
                  `${startDay.getDate()} - ${endDay.getDate()} ${new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "America/Mexico_City" }).format(endDay).replace('.', '').replace(/^\w/, (c) => c.toUpperCase())}`
                ) : "16 - 22 Ago"}
              </span>
            </div>
          </div>
          
          {/* Right: Days selector */}
          <div className="flex-1 min-w-0">
            <WeekDaySelector
              dias={calendario}
              seleccionado={diaSeleccionado}
              hoy={diaHoy}
              onSelect={setDiaSeleccionado}
            />
          </div>
        </div>

        {/* Card Count & Total Earnings Bar */}
        <div className="mt-4 flex items-center justify-between bg-[#0E1524]/60 border border-border/10 rounded-2xl px-4 py-3 select-none">
          <div className="flex items-center gap-2 font-body text-xs font-bold text-text-secondary">
            <svg className="w-4 h-4 text-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="10" width="20" height="8" rx="2" />
              <path d="M6 10 L8 5 L16 5 L18 10" />
              <circle cx="6" cy="18" r="1.5" />
              <circle cx="18" cy="18" r="1.5" />
            </svg>
            <span>{totalViajesTexto}</span>
          </div>
          
          <div className="flex items-center gap-1.5 bg-[#10B981]/15 border border-[#10B981]/30 px-3 py-1 rounded-xl font-display text-xs font-black text-[#10B981]">
            <span>${totalGanancia.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* List of custom Trip Cards */}
        <div key={`${diaSeleccionado}-${vista}`} className="mt-4 flex flex-col gap-4 animate-list-fade">
          {cargando ? (
            <TripsLoadingList />
          ) : listToRender.length === 0 ? (
            <div className="text-center py-10 flex flex-col items-center">
              <span className="text-xl font-bold text-text-tertiary">Sin horario</span>
              <p className="mt-3 font-display text-sm font-bold text-text-primary">Sin traslados para este día</p>
              <p className="mt-1 font-body text-xs text-text-tertiary max-w-[280px]">
                {vista === "disponibles" 
                  ? "No hay ofertas programadas en esta fecha." 
                  : "No tienes traslados aceptados para esta fecha."}
              </p>
              
              {/* Contextual Empty State CTAs */}
              {vista === "mis-viajes" ? (
                <button
                  type="button"
                  onClick={() => actualizarUrl({ vista: "disponibles" })}
                  className="mt-5 bg-surface-elevated text-text-primary font-display text-xs font-extrabold px-4 py-2.5 rounded-xl border border-border hover:bg-surface transition-colors cursor-pointer select-none"
                >
                  Buscar Ofertas Disponibles
                </button>
              ) : (
                tieneOfertasOtrosDias && (
                  <p className="mt-4 font-body text-[11px] text-[#00B4D8] font-bold select-none">
                    💡 ¡Hay ofertas disponibles otros días de la semana! Revisa los días marcados con un punto azul en el calendario.
                  </p>
                )
              )}
            </div>
          ) : (
            listToRender.map((item, index) => {
              const viaje = item.viaje;
              const trasladoId = viaje.traslado_id ?? `viaje-${index}`;
              const detalle = detalles[trasladoId] ?? detalleFallback(viaje);
              if (vista === "disponibles") {
                return (
                  <OfertaCard
                    key={trasladoId}
                    viaje={viaje}
                    detalle={detalle}
                    hrefDetalle={hrefDetalle(viaje)}
                  />
                );
              }
              return (
                <CustomTripCard
                  key={trasladoId}
                  viaje={viaje}
                  detalle={detalle}
                  esOferta={false}
                  onReject={(viaje) => setViajeParaRechazar(viaje)}
                  hrefDetalle={hrefDetalle(viaje)}
                />
              );
            })
          )}
        </div>

        {/* Important Info Card */}
        <div className="mt-6 flex items-start justify-between gap-3 bg-[#0E1524]/60 border border-border/10 rounded-2xl p-4 text-left select-none">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#00B4D8]/10 flex items-center justify-center text-[#00B4D8] shrink-0 font-bold font-display text-sm">
              i
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xs font-bold text-white leading-tight">Información importante</span>
              <p className="font-body text-[10px] text-text-secondary mt-1 leading-snug">
                Asegúrate de seguir cada paso del traslado y mantener comunicación con el usuario.
              </p>
            </div>
          </div>
          <Link
            href="/cuenta/soporte"
            className="font-display text-[10px] font-bold text-[#00B4D8] shrink-0 mt-0.5 hover:underline flex items-center gap-0.5"
          >
            Ver más
            <span>›</span>
          </Link>
        </div>

        {aviso && (
          <output className="mt-4" aria-live="polite" aria-atomic="true">
            <Aviso tono="info">{aviso}</Aviso>
          </output>
        )}

      </div>

      <RejectTripDialog
        viaje={viajeParaRechazar}
        onClose={() => setViajeParaRechazar(null)}
        onConfirm={confirmarRechazo}
      />

      {rechazoPendiente && (
        <output
          aria-live="polite"
          className="conductor-toast-bottom fixed inset-x-4 z-50 rounded-xl border border-border bg-surface-strong px-4 py-3 text-surface shadow-[0_18px_50px_rgba(26,31,46,0.28)] sm:left-auto sm:right-6 sm:w-[360px]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-body text-sm font-semibold">Traslado rechazado</p>
              <p className="mt-0.5 font-body text-sm text-text-secondary">{rechazoPendiente.motivo}</p>
            </div>
            <button
              type="button"
              onClick={deshacerRechazo}
              className="min-h-11 rounded-lg bg-surface px-3 py-2 font-body text-xs font-bold text-text-primary"
            >
              Deshacer
            </button>
          </div>
        </output>
      )}

      {/* Bottom Sheet de Soporte */}
      {soporteAbierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop de cierre */}
          <button 
            type="button" 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn cursor-default w-full h-full border-none outline-hidden" 
            onClick={() => setSoporteAbierto(false)}
            aria-label="Cerrar soporte"
          />
          {/* Tarjeta de contenido */}
          <div className="relative w-full max-w-md bg-surface-elevated rounded-t-[2rem] border-t border-border/40 p-6 flex flex-col gap-4 animate-slideUp shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-border/20">
              <h2 className="font-display text-lg font-bold text-text-primary">
                Soporte Rápido Ruum
              </h2>
              <button 
                type="button" 
                onClick={() => setSoporteAbierto(false)}
                className="text-text-tertiary hover:text-text-primary p-1 cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>
            <p className="font-body text-xs text-text-secondary">
              Selecciona un medio de contacto para comunicarte con el equipo operativo de guardia.
            </p>
            <div className="flex flex-col gap-2.5 mt-2">
              <a
                href="https://wa.me/525548210937"
                className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 font-body text-xs font-bold text-emerald-600">WA</span>
                <div className="flex flex-col items-start">
                  <span className="font-display text-sm font-bold text-emerald-400">WhatsApp de Soporte</span>
                  <span className="font-body text-[11px] text-text-secondary">Mensajería instantánea y respuesta inmediata</span>
                </div>
              </a>
              <a
                href="tel:+525548210937"
                className="flex items-center gap-3 p-4 bg-route-soft border border-route-action/20 rounded-xl hover:bg-route-soft/60 transition-colors"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-route-soft font-body text-xs font-bold text-route-action">TEL</span>
                <div className="flex flex-col items-start">
                  <span className="font-display text-sm font-bold text-route-action">Llamar a Soporte</span>
                  <span className="font-body text-[11px] text-text-secondary">Habla por teléfono directamente con un operador</span>
                </div>
              </a>
              <a
                href="mailto:soporte@ruumruum.com"
                className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-border/40 hover:bg-surface-elevated transition-colors"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated font-body text-[10px] font-bold text-text-secondary">MAIL</span>
                <div className="flex flex-col items-start">
                  <span className="font-display text-sm font-bold text-text-primary">Correo Electrónico</span>
                  <span className="font-body text-[11px] text-text-secondary">Reportar incidencias técnicas no urgentes</span>
                </div>
              </a>
            </div>
            <button
              type="button"
              onClick={() => setSoporteAbierto(false)}
              className="w-full min-h-11 mt-2 rounded-xl bg-[#0E1524] border border-border/10 font-display text-sm font-bold text-text-primary hover:bg-[#131B2C] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
