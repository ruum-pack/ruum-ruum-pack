"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { AdminPageHeader } from "../../admin-ui";
import { AdminButton } from "../../admin-components";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import {
  listarConductoresAdminPaginados,
  type PaginacionConductores
} from "@ruum/api/services";

type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type EstadoConductor = Database["public"]["Enums"]["estado_conductor"];

const ETIQUETA_ESTADO: Record<EstadoConductor, string> = {
  pendiente_verificacion: "Pendiente verificación",
  activo: "Activo",
  suspendido_7d: "Suspendido (7d)",
  suspendido_14d: "Suspendido (14d)",
  suspendido_30d: "Suspendido (30d)",
  suspendido_indefinido: "Suspendido",
  bloqueado_permanente: "Baja",
  modo_prueba_supervisada: "Modo prueba"
};

const ESTADO_CLASE: Record<EstadoConductor, string> = {
  pendiente_verificacion: "bg-status-warning/20 text-status-warning border-status-warning/30",
  activo: "bg-status-success/20 text-status-success border-status-success/30",
  suspendido_7d: "bg-status-error/20 text-status-error border-status-error/30",
  suspendido_14d: "bg-status-error/20 text-status-error border-status-error/30",
  suspendido_30d: "bg-status-error/20 text-status-error border-status-error/30",
  suspendido_indefinido: "bg-status-error/20 text-status-error border-status-error/30",
  bloqueado_permanente: "bg-ink/10 text-text-tertiary border-ink/20",
  modo_prueba_supervisada: "bg-status-warning/20 text-status-warning border-status-warning/30"
};

export default function PaginaConductoresActivos() {
  const [conductores, setConductores] = useState<ConductorRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoConductor | "todos">("todos");
  const [pagina, setPagina] = useState(1);
  const [tamanoPagina, setTamanoPagina] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (p?: number) => {
    if (!tieneSupabaseConfigurado()) {
      setConductores([]);
      setCargando(false);
      return;
    }
    const pg = p ?? 1;
    setCargando(true);
    try {
      const cliente = crearClienteNavegador();
      const resultado = await listarConductoresAdminPaginados(cliente, pg, 25, busqueda || undefined, estadoFiltro);
      setConductores(resultado.data);
      setTotal(resultado.paginacion.total);
      setTotalPaginas(resultado.paginacion.total_paginas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar conductores.");
    } finally {
      setCargando(false);
    }
  }, [busqueda, estadoFiltro]);

  useEffect(() => {
    void cargar(1);
  }, [cargar]);

  const irPagina = (p: number) => {
    if (p < 1 || p > totalPaginas) return;
    void cargar(p);
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 sm:px-8 sm:py-10">
      <AdminPageHeader
        etiqueta="Gestión"
        titulo="Conductores activos"
        descripcion="Listado de conductores con cuenta aprobada y gestión de estado."
        estadoConexion={conductores.length > 0 ? "datos_en_vivo" : "sin_conexion"}
        contadorResultados={conductores.length}
        accion={(
          <Link href="/conductores/activos/nuevo" className="rounded-lg border border-ink/20 bg-surface-primary px-4 py-2 font-body text-sm font-medium hover:bg-ink/5">
            Nuevo conductor
          </Link>
        )}
      />

      {error && <div className="mt-4"><Aviso tono="danger">{error}</Aviso></div>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); void cargar(1); }}
          placeholder="Buscar por nombre, CURP, licencia, teléfono…"
          className="flex-1 min-w-[250px] rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-text-tertiary focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
        />
        <select
          value={estadoFiltro}
          onChange={(e) => { setEstadoFiltro(e.target.value as "todos" | EstadoConductor); void cargar(1); }}
          className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="suspendido">Suspendido</option>
          <option value="baja">Baja</option>
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-card border border-ink/10 bg-surface-primary">
        <table className="w-full font-body text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="px-4 py-3">Conductor</th>
              <th className="px-4 py-3">CURP</th>
              <th className="px-4 py-3">Licencia</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Registrado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-tertiary">Cargando…</td>
              </tr>
            ) : conductores.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-tertiary">Sin conductores.</td>
              </tr>
            ) : (
              conductores.map((c) => (
                <tr key={c.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/conductores/activos/${c.id}`} className="hover:text-focus-default hover:underline">
                      {c.nombre ?? <span className="text-text-tertiary">Sin nombre</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono-ruum text-xs">{c.curp ?? "—"}</td>
                  <td className="px-4 py-3 font-mono-ruum text-xs">{c.licencia_numero ?? "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.telefono ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-1 font-body text-xs font-medium ${ESTADO_CLASE[c.estado]}`}>
                      {ETIQUETA_ESTADO[c.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{new Date(c.creado_en).toLocaleDateString("es-MX")}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/conductores/activos/${c.id}`}
                      className="rounded-md border border-ink/20 px-3 py-1.5 font-body text-xs font-medium text-ink hover:bg-ink/5"
                    >
                      Gestionar
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-between font-body text-sm text-text-secondary">
          <span>{total} resultado{total !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-3">
            <span>Página {pagina} de {totalPaginas}</span>
            <div className="flex gap-1">
              <button onClick={() => void cargar(pagina - 1)} disabled={pagina <= 1} className="rounded-md border border-ink/20 px-3 py-1.5 text-xs disabled:opacity-30">&larr; Anterior</button>
              <button onClick={() => void cargar(pagina + 1)} disabled={pagina >= totalPaginas} className="rounded-md border border-ink/20 px-3 py-1.5 text-xs disabled:opacity-30">Siguiente &rarr;</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}