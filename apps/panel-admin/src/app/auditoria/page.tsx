"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@ruum/ui";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AdminPageHeader } from "../admin-ui";
import { AdminLoadingState, AdminEmptyState, AdminErrorState, AdminBadge, AdminInput, AdminSelect } from "../admin-components";

type Evento = {
  id: string; creado_en: string; tipo: string; recurso: string;
  accion: string | null; motivo: string | null; rol: string | null; datos: unknown;
};

type Exportacion = {
  id: string; creada_en: string; recurso: string; formato: string;
  filas: number; estado: string; hash_sha256: string | null;
};

const TIPOS_EVENTO = ["todas", "mutacion", "consulta", "denegado", "aprobacion", "exportacion"] as const;

function fecha(fechaIso: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fechaIso));
}

export default function PaginaAuditoria() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [exportaciones, setExportaciones] = useState<Exportacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");

  async function cargar() {
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const rpc = cliente.rpc as unknown as (
        fn: "admin_tiene_permiso",
        args: { p_permiso: string }
      ) => Promise<{ data: boolean | null; error: unknown }>;
      const { data: tienePermiso } = await rpc("admin_tiene_permiso", { p_permiso: "auditoria:leer" });
      if (!tienePermiso) {
        setError("No tienes permiso 'auditoria:leer' para acceder al módulo de Auditoría.");
        setCargando(false);
        return;
      }
      const from = cliente.from as unknown as (tabla: string) => any;
      const [{ data: eventosData }, { data: exportacionesData }] = await Promise.all([
        from("auditoria_admin_seguridad").select("id,creado_en,tipo,recurso,accion,motivo,rol,datos").order("creado_en", { ascending: false }).limit(200),
        from("exportaciones_admin").select("id,creada_en,recurso,formato,filas,estado,hash_sha256").order("creada_en", { ascending: false }).limit(50)
      ]);
      setEventos((eventosData ?? []) as Evento[]);
      setExportaciones((exportacionesData ?? []) as Exportacion[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los datos de auditoría.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, []);

  const denegados = eventos.filter((e) => e.tipo.includes("denegado")).length;
  const mutaciones = eventos.filter((e) => e.tipo === "mutacion").length;

  const eventosFiltrados = useMemo(() => {
    let filtrados = eventos;
    if (filtroTipo !== "todas") {
      filtrados = filtrados.filter((e) => e.tipo === filtroTipo || (filtroTipo === "denegado" && e.tipo.includes("denegado")));
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      filtrados = filtrados.filter((e) =>
        e.recurso.toLowerCase().includes(q) ||
        (e.accion ?? "").toLowerCase().includes(q) ||
        (e.rol ?? "").toLowerCase().includes(q) ||
        (e.motivo ?? "").toLowerCase().includes(q)
      );
    }
    return filtrados;
  }, [eventos, filtroTipo, busqueda]);

  if (cargando) {
    return (
      <main className="admin-page-shell">
        <AdminLoadingState label="Cargando registro de auditoría" />
      </main>
    );
  }

  if (error && eventos.length === 0) {
    return (
      <main className="admin-page-shell">
        <AdminErrorState title={error} action={<Button onClick={cargar}>Reintentar</Button>} />
      </main>
    );
  }

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Administración"
        titulo="Auditoría"
        descripcion="Accesos denegados, mutaciones, aprobaciones y exportaciones trazables."
        estadoConexion={error ? "sin_conexion" : "datos_en_vivo"}
        contadorResultados={eventos.length}
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Resumen de auditoría">
        <div className="rounded-card border border-border-default bg-surface-primary p-4">
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Eventos recientes</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">{eventos.length}</p>
        </div>
        <div className="rounded-card border border-border-default bg-surface-primary p-4">
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Denegaciones</p>
          <p className="mt-1 font-display text-2xl font-semibold text-status-error">{denegados}</p>
        </div>
        <div className="rounded-card border border-border-default bg-surface-primary p-4">
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Mutaciones</p>
          <p className="mt-1 font-display text-2xl font-semibold text-status-warning">{mutaciones}</p>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <AdminInput
              label="Buscar"
              placeholder="Recurso, acción, rol…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="sm:w-44">
            <AdminSelect label="Tipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              {TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t === "todas" ? "Todos" : t}</option>)}
            </AdminSelect>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold text-ink">Eventos</h2>
        {eventosFiltrados.length === 0 ? (
          <div className="mt-3">
            <AdminEmptyState title="Sin eventos" description="No hay eventos que coincidan con los filtros seleccionados." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-card border border-border-default">
            <table className="w-full min-w-[700px] border-separate border-spacing-0 font-body text-sm">
              <caption className="sr-only">Últimos eventos administrativos</caption>
              <thead>
                <tr>
                  {["Fecha", "Tipo", "Recurso", "Acción", "Rol / motivo", "Datos"].map((col) => (
                    <th key={col} className="border-b border-ink/10 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eventosFiltrados.map((e) => (
                  <tr key={e.id} className="border-b border-ink/10 last:border-b-0 hover:bg-ink/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">{fecha(e.creado_en)}</td>
                    <td className="px-4 py-3">
                      <AdminBadge tone={e.tipo.includes("denegado") ? "danger" : e.tipo === "mutacion" ? "warning" : "neutral"}>{e.tipo}</AdminBadge>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{e.recurso}</td>
                    <td className="px-4 py-3 text-text-secondary">{e.accion ?? "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">{e.rol ?? "—"}{e.motivo ? ` · ${e.motivo}` : ""}</td>
                    <td className="px-4 py-3">
                      {e.datos && JSON.stringify(e.datos) !== "{}" ? (
                        <details>
                          <summary className="cursor-pointer font-body text-xs font-semibold text-status-info hover:underline">Ver</summary>
                          <pre className="mt-1 max-h-24 overflow-auto rounded bg-ink/[0.04] p-2 font-mono-ruum text-admin-secundario text-text-secondary">{JSON.stringify(e.datos, null, 2)}</pre>
                        </details>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink">Exportaciones</h2>
        {exportaciones.length === 0 ? (
          <div className="mt-3">
            <AdminEmptyState title="Sin exportaciones" description="No hay exportaciones administrativas registradas." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-card border border-border-default">
            <table className="w-full min-w-[600px] border-separate border-spacing-0 font-body text-sm">
              <caption className="sr-only">Exportaciones administrativas</caption>
              <thead>
                <tr>
                  {["Fecha", "Recurso", "Formato", "Filas", "Estado", "Huella"].map((col) => (
                    <th key={col} className="border-b border-ink/10 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exportaciones.map((e) => (
                  <tr key={e.id} className="border-b border-ink/10 last:border-b-0 hover:bg-ink/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">{fecha(e.creada_en)}</td>
                    <td className="px-4 py-3 font-medium text-ink">{e.recurso}</td>
                    <td className="px-4 py-3">
                      <AdminBadge>{e.formato}</AdminBadge>
                    </td>
                    <td className="px-4 py-3 font-mono-ruum text-text-secondary">{e.filas.toLocaleString("es-MX")}</td>
                    <td className="px-4 py-3"><AdminBadge tone={e.estado === "completado" ? "success" : e.estado === "error" ? "danger" : "warning"}>{e.estado}</AdminBadge></td>
                    <td className="max-w-[120px] truncate px-4 py-3 font-mono-ruum text-admin-secundario text-text-tertiary">{e.hash_sha256?.slice(0, 16) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
