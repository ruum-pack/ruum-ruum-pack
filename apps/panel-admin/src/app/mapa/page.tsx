"use client";

/**
 * PRD §10.3 — Mapa operativo. Muestra todos los traslados activos con pin
 * de origen (azul trazabilidad) y pin de destino (amarillo ruta), línea punteada de
 * ruta calculada, y panel lateral de selección. Usa Mapbox GL JS y Directions.
 *
 * Nota: la ubicación en tiempo real del conductor no está disponible hasta
 * que se implemente el GPS continuo (Foreground Service nativo, PRD §15).
 * Por ahora se muestra el pin de origen registrado en el traslado.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import Link from "next/link";
import { Aviso, EstadoBadge } from "@ruum/ui";
import { listarTrasladosActivosMapa, type TrasladoMapa } from "@ruum/api/services";
import { obtenerRutaMapbox } from "../../lib/mapbox-rutas";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

const TRASLADOS_MAPA_DEMO: TrasladoMapa[] = [
  {
    traslado_id: "demo-mapa-001",
    estado: "traslado_en_curso",
    conductor_nombre: "Conductor Demo A",
    vehiculo_marca: "Mazda",
    vehiculo_modelo: "3",
    tiene_incidencia_abierta: false,
    origen_lat: 19.4326, origen_lng: -99.1332, origen_ciudad: "CDMX",
    destino_lat: 20.6597, destino_lng: -103.3496, destino_ciudad: "Guadalajara",
    actualizado_en: new Date(Date.now() - 1000 * 60 * 45).toISOString()
  },
  {
    traslado_id: "demo-mapa-002",
    estado: "conductor_en_camino_al_origen",
    conductor_nombre: "Conductor Demo B",
    vehiculo_marca: "Toyota",
    vehiculo_modelo: "Corolla",
    tiene_incidencia_abierta: false,
    origen_lat: 25.6866, origen_lng: -100.3161, origen_ciudad: "Monterrey",
    destino_lat: 19.4326, destino_lng: -99.1332, destino_ciudad: "CDMX",
    actualizado_en: new Date(Date.now() - 1000 * 60 * 10).toISOString()
  },
  {
    traslado_id: "demo-mapa-003",
    estado: "traslado_en_curso",
    conductor_nombre: "Conductor Demo C",
    vehiculo_marca: "BMW",
    vehiculo_modelo: "Serie 3",
    tiene_incidencia_abierta: true,
    origen_lat: 21.1619, origen_lng: -86.8515, origen_ciudad: "Cancún",
    destino_lat: 20.9674, destino_lng: -89.6237, destino_ciudad: "Mérida",
    actualizado_en: new Date(Date.now() - 1000 * 60 * 90).toISOString()
  },
  {
    traslado_id: "demo-mapa-004",
    estado: "evidencia_inicial_completada",
    conductor_nombre: "Conductor Demo D",
    vehiculo_marca: "Nissan",
    vehiculo_modelo: "Frontier",
    tiene_incidencia_abierta: false,
    origen_lat: 29.0729, origen_lng: -110.9559, origen_ciudad: "Hermosillo",
    destino_lat: 32.5027, destino_lng: -117.0036, destino_ciudad: "Tijuana",
    actualizado_en: new Date(Date.now() - 1000 * 60 * 20).toISOString()
  }
];

const ETIQUETA_ESTADO: Partial<Record<string, string>> = {
  conductor_asignado: "Conductor asignado",
  conductor_en_camino_al_origen: "En camino al origen",
  conductor_en_punto_de_recoleccion: "En punto de recolección",
  verificacion_vehiculo_en_proceso: "Verificando vehículo",
  evidencia_inicial_en_proceso: "Capturando evidencia inicial",
  evidencia_inicial_completada: "Evidencia inicial completa",
  vehiculo_recibido: "Vehículo recibido",
  traslado_en_curso: "En ruta",
  incidencia_reportada: "Incidencia reportada",
  llegada_a_destino: "Llegó al destino",
  evidencia_final_en_proceso: "Capturando evidencia final",
  evidencia_final_completada: "Evidencia final completa",
  entrega_confirmada: "Entrega confirmada",
  pago_pendiente: "Pago pendiente",
  pago_completado: "Pago completado"
};

type EstadoConexionMapa = "datos_en_vivo" | "actualizando" | "reconectando" | "sin_conexion" | "desactualizado" | "demo";
type VistaMapaMovil = "mapa" | "lista" | "alertas";
type FiltroMapa = "todos" | "en_ruta" | "incidencias" | "sin_coordenadas" | "sin_senal" | "ubicacion_antigua";
type SimboloMapa = "origen" | "destino" | "vehiculo" | "incidencia" | "emergencia" | "sin_senal";
type EstadoSenalMapa = "confirmada" | "estimada" | "antigua" | "sin_senal" | "sin_ubicacion";
type CategoriaPrioridadMapa = "emergencia" | "incidencia_critica" | "sla_vencido" | "sin_senal" | "desviacion" | "en_riesgo" | "normal";

function tiempoRelativo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h`;
}

const tokenMapbox = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const estiloMapbox = process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL || "mapbox://styles/mapbox/streets-v12";
const UMBRAL_UBICACION_ANTIGUA_MIN = 30;
const UMBRAL_SIN_SENAL_MIN = 60;
const ORDEN_PRIORIDAD_MAPA: CategoriaPrioridadMapa[] = ["emergencia", "incidencia_critica", "sla_vencido", "sin_senal", "desviacion", "en_riesgo", "normal"];
const ETIQUETA_PRIORIDAD_MAPA: Record<CategoriaPrioridadMapa, string> = {
  emergencia: "Emergencia",
  incidencia_critica: "Incidencia crítica",
  sla_vencido: "SLA vencido",
  sin_senal: "Sin señal",
  desviacion: "Desviación",
  en_riesgo: "En riesgo",
  normal: "Operación normal"
};
const DESCRIPCION_PRIORIDAD_MAPA: Record<CategoriaPrioridadMapa, string> = {
  emergencia: "Incidencia abierta en estado de emergencia operativa.",
  incidencia_critica: "Traslado con incidencia abierta.",
  sla_vencido: "Reservado para el SLA operativo cuando el backend lo exponga.",
  sin_senal: "Última ubicación supera el umbral de señal.",
  desviacion: "Reservado para detección de desvío de ruta.",
  en_riesgo: "Ubicación antigua o punto estimado desactualizado.",
  normal: "Traslados sin alerta prioritaria."
};
const COLOR_MAPA = {
  origen: "var(--ruum-status-info)",
  destino: "var(--ruum-action-primary)",
  incidencia: "var(--ruum-status-error)",
  emergencia: "var(--ruum-status-error)",
  vehiculo: "var(--ruum-status-success)",
  sinSenal: "var(--ruum-status-warning)",
  pinBordeClaro: "var(--ruum-text-main)",
  pinBordeOscuro: "var(--ruum-surface-strong)",
  pinSombra: "var(--ruum-shadow-2)"
} as const;

function obtenerColoresMapa() {
  const estilos = window.getComputedStyle(document.documentElement);
  const leer = (token: string) => estilos.getPropertyValue(token).trim();
  return {
    origen: leer("--ruum-status-info"),
    destino: leer("--ruum-action-primary"),
    incidencia: leer("--ruum-status-error"),
    emergencia: leer("--ruum-status-error"),
    vehiculo: leer("--ruum-status-success"),
    sinSenal: leer("--ruum-status-warning"),
    pinBordeClaro: leer("--ruum-text-main"),
    pinBordeOscuro: leer("--ruum-surface-strong")
  };
}

function crearPin(simbolo: SimboloMapa, color: string, borde: string, etiqueta: string): HTMLButtonElement {
  const pin = document.createElement("button");
  const figura = document.createElement("span");
  pin.type = "button";
  pin.setAttribute("aria-label", etiqueta);
  pin.setAttribute("title", etiqueta);
  Object.assign(pin.style, {
    width: "44px",
    height: "44px",
    border: "0",
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0"
  });
  Object.assign(figura.style, {
    width: "24px",
    height: "24px",
    color,
    background: "var(--ruum-surface-primary)",
    border: `3px solid ${simbolo === "sin_senal" ? color : borde}`,
    boxShadow: COLOR_MAPA.pinSombra,
    pointerEvents: "none",
    display: "grid",
    placeItems: "center",
    fontSize: "13px",
    fontWeight: "800",
    lineHeight: "1"
  });
  aplicarSimboloMapa(figura, simbolo, color);
  pin.appendChild(figura);
  return pin;
}

function aplicarSimboloMapa(figura: HTMLSpanElement, simbolo: SimboloMapa, color: string) {
  if (simbolo === "origen") {
    Object.assign(figura.style, { borderRadius: "9999px", background: color });
    figura.textContent = "";
    return;
  }
  if (simbolo === "destino") {
    Object.assign(figura.style, { borderRadius: "4px", borderColor: color });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("width", "18"); svg.setAttribute("height", "18");
    const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", "M7 21V4h9l-1.4 3L16 10H7"); path.setAttribute("fill", "none"); path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", "2.2"); path.setAttribute("stroke-linejoin", "round"); svg.appendChild(path); figura.replaceChildren(svg);
    return;
  }
  if (simbolo === "vehiculo") {
    Object.assign(figura.style, { borderRadius: "9999px", borderColor: color });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("width", "18"); svg.setAttribute("height", "18");
    const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", "M5 12l7-7 7 7h-4v7H9v-7H5z"); path.setAttribute("fill", "currentColor"); svg.appendChild(path); figura.replaceChildren(svg);
    return;
  }
  if (simbolo === "incidencia") {
    Object.assign(figura.style, {
      width: "0",
      height: "0",
      background: "transparent",
      borderLeft: "14px solid transparent",
      borderRight: "14px solid transparent",
      borderBottom: `25px solid ${color}`,
      borderTop: "0",
      boxShadow: COLOR_MAPA.pinSombra
    });
    figura.textContent = "";
    return;
  }
  if (simbolo === "emergencia") {
    Object.assign(figura.style, { borderRadius: "9999px", borderColor: color, color });
    figura.textContent = "!";
    return;
  }
  Object.assign(figura.style, { borderRadius: "9999px", borderStyle: "dashed", borderColor: color, color });
  figura.textContent = "";
}

export default function PaginaMapaOperativo() {
  const [traslados, setTraslados] = useState<TrasladoMapa[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [estadoConexionGps, setEstadoConexionGps] = useState<EstadoConexionMapa>("actualizando");
  const [ultimaRespuestaExitosa, setUltimaRespuestaExitosa] = useState<Date | null>(null);
  const [seccionesDesactualizadas, setSeccionesDesactualizadas] = useState<string[]>([]);
  const [actualizandoManual, setActualizandoManual] = useState(false);
  const [ahora, setAhora] = useState<Date | null>(null);
  const [vistaMovil, setVistaMovil] = useState<VistaMapaMovil>("mapa");
  const [filtroMapa, setFiltroMapa] = useState<FiltroMapa>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [detalleColapsado, setDetalleColapsado] = useState(false);
  const [ordenPrioridad, setOrdenPrioridad] = useState<CategoriaPrioridadMapa[]>(ORDEN_PRIORIDAD_MAPA);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapboxMap | null>(null);
  const marcadoresRef = useRef<MapboxMarker[]>([]);
  const focoPrevioPanelRef = useRef<HTMLElement | null>(null);
  const [errorMapa, setErrorMapa] = useState<string | null>(null);

  const seleccionarTraslado = useCallback((trasladoId: string) => {
    focoPrevioPanelRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSeleccionado(trasladoId);
  }, []);

  const cerrarPanelSeleccionado = useCallback(() => {
    setSeleccionado(null);
    window.requestAnimationFrame(() => focoPrevioPanelRef.current?.focus());
  }, []);

  function moverPrioridad(categoria: CategoriaPrioridadMapa, direccion: -1 | 1) {
    setOrdenPrioridad((actual) => {
      const indice = actual.indexOf(categoria);
      const siguienteIndice = indice + direccion;
      if (indice < 0 || siguienteIndice < 0 || siguienteIndice >= actual.length) return actual;
      const copia = [...actual];
      const [item] = copia.splice(indice, 1);
      copia.splice(siguienteIndice, 0, item!);
      return copia;
    });
  }

  function restablecerPrioridad() {
    setOrdenPrioridad(ORDEN_PRIORIDAD_MAPA);
  }

  useEffect(() => {
    if (!seleccionado) return;
    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") cerrarPanelSeleccionado();
    }
    document.addEventListener("keydown", cerrarConEscape);
    return () => document.removeEventListener("keydown", cerrarConEscape);
  }, [seleccionado, cerrarPanelSeleccionado]);

  async function cargar(esRefresco = false) {
      if (!esRefresco) setCargando(true);
      if (esRefresco) {
        setActualizandoManual(true);
        setEstadoConexionGps(ultimaRespuestaExitosa ? "reconectando" : "actualizando");
      }
      if (!tieneSupabaseConfigurado()) {
        setTraslados(TRASLADOS_MAPA_DEMO);
        setEsDemo(true);
        setEstadoConexionGps("demo");
        setUltimaRespuestaExitosa(new Date());
        setSeccionesDesactualizadas([]);
        setCargando(false);
        setActualizandoManual(false);
        return;
      }
      try {
        const cliente = crearClienteNavegador();
        setTraslados(await listarTrasladosActivosMapa(cliente));
        setEsDemo(false);
        setEstadoConexionGps("datos_en_vivo");
        setUltimaRespuestaExitosa(new Date());
        setSeccionesDesactualizadas([]);
      } catch {
        const teniaRespuesta = Boolean(ultimaRespuestaExitosa);
        if (puedeUsarDatosDemo()) {
          setTraslados(TRASLADOS_MAPA_DEMO);
          setEsDemo(true);
          setEstadoConexionGps(teniaRespuesta ? "desactualizado" : "sin_conexion");
          setSeccionesDesactualizadas(["datos GPS del mapa", "traslados activos"]);
        } else {
          setTraslados([]);
          setEsDemo(false);
          setEstadoConexionGps(teniaRespuesta ? "desactualizado" : "sin_conexion");
          setSeccionesDesactualizadas(["datos GPS del mapa", "traslados activos"]);
        }
      } finally {
        setCargando(false);
        setActualizandoManual(false);
      }
  }

  useEffect(() => {
    void cargar();
  }, []);

  useEffect(() => {
    setAhora(new Date());
    const intervalo = window.setInterval(() => setAhora(new Date()), 30000);
    return () => window.clearInterval(intervalo);
  }, []);

  const trasladosVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return traslados
      .filter((t) => {
        const calidad = calidadUbicacion(t, ahora);
        if (filtroMapa === "en_ruta" && t.estado !== "traslado_en_curso") return false;
        if (filtroMapa === "incidencias" && !t.tiene_incidencia_abierta) return false;
        if (filtroMapa === "sin_coordenadas" && !trasladoSinCoordenadas(t)) return false;
        if (filtroMapa === "sin_senal" && calidad.estadoSenal !== "sin_senal") return false;
        if (filtroMapa === "ubicacion_antigua" && calidad.estadoSenal !== "antigua" && calidad.estadoSenal !== "sin_senal") return false;
        if (!q) return true;
        return [
          t.traslado_id,
          t.conductor_nombre,
          t.vehiculo_marca,
          t.vehiculo_modelo,
          t.origen_ciudad,
          t.destino_ciudad,
          ETIQUETA_ESTADO[t.estado] ?? t.estado
        ].join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => compararPrioridadMapa(a, b, ordenPrioridad, ahora));
  }, [ahora, busqueda, filtroMapa, ordenPrioridad, traslados]);

  useEffect(() => {
    if (vistaMovil === "mapa") window.setTimeout(() => mapaRef.current?.resize(), 0);
  }, [vistaMovil]);

  useEffect(() => {
    if (!seleccionado) return;
    document.getElementById(`mapa-lista-${seleccionado}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const traslado = traslados.find((t) => t.traslado_id === seleccionado);
    if (!traslado || trasladoSinCoordenadas(traslado)) return;
    const centro = puntoMedio([traslado.origen_lng!, traslado.origen_lat!], [traslado.destino_lng!, traslado.destino_lat!]);
    mapaRef.current?.flyTo({ center: centro, zoom: Math.max(mapaRef.current.getZoom(), 7), duration: 650, essential: true });
  }, [seleccionado, traslados]);

  useEffect(() => {
    if (cargando || !mapRef.current || trasladosVisibles.length === 0) return;
    if (mapaRef.current) return;

    let cancelado = false;
    void (async () => {
      if (!tokenMapbox) {
        setErrorMapa("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN no está configurado.");
        return;
      }
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        mapboxgl.accessToken = tokenMapbox;
        const mapa = new mapboxgl.Map({ container: mapRef.current!, style: estiloMapbox, center: [-100, 22.5], zoom: 4.2 });
        mapa.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
        mapaRef.current = mapa;
        mapa.on("error", (evento) => setErrorMapa(evento.error?.message ?? "No se pudo cargar el mapa."));
        await new Promise<void>((resolve) => mapa.once("load", () => resolve()));
        if (cancelado) return;
        const coloresMapa = obtenerColoresMapa();

        const bounds = new mapboxgl.LngLatBounds();
        const completos = trasladosVisibles.filter((t) => !trasladoSinCoordenadas(t));
        await Promise.all(completos.map(async (t, indice) => {
          const origen: [number, number] = [t.origen_lng!, t.origen_lat!];
          const destino: [number, number] = [t.destino_lng!, t.destino_lat!];
          const emergencia = esEmergenciaMapa(t);
          const calidad = calidadUbicacion(t, ahora);
          const sinSenal = calidad.estadoSenal === "sin_senal";
          const ubicacionAntigua = calidad.estadoSenal === "antigua";
          const color = t.tiene_incidencia_abierta ? coloresMapa.incidencia : coloresMapa.origen;
          const { geometry: geometria } = await obtenerRutaMapbox(origen, destino);
          if (cancelado) return;
          const sourceId = `ruta-${indice}`;
          mapa.addSource(sourceId, { type: "geojson", data: { type: "Feature", properties: {}, geometry: geometria } });
          mapa.addLayer({ id: sourceId, type: "line", source: sourceId, paint: { "line-color": color, "line-width": 3, "line-opacity": .65 } });

          const etiquetaTraslado = `${t.vehiculo_marca ?? "Vehículo"} ${t.vehiculo_modelo ?? ""}`.trim();
          const origenEl = crearPin("origen", coloresMapa.origen, coloresMapa.pinBordeClaro, `Origen de ${etiquetaTraslado}: ${t.origen_ciudad}. Seleccionar traslado.`);
          origenEl.onclick = () => seleccionarTraslado(t.traslado_id);
          const origenMarker = new mapboxgl.Marker({ element: origenEl }).setLngLat(origen)
            .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(`${t.vehiculo_marca ?? ""} ${t.vehiculo_modelo ?? ""} → ${t.destino_ciudad}`)).addTo(mapa);
          const destinoEl = crearPin("destino", coloresMapa.destino, coloresMapa.pinBordeOscuro, `Destino de ${etiquetaTraslado}: ${t.destino_ciudad}. Seleccionar traslado.`);
          destinoEl.onclick = () => seleccionarTraslado(t.traslado_id);
          const destinoMarker = new mapboxgl.Marker({ element: destinoEl }).setLngLat(destino)
            .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(`Destino: ${t.destino_ciudad}`)).addTo(mapa);
          const puntoVehiculo = puntoMedio(origen, destino);
          const vehiculoEl = crearPin(
            sinSenal ? "sin_senal" : "vehiculo",
            sinSenal || ubicacionAntigua ? coloresMapa.sinSenal : coloresMapa.vehiculo,
            coloresMapa.pinBordeClaro,
            `${calidad.estadoTexto} de ${etiquetaTraslado}. ${calidad.tiempoTexto}. Punto ${calidad.tipoPunto}. Seleccionar traslado.`
          );
          vehiculoEl.onclick = () => seleccionarTraslado(t.traslado_id);
          const vehiculoMarker = new mapboxgl.Marker({ element: vehiculoEl }).setLngLat(puntoVehiculo)
            .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(`${calidad.estadoTexto}: ${etiquetaTraslado}. ${calidad.tiempoTexto}`)).addTo(mapa);
          marcadoresRef.current.push(origenMarker, destinoMarker, vehiculoMarker);
          if (t.tiene_incidencia_abierta) {
            const incidenciaEl = crearPin("incidencia", coloresMapa.incidencia, coloresMapa.pinBordeClaro, `Incidencia abierta en traslado ${etiquetaTraslado}. Seleccionar traslado.`);
            incidenciaEl.onclick = () => seleccionarTraslado(t.traslado_id);
            const incidenciaMarker = new mapboxgl.Marker({ element: incidenciaEl }).setLngLat(puntoConOffset(puntoVehiculo, 0.16))
              .setPopup(new mapboxgl.Popup({ offset: 18 }).setText("Incidencia abierta")).addTo(mapa);
            marcadoresRef.current.push(incidenciaMarker);
          }
          if (emergencia) {
            const emergenciaEl = crearPin("emergencia", coloresMapa.emergencia, coloresMapa.pinBordeClaro, `Emergencia operativa en traslado ${etiquetaTraslado}. Seleccionar traslado.`);
            emergenciaEl.onclick = () => seleccionarTraslado(t.traslado_id);
            const emergenciaMarker = new mapboxgl.Marker({ element: emergenciaEl }).setLngLat(puntoConOffset(puntoVehiculo, -0.16))
              .setPopup(new mapboxgl.Popup({ offset: 18 }).setText("Emergencia operativa")).addTo(mapa);
            marcadoresRef.current.push(emergenciaMarker);
          }
          bounds.extend(origen).extend(destino);
        }));
        if (!bounds.isEmpty()) mapa.fitBounds(bounds, { padding: 70, maxZoom: 9, duration: 0 });
      } catch (error) {
        setErrorMapa(error instanceof Error ? error.message : "No se pudo inicializar Mapbox.");
      }
    })();

    return () => {
      cancelado = true;
      marcadoresRef.current.forEach((marcador) => marcador.remove());
      marcadoresRef.current = [];
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
  }, [ahora, cargando, seleccionarTraslado, trasladosVisibles]);

  const sel = traslados.find((t) => t.traslado_id === seleccionado);
  const enRuta = traslados.filter((t) => t.estado === "traslado_en_curso").length;
  const conInc = traslados.filter((t) => t.tiene_incidencia_abierta).length;
  const pendientesGeocodificacion = traslados.filter(trasladoSinCoordenadas).length;
  const sinSenal = traslados.filter((t) => calidadUbicacion(t, ahora).estadoSenal === "sin_senal").length;
  const ubicacionAntigua = traslados.filter((t) => {
    const estado = calidadUbicacion(t, ahora).estadoSenal;
    return estado === "antigua" || estado === "sin_senal";
  }).length;
  const alertasMapa = traslados.filter((t) => t.tiene_incidencia_abierta || trasladoSinCoordenadas(t) || calidadUbicacion(t, ahora).estadoSenal === "sin_senal" || calidadUbicacion(t, ahora).estadoSenal === "antigua");
  const calidadSeleccionada = sel ? calidadUbicacion(sel, ahora) : null;

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden">
      <div className="flex flex-col gap-4 border-b border-border-default px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Mapa operativo</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="font-mono-ruum text-xs text-text-tertiary">Torre de control · datos GPS y traslados activos</p>
            <span className={`rounded-full border px-2.5 py-1 font-body text-admin-secundario font-semibold ${claseEstadoConexion(estadoConexionGps)}`}>
              {textoEstadoConexionMapa(estadoConexionGps)}
            </span>
            <span className="font-body text-admin-secundario text-text-tertiary">Datos GPS</span>
            {esDemo && <span className="font-body text-admin-secundario text-status-warning">Origen demo</span>}
            {ultimaRespuestaExitosa && (
              <time dateTime={ultimaRespuestaExitosa.toISOString()} className="font-body text-admin-secundario text-text-tertiary">
                {textoActualizadoHace(ultimaRespuestaExitosa, ahora)}
              </time>
            )}
          </div>
          {seccionesDesactualizadas.length > 0 && (
            <p className="mt-2 font-body text-admin-secundario text-status-warning">
              Pueden estar desactualizadas: {seccionesDesactualizadas.join(", ")}.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void cargar(true)}
          disabled={actualizandoManual}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/20 bg-surface-primary px-4 py-2 font-body text-admin-boton font-semibold text-text-secondary transition-colors hover:border-signal/50 hover:text-ink disabled:cursor-wait disabled:opacity-70"
        >
          {actualizandoManual ? "Reconectando" : "Actualizar"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-border-default px-4 py-3 sm:px-6 lg:grid-cols-6">
        <div className="rounded-lg bg-status-info-soft px-3 py-2">
          <p className="font-mono-ruum text-xs text-status-info/70">Activos</p>
          <p className="font-display text-xl font-semibold text-status-info">{traslados.length}</p>
        </div>
        <div className="rounded-lg bg-signal-soft px-3 py-2">
          <p className="font-mono-ruum text-xs text-text-secondary">En ruta</p>
          <p className="font-display text-xl font-semibold text-ink">{enRuta}</p>
        </div>
        <div className={`rounded-lg px-3 py-2 ${conInc > 0 ? "bg-status-error-soft" : "bg-surface-secondary"}`}>
          <p className={`font-mono-ruum text-xs ${conInc > 0 ? "text-status-error/70" : "text-text-tertiary"}`}>Con incidencia</p>
          <p className={`font-display text-xl font-semibold ${conInc > 0 ? "text-status-error" : "text-text-tertiary"}`}>{conInc}</p>
        </div>
        <div className={`rounded-lg px-3 py-2 ${ubicacionAntigua > 0 ? "bg-status-warning-soft" : "bg-surface-secondary"}`}>
          <p className="font-mono-ruum text-xs text-text-secondary">Ubicación antigua</p>
          <p className="font-display text-xl font-semibold text-ink">{ubicacionAntigua}</p>
        </div>
        <div className={`rounded-lg px-3 py-2 ${sinSenal > 0 || pendientesGeocodificacion > 0 ? "bg-status-warning-soft" : "bg-surface-secondary"}`}>
          <p className="font-mono-ruum text-xs text-text-secondary">Sin señal</p>
          <p className="font-display text-xl font-semibold text-ink">{sinSenal + pendientesGeocodificacion}</p>
        </div>
      </div>

      <section className="grid gap-3 border-b border-border-default px-4 py-3 sm:px-6 lg:grid-cols-[minmax(220px,1fr)_auto]" aria-label="Filtros del mapa operativo">
        <div className="flex min-w-0 flex-wrap gap-2">
          {[
            ["todos", "Todos"],
            ["en_ruta", "En ruta"],
            ["incidencias", "Incidencias"],
            ["sin_coordenadas", "Sin coordenadas"],
            ["sin_senal", "Sin señal"],
            ["ubicacion_antigua", "Ubicación antigua"]
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filtroMapa === id}
              onClick={() => setFiltroMapa(id as FiltroMapa)}
              className={`rounded-full border px-3 py-1.5 font-body text-sm font-semibold ${filtroMapa === id ? "border-signal bg-signal text-ink" : "border-ink/20 text-text-secondary hover:border-signal/40"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar conductor, vehículo o ciudad"
          className="min-h-10 w-full rounded-lg border border-ink/20 bg-surface-primary px-3 font-body text-sm text-ink placeholder:text-text-tertiary lg:w-80"
          aria-label="Buscar en mapa operativo"
        />
      </section>

      <section className="border-b border-border-default px-4 py-3 sm:px-6" aria-label="Orden de prioridad del mapa">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono-ruum text-admin-secundario uppercase tracking-widest text-text-tertiary">Orden de prioridad</p>
            <p className="mt-1 font-body text-sm text-text-secondary">
              La lista y el mapa se ordenan con esta jerarquía. Las prioridades se recalculan al cambiar estado, incidencia o calidad de ubicación.
            </p>
          </div>
          <button
            type="button"
            onClick={restablecerPrioridad}
            className="w-fit rounded-lg border border-ink/20 px-3 py-2 font-body text-sm font-semibold text-text-secondary hover:border-signal/40"
          >
            Orden recomendado
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ordenPrioridad.map((categoria, indice) => (
            <div key={categoria} className="flex max-w-full items-center gap-2 rounded-full border border-ink/15 bg-surface-secondary px-3 py-1.5">
              <span className="font-mono-ruum text-admin-secundario text-text-tertiary">{indice + 1}</span>
              <span className="font-body text-sm font-semibold text-ink">{ETIQUETA_PRIORIDAD_MAPA[categoria]}</span>
              <span className="hidden max-w-52 truncate font-body text-xs text-text-tertiary md:inline">{DESCRIPCION_PRIORIDAD_MAPA[categoria]}</span>
              <button
                type="button"
                onClick={() => moverPrioridad(categoria, -1)}
                disabled={indice === 0}
                className="rounded border border-ink/20 px-1.5 font-mono-ruum text-xs text-text-secondary disabled:opacity-40"
                aria-label={`Subir prioridad ${ETIQUETA_PRIORIDAD_MAPA[categoria]}`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moverPrioridad(categoria, 1)}
                disabled={indice === ordenPrioridad.length - 1}
                className="rounded border border-ink/20 px-1.5 font-mono-ruum text-xs text-text-secondary disabled:opacity-40"
                aria-label={`Bajar prioridad ${ETIQUETA_PRIORIDAD_MAPA[categoria]}`}
              >
                ↓
              </button>
            </div>
          ))}
        </div>
      </section>

      <nav className="grid grid-cols-3 border-b border-border-default lg:hidden" aria-label="Vista móvil del mapa operativo">
        {[
          ["mapa", "Mapa"],
          ["lista", "Lista"],
          ["alertas", "Alertas"]
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setVistaMovil(id as VistaMapaMovil)}
            className={`px-3 py-3 font-body text-sm font-semibold ${vistaMovil === id ? "border-b-2 border-signal text-ink" : "text-text-secondary"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(320px,28rem)]">
        <div className={`relative min-h-[54vh] lg:block lg:min-h-0 ${vistaMovil === "mapa" ? "block" : "hidden"}`}>
          {cargando && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-primary/80">
              <p className="font-mono-ruum text-sm text-text-tertiary">Cargando traslados…</p>
            </div>
          )}
          {!cargando && traslados.length === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6">
              <p className="font-display text-lg font-semibold text-text-tertiary">Sin traslados activos</p>
              <p className="max-w-md text-center font-body text-sm text-text-tertiary">No hay traslados en curso con datos GPS disponibles en este momento.</p>
            </div>
          )}
          {errorMapa && (
            <div className="absolute left-4 right-4 top-4 z-10"><Aviso tono="danger">{errorMapa}</Aviso></div>
          )}
          <div ref={mapRef} className="h-full min-h-[54vh] lg:min-h-[520px]" />

          <div className="absolute bottom-4 left-4 z-[400] rounded-xl border border-border-default bg-surface-primary/95 px-4 py-3 backdrop-blur-sm">
            <p className="mb-2 font-mono-ruum text-admin-secundario uppercase tracking-widest text-text-tertiary">Leyenda</p>
            <div className="flex flex-col gap-1.5">
              {[
                ["origen", "Origen"],
                ["destino", "Destino"],
                ["vehiculo", "Vehículo"],
                ["incidencia", "Incidencia"],
                ["emergencia", "Emergencia"],
                ["sin_senal", "Sin señal"]
              ].map(([simbolo, label]) => (
                <div key={label} className="flex items-center gap-2">
                  <SimboloLeyenda simbolo={simbolo as SimboloMapa} />
                  <span className="font-body text-xs text-text-secondary">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${vistaMovil === "lista" ? "flex" : "hidden"} min-w-0 flex-col overflow-y-auto border-l border-border-default lg:flex lg:w-auto lg:min-w-80 lg:max-w-[42rem] lg:resize-x`}>
          {sel && (
            <div className="border-b border-border-default bg-surface-secondary/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono-ruum text-xs uppercase tracking-widest text-text-tertiary">Seleccionado</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetalleColapsado((actual) => !actual)}
                    className="rounded-lg border border-ink/20 px-2.5 py-1.5 font-body text-xs font-semibold text-text-secondary hover:border-signal/40"
                  >
                    {detalleColapsado ? "Expandir" : "Colapsar"}
                  </button>
                  <button
                    type="button"
                    onClick={cerrarPanelSeleccionado}
                    className="rounded-lg border border-ink/20 px-2.5 py-1.5 font-body text-xs font-semibold text-text-secondary hover:border-status-error/40"
                    aria-label="Cerrar detalle del traslado seleccionado"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
              <p className="font-display text-sm font-semibold">{sel.vehiculo_marca} {sel.vehiculo_modelo}</p>
              <p className="font-mono-ruum text-xs text-text-secondary">{sel.origen_ciudad} → {sel.destino_ciudad}</p>
              {!detalleColapsado && (
                <>
                  <div className="mt-2"><EstadoBadge estado={sel.estado} /></div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <DatoMapa etiqueta="Conductor" valor={sel.conductor_nombre ?? "Sin conductor"} />
                    <DatoMapa etiqueta="Tiempo desde actualización" valor={calidadSeleccionada?.tiempoTexto ?? "Sin dato"} />
                    <DatoMapa etiqueta="Origen" valor={sel.origen_ciudad ?? "Sin origen"} />
                    <DatoMapa etiqueta="Destino" valor={sel.destino_ciudad ?? "Sin destino"} />
                    <DatoMapa etiqueta="Última posición" valor={calidadSeleccionada?.ultimaPosicion ?? "Sin posición"} />
                    <DatoMapa etiqueta="Fuente" valor={calidadSeleccionada?.fuente ?? "No reportada"} />
                    <DatoMapa etiqueta="Precisión" valor={calidadSeleccionada?.precision ?? "No reportada"} />
                    <DatoMapa etiqueta="Estado de señal" valor={calidadSeleccionada?.estadoTexto ?? "Sin dato"} />
                    <DatoMapa etiqueta="Punto" valor={calidadSeleccionada?.tipoPunto ?? "No confirmado"} />
                    <DatoMapa etiqueta="Último punto válido" valor={calidadSeleccionada?.ultimoPuntoValido ?? "Sin punto válido"} />
                    <DatoMapa etiqueta="Prioridad" valor={ETIQUETA_PRIORIDAD_MAPA[prioridadMapa(sel, ahora)]} />
                  </div>
                  {sel.tiene_incidencia_abierta && (
                    <div className="mt-2 rounded-lg bg-status-error-soft px-3 py-2">
                      <p className="font-body text-xs text-status-error">Incidencia abierta</p>
                    </div>
                  )}
                  {trasladoSinCoordenadas(sel) && (
                    <div className="mt-2 rounded-lg bg-status-warning-soft px-3 py-2">
                      <p className="font-body text-xs text-status-warning">Coordenadas incompletas</p>
                    </div>
                  )}
                </>
              )}
              <Link
                href={`/viajes/${sel.traslado_id}`}
                className="mt-3 block w-full rounded-lg border border-status-info/30 bg-status-info-soft py-2 text-center font-body text-sm text-status-info transition-colors hover:bg-status-info hover:text-background-main"
              >
                Ver pasaporte
              </Link>
            </div>
          )}

          <div className="p-4">
            <p className="mb-3 font-mono-ruum text-admin-secundario uppercase tracking-widest text-text-tertiary">Todos los activos</p>
            <div className="flex flex-col gap-2">
              {trasladosVisibles.map((t) => {
                const calidad = calidadUbicacion(t, ahora);
                const prioridad = prioridadMapa(t, ahora);
                return (
                  <button
                    id={`mapa-lista-${t.traslado_id}`}
                    key={t.traslado_id}
                    onClick={() => seleccionarTraslado(t.traslado_id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                      seleccionado === t.traslado_id
                        ? "border-status-info bg-status-info-soft"
                        : t.tiene_incidencia_abierta
                        ? "border-status-error/30 bg-status-error-soft hover:border-status-error/60"
                        : calidad.estadoSenal === "antigua" || calidad.estadoSenal === "sin_senal" || calidad.estadoSenal === "sin_ubicacion"
                        ? "border-status-warning/30 bg-status-warning-soft hover:border-status-warning/60"
                        : "border-border-default bg-surface-primary hover:border-status-info/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-sm font-semibold leading-tight">
                          {t.vehiculo_marca} {t.vehiculo_modelo}
                        </p>
                        <p className="font-mono-ruum text-admin-secundario text-text-tertiary">{t.origen_ciudad} → {t.destino_ciudad}</p>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1">
                        <span className={`rounded-full px-2 py-0.5 font-mono-ruum text-admin-secundario ${clasePrioridadMapa(prioridad)}`}>{ETIQUETA_PRIORIDAD_MAPA[prioridad]}</span>
                        {t.tiene_incidencia_abierta && (
                          <span className="rounded-full bg-status-error-soft px-2 py-0.5 font-mono-ruum text-admin-secundario text-status-error">INC</span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 font-mono-ruum text-admin-secundario ${claseCalidadUbicacion(calidad.estadoSenal)}`}>{calidad.estadoCorto}</span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="font-body text-admin-secundario text-text-tertiary">{ETIQUETA_ESTADO[t.estado] ?? t.estado}</p>
                      <p className="font-mono-ruum text-admin-secundario text-text-tertiary">{calidad.tiempoTexto}</p>
                    </div>
                  </button>
                );
              })}
              {trasladosVisibles.length === 0 && !cargando && (
                <p className="py-8 text-center font-body text-sm text-text-tertiary">Sin traslados activos</p>
              )}
            </div>
          </div>
        </div>

        <div className={`${vistaMovil === "alertas" ? "block" : "hidden"} min-w-0 overflow-y-auto p-4 lg:hidden`}>
          <div className="mb-3">
            <p className="font-mono-ruum text-admin-secundario uppercase tracking-widest text-text-tertiary">Alertas</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-ink">Prioridad y confiabilidad GPS</h2>
          </div>
          <div className="grid gap-3">
            {alertasMapa.map((t) => {
              const calidad = calidadUbicacion(t, ahora);
              const alertaGps = trasladoSinCoordenadas(t) || calidad.estadoSenal === "sin_senal" || calidad.estadoSenal === "antigua";
              return (
                <button
                  key={t.traslado_id}
                  type="button"
                  onClick={() => {
                    seleccionarTraslado(t.traslado_id);
                    setVistaMovil("lista");
                  }}
                  className={`rounded-lg border p-3 text-left ${t.tiene_incidencia_abierta ? "border-status-error/30 bg-status-error-soft" : "border-status-warning/30 bg-status-warning-soft"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-body text-sm font-semibold text-ink">{t.vehiculo_marca} {t.vehiculo_modelo}</p>
                    <span className={`rounded-full px-2 py-0.5 font-mono-ruum text-admin-secundario ${t.tiene_incidencia_abierta ? "text-status-error" : "text-status-warning"}`}>
                      {t.tiene_incidencia_abierta ? "INC" : "GPS"}
                    </span>
                  </div>
                  <p className="mt-1 font-body text-xs text-text-secondary">{t.origen_ciudad} → {t.destino_ciudad}</p>
                  <p className="mt-1 font-body text-xs text-text-tertiary">
                    {t.tiene_incidencia_abierta ? "Incidencia abierta" : alertaGps ? `${calidad.estadoTexto}. ${calidad.tiempoTexto}` : "Sin alerta GPS"}
                  </p>
                </button>
              );
            })}
            {alertasMapa.length === 0 && (
              <div className="rounded-lg border border-border-default bg-surface-secondary p-6 text-center">
                <p className="font-body text-sm text-text-secondary">Sin alertas activas del mapa.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border-default px-6 py-2">
        <p className="font-body text-xs text-text-tertiary">
          Las rutas se calculan con Mapbox Directions. El pin de origen marca el punto de recogida, no la posición actual del conductor. La ubicación del vehículo se marca como estimada hasta recibir GPS continuo con fuente y precisión confirmadas.
        </p>
      </div>
    </div>
  );
}

function textoEstadoConexionMapa(estado: EstadoConexionMapa) {
  if (estado === "datos_en_vivo") return "Datos en vivo";
  if (estado === "actualizando") return "Actualizando";
  if (estado === "reconectando") return "Reconectando";
  if (estado === "desactualizado") return "Datos posiblemente desactualizados";
  if (estado === "demo") return "Modo demo";
  return "Sin conexión";
}

function claseEstadoConexion(estado: EstadoConexionMapa) {
  if (estado === "datos_en_vivo") return "border-status-success/30 bg-status-success-soft text-status-success";
  if (estado === "actualizando" || estado === "reconectando") return "border-status-info/30 bg-status-info-soft text-status-info";
  if (estado === "demo" || estado === "desactualizado") return "border-status-warning/35 bg-status-warning-soft text-status-warning";
  return "border-status-error/30 bg-status-error-soft text-status-error";
}

function trasladoSinCoordenadas(traslado: TrasladoMapa) {
  return traslado.origen_lat === null || traslado.origen_lng === null || traslado.destino_lat === null || traslado.destino_lng === null;
}

function trasladoSinSenal(traslado: TrasladoMapa) {
  return calidadUbicacion(traslado, new Date()).estadoSenal === "sin_senal";
}

function calidadUbicacion(traslado: TrasladoMapa, ahora: Date | null) {
  const sinUbicacion = trasladoSinCoordenadas(traslado);
  const minutos = minutosDesdeActualizacion(traslado.actualizado_en, ahora);
  const estadoSenal: EstadoSenalMapa = sinUbicacion
    ? "sin_ubicacion"
    : minutos >= UMBRAL_SIN_SENAL_MIN
    ? "sin_senal"
    : minutos >= UMBRAL_UBICACION_ANTIGUA_MIN
    ? "antigua"
    : "estimada";
  const ultimaPosicion = sinUbicacion ? "Sin última posición completa" : `${traslado.origen_ciudad} a ${traslado.destino_ciudad}`;
  return {
    minutos,
    estadoSenal,
    estadoTexto: etiquetaEstadoSenal(estadoSenal),
    estadoCorto: etiquetaEstadoSenalCorta(estadoSenal),
    tiempoTexto: textoTiempoUbicacion(minutos),
    fuente: sinUbicacion ? "No reportada" : "Ruta operativa",
    precision: sinUbicacion ? "No reportada" : "Estimada por ruta",
    tipoPunto: sinUbicacion ? "No confirmado" : estadoSenal === "estimada" ? "Estimado" : "Estimado desactualizado",
    ultimaPosicion,
    ultimoPuntoValido: sinUbicacion ? "Sin punto válido" : traslado.destino_ciudad || traslado.origen_ciudad || "Ruta registrada"
  };
}

function minutosDesdeActualizacion(iso: string, ahora: Date | null) {
  const referencia = ahora ?? new Date();
  return Math.max(0, Math.floor((referencia.getTime() - new Date(iso).getTime()) / 60000));
}

function textoTiempoUbicacion(minutos: number) {
  if (minutos < 1) return "Actualizada ahora";
  if (minutos < 60) return `Actualizada hace ${minutos} min`;
  return `Actualizada hace ${Math.floor(minutos / 60)} h`;
}

function etiquetaEstadoSenal(estado: EstadoSenalMapa) {
  if (estado === "estimada") return "Ubicación estimada";
  if (estado === "antigua") return "Ubicación antigua";
  if (estado === "sin_senal") return "Sin señal";
  if (estado === "sin_ubicacion") return "Sin ubicación";
  return "Ubicación confirmada";
}

function etiquetaEstadoSenalCorta(estado: EstadoSenalMapa) {
  if (estado === "estimada") return "EST";
  if (estado === "antigua") return "ANT";
  if (estado === "sin_senal") return "SIN";
  if (estado === "sin_ubicacion") return "S/U";
  return "OK";
}

function claseCalidadUbicacion(estado: EstadoSenalMapa) {
  if (estado === "estimada" || estado === "confirmada") return "bg-status-success-soft text-status-success";
  if (estado === "antigua" || estado === "sin_senal") return "bg-status-warning-soft text-status-warning";
  return "bg-status-error-soft text-status-error";
}

function prioridadMapa(traslado: TrasladoMapa, ahora: Date | null): CategoriaPrioridadMapa {
  const calidad = calidadUbicacion(traslado, ahora);
  if (esEmergenciaMapa(traslado)) return "emergencia";
  if (traslado.tiene_incidencia_abierta) return "incidencia_critica";
  if (calidad.estadoSenal === "sin_senal" || calidad.estadoSenal === "sin_ubicacion") return "sin_senal";
  if (calidad.estadoSenal === "antigua") return "en_riesgo";
  return "normal";
}

function compararPrioridadMapa(a: TrasladoMapa, b: TrasladoMapa, orden: CategoriaPrioridadMapa[], ahora: Date | null) {
  const prioridadA = prioridadMapa(a, ahora);
  const prioridadB = prioridadMapa(b, ahora);
  const indiceA = orden.indexOf(prioridadA);
  const indiceB = orden.indexOf(prioridadB);
  if (indiceA !== indiceB) return indiceA - indiceB;
  return new Date(a.actualizado_en).getTime() - new Date(b.actualizado_en).getTime();
}

function clasePrioridadMapa(prioridad: CategoriaPrioridadMapa) {
  if (prioridad === "emergencia" || prioridad === "incidencia_critica") return "bg-status-error-soft text-status-error";
  if (prioridad === "sla_vencido" || prioridad === "sin_senal" || prioridad === "desviacion" || prioridad === "en_riesgo") return "bg-status-warning-soft text-status-warning";
  return "bg-status-success-soft text-status-success";
}

function esEmergenciaMapa(traslado: TrasladoMapa) {
  return traslado.estado === "incidencia_reportada" && traslado.tiene_incidencia_abierta;
}

function puntoMedio(origen: [number, number], destino: [number, number]): [number, number] {
  return [(origen[0] + destino[0]) / 2, (origen[1] + destino[1]) / 2];
}

function puntoConOffset(punto: [number, number], offset: number): [number, number] {
  return [punto[0] + offset, punto[1] + offset];
}

function SimboloLeyenda({ simbolo }: { simbolo: SimboloMapa }) {
  if (simbolo === "origen") {
    return <span aria-hidden="true" className="size-4 rounded-full border-2 border-text-main bg-status-info" />;
  }
  if (simbolo === "destino") {
    return (
      <span aria-hidden="true" className="grid size-5 place-items-center text-signal">
        <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
          <path d="M7 21V4h9l-1.4 3L16 10H7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (simbolo === "vehiculo") {
    return (
      <span aria-hidden="true" className="grid size-5 place-items-center rounded-full border-2 border-status-success text-status-success">
        <svg viewBox="0 0 24 24" width="15" height="15" focusable="false">
          <path d="M5 12l7-7 7 7h-4v7H9v-7H5z" fill="currentColor" />
        </svg>
      </span>
    );
  }
  if (simbolo === "incidencia") {
    return <span aria-hidden="true" className="h-0 w-0 border-x-[9px] border-b-[16px] border-x-transparent border-b-status-error" />;
  }
  if (simbolo === "emergencia") {
    return <span aria-hidden="true" className="grid size-5 place-items-center rounded-full border-2 border-status-error font-mono-ruum text-xs font-bold text-status-error">!</span>;
  }
  return <span aria-hidden="true" className="size-5 rounded-full border-2 border-dashed border-status-warning" />;
}

function DatoMapa({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-surface-primary px-3 py-2">
      <p className="font-mono-ruum text-admin-secundario uppercase tracking-wide text-text-tertiary">{etiqueta}</p>
      <p className="mt-0.5 truncate font-body text-sm text-ink">{valor}</p>
    </div>
  );
}

function textoActualizadoHace(fecha: Date, ahora: Date | null) {
  const referencia = ahora ?? new Date();
  const segundos = Math.max(0, Math.floor((referencia.getTime() - fecha.getTime()) / 1000));
  if (segundos < 60) return `Actualizado hace ${segundos} segundos`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Actualizado hace ${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  return `Actualizado hace ${horas} horas`;
}
