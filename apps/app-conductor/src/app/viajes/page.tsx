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
      badgeBg: "bg-[#a8e820]/15 text-[#a8e820] border-[#a8e820]/30",
      titulo: "TRASLADO DISPONIBLE",
      descripcion: "Traslado disponible para aceptar."
    };
  }

  switch (estado) {
    case "conductor_asignado":
      return {
        dotColor: "bg-amber-400",
        textColor: "text-amber-300",
        badgeBg: "bg-amber-400/20 text-amber-300 border-amber-400/40",
        titulo: "PENDIENTE DE INICIO",
        descripcion: "Dirígete al punto de origen."
      };
    case "conductor_en_camino_al_origen":
      return {
        dotColor: "bg-emerald-400",
        textColor: "text-emerald-300",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        titulo: "EN CAMINO AL ORIGEN",
        descripcion: "Dirígete al punto de recolección."
      };
    case "conductor_en_punto_de_recoleccion":
    case "verificacion_vehiculo_en_proceso":
    case "evidencia_inicial_en_proceso":
    case "evidencia_inicial_completada":
    case "vehiculo_recibido":
      return {
        dotColor: "bg-emerald-400",
        textColor: "text-emerald-300",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        titulo: "EN PUNTO DE ORIGEN",
        descripcion: "Realiza la entrega del vehículo."
      };
    case "traslado_en_curso":
      return {
        dotColor: "bg-emerald-400",
        textColor: "text-emerald-300",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        titulo: "TRASLADO EN CURSO",
        descripcion: "Conduce de forma segura al destino."
      };
    case "llegada_a_destino":
    case "evidencia_final_en_proceso":
    case "evidencia_final_completada":
      return {
        dotColor: "bg-emerald-400",
        textColor: "text-emerald-300",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        titulo: "LLEGADA A DESTINO",
        descripcion: "Por entregar la unidad al receptor."
      };
    case "entrega_confirmada":
    case "servicio_cerrado":
      return {
        dotColor: "bg-emerald-400",
        textColor: "text-emerald-300",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        titulo: "TRASLADO FINALIZADO",
        descripcion: "El traslado ha sido concluido."
      };
    default:
      return {
        dotColor: "bg-amber-400",
        textColor: "text-amber-300",
        badgeBg: "bg-amber-400/20 text-amber-300 border-amber-400/40",
        titulo: "PENDIENTE DE INICIO",
        descripcion: "Dirígete al punto de origen."
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
  const distanciaTexto = viaje.distancia_km != null ? `${viaje.distancia_km.toFixed(1)} km` : "Por confirmar";

  const cardInfo = getEstadoCardInfo(viaje.estado || "", esOferta);

  return (
    <div className="w-full rounded-2xl border border-border/15 bg-[#0E1524]/80 p-3.5 sm:p-4 shadow-sm flex flex-col gap-3 text-left select-none">
      
      {/* Bloque de Cabecera: Estado + ID + Tarifa agrupada + Menú contextual */}
      <div className="flex items-center justify-between gap-2 border-b border-border/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-body text-[9.5px] font-extrabold uppercase tracking-wider ${
            esOferta 
              ? "bg-[#a8e820]/15 text-[#a8e820] border border-[#a8e820]/30" 
              : "bg-emerald-500/15 text-[#10B981] border border-emerald-500/30"
          }`}>
            {!esOferta && (
              <svg className="w-2.5 h-2.5 shrink-0 text-[#10B981]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {esOferta ? "DISPONIBLE" : "ACEPTADO"}
          </span>

          <span className="font-mono text-[10px] font-extrabold text-text-tertiary tracking-wider uppercase">
            ID {folio}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Tarifa destacada agrupada en cabecera */}
          <span className="font-display text-xs sm:text-sm font-black text-white leading-none tabular-nums bg-surface-elevated/80 border border-border/15 px-2.5 py-1 rounded-lg shadow-2xs">
            {ganancia}
          </span>

          {!esOferta && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReject(viaje);
              }}
              className="p-1 text-text-tertiary hover:text-text-primary transition-colors shrink-0 cursor-pointer rounded-lg hover:bg-surface-elevated"
              aria-label="Opciones de traslado"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Indicador de Estado (Badge de alto contraste) */}
      <div className="flex flex-col text-left">
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase border self-start ${
          cardInfo.badgeBg
        }`}>
          <span className={`h-2 w-2 rounded-full ${cardInfo.dotColor} animate-pulse shrink-0`} />
          <span>{cardInfo.titulo}</span>
        </div>
        <p className="font-body text-[10px] text-text-secondary mt-1 leading-snug">
          {cardInfo.descripcion}
        </p>
      </div>

      {/* Conector gráfico de Línea de Ruta Timeline (Origen -> Línea -> Destino) */}
      <div className="flex items-center justify-between gap-3 py-1.5 bg-[#070B14]/60 border border-border/10 rounded-xl px-3">
        <div className="flex flex-col text-left min-w-0 flex-1">
          <span className="font-display text-[8.5px] font-bold text-[#10B981] tracking-widest uppercase">Origen</span>
          <span className="font-display text-xs font-black text-white leading-tight truncate mt-0.5">{origen}</span>
          <span className="font-body text-[9px] text-text-tertiary truncate leading-none mt-0.5">{origenEstado}</span>
        </div>
        
        {/* Timeline Graphic Connector */}
        <div className="flex items-center gap-1 shrink-0 px-1 select-none" aria-hidden="true">
          <span className="h-2 w-2 rounded-full border-2 border-[#10B981] bg-transparent shrink-0" />
          <div className="h-[2px] w-6 sm:w-10 bg-gradient-to-r from-[#10B981] via-border/40 to-[#00B4D8] rounded-full" />
          <span className="h-2 w-2 rounded-full bg-[#00B4D8] shrink-0" />
        </div>

        <div className="flex flex-col text-right min-w-0 flex-1">
          <span className="font-display text-[8.5px] font-bold text-[#00B4D8] tracking-widest uppercase">Destino</span>
          <span className="font-display text-xs font-black text-white leading-tight truncate mt-0.5">{destino}</span>
          <span className="font-body text-[9px] text-text-tertiary truncate leading-none mt-0.5">{destinoEstado}</span>
        </div>
      </div>

      {/* Stats compactas */}
      <div className="grid grid-cols-3 gap-2 select-none border-t border-border/10 pt-2.5">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-text-tertiary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div className="flex flex-col text-left">
            <span className="text-text-tertiary text-[7.5px] font-bold uppercase tracking-wider leading-none">Hora</span>
            <span className="text-white text-[11px] font-extrabold mt-0.5 leading-none">{horaInicio}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 border-l border-border/10 pl-2">
          <svg className="w-3.5 h-3.5 text-text-tertiary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 15 15" />
          </svg>
          <div className="flex flex-col text-left">
            <span className="text-text-tertiary text-[7.5px] font-bold uppercase tracking-wider leading-none">Duración</span>
            <span className="text-white text-[11px] font-extrabold mt-0.5 leading-none">{duracionTexto}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 border-l border-border/10 pl-2">
          <svg className="w-3.5 h-3.5 text-text-tertiary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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

      {/* CTA Button visible sin necesidad de scroll */}
      <Link
        href={hrefDetalle}
        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#00B4D8] hover:bg-[#0092B0] px-4 py-2 font-display text-[11px] font-black tracking-widest text-white uppercase transition-all shadow-sm select-none cursor-pointer mt-0.5"
      >
        {esOferta ? "VER OFERTA" : "CONTINUAR TRASLADO"}
        <svg className="w-3.5 h-3.5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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

  const solicitanteNombre = viaje.contacto_entrega_nombre || null;

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

      {/* — Solicitante / contacto — */}
      {solicitanteNombre && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-surface-elevated/60 border border-border/10 px-3 py-2">
          <svg className="w-3.5 h-3.5 text-text-tertiary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="font-body text-[10px] text-text-tertiary font-bold uppercase tracking-wider leading-none">Solicitante:</span>
          <span className="font-body text-[11px] text-text-primary font-semibold leading-none truncate">{solicitanteNombre}</span>
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
  const [notificacionesCount, setNotificacionesCount] = useState(0);
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
    async function cargarNotificacionesCount() {
      if (!tieneSupabaseConfigurado()) return;
      try {
        const cliente = crearClienteNavegador();
        const { count } = await (cliente as any)
          .from("notificaciones_conductor")
          .select("id", { count: "exact", head: true })
          .is("leida_en", null);
        setNotificacionesCount(count ?? 0);
      } catch {
        // Ignorar si error de red o configuración
      }
    }
    void cargarNotificacionesCount();
    const actualizar = () => void cargarNotificacionesCount();
    window.addEventListener("ruum:notificaciones-actualizar", actualizar);
    return () => window.removeEventListener("ruum:notificaciones-actualizar", actualizar);
  }, []);

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
                href="/notificaciones"
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border/15 bg-[#0E1524]/60 hover:bg-[#0E1524] text-text-primary hover:text-[#00B4D8] transition-colors shadow-xs"
                aria-label="Notificaciones"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                  <path d="M10 21h4" />
                </svg>
                {notificacionesCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center border border-[#070B14] shadow-xs">
                    {notificacionesCount > 9 ? "9+" : notificacionesCount}
                  </span>
                )}
              </Link>
              <span className="font-body text-[9px] font-bold text-text-tertiary mt-1">Avisos</span>
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
            Ofertas ({disponiblesVisibles.length})
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
            Aceptados ({aceptados.length})
          </button>
        </div>

        {/* Compact Integrated Date Selector */}
        <div className="mt-3 flex items-center justify-between bg-[#0E1524]/60 border border-border/10 rounded-xl px-3 py-1.5 select-none">
          <button 
            type="button" 
            className="p-1 text-text-tertiary hover:text-text-primary cursor-pointer active:scale-95 transition-all rounded-lg hover:bg-surface-elevated"
            onClick={() => {
              const idx = calendario.findIndex(c => claveDia(c.dia) === diaSeleccionado);
              if (idx > 0) setDiaSeleccionado(claveDia(calendario[idx - 1].dia));
            }}
            aria-label="Día anterior"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          
          <div className="flex items-center gap-2">
            <span className="font-display text-xs font-black uppercase tracking-wider text-text-primary">
              {diaCalendarioSeleccionado ? 
                new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Mexico_City" }).format(diaCalendarioSeleccionado.dia).replace('.', '').toUpperCase() 
                : "HOY"}
            </span>
            {claveDia(diaCalendarioSeleccionado?.dia ?? new Date()) === diaHoy && (
              <span className="bg-[#00B4D8]/20 text-[#00B4D8] border border-[#00B4D8]/30 text-[8px] font-extrabold px-1.5 py-0.2 rounded-md uppercase">
                Hoy
              </span>
            )}
          </div>

          <button 
            type="button" 
            className="p-1 text-text-tertiary hover:text-text-primary cursor-pointer active:scale-95 transition-all rounded-lg hover:bg-surface-elevated"
            onClick={() => {
              const idx = calendario.findIndex(c => claveDia(c.dia) === diaSeleccionado);
              if (idx >= 0 && idx < calendario.length - 1) setDiaSeleccionado(claveDia(calendario[idx + 1].dia));
            }}
            aria-label="Día siguiente"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-text-secondary select-none px-1">
          <span>
            {listToRender.length === 1 ? `1 ${vista === "disponibles" ? "oferta disponible" : "traslado aceptado"}` : `${listToRender.length} ${vista === "disponibles" ? "ofertas disponibles" : "traslados aceptados"}`}
          </span>
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
