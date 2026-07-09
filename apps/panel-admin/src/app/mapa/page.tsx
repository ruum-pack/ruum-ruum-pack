"use client";

/**
 * PRD §10.3 — Mapa operativo. Muestra todos los traslados activos con pin
 * de origen (azul trazabilidad) y pin de destino (amarillo ruta), línea punteada de
 * ruta, y panel lateral de selección. Usa Leaflet via CDN (OSM, sin API key).
 *
 * Nota: la ubicación en tiempo real del conductor no está disponible hasta
 * que se implemente el GPS continuo (Foreground Service nativo, PRD §15).
 * Por ahora se muestra el pin de origen registrado en el traslado.
 */

"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Aviso, EstadoBadge } from "@ruum/ui";
import { listarTrasladosActivosMapa, type TrasladoMapa } from "@ruum/api/services";
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

declare global {
  interface Window {
    L: {
      map: (el: HTMLElement, opts: object) => LeafletMap;
      tileLayer: (url: string, opts: object) => { addTo: (m: LeafletMap) => void };
      divIcon: (opts: object) => LeafletIcon;
      marker: (latlng: [number, number], opts?: object) => LeafletMarker;
      polyline: (latlngs: [number, number][], opts: object) => { addTo: (m: LeafletMap) => void };
    };
  }
  interface LeafletMap {
    remove: () => void;
    fitBounds?: (bounds: [[number,number],[number,number]][]) => void;
  }
  interface LeafletIcon {}
  interface LeafletMarker {
    addTo: (m: LeafletMap) => LeafletMarker;
    bindTooltip: (content: string, opts?: object) => LeafletMarker;
    on: (evt: string, fn: () => void) => LeafletMarker;
  }
}

