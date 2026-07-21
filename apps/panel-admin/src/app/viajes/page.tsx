"use client";
import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import Link from "next/link";
import { Aviso, EstadoBadge } from "@ruum/ui";
import { AdminFiltroActivo, AdminPageHeader, limpiarParamsFiltroUrl } from "../admin-ui";
import { AdminDataTable, type AdminDataTableColumn, type AdminDataTableSortState } from "../AdminDataTable";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { listarCargasTrasladosMasivosAdmin, listarViajesAdmin, obtenerAdminActual, registrarEvento, obtenerPreferenciaAdmin, guardarPreferenciaAdmin, type TrazabilidadMasivaTraslado } from "@ruum/api/services";
import { VIAJES_DEMO } from "../../lib/datos-demo";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
type FiltroKpi = "activos" | "inician_60" | "sin_asignacion" | "incidencia" | "finalizados_hoy";
type AccionOperativa = "asignar_conductor" | "registrar_incidencia";
type EstadoConexionVista = "datos_en_vivo" | "actualizando" | "reconectando" | "sin_conexion" | "desactualizado" | "demo";
type FiltroSla = "todos" | "en_riesgo" | "vencido";
type FiltroFecha = "todos" | "hoy" | "7d" | "30d";
type PrioridadOperativa = "baja" | "media" | "alta" | "critica";
type AlcanceVistaGuardada = "privada" | "compartida";
type AccionMasivaId =
  | "asignar_responsable"
  | "cambiar_prioridad"
  | "escalar"
  | "exportar"
  | "etiquetar"
  | "descargar_evidencia"
  | "actualizar_estado";
type EstadoAccionMasiva = "pendiente" | "exitoso" | "parcial" | "bloqueado";
type PasaporteOperativo = PasaporteRow & {
  actualizado_en?: string | null;
  empresa_nombre?: string | null;
  fecha_hora_programada?: string | null;
  modalidad_programacion?: string | null;
};
type FiltrosAvanzados = {
  estado: EstadoTraslado | "todos";
  sla: FiltroSla;
  fecha: FiltroFecha;
  empresa: string;
  conductor: string;
  vehiculo: string;
  origen: string;
  destino: string;
  incidencia: boolean;
  sinAsignacion: boolean;
  sinCoordenadas: boolean;
  proximos: boolean;
};
type AccionMasivaConfig = {
  id: AccionMasivaId;
  etiqueta: string;
  descripcion: string;
  requiereConfirmacion?: boolean;
  destructiva?: boolean;
};
type ResultadoAccionMasiva = {
  trasladoId: string;
  folio: string;
  estado: "aplicado" | "omitido" | "bloqueado";
  detalle: string;
};
type AuditoriaOperacionMasiva = {
  id: string;
  accion: string;
  afectados: number;
  exitosos: number;
  omitidos: number;
  bloqueados: number;
  timestamp: string;
  detalle: string;
  folios: string[];
};
type VistaGuardada = {
  id: string;
  nombre: string;
  alcance: AlcanceVistaGuardada;
  filtros: FiltrosAvanzados;
  busqueda: string;
  columnas: string[];
  orden: AdminDataTableSortState;
  esPredeterminada: boolean;
};

// PRD §17.4 — pestañas. "Todos" + un subconjunto representativo del camino
// feliz y sus ramas — no los 33 estados técnicos, que es justo la traducción
// que el PRD pide ("Programados" agrupa todo lo previo a en curso).
const PESTANAS: { id: string; etiqueta: string; filtro: EstadoTraslado | "todos" }[] = [
  { id: "todos", etiqueta: "Todos", filtro: "todos" },
  { id: "pendientes", etiqueta: "Pendientes", filtro: "pendiente_de_conductor" },
  { id: "en_curso", etiqueta: "En curso", filtro: "traslado_en_curso" },
  { id: "finalizados", etiqueta: "Finalizados", filtro: "servicio_cerrado" },
  { id: "cancelados", etiqueta: "Cancelados", filtro: "servicio_cancelado" }
];

const ESTADOS_TERMINALES: EstadoTraslado[] = ["servicio_cerrado", "servicio_cancelado", "traslado_fallido"];

const ETIQUETA_FILTRO_KPI: Record<FiltroKpi, string> = {
  activos: "Traslados activos",
  inician_60: "Inician en 60 minutos",
  sin_asignacion: "Sin asignación",
  incidencia: "Con incidencia",
  finalizados_hoy: "Finalizados hoy"
};

const ETIQUETA_ACCION_OPERATIVA: Record<AccionOperativa, string> = {
  asignar_conductor: "Asignar conductor",
  registrar_incidencia: "Registrar incidencia"
};

const FILTROS_INICIALES: FiltrosAvanzados = {
  estado: "todos",
  sla: "todos",
  fecha: "todos",
  empresa: "",
  conductor: "",
  vehiculo: "",
  origen: "",
  destino: "",
  incidencia: false,
  sinAsignacion: false,
  sinCoordenadas: false,
  proximos: false
};

const COLUMNAS_OPERATIVAS_INICIALES = [
  "folio",
  "inicio_programado",
  "ruta",
  "vehiculo",
  "conductor",
  "sla",
  "estatus",
  "incidencia",
  "ultima_actualizacion",
  "responsable"
];

const ACCIONES_MASIVAS: AccionMasivaConfig[] = [
  {
    id: "asignar_responsable",
    etiqueta: "Asignar responsable",
    descripcion: "Define responsable operativo para los registros seleccionados."
  },
  {
    id: "cambiar_prioridad",
    etiqueta: "Cambiar prioridad",
    descripcion: "Marca prioridad operativa para ordenar atención interna."
  },
  {
    id: "escalar",
    etiqueta: "Escalar",
    descripcion: "Escala los traslados seleccionados a supervisión.",
    requiereConfirmacion: true
  },
  {
    id: "exportar",
    etiqueta: "Exportar",
    descripcion: "Descarga la selección en CSV."
  },
  {
    id: "etiquetar",
    etiqueta: "Etiquetar",
    descripcion: "Añade una etiqueta operativa a la selección."
  },
  {
    id: "descargar_evidencia",
    etiqueta: "Descargar evidencia",
    descripcion: "Descarga un manifiesto JSON de evidencia disponible."
  },
  {
    id: "actualizar_estado",
    etiqueta: "Actualizar estado",
    descripcion: "Prepara actualización solo para estados operativamente seguros.",
    requiereConfirmacion: true,
    destructiva: true
  }
];

const VISTAS_PREDEFINIDAS: Array<Omit<VistaGuardada, "id" | "alcance" | "columnas" | "orden" | "esPredeterminada"> & { id: string }> = [
  { id: "riesgo", nombre: "En riesgo", filtros: { ...FILTROS_INICIALES, sla: "en_riesgo" }, busqueda: "" },
  { id: "sin_conductor", nombre: "Sin conductor", filtros: { ...FILTROS_INICIALES, sinAsignacion: true }, busqueda: "" },
  { id: "inician_60", nombre: "Inician en 60 minutos", filtros: { ...FILTROS_INICIALES, proximos: true }, busqueda: "" },
  { id: "incidencia", nombre: "Con incidencia", filtros: { ...FILTROS_INICIALES, incidencia: true }, busqueda: "" },
  { id: "sin_ubicacion", nombre: "Sin ubicación", filtros: { ...FILTROS_INICIALES, sinCoordenadas: true }, busqueda: "" },
  { id: "mis_asignados", nombre: "Mis traslados asignados", filtros: { ...FILTROS_INICIALES }, busqueda: "Torre de control" }
];

const PREF_VISTAS_GUARDADAS = "viajes.vistas_guardadas";
const PREF_AUDITORIA_MASIVA = "viajes.auditoria_masiva";

