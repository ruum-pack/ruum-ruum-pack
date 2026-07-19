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

import { useCallback, useEffect, useRef, useState } from "react";
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

function tiempoRelativo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h`;
}

const tokenMapbox = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const estiloMapbox = process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL || "mapbox://styles/mapbox/streets-v12";
const COLOR_MAPA = {
  origen: "var(--ruum-status-info)",
  destino: "var(--ruum-action-primary)",
  incidencia: "var(--ruum-status-error)",
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
    pinBordeClaro: leer("--ruum-text-main"),
    pinBordeOscuro: leer("--ruum-surface-strong")
  };
}

function crearPin(color: string, borde: string, etiqueta: string): HTMLButtonElement {
  const pin = document.createElement("button");
  const punto = document.createElement("span");
  pin.type = "button";
  pin.setAttribute("aria-label", etiqueta);
  Object.assign(pin.style, {
    width: "40px",
    height: "40px",
    border: "0",
    borderRadius: "9999px",
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0"
  });
  Object.assign(punto.style, {
    width: "18px",
    height: "18px",
    borderRadius: "9999px",
    background: color,
    border: `3px solid ${borde}`,
    boxShadow: COLOR_MAPA.pinSombra,
    pointerEvents: "none"
  });
  pin.appendChild(punto);
  return pin;
}

export default function PaginaMapaOperativo() {
  const [traslados, setTraslados] = useState<TrasladoMapa[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
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

  useEffect(() => {
    if (!seleccionado) return;
    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") cerrarPanelSeleccionado();
    }
    document.addEventListener("keydown", cerrarConEscape);
    return () => document.removeEventListener("keydown", cerrarConEscape);
  }, [seleccionado, cerrarPanelSeleccionado]);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setTraslados(TRASLADOS_MAPA_DEMO);
        setEsDemo(true);
        setCargando(false);
        return;
      }
      try {
        const cliente = crearClienteNavegador();
        setTraslados(await listarTrasladosActivosMapa(cliente));
        setEsDemo(false);
      } catch {
        if (puedeUsarDatosDemo()) {
          setTraslados(TRASLADOS_MAPA_DEMO);
          setEsDemo(true);
        } else {
          setTraslados([]);
          setEsDemo(false);
        }
      } finally {
        setCargando(false);
      }
    }
    void cargar();
  }, []);

  useEffect(() => {
    if (cargando || !mapRef.current || traslados.length === 0) return;
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
        const completos = traslados.filter((t) => t.origen_lat !== null && t.origen_lng !== null && t.destino_lat !== null && t.destino_lng !== null);
        await Promise.all(completos.map(async (t, indice) => {
          const origen: [number, number] = [t.origen_lng!, t.origen_lat!];
          const destino: [number, number] = [t.destino_lng!, t.destino_lat!];
          const color = t.tiene_incidencia_abierta ? coloresMapa.incidencia : coloresMapa.origen;
          const { geometry: geometria } = await obtenerRutaMapbox(origen, destino);
          if (cancelado) return;
          const sourceId = `ruta-${indice}`;
          mapa.addSource(sourceId, { type: "geojson", data: { type: "Feature", properties: {}, geometry: geometria } });
          mapa.addLayer({ id: sourceId, type: "line", source: sourceId, paint: { "line-color": color, "line-width": 3, "line-opacity": .65 } });

          const etiquetaTraslado = `${t.vehiculo_marca ?? "Vehículo"} ${t.vehiculo_modelo ?? ""}`.trim();
          const origenEl = crearPin(color, coloresMapa.pinBordeClaro, `Seleccionar origen de ${etiquetaTraslado} hacia ${t.destino_ciudad}`);
          origenEl.onclick = () => seleccionarTraslado(t.traslado_id);
          const origenMarker = new mapboxgl.Marker({ element: origenEl }).setLngLat(origen)
            .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(`${t.vehiculo_marca ?? ""} ${t.vehiculo_modelo ?? ""} → ${t.destino_ciudad}`)).addTo(mapa);
          const destinoEl = crearPin(coloresMapa.destino, coloresMapa.pinBordeOscuro, `Seleccionar destino de ${etiquetaTraslado} en ${t.destino_ciudad}`);
          destinoEl.onclick = () => seleccionarTraslado(t.traslado_id);
          const destinoMarker = new mapboxgl.Marker({ element: destinoEl }).setLngLat(destino)
            .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(`Destino: ${t.destino_ciudad}`)).addTo(mapa);
          marcadoresRef.current.push(origenMarker, destinoMarker);
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
  }, [cargando, traslados, seleccionarTraslado]);

  const sel = traslados.find((t) => t.traslado_id === seleccionado);
  const enRuta = traslados.filter((t) => t.estado === "traslado_en_curso").length;
  const conInc = traslados.filter((t) => t.tiene_incidencia_abierta).length;
  const pendientesGeocodificacion = traslados.filter(
    (t) => t.origen_lat === null || t.origen_lng === null || t.destino_lat === null || t.destino_lng === null
  ).length;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
        <div>
          <h1 className="font-display text-xl font-semibold">Mapa operativo</h1>
          <p className="font-mono-ruum text-xs text-text-tertiary">Torre de control · traslados activos</p>
        </div>
        {esDemo && (
          <span className="rounded-lg bg-status-warning-soft px-3 py-1 font-mono-ruum text-xs text-status-warning">
            Modo demo
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 border-b border-border-default px-6 py-3">
        <div className="rounded-xl bg-status-info-soft px-4 py-3">
          <p className="font-mono-ruum text-xs text-status-info/70">Activos</p>
          <p className="font-display text-2xl font-semibold text-status-info">{traslados.length}</p>
        </div>
        <div className="rounded-xl bg-signal-soft px-4 py-3">
          <p className="font-mono-ruum text-xs text-text-secondary">En ruta</p>
          <p className="font-display text-2xl font-semibold text-ink">{enRuta}</p>
        </div>
        <div className={`rounded-xl px-4 py-3 ${conInc > 0 ? "bg-status-error-soft" : "bg-surface-secondary"}`}>
          <p className={`font-mono-ruum text-xs ${conInc > 0 ? "text-status-error/70" : "text-text-tertiary"}`}>Con incidencia</p>
          <p className={`font-display text-2xl font-semibold ${conInc > 0 ? "text-status-error" : "text-text-tertiary"}`}>{conInc}</p>
        </div>
        <div className={`rounded-xl px-4 py-3 ${pendientesGeocodificacion > 0 ? "bg-status-warning-soft" : "bg-surface-secondary"}`}>
          <p className="font-mono-ruum text-xs text-text-secondary">Sin coordenadas</p>
          <p className="font-display text-2xl font-semibold text-ink">{pendientesGeocodificacion}</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          {cargando && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-primary/80">
              <p className="font-mono-ruum text-sm text-text-tertiary">Cargando traslados…</p>
            </div>
          )}
          {!cargando && traslados.length === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
              <p className="font-display text-lg text-text-tertiary">Sin traslados activos</p>
            </div>
          )}
          {errorMapa && (
            <div className="absolute left-4 right-4 top-4 z-10"><Aviso tono="danger">{errorMapa}</Aviso></div>
          )}
          <div ref={mapRef} style={{ height: "100%", minHeight: 480 }} />

          <div className="absolute bottom-4 left-4 z-[400] rounded-xl border border-border-default bg-surface-primary/95 px-4 py-3 backdrop-blur-sm">
            <p className="mb-2 font-mono-ruum text-admin-secundario uppercase tracking-widest text-text-tertiary">Leyenda</p>
            <div className="flex flex-col gap-1.5">
              {[
                [COLOR_MAPA.origen, "Origen activo"],
                [COLOR_MAPA.destino, "Destino"],
                [COLOR_MAPA.incidencia, "Con incidencia"]
              ].map(([color, label]) => (
                <div key={label} className="flex items-center gap-2">
                  <span style={{ background: color }} className="h-3 w-3 rounded-full border-2 border-white" />
                  <span className="font-body text-xs text-text-secondary">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-80 flex-col overflow-y-auto border-l border-border-default">
          {sel && (
            <div className="border-b border-border-default bg-surface-secondary/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono-ruum text-xs uppercase tracking-widest text-text-tertiary">Seleccionado</p>
                <button
                  type="button"
                  onClick={cerrarPanelSeleccionado}
                  className="inline-flex size-10 items-center justify-center rounded-lg font-mono-ruum text-admin-boton text-text-tertiary hover:bg-surface-primary hover:text-text-secondary"
                  aria-label="Cerrar detalle del traslado seleccionado"
                >
                  ✕
                </button>
              </div>
              <p className="font-display text-sm font-semibold">{sel.vehiculo_marca} {sel.vehiculo_modelo}</p>
              <p className="font-mono-ruum text-xs text-text-secondary">{sel.origen_ciudad} → {sel.destino_ciudad}</p>
              <div className="mt-2"><EstadoBadge estado={sel.estado} /></div>
              {sel.tiene_incidencia_abierta && (
                <div className="mt-2 rounded-lg bg-status-error-soft px-3 py-2">
                  <p className="font-body text-xs text-status-error">⚠ Incidencia abierta</p>
                </div>
              )}
              <Link
                href={`/viajes/${sel.traslado_id}`}
                className="mt-3 block w-full rounded-lg border border-status-info/30 bg-status-info-soft py-2 text-center font-body text-sm text-status-info hover:bg-status-info hover:text-background-main transition-colors"
              >
                Ver pasaporte →
              </Link>
            </div>
          )}

          <div className="p-4">
            <p className="mb-3 font-mono-ruum text-admin-secundario uppercase tracking-widest text-text-tertiary">Todos los activos</p>
            <div className="flex flex-col gap-2">
              {traslados.map((t) => (
                <button
                  key={t.traslado_id}
                  onClick={() => seleccionarTraslado(t.traslado_id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    seleccionado === t.traslado_id
                      ? "border-status-info bg-status-info-soft"
                      : t.tiene_incidencia_abierta
                      ? "border-status-error/30 bg-status-error-soft hover:border-status-error/60"
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
                    {t.tiene_incidencia_abierta && (
                      <span className="mt-0.5 flex-shrink-0 rounded-full bg-status-error-soft px-2 py-0.5 font-mono-ruum text-admin-secundario text-status-error">INC</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="font-body text-admin-secundario text-text-tertiary">{ETIQUETA_ESTADO[t.estado] ?? t.estado}</p>
                    <p className="font-mono-ruum text-admin-secundario text-text-tertiary">{tiempoRelativo(t.actualizado_en)}</p>
                  </div>
                </button>
              ))}
              {traslados.length === 0 && !cargando && (
                <p className="py-8 text-center font-body text-sm text-text-tertiary">Sin traslados activos</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border-default px-6 py-2">
        <p className="font-body text-xs text-text-tertiary">
          Rutas calculadas con Mapbox Directions. Ubicación en tiempo real disponible con GPS continuo (PRD §15).
        </p>
      </div>
    </div>
  );
}