function cargarLeaflet(): Promise<void> {
  if (window.L) return Promise.resolve();
  return new Promise((resolve) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export default function PaginaMapaOperativo() {
  const [traslados, setTraslados] = useState<TrasladoMapa[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<LeafletMap | null>(null);

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

    void (async () => {
      await cargarLeaflet();
      const L = window.L;
      const mapa = L.map(mapRef.current!, { center: [22.5, -100], zoom: 5 });
      mapaRef.current = mapa;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
      }).addTo(mapa);

      const iconOrigen = (incidencia: boolean) =>
        L.divIcon({
          html: `<div style="width:13px;height:13px;border-radius:50%;background:${incidencia ? "#b32626" : "#1e88e5"};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
          className: "",
          iconSize: [13, 13],
          iconAnchor: [6, 6]
        });

      const iconDestino = L.divIcon({
        html: `<div style="width:13px;height:13px;border-radius:50%;background:#ffc400;border:2.5px solid #151515;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
        className: "",
        iconSize: [13, 13],
        iconAnchor: [6, 6]
      });

      for (const t of traslados) {
        const color = t.tiene_incidencia_abierta ? "#b32626" : "#1e88e5";
        L.polyline(
          [[t.origen_lat, t.origen_lng], [t.destino_lat, t.destino_lng]],
          { color, weight: 1.5, opacity: 0.45, dashArray: "5 4" }
        ).addTo(mapa);

        L.marker([t.origen_lat, t.origen_lng], { icon: iconOrigen(t.tiene_incidencia_abierta) })
          .addTo(mapa)
          .bindTooltip(`${t.vehiculo_marca ?? ""} ${t.vehiculo_modelo ?? ""} → ${t.destino_ciudad}`, { direction: "top" })
          .on("click", () => setSeleccionado(t.traslado_id));

        L.marker([t.destino_lat, t.destino_lng], { icon: iconDestino })
          .addTo(mapa)
          .bindTooltip(`Destino: ${t.destino_ciudad}`, { direction: "top" });
      }
    })();

    return () => {
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
  }, [cargando, traslados]);

  const sel = traslados.find((t) => t.traslado_id === seleccionado);
  const enRuta = traslados.filter((t) => t.estado === "traslado_en_curso").length;
  const conInc = traslados.filter((t) => t.tiene_incidencia_abierta).length;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between border-b border-mist-dim px-6 py-4">
        <div>
          <h1 className="font-display text-xl font-semibold">Mapa operativo</h1>
          <p className="font-mono-ruum text-xs text-ink/45">Torre de control · traslados activos</p>
        </div>
        {esDemo && (
          <span className="rounded-lg bg-warn-soft px-3 py-1 font-mono-ruum text-xs text-warn">
            Modo demo
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 border-b border-mist-dim px-6 py-3">
        <div className="rounded-xl bg-route-soft px-4 py-3">
          <p className="font-mono-ruum text-xs text-route-dark/70">Activos</p>
          <p className="font-display text-2xl font-semibold text-route-dark">{traslados.length}</p>
        </div>
        <div className="rounded-xl bg-signal-soft px-4 py-3">
          <p className="font-mono-ruum text-xs text-ink/60">En ruta</p>
          <p className="font-display text-2xl font-semibold text-ink">{enRuta}</p>
        </div>
        <div className={`rounded-xl px-4 py-3 ${conInc > 0 ? "bg-danger-soft" : "bg-mist-dim"}`}>
          <p className={`font-mono-ruum text-xs ${conInc > 0 ? "text-danger/70" : "text-ink/45"}`}>Con incidencia</p>
          <p className={`font-display text-2xl font-semibold ${conInc > 0 ? "text-danger" : "text-ink/45"}`}>{conInc}</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          {cargando && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-mist/80">
              <p className="font-mono-ruum text-sm text-ink/45">Cargando traslados…</p>
            </div>
          )}
          {!cargando && traslados.length === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
              <p className="font-display text-lg text-ink/35">Sin traslados activos</p>
            </div>
          )}
          <div ref={mapRef} style={{ height: "100%", minHeight: 480 }} />

          <div className="absolute bottom-4 left-4 z-[400] rounded-xl border border-mist-dim bg-mist/95 px-4 py-3 backdrop-blur-sm">
            <p className="mb-2 font-mono-ruum text-[10px] uppercase tracking-widest text-ink/40">Leyenda</p>
            <div className="flex flex-col gap-1.5">
              {[
                ["#1e88e5", "Origen activo"],
                ["#ffc400", "Destino"],
                ["#b32626", "Con incidencia"]
              ].map(([color, label]) => (
                <div key={label} className="flex items-center gap-2">
                  <span style={{ background: color }} className="h-3 w-3 rounded-full border-2 border-white" />
                  <span className="font-body text-xs text-ink/65">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-80 flex-col overflow-y-auto border-l border-mist-dim">
          {sel && (
            <div className="border-b border-mist-dim bg-mist-dim/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono-ruum text-xs uppercase tracking-widest text-ink/40">Seleccionado</p>
                <button onClick={() => setSeleccionado(null)} className="font-mono-ruum text-xs text-ink/40 hover:text-ink/70">✕</button>
              </div>
              <p className="font-display text-sm font-semibold">{sel.vehiculo_marca} {sel.vehiculo_modelo}</p>
              <p className="font-mono-ruum text-xs text-ink/55">{sel.origen_ciudad} → {sel.destino_ciudad}</p>
              <div className="mt-2"><EstadoBadge estado={sel.estado} /></div>
              {sel.tiene_incidencia_abierta && (
                <div className="mt-2 rounded-lg bg-danger-soft px-3 py-2">
                  <p className="font-body text-xs text-danger">⚠ Incidencia abierta</p>
                </div>
              )}
              <Link
                href={`/viajes/${sel.traslado_id}`}
                className="mt-3 block w-full rounded-lg border border-route/30 bg-route-soft py-2 text-center font-body text-sm text-route-dark hover:bg-route hover:text-white transition-colors"
              >
                Ver pasaporte →
              </Link>
            </div>
          )}

          <div className="p-4">
            <p className="mb-3 font-mono-ruum text-[10px] uppercase tracking-widest text-ink/40">Todos los activos</p>
            <div className="flex flex-col gap-2">
              {traslados.map((t) => (
                <button
                  key={t.traslado_id}
                  onClick={() => setSeleccionado(t.traslado_id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    seleccionado === t.traslado_id
                      ? "border-route bg-route-soft"
                      : t.tiene_incidencia_abierta
                      ? "border-danger/30 bg-danger-soft hover:border-danger/60"
                      : "border-mist-dim bg-mist hover:border-route/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold leading-tight">
                        {t.vehiculo_marca} {t.vehiculo_modelo}
                      </p>
                      <p className="font-mono-ruum text-[10px] text-ink/50">{t.origen_ciudad} → {t.destino_ciudad}</p>
                    </div>
                    {t.tiene_incidencia_abierta && (
                      <span className="mt-0.5 flex-shrink-0 rounded-full bg-danger-soft px-2 py-0.5 font-mono-ruum text-[9px] text-danger">INC</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="font-body text-xs text-ink/50">{ETIQUETA_ESTADO[t.estado] ?? t.estado}</p>
                    <p className="font-mono-ruum text-[10px] text-ink/35">{tiempoRelativo(t.actualizado_en)}</p>
                  </div>
                </button>
              ))}
              {traslados.length === 0 && !cargando && (
                <p className="py-8 text-center font-body text-sm text-ink/30">Sin traslados activos</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-mist-dim px-6 py-2">
        <p className="font-body text-xs text-ink/30">
          Pines en origen registrado. Ubicación en tiempo real disponible con GPS continuo (PRD §15).
        </p>
      </div>
    </div>
  );
}
