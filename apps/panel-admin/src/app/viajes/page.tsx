"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Aviso, EstadoBadge } from "@ruum/ui";
import { AdminPageHeader, AdminPanel } from "../admin-ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { listarViajesAdmin } from "@ruum/api/services";
import { VIAJES_DEMO } from "../../lib/datos-demo";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

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

export default function PaginaViajesAdmin() {
  const [pestana, setPestana] = useState(PESTANAS[0]!.id);
  const [traslados, setTraslados] = useState<PasaporteRow[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const filtroActual = PESTANAS.find((p) => p.id === pestana)!.filtro;

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        const lista = filtroActual === "todos" ? VIAJES_DEMO : VIAJES_DEMO.filter((v) => v.estado === filtroActual);
        setTraslados(lista);
        setEsDemo(true);
        setCargando(false);
        return;
      }

      setCargando(true);
      try {
        const cliente = crearClienteNavegador();
        setTraslados(await listarViajesAdmin(cliente, filtroActual));
        setEsDemo(false);
      } catch {
        if (puedeUsarDatosDemo()) {
          const lista = filtroActual === "todos" ? VIAJES_DEMO : VIAJES_DEMO.filter((v) => v.estado === filtroActual);
          setTraslados(lista);
          setEsDemo(true);
        } else {
          setTraslados([]);
          setEsDemo(false);
        }
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [filtroActual]);

  const trasladosFiltrados = busqueda.trim()
    ? traslados.filter((v) => {
        const q = busqueda.trim().toLowerCase();
        return (
          (v.traslado_id?.slice(0, 8).toLowerCase().includes(q) ?? false) ||
          `${v.vehiculo_marca ?? ""} ${v.vehiculo_modelo ?? ""}`.toLowerCase().includes(q) ||
          (v.conductor_nombre ?? "").toLowerCase().includes(q)
        );
      })
    : traslados;

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Operación"
        titulo="Traslados"
        descripcion="Bandeja operativa para revisar folios, conductor asignado, monto autorizado y estado actual."
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
            onClick={() => setPestana(p.id)}
            className={[
              "px-4 py-2.5 font-body text-sm font-medium transition-colors",
              pestana === p.id ? "border-b-2 border-signal text-ink" : "text-ink/55 hover:text-ink"
            ].join(" ")}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label className="sr-only" htmlFor="buscar-traslados">Buscar traslados</label>
        <input
          id="buscar-traslados"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por folio, vehículo, conductor o placa…"
          className="flex-1 rounded-lg border border-ink/20 bg-mist px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/40 focus:border-route-dark focus:outline-none focus:ring-2 focus:ring-route-dark/20"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda("")}
            className="font-body text-sm text-ink/50 hover:text-ink"
            aria-label="Limpiar búsqueda"
          >
            Limpiar
          </button>
        )}
      </div>

      <AdminPanel className="admin-table-card mt-3">
        <table>
          <caption className="sr-only">Lista de traslados operativos</caption>
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/45">
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Vehículo</th>
              <th className="px-4 py-3">Conductor</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink/50">
                  Cargando…
                </td>
              </tr>
            ) : trasladosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink/50">
                  {busqueda.trim() ? "No encontramos traslados con esa búsqueda." : "No hay traslados en esta pestaña."}
                </td>
              </tr>
            ) : (
              trasladosFiltrados.map((v, indice) => (
                <tr key={v.traslado_id ?? `traslado-sin-folio-${indice}`}>
                  <td className="px-4 py-3">
                    {v.traslado_id ? (
                      <Link href={`/viajes/${v.traslado_id}`} className="font-mono-ruum text-xs text-route-dark hover:underline">
                        {v.traslado_id.slice(0, 8).toUpperCase()}
                      </Link>
                    ) : (
                      <span className="text-ink/40">Sin folio</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {v.vehiculo_marca} {v.vehiculo_modelo}
                    {v.vehiculo_tipo && <span className="text-ink/45"> · {ETIQUETA_TIPO_VEHICULO[v.vehiculo_tipo]}</span>}
                  </td>
                  <td className="px-4 py-3">{v.conductor_nombre ?? <span className="text-ink/40">Sin asignar</span>}</td>
                  <td className="px-4 py-3 font-mono-ruum">${v.precio_cotizado?.toLocaleString("es-MX") ?? "—"}</td>
                  <td className="px-4 py-3">
                    {v.estado ? <EstadoBadge estado={v.estado} /> : <span className="text-ink/40">Sin estado</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminPanel>
    </main>
  );
}
