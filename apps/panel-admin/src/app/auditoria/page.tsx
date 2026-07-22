"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@ruum/ui";
import { AdminPageHeader } from "../admin-ui";
import { AdminLoadingState, AdminEmptyState, AdminErrorState, AdminBadge, AdminInput, AdminSelect } from "../admin-components";

type DatosAuditoria = Record<string, unknown>;

type Evento = {
  id: string; creado_en: string; tipo: string; recurso: string;
  accion: string | null; motivo: string | null; rol: string | null; datos: DatosAuditoria;
};

type Exportacion = {
  id: string; creada_en: string; recurso: string; formato: string;
  filas: number; estado: string; hash_sha256: string | null;
};

type Paginacion = {
  page: number; pageSize: number; total: number; totalPages: number;
};

const TIPOS_EVENTO = ["todas", "mutacion", "consulta", "denegado", "aprobacion", "exportacion"] as const;
const OPCIONES_POR_PAGINA = [10, 20, 50, 100];

function fecha(fechaIso: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fechaIso));
}

function sanitizarDatosVisibles(datos: DatosAuditoria): DatosAuditoria {
  const CAMPOS_SENSIBLES = new Set([
    "auth_user_id", "token", "secret", "password", "cvv", "card_number",
    "numero_tarjeta", "cvv2", "pin", "refresh_token", "session_id"
  ]);
  const limpios: DatosAuditoria = {};
  for (const [clave, valor] of Object.entries(datos)) {
    if (CAMPOS_SENSIBLES.has(clave)) {
      limpios[clave] = "[REDACTED]";
    } else {
      limpios[clave] = valor;
    }
  }
  return limpios;
}

export default function PaginaAuditoria() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [exportaciones, setExportaciones] = useState<Exportacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState<Paginacion>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [tamanoPagina, setTamanoPagina] = useState(20);

  const cargar = useCallback(async (page: number, pageSize: number, tipo: string, q: string) => {
    setError(null);
    setCargando(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        tipo,
        busqueda: q
      });
      const res = await fetch(`/api/auditoria?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.mensaje ?? `Error ${res.status} al cargar auditoría.`);
      }
      const datos = await res.json();
      setEventos(datos.eventos ?? []);
      setExportaciones(datos.exportaciones ?? []);
      setPaginas(datos.paginacion ?? { page, pageSize, total: 0, totalPages: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los datos de auditoría.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(pagina, tamanoPagina, filtroTipo, busqueda), 0);
    return () => clearTimeout(timer);
  }, [pagina, tamanoPagina, filtroTipo, busqueda, cargar]);

  function cambiarFiltroTipo(valor: string) {
    setFiltroTipo(valor);
    setPagina(1);
  }

  function cambiarBusqueda(valor: string) {
    setBusqueda(valor);
    setPagina(1);
  }

  function cambiarTamanoPagina(valor: number) {
    setTamanoPagina(valor);
    setPagina(1);
  }

  const denegados = eventos.filter((e) => e.tipo.includes("denegado")).length;
  const mutaciones = eventos.filter((e) => e.tipo === "mutacion").length;

  if (cargando && eventos.length === 0) {
    return (
      <main className="admin-page-shell">
        <AdminLoadingState label="Cargando registro de auditoría" />
      </main>
    );
  }

  if (error && eventos.length === 0) {
    return (
      <main className="admin-page-shell">
        <AdminErrorState title={error} action={<Button onClick={() => cargar(pagina, tamanoPagina, filtroTipo, busqueda)}>Reintentar</Button>} />
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
        contadorResultados={paginas.total}
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Resumen de auditoría">
        <div className="rounded-card border border-border-default bg-surface-primary p-4">
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Eventos totales</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">{paginas.total}</p>
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
              onChange={(e) => cambiarBusqueda(e.target.value)}
            />
          </div>
          <div className="sm:w-44">
            <AdminSelect label="Tipo" value={filtroTipo} onChange={(e) => cambiarFiltroTipo(e.target.value)}>
              {TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t === "todas" ? "Todos" : t}</option>)}
            </AdminSelect>
          </div>
          <div className="sm:w-32">
            <AdminSelect label="Por página" value={String(tamanoPagina)} onChange={(e) => cambiarTamanoPagina(Number(e.target.value))}>
              {OPCIONES_POR_PAGINA.map((n) => <option key={n} value={n}>{n}</option>)}
            </AdminSelect>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold text-ink">Eventos</h2>
        {eventos.length === 0 ? (
          <div className="mt-3">
            <AdminEmptyState title="Sin eventos" description="No hay eventos que coincidan con los filtros seleccionados." />
          </div>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto rounded-card border border-border-default">
              <table className="w-full min-w-[700px] border-separate border-spacing-0 font-body text-sm">
                <caption className="sr-only">Eventos administrativos</caption>
                <thead>
                  <tr>
                    {["Fecha", "Tipo", "Recurso", "Acción", "Rol / motivo", "Datos"].map((col) => (
                      <th key={col} className="border-b border-ink/10 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {eventos.map((e) => (
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
                            <pre className="mt-1 max-h-24 overflow-auto rounded bg-ink/[0.04] p-2 font-mono-ruum text-admin-secundario text-text-secondary">{JSON.stringify(sanitizarDatosVisibles(e.datos), null, 2)}</pre>
                          </details>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="font-body text-sm text-text-tertiary">
                Página {paginas.page} de {paginas.totalPages} ({paginas.total} eventos)
              </p>
              <div className="flex gap-2">
                <button
                  className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl px-5 py-3 font-display text-sm font-bold leading-5 transition-[background-color,border-color,box-shadow,transform] duration-150 border border-border-strong bg-surface text-text-primary shadow-sm hover:-translate-y-0.5 hover:border-route-action hover:bg-surface-elevated hover:shadow-md active:translate-y-0 active:bg-surface-elevated focus-visible:outline-route-action disabled:cursor-not-allowed disabled:transform-none disabled:border-border disabled:bg-surface-elevated disabled:text-disabled disabled:shadow-none"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <button
                  className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl px-5 py-3 font-display text-sm font-bold leading-5 transition-[background-color,border-color,box-shadow,transform] duration-150 border border-border-strong bg-surface text-text-primary shadow-sm hover:-translate-y-0.5 hover:border-route-action hover:bg-surface-elevated hover:shadow-md active:translate-y-0 active:bg-surface-elevated focus-visible:outline-route-action disabled:cursor-not-allowed disabled:transform-none disabled:border-border disabled:bg-surface-elevated disabled:text-disabled disabled:shadow-none"
                  disabled={pagina >= paginas.totalPages}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
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