export default function PaginaViajesAdmin() {
  const [pestana, setPestana] = useState(PESTANAS[0]!.id);
  const [traslados, setTraslados] = useState<PasaporteRow[]>([]);
  const [trazabilidadPorTraslado, setTrazabilidadPorTraslado] = useState<Map<string, TrazabilidadMasivaTraslado>>(new Map());
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroKpi, setFiltroKpi] = useState<FiltroKpi | null>(null);
  const [accionOperativa, setAccionOperativa] = useState<AccionOperativa | null>(null);
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionVista>("actualizando");
  const [ultimaRespuestaExitosa, setUltimaRespuestaExitosa] = useState<Date | null>(null);
  const [seccionesDesactualizadas, setSeccionesDesactualizadas] = useState<string[]>([]);
  const [actualizandoManual, setActualizandoManual] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [filtros, setFiltros] = useState<FiltrosAvanzados>(FILTROS_INICIALES);
  const [columnasVisibles, setColumnasVisibles] = useState<Set<string>>(() => new Set(COLUMNAS_OPERATIVAS_INICIALES));
  const [ordenTabla, setOrdenTabla] = useState<AdminDataTableSortState>({ columnId: "sla", direction: "desc" });
  const [accionMasiva, setAccionMasiva] = useState<AccionMasivaConfig | null>(null);
  const [estadoAccionMasiva, setEstadoAccionMasiva] = useState<EstadoAccionMasiva>("pendiente");
  const [resultadosAccionMasiva, setResultadosAccionMasiva] = useState<ResultadoAccionMasiva[]>([]);
  const [confirmacionMasiva, setConfirmacionMasiva] = useState(false);
  const [responsableMasivo, setResponsableMasivo] = useState("Supervisor");
  const [prioridadMasiva, setPrioridadMasiva] = useState<PrioridadOperativa>("alta");
  const [etiquetaMasiva, setEtiquetaMasiva] = useState("Corporativo");
  const [auditoriaMasiva, setAuditoriaMasiva] = useState<AuditoriaOperacionMasiva[]>([]);
  const [detalleAbiertoId, setDetalleAbiertoId] = useState<string | null>(null);
  const [vistasGuardadas, setVistasGuardadas] = useState<VistaGuardada[]>([]);
  const [nombreVista, setNombreVista] = useState("");
  const [alcanceVista, setAlcanceVista] = useState<AlcanceVistaGuardada>("privada");
  const filtrosInicializados = useRef(false);
  const botonCerrarDetalleRef = useRef<HTMLButtonElement | null>(null);
  const focoAntesDetalleRef = useRef<HTMLElement | null>(null);

  const filtroActual = PESTANAS.find((p) => p.id === pestana)!.filtro;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parametro = params.get("filtro");
    if (esFiltroKpi(parametro)) {
      setFiltroKpi(parametro);
      setPestana("todos");
    }
    const accion = params.get("accion");
    if (esAccionOperativa(accion)) setAccionOperativa(accion);
    const estadoUrl = params.get("estado");
    const estado = esEstadoTraslado(estadoUrl) ? estadoUrl : "todos";
    const slaUrl = params.get("sla");
    const fechaUrl = params.get("fecha");
    setFiltros({
      estado,
      sla: esFiltroSla(slaUrl) ? slaUrl : "todos",
      fecha: esFiltroFecha(fechaUrl) ? fechaUrl : "todos",
      empresa: params.get("empresa") ?? "",
      conductor: params.get("conductor") ?? "",
      vehiculo: params.get("vehiculo") ?? "",
      origen: params.get("origen") ?? "",
      destino: params.get("destino") ?? "",
      incidencia: params.get("incidencia") === "1",
      sinAsignacion: params.get("sin_asignacion") === "1",
      sinCoordenadas: params.get("sin_coordenadas") === "1",
      proximos: params.get("proximos") === "1"
    });
    if (estado !== "todos") {
      const pestanaEstado = PESTANAS.find((item) => item.filtro === estado);
      setPestana(pestanaEstado?.id ?? "todos");
    }
    setBusqueda(params.get("q") ?? "");
    setDetalleAbiertoId(params.get("detalle"));
    filtrosInicializados.current = true;
  }, []);

  useEffect(() => {
    if (!tieneSupabaseConfigurado()) return;
    const cliente = crearClienteNavegador();
    void Promise.all([
      obtenerPreferenciaAdmin<VistaGuardada[]>(cliente, PREF_VISTAS_GUARDADAS),
      obtenerPreferenciaAdmin<AuditoriaOperacionMasiva[]>(cliente, PREF_AUDITORIA_MASIVA)
    ]).then(([vistas, auditoria]) => {
      setVistasGuardadas(vistas ?? []);
      setAuditoriaMasiva(auditoria ?? []);
    }).catch(() => { setVistasGuardadas([]); setAuditoriaMasiva([]); });
  }, []);

  useEffect(() => {
    if (!tieneSupabaseConfigurado()) return;
    const timer = window.setTimeout(() => void guardarPreferenciaAdmin(crearClienteNavegador(), PREF_VISTAS_GUARDADAS, vistasGuardadas), 400);
    return () => window.clearTimeout(timer);
  }, [vistasGuardadas]);

  useEffect(() => {
    if (!tieneSupabaseConfigurado()) return;
    const timer = window.setTimeout(() => void guardarPreferenciaAdmin(crearClienteNavegador(), PREF_AUDITORIA_MASIVA, auditoriaMasiva.slice(0, 20)), 400);
    return () => window.clearTimeout(timer);
  }, [auditoriaMasiva]);

  useEffect(() => {
    if (!filtrosInicializados.current) return;
    const params = new URLSearchParams();
    if (busqueda.trim()) params.set("q", busqueda.trim());
    if (filtroKpi) params.set("filtro", filtroKpi);
    if (accionOperativa) params.set("accion", accionOperativa);
    if (filtros.estado !== "todos") params.set("estado", filtros.estado);
    if (filtros.sla !== "todos") params.set("sla", filtros.sla);
    if (filtros.fecha !== "todos") params.set("fecha", filtros.fecha);
    if (filtros.empresa) params.set("empresa", filtros.empresa);
    if (filtros.conductor) params.set("conductor", filtros.conductor);
    if (filtros.vehiculo) params.set("vehiculo", filtros.vehiculo);
    if (filtros.origen) params.set("origen", filtros.origen);
    if (filtros.destino) params.set("destino", filtros.destino);
    if (filtros.incidencia) params.set("incidencia", "1");
    if (filtros.sinAsignacion) params.set("sin_asignacion", "1");
    if (filtros.sinCoordenadas) params.set("sin_coordenadas", "1");
    if (filtros.proximos) params.set("proximos", "1");
    if (detalleAbiertoId) params.set("detalle", detalleAbiertoId);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/viajes?${query}` : "/viajes");
  }, [accionOperativa, busqueda, detalleAbiertoId, filtroKpi, filtros]);

  useEffect(() => {
    if (!detalleAbiertoId) return;
    focoAntesDetalleRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cerrarDetalleRapido();
    };
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => botonCerrarDetalleRef.current?.focus(), 0);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [detalleAbiertoId]);

  async function cargar(esRefresco = false) {
      if (!esRefresco) setCargando(true);
      if (esRefresco) {
        setActualizandoManual(true);
        setEstadoConexion(ultimaRespuestaExitosa ? "reconectando" : "actualizando");
      }
      if (!tieneSupabaseConfigurado()) {
        const lista = filtroActual === "todos" ? VIAJES_DEMO : VIAJES_DEMO.filter((v) => v.estado === filtroActual);
        setTraslados(lista);
        setEsDemo(true);
        setEstadoConexion("demo");
        setUltimaRespuestaExitosa(new Date());
        setSeccionesDesactualizadas([]);
        setCargando(false);
        setActualizandoManual(false);
        return;
      }

      try {
        const cliente = crearClienteNavegador();
        const [lista, masivos] = await Promise.all([
          listarViajesAdmin(cliente, filtroActual),
          listarCargasTrasladosMasivosAdmin(cliente)
        ]);
        const cargasPorId = new Map(masivos.cargas.map((carga) => [carga.id, carga]));
        setTrazabilidadPorTraslado(new Map(
          masivos.filas
            .filter((fila) => fila.traslado_id)
            .flatMap((fila) => {
              const carga = cargasPorId.get(fila.carga_id);
              return carga && fila.traslado_id ? [[fila.traslado_id, { carga, fila } as TrazabilidadMasivaTraslado]] : [];
            })
        ));
        setTraslados(lista);
        setEsDemo(false);
        setEstadoConexion("datos_en_vivo");
        setUltimaRespuestaExitosa(new Date());
        setSeccionesDesactualizadas([]);
      } catch {
        const teniaRespuesta = Boolean(ultimaRespuestaExitosa);
        if (puedeUsarDatosDemo()) {
          const lista = filtroActual === "todos" ? VIAJES_DEMO : VIAJES_DEMO.filter((v) => v.estado === filtroActual);
          setTraslados(lista);
          setTrazabilidadPorTraslado(new Map());
          setEsDemo(true);
          setEstadoConexion(teniaRespuesta ? "desactualizado" : "sin_conexion");
          setSeccionesDesactualizadas(["traslados administrativos", "trazabilidad de cargas masivas"]);
        } else {
          setTraslados([]);
          setTrazabilidadPorTraslado(new Map());
          setEsDemo(false);
          setEstadoConexion(teniaRespuesta ? "desactualizado" : "sin_conexion");
          setSeccionesDesactualizadas(["traslados administrativos", "trazabilidad de cargas masivas"]);
        }
      } finally {
        setCargando(false);
        setActualizandoManual(false);
      }
  }

  useEffect(() => {
    void cargar();
  }, [filtroActual]);

  const trasladosPorKpi = useMemo(() => {
    if (!filtroKpi) return traslados;
    const ahora = Date.now();
    const en60Min = ahora + 60 * 60 * 1000;
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    return traslados.filter((v) => {
      const extendido = v as PasaporteRow & {
        modalidad_programacion?: string | null;
        fecha_hora_programada?: string | null;
        tiene_incidencia_abierta?: boolean | null;
        incidencias_abiertas?: number | null;
        actualizado_en?: string | null;
      };
      if (filtroKpi === "activos") return v.estado ? !ESTADOS_TERMINALES.includes(v.estado) : false;
      if (filtroKpi === "sin_asignacion") return v.estado === "pendiente_de_conductor";
      if (filtroKpi === "incidencia") return Boolean(extendido.tiene_incidencia_abierta) || Number(extendido.incidencias_abiertas ?? 0) > 0;
      if (filtroKpi === "finalizados_hoy") {
        const fechaCierre = extendido.actualizado_en ? new Date(extendido.actualizado_en).getTime() : 0;
        return v.estado === "servicio_cerrado" && fechaCierre >= inicioHoy.getTime();
      }
      if (filtroKpi === "inician_60") {
        const fechaProgramada = extendido.fecha_hora_programada ? new Date(extendido.fecha_hora_programada).getTime() : 0;
        return extendido.modalidad_programacion === "programado" && fechaProgramada >= ahora && fechaProgramada <= en60Min;
      }
      return true;
    });
  }, [filtroKpi, traslados]);

  const opcionesFiltros = useMemo(() => {
    const empresas = new Map<string, string>();
    const conductores = new Set<string>();
    const vehiculos = new Set<string>();
    for (const traslado of traslados) {
      if (traslado.conductor_nombre) conductores.add(traslado.conductor_nombre);
      if (traslado.vehiculo_tipo) vehiculos.add(traslado.vehiculo_tipo);
      if (traslado.traslado_id) {
        const trazabilidad = trazabilidadPorTraslado.get(traslado.traslado_id);
        if (trazabilidad?.carga.empresa_id) empresas.set(trazabilidad.carga.empresa_id, trazabilidad.carga.empresa_id.slice(0, 8).toUpperCase());
      }
    }
    return {
      empresas: Array.from(empresas.entries()),
      conductores: Array.from(conductores).sort(),
      vehiculos: Array.from(vehiculos).sort()
    };
  }, [traslados, trazabilidadPorTraslado]);

  const trasladosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return trasladosPorKpi.filter((v) => {
      const extendido = v as PasaporteRow & { fecha_hora_programada?: string | null; actualizado_en?: string | null };
      const trazabilidad = v.traslado_id ? trazabilidadPorTraslado.get(v.traslado_id) : null;
      const textoBusqueda = [
        v.traslado_id?.slice(0, 8),
        v.vehiculo_marca,
        v.vehiculo_modelo,
        v.vehiculo_placas,
        v.conductor_nombre,
        v.origen_ciudad,
        v.origen_direccion,
        v.destino_ciudad,
        v.destino_direccion
      ].join(" ").toLowerCase();
      if (q && !textoBusqueda.includes(q)) return false;
      if (filtros.estado !== "todos" && v.estado !== filtros.estado) return false;
      if (filtros.empresa && trazabilidad?.carga.empresa_id !== filtros.empresa) return false;
      if (filtros.conductor && v.conductor_nombre !== filtros.conductor) return false;
      if (filtros.vehiculo && v.vehiculo_tipo !== filtros.vehiculo) return false;
      if (filtros.origen && !`${v.origen_ciudad ?? ""} ${v.origen_direccion ?? ""}`.toLowerCase().includes(filtros.origen.toLowerCase())) return false;
      if (filtros.destino && !`${v.destino_ciudad ?? ""} ${v.destino_direccion ?? ""}`.toLowerCase().includes(filtros.destino.toLowerCase())) return false;
      if (filtros.incidencia && !v.tiene_incidencia_abierta && Number(v.incidencias_abiertas ?? 0) === 0) return false;
      if (filtros.sinAsignacion && v.estado !== "pendiente_de_conductor") return false;
      if (filtros.sinCoordenadas && !sinCoordenadas(v)) return false;
      if (filtros.proximos && !iniciaEn60Min(extendido.fecha_hora_programada)) return false;
      if (filtros.fecha !== "todos" && !coincideFecha(v.creado_en, filtros.fecha)) return false;
      if (filtros.sla !== "todos" && !coincideSla(v, filtros.sla)) return false;
      return true;
    });
  }, [busqueda, filtros, trazabilidadPorTraslado, trasladosPorKpi]);

  const chips = useMemo(() => {
    const activos: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (busqueda.trim()) activos.push({ id: "q", label: `Búsqueda: ${busqueda.trim()}`, onRemove: () => setBusqueda("") });
    if (filtros.estado !== "todos") activos.push({ id: "estado", label: `Estado: ${PESTANAS.find((item) => item.filtro === filtros.estado)?.etiqueta ?? filtros.estado}`, onRemove: () => actualizarEstadoFiltro("todos", setFiltros, setPestana) });
    if (filtros.sla !== "todos") activos.push({ id: "sla", label: `SLA: ${filtros.sla === "en_riesgo" ? "En riesgo" : "Vencido"}`, onRemove: () => setFiltros((actual) => ({ ...actual, sla: "todos" })) });
    if (filtros.fecha !== "todos") activos.push({ id: "fecha", label: `Fecha: ${filtros.fecha === "hoy" ? "Hoy" : filtros.fecha === "7d" ? "Últimos 7 días" : "Últimos 30 días"}`, onRemove: () => setFiltros((actual) => ({ ...actual, fecha: "todos" })) });
    if (filtros.empresa) activos.push({ id: "empresa", label: `Empresa: ${opcionesFiltros.empresas.find(([id]) => id === filtros.empresa)?.[1] ?? filtros.empresa.slice(0, 8).toUpperCase()}`, onRemove: () => setFiltros((actual) => ({ ...actual, empresa: "" })) });
    if (filtros.conductor) activos.push({ id: "conductor", label: `Conductor: ${filtros.conductor}`, onRemove: () => setFiltros((actual) => ({ ...actual, conductor: "" })) });
    if (filtros.vehiculo) activos.push({ id: "vehiculo", label: `Vehículo: ${ETIQUETA_TIPO_VEHICULO[filtros.vehiculo as keyof typeof ETIQUETA_TIPO_VEHICULO] ?? filtros.vehiculo}`, onRemove: () => setFiltros((actual) => ({ ...actual, vehiculo: "" })) });
    if (filtros.origen) activos.push({ id: "origen", label: `Origen: ${filtros.origen}`, onRemove: () => setFiltros((actual) => ({ ...actual, origen: "" })) });
    if (filtros.destino) activos.push({ id: "destino", label: `Destino: ${filtros.destino}`, onRemove: () => setFiltros((actual) => ({ ...actual, destino: "" })) });
    if (filtros.incidencia) activos.push({ id: "incidencia", label: "Con incidencia", onRemove: () => setFiltros((actual) => ({ ...actual, incidencia: false })) });
    if (filtros.sinAsignacion) activos.push({ id: "sinAsignacion", label: "Sin asignación", onRemove: () => setFiltros((actual) => ({ ...actual, sinAsignacion: false })) });
    if (filtros.sinCoordenadas) activos.push({ id: "sinCoordenadas", label: "Sin coordenadas", onRemove: () => setFiltros((actual) => ({ ...actual, sinCoordenadas: false })) });
    if (filtros.proximos) activos.push({ id: "proximos", label: "Próximos a iniciar", onRemove: () => setFiltros((actual) => ({ ...actual, proximos: false })) });
    return activos;
  }, [busqueda, filtros, opcionesFiltros.empresas]);

  const trasladosSeleccionados = useMemo(
    () => trasladosFiltrados.filter((traslado) => seleccionados.has(idTrasladoOperativo(traslado))),
    [seleccionados, trasladosFiltrados]
  );

  const trasladoDetalle = useMemo(
    () => traslados.find((traslado) => traslado.traslado_id === detalleAbiertoId) ?? null,
    [detalleAbiertoId, traslados]
  );

  const vistasDisponibles = useMemo<VistaGuardada[]>(() => {
    const predefinidas = VISTAS_PREDEFINIDAS.map((vista) => ({
      ...vista,
      alcance: "compartida" as const,
      columnas: COLUMNAS_OPERATIVAS_INICIALES,
      orden: vista.id === "riesgo" ? { columnId: "sla", direction: "desc" } as AdminDataTableSortState : ordenTabla,
      esPredeterminada: false
    }));
    return [...predefinidas, ...vistasGuardadas];
  }, [ordenTabla, vistasGuardadas]);

  const columnasTraslados = useMemo<AdminDataTableColumn<PasaporteRow>[]>(() => [
    {
      id: "folio",
      header: "Folio",
      sortValue: (v) => v.traslado_id ?? "",
      cell: (v) => v.traslado_id ? (
        <Link href={`/viajes/${v.traslado_id}`} className="font-mono-ruum text-admin-tabla text-status-info hover:underline">
          {v.traslado_id.slice(0, 8).toUpperCase()}
        </Link>
      ) : <span className="text-text-tertiary">Sin folio</span>
    },
    {
      id: "inicio_programado",
      header: "Inicio programado",
      sortValue: (v) => obtenerInicioProgramado(v) ?? "",
      cell: (v) => <FechaOperativa fechaIso={obtenerInicioProgramado(v)} />
    },
    {
      id: "ruta",
      header: "Ruta",
      sortValue: (v) => textoRuta(v),
      cell: (v) => {
        const trazabilidad = v.traslado_id ? trazabilidadPorTraslado.get(v.traslado_id) : null;
        return (
          <div className="grid min-w-56 gap-1">
            <span className="font-body text-sm font-semibold text-ink">{v.origen_ciudad ?? v.origen_direccion ?? "Origen sin dato"}</span>
            <span className="font-body text-xs text-text-secondary">a {v.destino_ciudad ?? v.destino_direccion ?? "Destino sin dato"}</span>
            {trazabilidad && (
              <span className="w-fit rounded-full border border-route-dark/25 bg-route-soft px-2.5 py-1 font-body text-xs font-semibold text-route-dark">
                Masivo · {trazabilidad.fila.referencia_externa ?? trazabilidad.carga.nombre_archivo}
              </span>
            )}
          </div>
        );
      }
    },
    {
      id: "vehiculo",
      header: "Vehículo",
      sortValue: (v) => `${v.vehiculo_marca ?? ""} ${v.vehiculo_modelo ?? ""} ${v.vehiculo_placas ?? ""}`,
      cell: (v) => <VehiculoOperativo traslado={v} />
    },
    {
      id: "conductor",
      header: "Conductor",
      sortValue: (v) => v.conductor_nombre ?? "",
      cell: (v) => v.conductor_nombre ?? <span className="font-body text-sm font-semibold text-status-warning">Sin asignar</span>
    },
    {
      id: "sla",
      header: "SLA",
      sortValue: (v) => estadoSla(v).prioridad,
      cell: (v) => <SlaOperativo traslado={v} />
    },
    {
      id: "estatus",
      header: "Estado",
      sortValue: (v) => v.estado ?? "",
      cell: (v) => <EstadoOperativo estado={v.estado} />
    },
    {
      id: "incidencia",
      header: "Incidencia",
      sortValue: (v) => Number(v.incidencias_abiertas ?? 0),
      cell: (v) => <IncidenciaOperativa traslado={v} />
    },
    {
      id: "ultima_actualizacion",
      header: "Última actualización",
      sortValue: (v) => obtenerUltimaActualizacion(v) ?? "",
      cell: (v) => <FechaOperativa fechaIso={obtenerUltimaActualizacion(v)} compacta />
    },
    {
      id: "responsable",
      header: "Responsable",
      sortValue: (v) => responsableOperativo(v),
      cell: (v) => <span className="font-body text-sm font-semibold text-text-secondary">{responsableOperativo(v)}</span>
    }
  ], [trazabilidadPorTraslado]);

  function abrirAccionMasiva(accion: AccionMasivaConfig) {
    setAccionMasiva(accion);
    setEstadoAccionMasiva("pendiente");
    setResultadosAccionMasiva([]);
    setConfirmacionMasiva(false);
  }

  async function ejecutarAccionMasiva() {
    if (!accionMasiva || trasladosSeleccionados.length === 0) return;
    const resultados = construirResultadosAccionMasiva(accionMasiva.id, trasladosSeleccionados, {
      responsable: responsableMasivo,
      prioridad: prioridadMasiva,
      etiqueta: etiquetaMasiva
    });
    if (accionMasiva.id === "exportar") descargarArchivo("ruum-traslados-seleccion.csv", "text/csv", exportarTrasladosCsv(trasladosSeleccionados));
    if (accionMasiva.id === "descargar_evidencia") descargarArchivo("ruum-evidencia-seleccion.json", "application/json", JSON.stringify(exportarEvidencia(trasladosSeleccionados), null, 2));
    await registrarAuditoriaMasiva(accionMasiva, resultados);
    setResultadosAccionMasiva(resultados);
    setEstadoAccionMasiva(resolverEstadoAccion(resultados));
  }

  async function registrarAuditoriaMasiva(accion: AccionMasivaConfig, resultados: ResultadoAccionMasiva[]) {
    const entrada: AuditoriaOperacionMasiva = {
      id: `${Date.now()}-${accion.id}`,
      accion: accion.etiqueta,
      afectados: resultados.length,
      exitosos: resultados.filter((resultado) => resultado.estado === "aplicado").length,
      omitidos: resultados.filter((resultado) => resultado.estado === "omitido").length,
      bloqueados: resultados.filter((resultado) => resultado.estado === "bloqueado").length,
      timestamp: new Date().toISOString(),
      detalle: resultados.map((resultado) => `${resultado.folio}: ${resultado.detalle}`).join(" | "),
      folios: resultados.map((resultado) => resultado.folio)
    };
    setAuditoriaMasiva((actual) => [entrada, ...actual].slice(0, 20));
    if (!tieneSupabaseConfigurado() || esDemo) return;
    try {
      const cliente = crearClienteNavegador();
      const admin = await obtenerAdminActual(cliente);
      if (!admin?.id) return;
      await Promise.all(resultados.map((resultado) => registrarEvento(cliente, "modificacion_traslado_activo", "admin", admin.id, {
        traslado_id: resultado.trasladoId,
        accion_masiva: accion.id,
        resultado: resultado.estado,
        detalle: resultado.detalle,
        folio: resultado.folio
      })));
    } catch {
      setAuditoriaMasiva((actual) => [{
        ...entrada,
        id: `${entrada.id}-local`,
        detalle: `${entrada.detalle} | Auditoría remota no disponible; registro local conservado.`
      }, ...actual].slice(0, 20));
    }
  }

  function guardarVistaActual(esPredeterminada = false) {
    const nombre = nombreVista.trim() || `Vista ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
    const vista: VistaGuardada = {
      id: `${Date.now()}-${nombre.toLowerCase().replace(/\s+/g, "-")}`,
      nombre,
      alcance: alcanceVista,
      filtros,
      busqueda,
      columnas: Array.from(columnasVisibles),
      orden: ordenTabla,
      esPredeterminada
    };
    setVistasGuardadas((actual) => [
      vista,
      ...actual.map((item) => esPredeterminada ? { ...item, esPredeterminada: false } : item)
    ]);
    setNombreVista("");
  }

  function aplicarVista(vista: VistaGuardada) {
    setFiltros(vista.filtros);
    setBusqueda(vista.busqueda);
    setColumnasVisibles(new Set(vista.columnas));
    setOrdenTabla(vista.orden);
    const pestana = PESTANAS.find((item) => item.filtro === vista.filtros.estado);
    setPestana(pestana?.id ?? "todos");
  }

  function establecerPredeterminada(vistaId: string) {
    setVistasGuardadas((actual) => actual.map((vista) => ({ ...vista, esPredeterminada: vista.id === vistaId })));
  }

  function abrirDetalleRapido(traslado: PasaporteRow) {
    if (!traslado.traslado_id) return;
    setDetalleAbiertoId(traslado.traslado_id);
  }

  function cerrarDetalleRapido() {
    setDetalleAbiertoId(null);
    window.setTimeout(() => focoAntesDetalleRef.current?.focus(), 0);
  }

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Operación"
        titulo={accionOperativa ? ETIQUETA_ACCION_OPERATIVA[accionOperativa] : filtroKpi ? ETIQUETA_FILTRO_KPI[filtroKpi] : "Traslados"}
        descripcion={accionOperativa ? "Selecciona el traslado operativo correspondiente." : filtroKpi ? "Vista filtrada desde indicadores accionables del dashboard." : "Bandeja operativa para revisar folios, conductor asignado, monto autorizado y estado actual."}
        estadoConexion={estadoConexion}
        ultimaActualizacion={ultimaRespuestaExitosa}
        tipoDatos="administrativos"
        seccionesDesactualizadas={seccionesDesactualizadas}
        contadorResultados={trasladosFiltrados.length}
        accion={(
          <button
            type="button"
            onClick={() => void cargar(true)}
            disabled={actualizandoManual}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/20 bg-surface-primary px-4 py-2 font-body text-admin-boton font-semibold text-text-secondary transition-colors hover:border-signal/50 hover:text-ink disabled:cursor-wait disabled:opacity-70"
          >
            {actualizandoManual ? "Reconectando" : "Actualizar"}
          </button>
        )}
      />

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no traslados reales.</Aviso>
        </div>
      )}

      <div className="mt-6 flex gap-1 border-b border-ink/10">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setPestana(p.id);
              setFiltros((actual) => ({ ...actual, estado: p.filtro }));
            }}
            className={[
              "px-4 py-2.5 font-body text-sm font-medium transition-colors",
              pestana === p.id ? "border-b-2 border-signal text-ink" : "text-text-secondary hover:text-ink"
            ].join(" ")}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {filtroKpi && (
        <AdminFiltroActivo
          etiqueta={ETIQUETA_FILTRO_KPI[filtroKpi]}
          onLimpiar={() => {
            setFiltroKpi(null);
            setAccionOperativa(null);
            limpiarParamsFiltroUrl();
          }}
        />
      )}

      {accionOperativa && (
        <div className="mt-4 rounded-lg border border-signal/35 bg-signal-soft px-4 py-3">
          <p className="font-body text-sm font-semibold text-ink">{ETIQUETA_ACCION_OPERATIVA[accionOperativa]}</p>
          <p className="mt-1 font-body text-xs text-text-secondary">
            {accionOperativa === "asignar_conductor"
              ? "Abre el folio sin conductor y usa el bloque de asignación del pasaporte."
              : "Abre el folio activo y registra la incidencia desde su seguimiento operativo."}
          </p>
        </div>
      )}

      <section className="mt-4 rounded-card border border-border-default bg-surface-primary p-4" aria-label="Filtros avanzados de traslados">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CampoFiltro etiqueta="Buscar">
            <input
              id="buscar-traslados"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Folio, vehículo, placa..."
              className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm text-ink placeholder:text-text-tertiary"
            />
          </CampoFiltro>
          <CampoFiltro etiqueta="Estado">
            <select value={filtros.estado} onChange={(e) => actualizarEstadoFiltro(e.target.value as EstadoTraslado | "todos", setFiltros, setPestana)} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm">
              {PESTANAS.map((item) => <option key={item.id} value={item.filtro}>{item.etiqueta}</option>)}
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="SLA">
            <select value={filtros.sla} onChange={(e) => setFiltros((actual) => ({ ...actual, sla: e.target.value as FiltroSla }))} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm">
              <option value="todos">Todos</option>
              <option value="en_riesgo">En riesgo</option>
              <option value="vencido">Vencido</option>
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="Fecha">
            <select value={filtros.fecha} onChange={(e) => setFiltros((actual) => ({ ...actual, fecha: e.target.value as FiltroFecha }))} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm">
              <option value="todos">Todas</option>
              <option value="hoy">Hoy</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="Empresa">
            <select value={filtros.empresa} onChange={(e) => setFiltros((actual) => ({ ...actual, empresa: e.target.value }))} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm">
              <option value="">Todas</option>
              {opcionesFiltros.empresas.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="Conductor">
            <select value={filtros.conductor} onChange={(e) => setFiltros((actual) => ({ ...actual, conductor: e.target.value }))} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm">
              <option value="">Todos</option>
              {opcionesFiltros.conductores.map((nombre) => <option key={nombre} value={nombre}>{nombre}</option>)}
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="Tipo de vehículo">
            <select value={filtros.vehiculo} onChange={(e) => setFiltros((actual) => ({ ...actual, vehiculo: e.target.value }))} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm">
              <option value="">Todos</option>
              {opcionesFiltros.vehiculos.map((tipo) => <option key={tipo} value={tipo}>{ETIQUETA_TIPO_VEHICULO[tipo as keyof typeof ETIQUETA_TIPO_VEHICULO] ?? tipo}</option>)}
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="Origen">
            <input value={filtros.origen} onChange={(e) => setFiltros((actual) => ({ ...actual, origen: e.target.value }))} placeholder="Ciudad o dirección" className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" />
          </CampoFiltro>
          <CampoFiltro etiqueta="Destino">
            <input value={filtros.destino} onChange={(e) => setFiltros((actual) => ({ ...actual, destino: e.target.value }))} placeholder="Ciudad o dirección" className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" />
          </CampoFiltro>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <FiltroToggle activo={filtros.incidencia} onClick={() => setFiltros((actual) => ({ ...actual, incidencia: !actual.incidencia }))}>Con incidencia</FiltroToggle>
          <FiltroToggle activo={filtros.sinAsignacion} onClick={() => setFiltros((actual) => ({ ...actual, sinAsignacion: !actual.sinAsignacion }))}>Sin asignación</FiltroToggle>
          <FiltroToggle activo={filtros.sinCoordenadas} onClick={() => setFiltros((actual) => ({ ...actual, sinCoordenadas: !actual.sinCoordenadas }))}>Sin coordenadas</FiltroToggle>
          <FiltroToggle activo={filtros.proximos} onClick={() => setFiltros((actual) => ({ ...actual, proximos: !actual.proximos }))}>Próximos a iniciar</FiltroToggle>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(window.location.href)}
            className="rounded-full border border-status-info/30 px-3 py-1.5 font-body text-sm font-semibold text-status-info hover:bg-status-info-soft"
          >
            Copiar enlace
          </button>
          {(chips.length > 0 || filtroKpi || accionOperativa) && (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                setFiltroKpi(null);
                setAccionOperativa(null);
                setPestana("todos");
                setFiltros(FILTROS_INICIALES);
              }}
              className="rounded-full border border-ink/20 px-3 py-1.5 font-body text-sm font-semibold text-text-secondary hover:border-status-error/40 hover:text-status-error"
            >
              Limpiar todos
            </button>
          )}
        </div>

        {(chips.length > 0 || filtroKpi || accionOperativa) && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Filtros activos">
            {filtroKpi && <ChipFiltro etiqueta={`Indicador: ${ETIQUETA_FILTRO_KPI[filtroKpi]}`} onRemove={() => setFiltroKpi(null)} />}
            {accionOperativa && <ChipFiltro etiqueta={`Acción: ${ETIQUETA_ACCION_OPERATIVA[accionOperativa]}`} onRemove={() => setAccionOperativa(null)} />}
            {chips.map((chip) => <ChipFiltro key={chip.id} etiqueta={chip.label} onRemove={chip.onRemove} />)}
          </div>
        )}
      </section>

      <section className="mt-4 rounded-card border border-border-default bg-surface-primary p-4" aria-label="Vistas guardadas de traslados">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-body text-admin-secundario font-semibold uppercase tracking-wide text-text-tertiary">Vistas guardadas</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-ink">Filtros, columnas y orden</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={nombreVista}
              onChange={(event) => setNombreVista(event.target.value)}
              placeholder="Nombre de la vista"
              className="min-h-10 rounded-lg border border-ink/20 bg-surface-primary px-3 font-body text-sm"
            />
            <select value={alcanceVista} onChange={(event) => setAlcanceVista(event.target.value as AlcanceVistaGuardada)} className="min-h-10 rounded-lg border border-ink/20 bg-surface-primary px-3 font-body text-sm">
              <option value="privada">Privada</option>
              <option value="compartida">Compartida</option>
            </select>
            <button type="button" onClick={() => guardarVistaActual(false)} className="rounded-lg border border-signal/40 px-3 py-2 font-body text-sm font-semibold text-ink hover:bg-signal-soft">
              Guardar vista
            </button>
            <button type="button" onClick={() => guardarVistaActual(true)} className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm font-semibold text-text-secondary hover:border-signal/40">
              Guardar como predeterminada
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {vistasDisponibles.map((vista) => (
            <span key={vista.id} className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-surface-secondary px-3 py-1.5">
              <button type="button" onClick={() => aplicarVista(vista)} className="font-body text-sm font-semibold text-text-secondary hover:text-ink">
                {vista.nombre}
              </button>
              <span className="font-body text-xs text-text-tertiary">{vista.alcance}{vista.esPredeterminada ? " · predeterminada" : ""}</span>
              {!VISTAS_PREDEFINIDAS.some((predefinida) => predefinida.id === vista.id) && (
                <button type="button" onClick={() => establecerPredeterminada(vista.id)} className="font-body text-xs font-semibold text-status-info hover:underline">
                  Pred.
                </button>
              )}
            </span>
          ))}
        </div>
      </section>

      <AdminDataTable
        caption="Lista de traslados operativos"
        rows={trasladosFiltrados}
        columns={columnasTraslados}
        getRowId={(v) => v.traslado_id ?? `sin-folio-${v.creado_en ?? ""}-${v.vehiculo_modelo ?? ""}`}
        loading={cargando}
        emptyMessage={busqueda.trim() ? "No encontramos traslados con esa búsqueda." : "No hay traslados en esta vista."}
        partialError={seccionesDesactualizadas.length > 0 ? `Error parcial: ${seccionesDesactualizadas.join(", ")}.` : null}
        selectedIds={seleccionados}
        onSelectionChange={setSeleccionados}
        sortState={ordenTabla}
        onSortChange={setOrdenTabla}
        visibleColumnIds={columnasVisibles}
        onVisibleColumnIdsChange={setColumnasVisibles}
        rowActions={[
          { label: "Vista rápida", onClick: abrirDetalleRapido },
          { label: "Abrir", href: (v) => v.traslado_id ? `/viajes/${v.traslado_id}` : "/viajes" },
          { label: "Asignar", href: (v) => v.traslado_id ? `/viajes/${v.traslado_id}#asignar-conductor` : "/viajes?filtro=sin_asignacion" }
        ]}
        bulkActions={ACCIONES_MASIVAS.map((accion) => ({
          label: accion.etiqueta,
          destructive: accion.destructiva,
          requiresConfirmation: accion.requiereConfirmacion,
          onClick: () => abrirAccionMasiva(accion)
        }))}
      />

      {auditoriaMasiva.length > 0 && (
        <section className="mt-4 rounded-card border border-border-default bg-surface-primary p-4" aria-label="Auditoría de acciones masivas">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-body text-admin-secundario font-semibold uppercase tracking-wide text-text-tertiary">Auditoría operativa</p>
              <h2 className="mt-1 font-display text-lg font-semibold text-ink">Últimas acciones masivas</h2>
            </div>
            <span className="font-body text-sm text-text-tertiary">{auditoriaMasiva.length} registros</span>
          </div>
          <div className="mt-3 grid gap-2">
            {auditoriaMasiva.slice(0, 5).map((evento) => (
              <div key={evento.id} className="rounded-lg border border-ink/10 bg-surface-secondary p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-body text-sm font-semibold text-ink">{evento.accion}</p>
                  <span className="font-body text-xs text-text-tertiary">{formatoFechaAbsoluta(evento.timestamp)}</span>
                </div>
                <p className="mt-1 font-body text-xs text-text-secondary">
                  {evento.afectados} afectados · {evento.exitosos} aplicados · {evento.omitidos} omitidos · {evento.bloqueados} bloqueados
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {accionMasiva && (
        <AccionMasivaDialog
          accion={accionMasiva}
          total={trasladosSeleccionados.length}
          estado={estadoAccionMasiva}
          resultados={resultadosAccionMasiva}
          confirmacion={confirmacionMasiva}
          onConfirmacionChange={setConfirmacionMasiva}
          responsable={responsableMasivo}
          onResponsableChange={setResponsableMasivo}
          prioridad={prioridadMasiva}
          onPrioridadChange={setPrioridadMasiva}
          etiqueta={etiquetaMasiva}
          onEtiquetaChange={setEtiquetaMasiva}
          onCerrar={() => setAccionMasiva(null)}
          onEjecutar={() => void ejecutarAccionMasiva()}
        />
      )}

      {trasladoDetalle && (
        <DetalleRapidoTraslado
          traslado={trasladoDetalle}
          trazabilidad={trasladoDetalle.traslado_id ? trazabilidadPorTraslado.get(trasladoDetalle.traslado_id) ?? null : null}
          botonCerrarRef={botonCerrarDetalleRef}
          onCerrar={cerrarDetalleRapido}
          onAsignar={() => {
            cerrarDetalleRapido();
            window.location.href = trasladoDetalle.traslado_id ? `/viajes/${trasladoDetalle.traslado_id}#asignar-conductor` : "/viajes?filtro=sin_asignacion";
          }}
        />
      )}
    </main>
  );
}

function esFiltroKpi(valor: string | null): valor is FiltroKpi {
  return valor === "activos" ||
    valor === "inician_60" ||
    valor === "sin_asignacion" ||
    valor === "incidencia" ||
    valor === "finalizados_hoy";
}

function esAccionOperativa(valor: string | null): valor is AccionOperativa {
  return valor === "asignar_conductor" || valor === "registrar_incidencia";
}

function esEstadoTraslado(valor: string | null): valor is EstadoTraslado {
  return PESTANAS.some((item) => item.filtro === valor && valor !== "todos");
}

function esFiltroSla(valor: string | null): valor is FiltroSla {
  return valor === "todos" || valor === "en_riesgo" || valor === "vencido";
}

function esFiltroFecha(valor: string | null): valor is FiltroFecha {
  return valor === "todos" || valor === "hoy" || valor === "7d" || valor === "30d";
}

function actualizarEstadoFiltro(
  estado: EstadoTraslado | "todos",
  setFiltros: Dispatch<SetStateAction<FiltrosAvanzados>>,
  setPestana: Dispatch<SetStateAction<string>>
) {
  setFiltros((actual) => ({ ...actual, estado }));
  const pestana = PESTANAS.find((item) => item.filtro === estado);
  setPestana(pestana?.id ?? "todos");
}

function horasDesdeIso(fechaIso: string | null | undefined) {
  if (!fechaIso) return 0;
  return Math.max(0, (Date.now() - new Date(fechaIso).getTime()) / 36e5);
}

function coincideSla(v: PasaporteRow, filtro: FiltroSla) {
  const horas = horasDesdeIso(v.creado_en);
  const riesgo = v.estado === "pendiente_de_conductor" || Boolean(v.tiene_incidencia_abierta) || Number(v.incidencias_abiertas ?? 0) > 0 || horas >= 12;
  if (filtro === "en_riesgo") return riesgo;
  return riesgo && horas >= 24;
}

function coincideFecha(fechaIso: string | null, filtro: FiltroFecha) {
  if (!fechaIso) return false;
  const fecha = new Date(fechaIso).getTime();
  const ahora = Date.now();
  if (filtro === "hoy") {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    return fecha >= inicio.getTime();
  }
  if (filtro === "7d") return fecha >= ahora - 7 * 24 * 60 * 60 * 1000;
  if (filtro === "30d") return fecha >= ahora - 30 * 24 * 60 * 60 * 1000;
  return true;
}

function sinCoordenadas(v: PasaporteRow) {
  return v.origen_lat == null || v.origen_lng == null || v.destino_lat == null || v.destino_lng == null;
}

function iniciaEn60Min(fechaIso: string | null | undefined) {
  if (!fechaIso) return false;
  const fecha = new Date(fechaIso).getTime();
  const ahora = Date.now();
  return fecha >= ahora && fecha <= ahora + 60 * 60 * 1000;
}

function obtenerInicioProgramado(v: PasaporteRow) {
  const operativo = v as PasaporteOperativo;
  return operativo.fecha_hora_programada ?? v.creado_en;
}

function obtenerUltimaActualizacion(v: PasaporteRow) {
  const operativo = v as PasaporteOperativo;
  return operativo.actualizado_en ?? v.creado_en;
}

function textoRuta(v: PasaporteRow) {
  return `${v.origen_ciudad ?? v.origen_direccion ?? ""} ${v.destino_ciudad ?? v.destino_direccion ?? ""}`;
}

function formatoFechaAbsoluta(fechaIso: string | null | undefined) {
  if (!fechaIso) return "Sin fecha";
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return "Fecha inválida";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(fecha);
}

function textoRelativo(fechaIso: string | null | undefined) {
  if (!fechaIso) return null;
  const fecha = new Date(fechaIso).getTime();
  if (Number.isNaN(fecha)) return null;
  const minutos = Math.round((fecha - Date.now()) / 60000);
  const absoluto = Math.abs(minutos);
  const prefijo = minutos >= 0 ? "En" : "Hace";
  if (absoluto < 1) return "Ahora";
  if (absoluto < 60) return `${prefijo} ${absoluto} min`;
  const horas = Math.round(absoluto / 60);
  if (horas < 36) return `${prefijo} ${horas} h`;
  return `${prefijo} ${Math.round(horas / 24)} d`;
}

function estadoSla(v: PasaporteRow) {
  const horas = horasDesdeIso(obtenerUltimaActualizacion(v));
  const vencido = coincideSla(v, "vencido");
  const riesgo = coincideSla(v, "en_riesgo");
  if (vencido) {
    return {
      etiqueta: "Vencido",
      detalle: horas >= 1 ? `${Math.round(horas)} h sin resolver` : "Atención inmediata",
      prioridad: 3,
      clases: "border-status-error/35 bg-status-error-soft text-status-error",
      icono: "!"
    };
  }
  if (riesgo) {
    return {
      etiqueta: "En riesgo",
      detalle: iniciaEn60Min(obtenerInicioProgramado(v)) ? "Inicia en 60 min" : "Revisar operación",
      prioridad: 2,
      clases: "border-status-warning/35 bg-status-warning-soft text-status-warning",
      icono: "!"
    };
  }
  return {
    etiqueta: "En tiempo",
    detalle: "Sin alerta crítica",
    prioridad: 1,
    clases: "border-status-success/30 bg-status-success-soft text-status-success",
    icono: "OK"
  };
}

function responsableOperativo(v: PasaporteRow) {
  if (Boolean(v.tiene_incidencia_abierta) || Number(v.incidencias_abiertas ?? 0) > 0) return "Incidencias";
  if (!v.conductor_nombre) return "Asignación";
  if (sinCoordenadas(v)) return "Monitoreo";
  if (coincideSla(v, "vencido") || coincideSla(v, "en_riesgo")) return "Supervisor";
  return "Torre de control";
}

function FechaOperativa({ fechaIso, compacta = false }: { fechaIso: string | null | undefined; compacta?: boolean }) {
  const relativo = textoRelativo(fechaIso);
  return (
    <span className="grid min-w-36 gap-0.5">
      <span className="font-body text-sm font-semibold text-ink">{formatoFechaAbsoluta(fechaIso)}</span>
      {!compacta || relativo ? <span className="font-body text-xs text-text-tertiary">{relativo ?? "Sin referencia relativa"}</span> : null}
    </span>
  );
}

function VehiculoOperativo({ traslado }: { traslado: PasaporteRow }) {
  const tipo = traslado.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[traslado.vehiculo_tipo] : null;
  const nombre = [traslado.vehiculo_marca, traslado.vehiculo_modelo].filter(Boolean).join(" ");
  return (
    <span className="grid min-w-40 gap-0.5">
      <span className="font-body text-sm font-semibold text-ink">{nombre || "Vehículo sin dato"}</span>
      <span className="font-body text-xs text-text-secondary">{tipo ?? "Tipo no definido"}{traslado.vehiculo_placas ? ` · ${traslado.vehiculo_placas}` : ""}</span>
    </span>
  );
}

function SlaOperativo({ traslado }: { traslado: PasaporteRow }) {
  const sla = estadoSla(traslado);
  return (
    <span className={`inline-flex min-w-32 items-center gap-2 rounded-full border px-2.5 py-1 font-body text-xs font-semibold ${sla.clases}`}>
      <span aria-hidden="true" className="font-mono-ruum">{sla.icono}</span>
      <span className="grid leading-tight">
        <span>{sla.etiqueta}</span>
        <span className="font-normal opacity-80">{sla.detalle}</span>
      </span>
    </span>
  );
}

function EstadoOperativo({ estado }: { estado: EstadoTraslado | null }) {
  if (!estado) return <span className="text-text-tertiary">Sin estado</span>;
  const critico = estado === "pendiente_de_conductor" || estado === "incidencia_reportada" || estado === "traslado_fallido" || estado === "servicio_cancelado";
  return (
    <span className={critico ? "inline-flex items-center gap-2 rounded-full border border-status-error/30 bg-status-error-soft px-2 py-1 text-status-error" : "inline-flex items-center gap-2"}>
      {critico && <span aria-hidden="true" className="font-mono-ruum text-xs font-bold">!</span>}
      <EstadoBadge estado={estado} />
    </span>
  );
}

function IncidenciaOperativa({ traslado }: { traslado: PasaporteRow }) {
  const abiertas = Number(traslado.incidencias_abiertas ?? 0);
  const tieneIncidencia = Boolean(traslado.tiene_incidencia_abierta) || abiertas > 0;
  if (!tieneIncidencia) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-status-success/30 bg-status-success-soft px-2.5 py-1 font-body text-xs font-semibold text-status-success">
        <span aria-hidden="true" className="font-mono-ruum">OK</span>
        Sin incidencia
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-status-error/35 bg-status-error-soft px-2.5 py-1 font-body text-xs font-semibold text-status-error">
      <span aria-hidden="true" className="font-mono-ruum">!</span>
      {abiertas > 1 ? `${abiertas} abiertas` : "Abierta"}
    </span>
  );
}

function AccionMasivaDialog({
  accion,
  total,
  estado,
  resultados,
  confirmacion,
  onConfirmacionChange,
  responsable,
  onResponsableChange,
  prioridad,
  onPrioridadChange,
  etiqueta,
  onEtiquetaChange,
  onCerrar,
  onEjecutar
}: {
  accion: AccionMasivaConfig;
  total: number;
  estado: EstadoAccionMasiva;
  resultados: ResultadoAccionMasiva[];
  confirmacion: boolean;
  onConfirmacionChange: (value: boolean) => void;
  responsable: string;
  onResponsableChange: (value: string) => void;
  prioridad: PrioridadOperativa;
  onPrioridadChange: (value: PrioridadOperativa) => void;
  etiqueta: string;
  onEtiquetaChange: (value: string) => void;
  onCerrar: () => void;
  onEjecutar: () => void;
}) {
  const requiereConfirmacion = Boolean(accion.requiereConfirmacion || accion.destructiva);
  const puedeEjecutar = total > 0 && (!requiereConfirmacion || confirmacion);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/35 p-4" role="dialog" aria-modal="true" aria-labelledby="accion-masiva-titulo">
      <section className="w-full max-w-2xl rounded-card border border-border-default bg-surface-primary shadow-[var(--ruum-shadow-2)]">
        <div className="border-b border-ink/10 p-4">
          <p className="font-body text-admin-secundario font-semibold uppercase tracking-wide text-text-tertiary">Acción masiva</p>
          <h2 id="accion-masiva-titulo" className="mt-1 font-display text-xl font-semibold text-ink">{accion.etiqueta}</h2>
          <p className="mt-1 font-body text-sm text-text-secondary">{accion.descripcion}</p>
        </div>
        <div className="grid gap-4 p-4">
          <Aviso tono={accion.destructiva ? "atencion" : "info"}>
            Esta operación afectará {total.toLocaleString("es-MX")} registro{total === 1 ? "" : "s"}. Los resultados parciales se reportarán por folio y quedarán en auditoría.
          </Aviso>
          {accion.id === "asignar_responsable" && (
            <CampoFiltro etiqueta="Responsable">
              <select value={responsable} onChange={(event) => onResponsableChange(event.target.value)} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm">
                <option>Asignación</option>
                <option>Supervisor</option>
                <option>Incidencias</option>
                <option>Monitoreo</option>
                <option>Compliance</option>
              </select>
            </CampoFiltro>
          )}
          {accion.id === "cambiar_prioridad" && (
            <CampoFiltro etiqueta="Prioridad">
              <select value={prioridad} onChange={(event) => onPrioridadChange(event.target.value as PrioridadOperativa)} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm">
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </CampoFiltro>
          )}
          {accion.id === "etiquetar" && (
            <CampoFiltro etiqueta="Etiqueta">
              <input value={etiqueta} onChange={(event) => onEtiquetaChange(event.target.value)} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" />
            </CampoFiltro>
          )}
          {requiereConfirmacion && (
            <label className="flex items-start gap-3 rounded-lg border border-status-warning/25 bg-status-warning-soft p-3 font-body text-sm text-status-warning">
              <input type="checkbox" checked={confirmacion} onChange={(event) => onConfirmacionChange(event.target.checked)} className="mt-1" />
              Confirmo que revisé la selección y entiendo que la operación puede cambiar la prioridad operativa o escalar atención.
            </label>
          )}
          {resultados.length > 0 && (
            <div className="max-h-72 overflow-auto rounded-lg border border-ink/10">
              <div className="border-b border-ink/10 bg-surface-secondary px-3 py-2 font-body text-sm font-semibold text-ink">
                Resultado {estado}: {resultados.filter((item) => item.estado === "aplicado").length} aplicados, {resultados.filter((item) => item.estado === "omitido").length} omitidos, {resultados.filter((item) => item.estado === "bloqueado").length} bloqueados
              </div>
              {resultados.map((resultado) => (
                <div key={`${resultado.trasladoId}-${resultado.detalle}`} className="grid gap-1 border-b border-ink/10 px-3 py-2 last:border-b-0">
                  <span className="font-mono-ruum text-xs font-semibold text-ink">{resultado.folio}</span>
                  <span className={resultado.estado === "aplicado" ? "font-body text-sm text-status-success" : resultado.estado === "bloqueado" ? "font-body text-sm text-status-error" : "font-body text-sm text-status-warning"}>
                    {resultado.estado}: {resultado.detalle}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-ink/10 p-4">
          <button type="button" onClick={onCerrar} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-semibold text-text-secondary">Cerrar</button>
          <button type="button" disabled={!puedeEjecutar} onClick={onEjecutar} className="rounded-lg border border-signal/40 bg-signal px-4 py-2 font-body text-sm font-semibold text-ink disabled:opacity-50">
            Ejecutar
          </button>
        </div>
      </section>
    </div>
  );
}

function DetalleRapidoTraslado({
  traslado,
  trazabilidad,
  botonCerrarRef,
  onCerrar,
  onAsignar
}: {
  traslado: PasaporteRow;
  trazabilidad: TrazabilidadMasivaTraslado | null;
  botonCerrarRef: RefObject<HTMLButtonElement | null>;
  onCerrar: () => void;
  onAsignar: () => void;
}) {
  const sla = estadoSla(traslado);
  const folio = folioCorto(traslado);
  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-border-default bg-surface-primary shadow-[var(--ruum-shadow-2)]" role="dialog" aria-modal="true" aria-labelledby="detalle-rapido-titulo">
      <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-5">
        <div>
          <p className="font-body text-admin-secundario font-semibold uppercase tracking-wide text-text-tertiary">Detalle rápido</p>
          <h2 id="detalle-rapido-titulo" className="mt-1 font-display text-xl font-semibold text-ink">{folio}</h2>
          <p className="mt-1 font-body text-sm text-text-secondary">Revisión sin abandonar el listado</p>
        </div>
        <button ref={botonCerrarRef} type="button" onClick={onCerrar} className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm font-semibold text-text-secondary">
          Cerrar
        </button>
      </div>
      <div className="grid flex-1 gap-4 overflow-auto p-5">
        <DetalleSeccion titulo="Resumen">
          <DatoRapido etiqueta="Folio" valor={folio} />
          <DatoRapido etiqueta="Inicio" valor={formatoFechaAbsoluta(obtenerInicioProgramado(traslado))} />
          <DatoRapido etiqueta="Última actualización" valor={formatoFechaAbsoluta(obtenerUltimaActualizacion(traslado))} />
        </DetalleSeccion>
        <DetalleSeccion titulo="Estado y SLA">
          <EstadoOperativo estado={traslado.estado} />
          <span className={`mt-2 inline-flex w-fit rounded-full border px-3 py-1 font-body text-sm font-semibold ${sla.clases}`}>{sla.icono} {sla.etiqueta} · {sla.detalle}</span>
        </DetalleSeccion>
        <DetalleSeccion titulo="Conductor">
          <DatoRapido etiqueta="Asignado" valor={traslado.conductor_nombre ?? "Sin conductor"} />
          <DatoRapido etiqueta="Responsable" valor={responsableOperativo(traslado)} />
        </DetalleSeccion>
        <DetalleSeccion titulo="Vehículo">
          <DatoRapido etiqueta="Unidad" valor={[traslado.vehiculo_marca, traslado.vehiculo_modelo].filter(Boolean).join(" ") || "Sin dato"} />
          <DatoRapido etiqueta="Tipo" valor={traslado.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[traslado.vehiculo_tipo] : "Sin tipo"} />
          <DatoRapido etiqueta="Placas" valor={traslado.vehiculo_placas ?? "Sin placas"} />
        </DetalleSeccion>
        <DetalleSeccion titulo="Ruta">
          <DatoRapido etiqueta="Origen" valor={traslado.origen_direccion ?? traslado.origen_ciudad ?? "Sin origen"} />
          <DatoRapido etiqueta="Destino" valor={traslado.destino_direccion ?? traslado.destino_ciudad ?? "Sin destino"} />
          <DatoRapido etiqueta="Última ubicación" valor={sinCoordenadas(traslado) ? "Sin coordenadas completas" : `${traslado.origen_lat}, ${traslado.origen_lng}`} />
        </DetalleSeccion>
        <DetalleSeccion titulo="Incidencias y evidencia">
          <DatoRapido etiqueta="Incidencias" valor={Number(traslado.incidencias_abiertas ?? 0) > 0 || traslado.tiene_incidencia_abierta ? `${traslado.incidencias_abiertas ?? 1} abiertas` : "Sin incidencia abierta"} />
          <DatoRapido etiqueta="Evidencia" valor={sinCoordenadas(traslado) ? "Ubicación pendiente" : "Ubicación disponible"} />
        </DetalleSeccion>
        <DetalleSeccion titulo="Historial reciente">
          <DatoRapido etiqueta="Creación" valor={formatoFechaAbsoluta(traslado.creado_en)} />
          <DatoRapido etiqueta="Lote" valor={trazabilidad?.carga.nombre_archivo ?? "Individual"} />
          <DatoRapido etiqueta="Referencia" valor={trazabilidad?.fila.referencia_externa ?? "Sin referencia externa"} />
        </DetalleSeccion>
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-ink/10 p-5">
        <button type="button" onClick={onAsignar} className="rounded-lg border border-signal/40 bg-signal px-4 py-2 font-body text-sm font-semibold text-ink">
          Asignar conductor
        </button>
        <Link href={traslado.traslado_id ? `/viajes/${traslado.traslado_id}` : "/viajes"} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-semibold text-text-secondary">
          Expediente completo
        </Link>
      </div>
    </aside>
  );
}

function DetalleSeccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-ink/10 bg-surface-secondary p-4">
      <h3 className="font-body text-sm font-semibold uppercase tracking-wide text-text-tertiary">{titulo}</h3>
      <div className="mt-3 grid gap-2">{children}</div>
    </section>
  );
}

function DatoRapido({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">{etiqueta}</dt>
      <dd className="font-body text-sm text-ink">{valor}</dd>
    </div>
  );
}

function CampoFiltro({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 font-body text-sm text-text-secondary">
      <span className="font-body text-admin-secundario font-semibold uppercase tracking-wide text-text-tertiary">{etiqueta}</span>
      {children}
    </label>
  );
}

function FiltroToggle({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 font-body text-sm font-semibold ${activo ? "border-signal bg-signal text-ink" : "border-ink/20 bg-surface-primary text-text-secondary hover:border-signal/40"}`}
    >
      {children}
    </button>
  );
}

function ChipFiltro({ etiqueta, onRemove }: { etiqueta: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-surface-secondary px-3 py-1.5 font-body text-sm text-text-secondary">
      {etiqueta}
      <button type="button" onClick={onRemove} className="font-bold text-text-tertiary hover:text-status-error" aria-label={`Quitar filtro ${etiqueta}`}>
        ×
      </button>
    </span>
  );
}

function idTrasladoOperativo(v: PasaporteRow) {
  return v.traslado_id ?? `sin-folio-${v.creado_en ?? ""}-${v.vehiculo_modelo ?? ""}`;
}

function folioCorto(v: PasaporteRow) {
  return v.traslado_id ? v.traslado_id.slice(0, 8).toUpperCase() : "SIN FOLIO";
}

function construirResultadosAccionMasiva(
  accion: AccionMasivaId,
  traslados: PasaporteRow[],
  opciones: { responsable: string; prioridad: PrioridadOperativa; etiqueta: string }
): ResultadoAccionMasiva[] {
  return traslados.map((traslado) => {
    const trasladoId = idTrasladoOperativo(traslado);
    const folio = folioCorto(traslado);
    if (!traslado.traslado_id) {
      return { trasladoId, folio, estado: "bloqueado", detalle: "No hay identificador persistente para auditar la operación." };
    }
    if (accion === "asignar_responsable") {
      return { trasladoId, folio, estado: "aplicado", detalle: `Responsable asignado: ${opciones.responsable}.` };
    }
    if (accion === "cambiar_prioridad") {
      return { trasladoId, folio, estado: "aplicado", detalle: `Prioridad marcada como ${opciones.prioridad}.` };
    }
    if (accion === "escalar") {
      return { trasladoId, folio, estado: "aplicado", detalle: "Escalado a supervisión operativa." };
    }
    if (accion === "exportar") {
      return { trasladoId, folio, estado: "aplicado", detalle: "Incluido en exportación CSV." };
    }
    if (accion === "etiquetar") {
      return opciones.etiqueta.trim()
        ? { trasladoId, folio, estado: "aplicado", detalle: `Etiqueta aplicada: ${opciones.etiqueta.trim()}.` }
        : { trasladoId, folio, estado: "omitido", detalle: "Etiqueta vacía; no se aplicó cambio." };
    }
    if (accion === "descargar_evidencia") {
      return sinCoordenadas(traslado) && !traslado.tiene_incidencia_abierta
        ? { trasladoId, folio, estado: "omitido", detalle: "Sin evidencia operativa disponible en la bandeja." }
        : { trasladoId, folio, estado: "aplicado", detalle: "Incluido en manifiesto de evidencia." };
    }
    const seguro = traslado.estado === "solicitud_creada" || traslado.estado === "servicio_confirmado" || traslado.estado === "pendiente_de_conductor";
    if (!traslado.estado || !seguro || ESTADOS_TERMINALES.includes(traslado.estado)) {
      return { trasladoId, folio, estado: "bloqueado", detalle: `Estado ${traslado.estado ?? "sin estado"} no permite actualización masiva segura.` };
    }
    return { trasladoId, folio, estado: "aplicado", detalle: "Actualización preparada para revisión segura; no se mutó estado directo desde frontend." };
  });
}

function resolverEstadoAccion(resultados: ResultadoAccionMasiva[]): EstadoAccionMasiva {
  if (resultados.length === 0) return "bloqueado";
  const aplicados = resultados.filter((resultado) => resultado.estado === "aplicado").length;
  const bloqueados = resultados.filter((resultado) => resultado.estado === "bloqueado").length;
  if (aplicados === resultados.length) return "exitoso";
  if (bloqueados === resultados.length) return "bloqueado";
  return "parcial";
}

function exportarTrasladosCsv(traslados: PasaporteRow[]) {
  const encabezado = ["folio", "inicio_programado", "ruta", "vehiculo", "conductor", "sla", "estado", "incidencia", "ultima_actualizacion", "responsable"];
  const filas = traslados.map((traslado) => [
    folioCorto(traslado),
    formatoFechaAbsoluta(obtenerInicioProgramado(traslado)),
    textoRuta(traslado),
    [traslado.vehiculo_marca, traslado.vehiculo_modelo, traslado.vehiculo_placas].filter(Boolean).join(" "),
    traslado.conductor_nombre ?? "Sin asignar",
    estadoSla(traslado).etiqueta,
    traslado.estado ?? "Sin estado",
    traslado.tiene_incidencia_abierta ? "Con incidencia" : "Sin incidencia",
    formatoFechaAbsoluta(obtenerUltimaActualizacion(traslado)),
    responsableOperativo(traslado)
  ]);
  return [encabezado, ...filas].map((fila) => fila.map(valorCsv).join(",")).join("\n");
}

function exportarEvidencia(traslados: PasaporteRow[]) {
  return traslados.map((traslado) => ({
    folio: folioCorto(traslado),
    traslado_id: traslado.traslado_id,
    incidencia_abierta: Boolean(traslado.tiene_incidencia_abierta) || Number(traslado.incidencias_abiertas ?? 0) > 0,
    coordenadas_origen: traslado.origen_lat != null && traslado.origen_lng != null ? { lat: traslado.origen_lat, lng: traslado.origen_lng } : null,
    coordenadas_destino: traslado.destino_lat != null && traslado.destino_lng != null ? { lat: traslado.destino_lat, lng: traslado.destino_lng } : null,
    ultima_actualizacion: obtenerUltimaActualizacion(traslado)
  }));
}

function valorCsv(valor: string | number | null | undefined) {
  return `"${String(valor ?? "").replaceAll("\"", "\"\"")}"`;
}

function descargarArchivo(nombre: string, tipo: string, contenido: string) {
  const blob = new Blob([contenido], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
