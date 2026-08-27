"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Aviso, LogoMarca } from "@ruum/ui";
import type { Conductor } from "@ruum/shared/types";
import type { MotivoRechazo } from "@ruum/shared/constants";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import {
  listarViajesDisponibles,
  listarViajesAceptados,
  obtenerConductorActual,
  listarHistorialViajesConductor,
  registrarEvento
} from "@ruum/api/services";
import { RejectTripDialog } from "./RejectTripDialog";
import { OfertaCard } from "./OfertaCard";
import { AcceptedTripCard } from "./AcceptedTripCard";
import { ViajesDateNavigator } from "./ViajesDateNavigator";
import { ViajesFilters, type OrdenViajes } from "./ViajesFilters";
import { UndoRechazoToast } from "./UndoRechazoToast";
import { ViajesMapa } from "./ViajesMapa";
import { PanelSupportSheet } from "../panel/PanelSupportSheet";
import {
  claveDia,
  crearCalendario,
  detalleFallback,
  normalizarVista,
  type DetalleOperativo,
  type PasaporteRow
} from "./trips-utils";

type RechazoPendiente = {
  viaje: PasaporteRow;
  motivo: MotivoRechazo;
};

function TripsLoadingList() {
  return (
    <output aria-label="Cargando viajes" aria-busy="true" className="w-full flex flex-col gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-44 w-full animate-pulse rounded-2xl bg-surface-elevated" />
      ))}
    </output>
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
  const [refrescando, setRefrescando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [viajeParaRechazar, setViajeParaRechazar] = useState<PasaporteRow | null>(null);
  const [rechazoPendiente, setRechazoPendiente] = useState<RechazoPendiente | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [soporteAbierto, setSoporteAbierto] = useState(false);
  const [notificacionesCount, setNotificacionesCount] = useState(0);
  const [orden, setOrden] = useState<OrdenViajes>(() => {
    const v = searchParams.get("orden") as OrdenViajes | null;
    return v === "mayor_ganancia" || v === "menor_distancia" ? v : "recientes";
  });
  const [ciudadFiltro, setCiudadFiltro] = useState<string>(() => searchParams.get("ciudad") ?? "todas");
  const [modoMapa, setModoMapa] = useState<"lista" | "mapa">("lista");
  const [estaOnline, setEstaOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const timeoutRechazoRef = useRef<number | null>(null);
  const recargaDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const vista = normalizarVista(searchParams.get("vista"));
  const queryActual = searchParams.toString();
  const rutaActual = queryActual ? `/viajes?${queryActual}` : "/viajes";

  function actualizarUrl(cambios: Partial<Record<"vista" | "fecha" | "estado" | "orden" | "ciudad", string>>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(cambios).forEach(([clave, valor]) => {
      if (!valor || valor === "todos" || valor === "recientes") {
        // rec recientes es default -> limpia URL
        if (clave === "orden" && valor === "recientes") params.delete(clave);
        else if (clave === "ciudad" && (valor === "todas" || !valor)) params.delete(clave);
        else if (clave !== "orden" && clave !== "ciudad") params.delete(clave);
        else if (valor === "todos" || !valor) params.delete(clave);
      } else {
        params.set(clave, valor);
      }
    });
    const query = params.toString();
    router.replace(query ? `/viajes?${query}` : "/viajes", { scroll: false });
  }

  function hrefDetalle(viaje: PasaporteRow) {
    return `/viajes/${viaje.traslado_id}?volver=${encodeURIComponent(rutaActual)}`;
  }

  // Escuchar estado de conexión
  useEffect(() => {
    const actualizar = () => setEstaOnline(navigator.onLine);
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  // Preferencia Lista | Mapa — Persistida en Preferences (Capacitor) + localStorage fallback
  useEffect(() => {
    let cancelado = false;
    async function cargarModo() {
      try {
        // Intentar Preferences (nativo)
        const { Preferences } = await import("@capacitor/preferences");
        const { value } = await Preferences.get({ key: "ruum_conductor_viajes_modo" });
        if (!cancelado && (value === "mapa" || value === "lista")) setModoMapa(value);
        return;
      } catch {}
      try {
        const v = localStorage.getItem("ruum_conductor_viajes_modo");
        if (!cancelado && (v === "mapa" || v === "lista")) setModoMapa(v as "lista" | "mapa");
      } catch {}
    }
    void cargarModo();
    return () => {
      cancelado = true;
    };
  }, []);

  function cambiarModo(modo: "lista" | "mapa") {
    setModoMapa(modo);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
    void (async () => {
      try {
        const { Preferences } = await import("@capacitor/preferences");
        await Preferences.set({ key: "ruum_conductor_viajes_modo", value: modo });
      } catch {}
      try {
        localStorage.setItem("ruum_conductor_viajes_modo", modo);
      } catch {}
    })();
  }

  // Notificaciones no leídas
  useEffect(() => {
    async function cargarNotificacionesCount() {
      if (!tieneSupabaseConfigurado()) return;
      try {
        const cliente = crearClienteNavegador();
        const { count } = await cliente
          .from("notificaciones_conductor")
          .select("id", { count: "exact", head: true })
          .is("leida_en", null);
        setNotificacionesCount(count ?? 0);
      } catch {
        // Ignorar
      }
    }
    void cargarNotificacionesCount();
    const actualizar = () => void cargarNotificacionesCount();
    window.addEventListener("ruum:notificaciones-actualizar", actualizar);
    return () => window.removeEventListener("ruum:notificaciones-actualizar", actualizar);
  }, []);

  // Inicializar fecha de hoy
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

  // Carga principal de datos
  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setAviso("Supabase no está configurado. No se pueden consultar viajes reales.");
        setCargando(false);
        setRefrescando(false);
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

        const resultados = await Promise.allSettled([
          listarViajesDisponibles(cliente),
          conductorActual ? listarViajesAceptados(cliente, conductorActual.id) : Promise.resolve([] as PasaporteRow[]),
          conductorActual ? listarHistorialViajesConductor(cliente, conductorActual.id) : Promise.resolve([] as PasaporteRow[])
        ]);
        const listaDisponibles = resultados[0].status === "fulfilled" ? resultados[0].value : [];
        const listaAceptados = resultados[1].status === "fulfilled" ? resultados[1].value : [];
        const historialViajes = resultados[2].status === "fulfilled" ? resultados[2].value : [];
        if (resultados.some((r) => r.status === "rejected")) {
          console.warn("Algunos listados fallaron, mostrando datos parciales", resultados);
        }

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
        setRefrescando(false);
      }
    }
    void cargar();
  }, [refreshCount]);

  // Suscripción Realtime a Traslados
  useEffect(() => {
    if (!tieneSupabaseConfigurado()) return;

    let cliente: ReturnType<typeof crearClienteNavegador>;
    try {
      cliente = crearClienteNavegador();
    } catch {
      return;
    }

    const triggerRecarga = () => {
      if (recargaDebounceRef.current) clearTimeout(recargaDebounceRef.current);
      recargaDebounceRef.current = setTimeout(() => {
        setRefrescando(true);
        setRefreshCount((prev) => prev + 1);
      }, 600);
    };

    const canalTraslados = cliente
      .channel("viajes_lista_traslados")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "traslados" },
        () => triggerRecarga()
      )
      .subscribe();

    return () => {
      if (recargaDebounceRef.current) clearTimeout(recargaDebounceRef.current);
      cliente.removeChannel(canalTraslados);
    };
  }, []);

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
    setDisponibles((prev) => (prev.some((item) => item.traslado_id === viaje.traslado_id) ? prev : [viaje, ...prev]));
    setRechazados((prev) => prev.filter((id) => id !== viaje.traslado_id));
    setRechazoPendiente(null);
    setAviso("Rechazo deshecho. El traslado volvió a estar disponible.");
  }

  const disponiblesVisibles = useMemo(
    () => disponibles.filter((viaje) => viaje.traslado_id && !rechazados.includes(viaje.traslado_id)),
    [disponibles, rechazados]
  );
  const calendario = useMemo(() => crearCalendario(disponiblesVisibles, aceptados, detalles), [disponiblesVisibles, aceptados, detalles]);
  const [visibleCount, setVisibleCount] = useState(10);

  const diaCalendarioSeleccionado = calendario.find(({ dia }) => claveDia(dia) === diaSeleccionado) ?? calendario[0];

  // Lista cruda del día seleccionado
  const rawListToRender = useMemo(() => {
    if (!diaCalendarioSeleccionado) return [];
    return diaCalendarioSeleccionado.viajes.filter((item) => {
      if (vista === "disponibles") return item.tipo === "Ofertado";
      return item.tipo !== "Ofertado";
    });
  }, [diaCalendarioSeleccionado, vista]);

  // Ciudades disponibles para el filtro
  const ciudadesDisponibles = useMemo(() => {
    const set = new Set<string>();
    rawListToRender.forEach((item) => {
      if (item.viaje.origen_ciudad) set.add(item.viaje.origen_ciudad);
    });
    return Array.from(set);
  }, [rawListToRender]);

  // Lista filtrada y ordenada
  const listToRender = useMemo(() => {
    let result = [...rawListToRender];

    if (ciudadFiltro !== "todas") {
      result = result.filter((item) => item.viaje.origen_ciudad === ciudadFiltro);
    }

    if (orden === "mayor_ganancia") {
      result.sort((a, b) => (b.viaje.ganancia_conductor ?? 0) - (a.viaje.ganancia_conductor ?? 0));
    } else if (orden === "menor_distancia") {
      result.sort((a, b) => (a.viaje.distancia_km ?? 9999) - (b.viaje.distancia_km ?? 9999));
    }

    return result;
  }, [rawListToRender, ciudadFiltro, orden]);

  const tieneOfertasOtrosDias = calendario.some(
    ({ dia, viajes }) => claveDia(dia) !== diaSeleccionado && viajes.some((v) => v.tipo === "Ofertado")
  );

  // Reset paginación al cambiar filtros/vista/día
  useEffect(() => {
    setVisibleCount(10);
  }, [vista, ciudadFiltro, orden, diaSeleccionado]);

  const listToRenderVisible = useMemo(() => listToRender.slice(0, visibleCount), [listToRender, visibleCount]);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-10 flex flex-col justify-between min-h-[calc(100vh-100px)] text-text-primary">
      <div className="w-full flex flex-col flex-1 pb-16">
        {/* Header — sticky con acciones 44px y barra fina */}
        {refrescando && (
          <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 h-1 bg-signal/20" aria-hidden>
            <div className="h-full w-1/3 animate-pulse bg-signal" style={{ animationDuration: "0.9s" }} />
          </div>
        )}
        <header className="sticky top-0 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 border-b border-border/20 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-body text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Conductor</p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary leading-none">
              Traslados
            </h1>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-text-tertiary">
              <span className={`h-1.5 w-1.5 rounded-full ${estaOnline ? "bg-signal animate-pulse" : "bg-danger"}`} aria-hidden />
              <span>{estaOnline ? "En vivo" : "Sin conexión"}</span>
              <span className="text-text-tertiary/60" aria-hidden>·</span>
              <button
                type="button"
                onClick={() => {
                  setRefrescando(true);
                  setRefreshCount((prev) => prev + 1);
                }}
                disabled={refrescando}
                aria-busy={refrescando || undefined}
                className="inline-flex items-center gap-1 min-h-11 rounded-lg border border-border/30 bg-surface-elevated px-3 py-1.5 text-xs font-bold text-route-action hover:bg-surface disabled:opacity-50 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
              >
                Recargar
              </button>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 select-none">
            <button
              type="button"
              onClick={() => setSoporteAbierto(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border/20 bg-surface-elevated text-text-primary hover:text-route-action transition-colors cursor-pointer shadow-xs focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
              aria-label="Ayuda y soporte rápido"
            >
              <span className="font-display text-sm font-black">?</span>
            </button>

            <Link
              href="/notificaciones"
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-border/20 bg-surface-elevated text-text-primary hover:text-route-action transition-colors shadow-xs focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
              aria-label={notificacionesCount > 0 ? `Notificaciones (${notificacionesCount > 99 ? "99+" : notificacionesCount} sin leer)` : "Notificaciones"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </svg>
              {notificacionesCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[11px] font-black rounded-full min-w-5 h-5 px-1 flex items-center justify-center border-2 border-surface shadow-xs tabular-nums">
                  {notificacionesCount > 99 ? "99+" : notificacionesCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Banner Modo Offline */}
        {!estaOnline && (
          <div className="mt-4">
            <Aviso tono="atencion">
              <span className="font-bold">Modo sin conexión:</span> Mostrando traslados guardados localmente. Conéctate a internet para ver y aceptar nuevas ofertas.
            </Aviso>
          </div>
        )}

        {/* Tab switch 44px real, normal-case, signal activo */}
        <div
          role="tablist"
          aria-label="Vistas de traslados"
          className="mt-5 flex w-full rounded-2xl border border-border/20 bg-surface-elevated p-1 select-none"
        >
          <button
            type="button"
            role="tab"
            id="tab-ofertas"
            aria-selected={vista === "disponibles"}
            aria-controls="panel-traslados"
            onClick={() => actualizarUrl({ vista: "disponibles" })}
            className={`flex-1 rounded-xl px-3 text-center text-sm font-bold transition-all duration-200 cursor-pointer min-h-11 flex items-center justify-center tabular-nums focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action ${
              vista === "disponibles"
                ? "bg-signal text-slate-950 shadow-md"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Ofertas <span className="ml-1 tabular-nums">({disponiblesVisibles.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-aceptados"
            aria-selected={vista === "mis-viajes"}
            aria-controls="panel-traslados"
            onClick={() => actualizarUrl({ vista: "mis-viajes" })}
            className={`flex-1 rounded-xl px-3 text-center text-sm font-bold transition-all duration-200 cursor-pointer min-h-11 flex items-center justify-center tabular-nums focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action ${
              vista === "mis-viajes"
                ? "bg-signal text-slate-950 shadow-md"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Aceptados <span className="ml-1 tabular-nums">({aceptados.length})</span>
          </button>
        </div>

        {/* Toggle Lista | Mapa — R2 persistente */}
        <div role="group" aria-label="Vista Lista o Mapa" className="mt-3 flex w-full rounded-xl border border-border/20 bg-surface-elevated p-1 select-none">
          <button
            type="button"
            aria-pressed={modoMapa === "lista"}
            aria-label="Vista lista"
            onClick={() => cambiarModo("lista")}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-black tracking-wide transition-all cursor-pointer min-h-11 flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action ${
              modoMapa === "lista" ? "bg-surface text-text-primary shadow-sm border border-border" : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Lista
          </button>
          <button
            type="button"
            aria-pressed={modoMapa === "mapa"}
            aria-label="Vista mapa"
            onClick={() => cambiarModo("mapa")}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-black tracking-wide transition-all cursor-pointer min-h-11 flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action ${
              modoMapa === "mapa" ? "bg-signal text-slate-950 shadow-md" : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            Mapa
            {listToRender.length > 0 && (
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums ${modoMapa === "mapa" ? "bg-slate-950 text-signal" : "bg-border text-text-tertiary"}`}>{listToRender.length}</span>
            )}
          </button>
        </div>

        {/* Navegador de Fechas y Calendario Semanal */}
        <ViajesDateNavigator
          calendario={calendario}
          diaSeleccionado={diaSeleccionado}
          diaHoy={diaHoy}
          onSelectDia={setDiaSeleccionado}
        />

        {/* Filtros y Ordenamiento */}
        {rawListToRender.length > 1 && (
          <ViajesFilters
            orden={orden}
            onCambiarOrden={(v) => {
              setOrden(v);
              actualizarUrl({ orden: v });
            }}
            ciudadFiltro={ciudadFiltro}
            onCambiarCiudad={(v) => {
              setCiudadFiltro(v);
              actualizarUrl({ ciudad: v });
            }}
            ciudadesDisponibles={ciudadesDisponibles}
          />
        )}

        {/* Conteo de Elementos */}
        <div className="mt-3 flex items-center justify-between text-xs font-bold text-text-secondary select-none px-1">
          <span>
            {listToRender.length === 1
              ? `1 ${vista === "disponibles" ? "oferta disponible" : "traslado aceptado"}`
              : `${listToRender.length} ${vista === "disponibles" ? "ofertas disponibles" : "traslados aceptados"}`}
          </span>
        </div>

        {/* Vista Mapa — R2 */}
        {modoMapa === "mapa" && !cargando && listToRender.length > 0 && (
          <div className="mt-3">
            <ViajesMapa
              viajes={listToRender.map((it) => it.viaje)}
              onSelect={(viaje) => router.push(hrefDetalle(viaje))}
              vistaId={`${vista}-${diaSeleccionado}-${orden}-${ciudadFiltro}`}
            />
            <p className="mt-2 font-body text-[11px] text-center text-text-tertiary">Vista geográfica · {listToRender.length} ofertas · Toca un pin o vuelve a Lista para detalle completo</p>
          </div>
        )}

        {/* Lista de Tarjetas — oculta cuando mapa y hay datos */}
        <div
          id="panel-traslados"
          role="tabpanel"
          aria-labelledby={vista === "disponibles" ? "tab-ofertas" : "tab-aceptados"}
          className={`mt-3 flex flex-col gap-3.5 ${modoMapa === "mapa" && !cargando && listToRender.length > 0 ? "hidden" : ""}`}
        >
          {cargando ? (
            <TripsLoadingList />
          ) : listToRender.length === 0 ? (
            <div className="text-center py-10 flex flex-col items-center bg-surface-elevated border border-border/20 rounded-3xl p-6">
              <div className="size-14 rounded-2xl bg-surface border border-border/20 flex items-center justify-center text-2xl" aria-hidden>
                {rawListToRender.length > 0 && listToRender.length === 0 ? "🔍" : vista === "disponibles" ? "📭" : "📋"}
              </div>
              <p className="mt-3 font-display text-sm font-bold text-text-primary">
                {rawListToRender.length > 0 && listToRender.length === 0 ? "Sin resultados con estos filtros" : "Sin traslados para este día"}
              </p>
              <p className="mt-1 font-body text-xs text-text-secondary max-w-[300px] leading-relaxed">
                {rawListToRender.length > 0 && listToRender.length === 0
                  ? `Hay ${rawListToRender.length} ofertas este día, pero ninguna coincide con “${ciudadFiltro !== "todas" ? ciudadFiltro : orden}”. Prueba limpiar filtros.`
                  : vista === "disponibles"
                  ? "No hay ofertas programadas en esta fecha. Revisa otro día o cambia el orden a Mayor ganancia."
                  : "No tienes traslados aceptados para esta fecha. Acepta una oferta para verla aquí."}
              </p>

              {rawListToRender.length > 0 && listToRender.length === 0 ? (
                <div className="mt-4 flex flex-col gap-2 w-full max-w-[300px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCiudadFiltro("todas");
                      setOrden("recientes");
                      actualizarUrl({ ciudad: "todas", orden: "recientes" });
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-signal text-slate-950 px-5 py-3 font-display text-sm font-black shadow-sm focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-signal"
                  >
                    Limpiar filtros
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCiudadFiltro("todas");
                      setOrden("mayor_ganancia");
                      actualizarUrl({ ciudad: "todas", orden: "mayor_ganancia" });
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-route-action/30 bg-route-soft px-5 py-3 font-body text-sm font-bold text-route-action"
                  >
                    Probar “Mayor ganancia” →
                  </button>
                </div>
              ) : vista === "mis-viajes" ? (
                <button
                  type="button"
                  onClick={() => actualizarUrl({ vista: "disponibles" })}
                  className="mt-4 bg-signal text-slate-950 font-display text-sm font-bold px-5 py-3 rounded-xl transition-all shadow-sm cursor-pointer select-none min-h-11 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-signal"
                >
                  Buscar ofertas disponibles
                </button>
              ) : tieneOfertasOtrosDias ? (
                (() => {
                  const diaConOfertas = calendario.find(({ dia, viajes }) => claveDia(dia) !== diaSeleccionado && viajes.some((v) => v.tipo === "Ofertado"));
                  const label = diaConOfertas
                    ? new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", timeZone: "America/Mexico_City" }).format(diaConOfertas.dia)
                    : "otro día";
                  return (
                    <div className="mt-4 flex flex-col gap-2 w-full max-w-[300px]">
                      <button
                        type="button"
                        onClick={() => diaConOfertas && setDiaSeleccionado(claveDia(diaConOfertas.dia))}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-route-action/30 bg-route-soft px-5 py-3 font-body text-sm font-bold text-route-action hover:bg-route-soft/70 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
                      >
                        Ver ofertas del {label} →
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCiudadFiltro("todas");
                          setOrden("mayor_ganancia");
                          actualizarUrl({ ciudad: "todas", orden: "mayor_ganancia" });
                        }}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-surface border border-border px-5 py-3 font-body text-sm font-bold text-text-secondary"
                      >
                        Ver con “Mayor ganancia”
                      </button>
                    </div>
                  );
                })()
              ) : (
                <div className="mt-4 flex flex-col gap-2 w-full max-w-[300px]">
                  <button
                    type="button"
                    onClick={() => {
                      setOrden("mayor_ganancia");
                      actualizarUrl({ orden: "mayor_ganancia" });
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-route-action/30 bg-route-soft px-5 py-3 font-body text-sm font-bold text-route-action"
                  >
                    Ordenar por mayor ganancia
                  </button>
                  <Link href="/panel" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-surface border border-border px-5 py-3 font-body text-sm font-bold text-text-secondary text-center">
                    Volver al panel
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              {listToRenderVisible.map((item, index) => {
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
                  <AcceptedTripCard
                    key={trasladoId}
                    viaje={viaje}
                    detalle={detalle}
                    onReject={(viaje) => setViajeParaRechazar(viaje)}
                    hrefDetalle={hrefDetalle(viaje)}
                  />
                );
              })}
              {listToRender.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((v) => v + 10)}
                  className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 py-3 font-body text-sm font-bold text-text-primary hover:bg-surface-elevated focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
                >
                  Cargar más ({listToRender.length - visibleCount} restantes)
                </button>
              )}
            </>
          )}
        </div>

        {aviso && (
          <output className="mt-4 block" aria-live="polite" aria-atomic="true">
            <Aviso tono="info">{aviso}</Aviso>
          </output>
        )}
      </div>

      {/* Toast Flotante para Deshacer Rechazo */}
      {rechazoPendiente && (
        <UndoRechazoToast
          viaje={rechazoPendiente.viaje}
          motivo={rechazoPendiente.motivo}
          onDeshacer={deshacerRechazo}
        />
      )}

      {/* Diálogo Accesible para Rechazar Traslado */}
      <RejectTripDialog
        viaje={viajeParaRechazar}
        onClose={() => setViajeParaRechazar(null)}
        onConfirm={confirmarRechazo}
      />

      {/* Bottom Sheet de Soporte Accesible */}
      <PanelSupportSheet
        abierto={soporteAbierto}
        onCerrar={() => setSoporteAbierto(false)}
      />
    </div>
  );
}
