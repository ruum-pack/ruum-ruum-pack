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
  obtenerGananciasConductor,
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

function CustomTripCard({
  viaje,
  detalle,
  esOferta,
  isExpanded,
  onToggleExpand,
  onAccept,
  hrefDetalle
}: {
  viaje: PasaporteRow;
  detalle: DetalleOperativo;
  esOferta: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAccept: (trasladoId: string) => void;
  hrefDetalle: string;
}) {
  const folio = viaje.traslado_id ? viaje.traslado_id.slice(0, 8).toUpperCase() : "3811604";
  const ganancia = detalle.gananciaConductorOficial != null 
    ? `$${detalle.gananciaConductorOficial.toFixed(2)}` 
    : "$582.96";

  const origen = (viaje.origen_ciudad || "Amazon DTL").toUpperCase();
  const destino = (viaje.destino_ciudad || "Toluca").toUpperCase();
  const ruta = `${origen} - ${destino}`;

  const horaInicio = detalle.fechaHora 
    ? new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Mexico_City" }).format(new Date(detalle.fechaHora)) 
    : "10:00";
  
  const duracionHoras = detalle.tiempoEstimadoHoras || 6;
  const horaFin = detalle.fechaHora 
    ? new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Mexico_City" }).format(new Date(new Date(detalle.fechaHora).getTime() + duracionHoras * 3600000)) 
    : "16:00";

  const duracionTexto = `${duracionHoras}hr`;
  const distanciaTexto = detalle.distanciaKm != null ? `${detalle.distanciaKm.toFixed(1)} Km` : "138.2 Km";

  const estadoTexto = esOferta ? "DISPONIBLE" : "ACEPTADO";

  return (
    <div
      className={`w-full text-left bg-surface-elevated rounded-[1.5rem] p-5 border transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col gap-3.5 ${
        isExpanded ? "border-[#00B4D8]/60 ring-1 ring-[#00B4D8]/10" : "border-border/40 hover:border-signal/40"
      }`}
    >
      <button 
        type="button"
        onClick={onToggleExpand}
        className="w-full flex flex-col gap-3.5 cursor-pointer select-none text-left bg-transparent border-none p-0 outline-hidden font-inherit"
      >
        <div className="flex justify-between items-start w-full">
          <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 font-display text-[10px] font-bold ${
            esOferta ? "bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          }`}>
            {estadoTexto}
          </span>
          <div className="flex items-center gap-1">
            <span className="font-display text-base font-extrabold text-text-primary">{ganancia}</span>
            <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-500 font-bold text-xs select-none">
              $
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center w-full">
            <span className="font-body text-[11px] font-bold text-text-tertiary uppercase">Viaje #{folio}</span>
            <span className="text-[10px] font-bold text-text-tertiary flex items-center gap-0.5">
              {isExpanded ? "Contraer ▲" : "Expandir ▼"}
            </span>
          </div>
          <h2 className="font-display text-lg font-extrabold text-text-primary tracking-tight leading-tight">
            {ruta}
          </h2>
        </div>

        <div className="flex flex-col gap-1 font-body text-xs text-text-secondary">
          <p className="flex items-center gap-2">
            <span className="text-text-tertiary w-14 font-semibold">Ciudad</span>
            <span className="text-text-primary font-medium">{viaje.origen_ciudad || "Toluca"} - {viaje.destino_ciudad || "Méx."}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-text-tertiary w-14 font-semibold">Solicitado</span>
            <span className="text-text-primary font-medium">{viaje.contacto_entrega_nombre || "zaida Froebel"}</span>
          </p>
        </div>

        <div className="border-t border-border/40 pt-3.5 flex justify-between items-center text-text-secondary font-body text-xs mt-1">
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="font-semibold text-text-primary">{horaInicio} - {horaFin}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2v4" />
              <path d="M12 12h4" />
            </svg>
            <span className="font-semibold text-text-primary">{duracionTexto}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="font-semibold text-text-primary">{distanciaTexto}</span>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 border-t border-border/20 pt-4 flex flex-col gap-3.5 animate-slideDown">
          <div className="grid gap-3 border-l-2 border-dashed border-border/60 pl-3">
            <div className="min-w-0">
              <p className="font-body text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Recolección (Origen)</p>
              <p className="mt-0.5 font-body text-xs text-text-primary">{viaje.origen_direccion || "Dirección de recolección"}</p>
            </div>
            <div className="min-w-0">
              <p className="font-body text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Entrega (Destino)</p>
              <p className="mt-0.5 font-body text-xs text-text-primary">{viaje.destino_direccion || "Dirección de entrega"}</p>
            </div>
          </div>

          {detalle.requisitos && (
            <div className="bg-surface p-3 rounded-xl border border-border/40 flex flex-col gap-1">
              <span className="font-body text-[9px] font-extrabold text-text-tertiary uppercase tracking-wider">Notas de Operación</span>
              <p className="font-body text-xs text-text-secondary">{detalle.requisitos}</p>
            </div>
          )}

          <div className="flex gap-2 mt-1">
            {esOferta ? (
              <>
                <button
                  type="button"
                  onClick={() => onAccept(viaje.traslado_id!)}
                  className="flex-1 min-h-10 bg-[#00B4D8] hover:bg-[#00B4D8]/90 text-white font-display text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm active:scale-95"
                >
                  <span>✓</span> Aceptar Viaje
                </button>
                <Link
                  href={hrefDetalle}
                  className="flex-1 min-h-10 bg-control-soft hover:bg-border/60 text-text-primary font-display text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center text-center"
                >
                  Ver completo →
                </Link>
              </>
            ) : (
              <Link
                href={hrefDetalle}
                className="w-full min-h-10 bg-route-action hover:bg-route-action/90 text-white font-display text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-sm active:scale-95 text-center"
              >
                Abrir Panel de Viaje →
              </Link>
            )}
          </div>
        </div>
      )}
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
  const [tarjetaExpandida, setTarjetaExpandida] = useState<string | null>(null);
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
                    gananciaConductorOficial: null,
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
          setAviso("Inicia sesión como conductor para aceptar y ver tus viajes.");
        }
      } catch (err) {
        setAviso(traducirErrorOperativo(err, "No pudimos cargar los viajes."));
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
      setAviso("Viaje aceptado exitosamente.");
    } catch (err) {
      setAviso(traducirErrorOperativo(err, "No pudimos aceptar el viaje. Intenta de nuevo."));
    } finally {
      setAceptando(null);
    }
  }

  async function persistirRechazo(pendiente: RechazoPendiente) {
    if (!conductor) throw new Error("Inicia sesión como conductor para registrar el rechazo.");
    if (!pendiente.viaje.traslado_id) throw new Error("No se pudo identificar el viaje.");
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
      setAviso("No se pudo identificar el viaje para rechazarlo.");
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
    setAviso("Rechazo deshecho. El viaje volvió a estar disponible.");
  }

  const disponiblesVisibles = disponibles.filter((viaje) => viaje.traslado_id && !rechazados.includes(viaje.traslado_id));
  const calendario = crearCalendario(disponiblesVisibles, aceptados, detalles);

  const diaCalendarioSeleccionado = calendario.find(({ dia }) => claveDia(dia) === diaSeleccionado) ?? calendario[0];

  // Filter list by selected day and tab
  const listToRender = diaCalendarioSeleccionado
    ? diaCalendarioSeleccionado.viajes
        .filter((item) => {
          if (vista === "disponibles") return item.tipo === "Ofertado";
          return item.tipo !== "Ofertado";
        })
    : [];

  // Calendar Header Text
  const startDay = calendario[0]?.dia;
  const endDay = calendario[calendario.length - 1]?.dia;
  let RangoCalendarioText = "Semana actual";
  if (startDay && endDay) {
    const formateadorMes = new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "America/Mexico_City" });
    const mesInicio = formateadorMes.format(startDay);
    const mesFin = formateadorMes.format(endDay);
    const mesTexto = mesInicio === mesFin ? mesInicio : `${mesInicio}/${mesFin}`;
    const mesCapitalizado = mesTexto.replace(/^\w/, (c) => c.toUpperCase());
    RangoCalendarioText = `Semana ${startDay.getDate()} a ${endDay.getDate()} ${mesCapitalizado}`;
  }

  // Summary Selected Date Text
  let prefijoDia = "";
  if (diaCalendarioSeleccionado) {
    const clave = claveDia(diaCalendarioSeleccionado.dia);
    if (clave === diaHoy) {
      prefijoDia = "HOY";
    } else if (clave === claveDia(new Date(Date.now() + 86400000))) {
      prefijoDia = "MAÑANA";
    } else {
      prefijoDia = new Intl.DateTimeFormat("es-MX", { weekday: "long", timeZone: "America/Mexico_City" })
        .format(diaCalendarioSeleccionado.dia)
        .toUpperCase();
    }
  }

  const fechaCompletaTexto = diaCalendarioSeleccionado
    ? `${prefijoDia} · ${new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Mexico_City" })
        .format(diaCalendarioSeleccionado.dia)}`
    : "";

  const totalGanancia = listToRender.reduce((sum, item) => {
    const det = (item.viaje.traslado_id ? detalles[item.viaje.traslado_id] : null) ?? detalleFallback(item.viaje);
    return sum + (det.gananciaConductorOficial ?? 582.96);
  }, 0);

  const totalViajesTexto = listToRender.length === 1 ? "1 Viaje" : `${listToRender.length} Viajes`;

  // Check if any other day has offers
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
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); max-height: 0; }
          to { opacity: 1; transform: translateY(0); max-height: 500px; }
        }
        .animate-slideDown {
          animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          overflow: hidden;
        }
      ` }} />

      <div className="w-full flex flex-col flex-1">
        
        {/* Header */}
        <header className="flex justify-between items-center border-b border-border/20 pb-4">
          <div className="flex flex-col">
            <h1 className="font-display text-3xl font-extrabold text-text-primary tracking-tight mt-1 leading-none">
              Traslados
            </h1>
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-bold text-text-tertiary">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sincronizado en tiempo real</span>
              <button 
                type="button" 
                onClick={() => {
                  setCargando(true);
                  setRefreshCount((prev) => prev + 1);
                }}
                className="ml-1 text-[#00B4D8] hover:underline cursor-pointer select-none"
              >
                (Recargar 🔄)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link 
              href="/notificaciones" 
              className="relative p-1.5 text-text-primary hover:text-signal transition-colors" 
              aria-label="Notificaciones"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[9px] font-bold rounded-full h-4.5 w-4.5 flex items-center justify-center border border-surface shadow-xs">
                1
              </span>
            </Link>
            <Link 
              href="/cuenta" 
              className="p-1.5 text-text-primary hover:text-signal transition-colors" 
              aria-label="Ajustes de cuenta"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </Link>
          </div>
        </header>

        {/* Tab switch OFERTAS / ACEPTADOS */}
        <div className="mt-6 rounded-full bg-surface-elevated border border-border/40 p-1 flex w-full">
          <button
            type="button"
            onClick={() => actualizarUrl({ vista: "disponibles" })}
            className={`flex-1 py-2.5 text-center text-xs font-bold tracking-wider rounded-full transition-all duration-300 ${
              vista === "disponibles" 
                ? "bg-[#00B4D8] text-white shadow-xs cursor-default" 
                : "text-text-secondary hover:text-text-primary cursor-pointer"
            }`}
          >
            OFERTAS
          </button>
          <button
            type="button"
            onClick={() => actualizarUrl({ vista: "mis-viajes" })}
            className={`flex-1 py-2.5 text-center text-xs font-bold tracking-wider rounded-full transition-all duration-300 ${
              vista === "mis-viajes" 
                ? "bg-[#00B4D8] text-white shadow-xs cursor-default" 
                : "text-text-secondary hover:text-text-primary cursor-pointer"
            }`}
          >
            ACEPTADOS
          </button>
        </div>

        {/* Calendar Range Header with Volver a Hoy */}
        <div className="flex justify-center items-center gap-2 mt-6">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="font-body text-xs font-semibold text-text-tertiary">
            {RangoCalendarioText}
          </span>
          {diaSeleccionado !== diaHoy && (
            <button
              type="button"
              onClick={() => setDiaSeleccionado(diaHoy)}
              className="ml-2 bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 px-2 py-0.5 rounded-full text-[10px] font-black hover:bg-[#00B4D8]/20 transition-all cursor-pointer select-none"
            >
              Volver a Hoy
            </button>
          )}
        </div>

        {/* Week Day Selector */}
        <div className="mt-4">
          <WeekDaySelector
            dias={calendario}
            seleccionado={diaSeleccionado}
            hoy={diaHoy}
            onSelect={setDiaSeleccionado}
          />
        </div>

        {/* Selected Day Summary Row */}
        <div className="mt-6 flex justify-between items-center border-b border-border/20 pb-3 font-display">
          <span className="text-[#00B4D8] text-xs font-black tracking-wide uppercase">
            {fechaCompletaTexto}
          </span>
          <div className="flex items-center gap-3 text-text-secondary text-xs font-bold">
            <span>{totalViajesTexto}</span>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-500 font-bold text-xs select-none">
                $
              </div>
              <span className="text-text-primary">${totalGanancia.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* List of custom Trip Cards */}
        <div key={`${diaSeleccionado}-${vista}`} className="mt-4 flex flex-col gap-4 animate-list-fade">
          {cargando ? (
            <TripsLoadingList />
          ) : listToRender.length === 0 ? (
            <div className="text-center py-10 flex flex-col items-center">
              <span className="text-3xl">📅</span>
              <p className="mt-3 font-display text-sm font-bold text-text-primary">Sin viajes para este día</p>
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
                  className="mt-5 bg-[#00B4D8] text-white font-display text-xs font-extrabold px-4 py-2.5 rounded-xl hover:bg-[#00B4D8]/90 active:scale-95 transition-all cursor-pointer shadow-sm select-none"
                >
                  🔍 Buscar Ofertas Disponibles
                </button>
              ) : (
                tieneOfertasOtrosDias && (
                  <p className="mt-4 font-body text-[11px] text-[#00B4D8] font-bold">
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
              return (
                <CustomTripCard
                  key={trasladoId}
                  viaje={viaje}
                  detalle={detalle}
                  esOferta={vista === "disponibles"}
                  isExpanded={tarjetaExpandida === trasladoId}
                  onToggleExpand={() => setTarjetaExpandida(tarjetaExpandida === trasladoId ? null : trasladoId)}
                  onAccept={(id) => void aceptar(id)}
                  hrefDetalle={hrefDetalle(viaje)}
                />
              );
            })
          )}
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
              <p className="font-body text-sm font-semibold">Viaje rechazado</p>
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
    </div>
  );
}
