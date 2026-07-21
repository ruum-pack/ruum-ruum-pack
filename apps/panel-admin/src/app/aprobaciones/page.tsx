"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@ruum/ui";
import { listarAprobacionesPendientes, decidirAprobacionAdmin, type SolicitudAprobacionAdmin } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AdminPageHeader } from "../admin-ui";
import { AdminLoadingState, AdminEmptyState, AdminErrorState, AdminDialog, AdminBadge } from "../admin-components";

type DecisionAccion = { solicitud: SolicitudAprobacionAdmin; aprobar: boolean } | null;

function fecha(fechaIso: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fechaIso));
}

export default function PaginaAprobaciones() {
  const [solicitudes, setSolicitudes] = useState<SolicitudAprobacionAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<DecisionAccion>(null);
  const [motivo, setMotivo] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  async function cargar() {
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      setSolicitudes(await listarAprobacionesPendientes(cliente));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las aprobaciones.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, []);

  function ejecutarDecision() {
    if (!decision) return;
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await decidirAprobacionAdmin(cliente, decision.solicitud.id, decision.aprobar, motivo, decision.solicitud.version);
        setMensaje(decision.aprobar ? "Solicitud aprobada." : "Solicitud rechazada.");
        setDecision(null);
        setMotivo("");
        cargar();
      } catch (e) {
        setMensaje(e instanceof Error ? e.message : "No se pudo procesar la decisión.");
      }
    });
  }

  if (cargando) {
    return (
      <main className="admin-page-shell">
        <AdminLoadingState label="Cargando solicitudes de aprobación" />
      </main>
    );
  }

  if (error && solicitudes.length === 0) {
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
        titulo="Aprobaciones"
        descripcion="Solicitudes duales de finanzas y sanciones que requieren solicitante y aprobador distintos."
        estadoConexion={error ? "sin_conexion" : "datos_en_vivo"}
        contadorResultados={solicitudes.length}
      />

      {solicitudes.length === 0 ? (
        <div className="mt-6">
          <AdminEmptyState title="Sin solicitudes pendientes" description="No hay solicitudes de aprobación pendientes de revisión." />
        </div>
      ) : (
        <section className="mt-6 grid gap-4">
          {solicitudes.map((s) => {
            const payloadStr = typeof s.payload === "string" ? s.payload : JSON.stringify(s.payload);
            return (
              <article key={s.id} className="rounded-card border border-border-default bg-surface-primary p-5 shadow-[var(--ruum-shadow-1)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono-ruum text-xs uppercase tracking-wide text-text-tertiary">{s.id.slice(0, 8).toUpperCase()}</p>
                      <AdminBadge tone={s.tipo === "finanzas" ? "warning" : "danger"}>{s.tipo}</AdminBadge>
                    </div>
                    <h2 className="mt-1 font-display text-lg font-semibold text-ink">{s.accion}</h2>
                    <p className="mt-1 font-body text-sm text-text-secondary">Recurso: {s.recurso} · Capacidad requerida: {s.capacidad_requerida}</p>
                    {payloadStr !== "{}" && (
                      <details className="mt-2">
                        <summary className="cursor-pointer font-body text-xs font-semibold text-status-info hover:underline">Ver payload</summary>
                        <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-ink/[0.04] p-3 font-mono-ruum text-admin-secundario text-text-secondary">{payloadStr}</pre>
                      </details>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="rounded-full border border-ink/10 bg-surface-secondary px-3 py-1 font-body text-xs font-semibold text-text-secondary">{s.estado}</span>
                    <p className="font-body text-xs text-text-tertiary">Creada {fecha(s.creada_en)}</p>
                    <p className="font-body text-xs text-text-tertiary">Expira {fecha(s.expira_en)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-ink/10 pt-4">
                  <Button variant="quiet" onClick={() => { setDecision({ solicitud: s, aprobar: true }); setMotivo(""); }}>Aprobar</Button>
                  <Button variant="quiet" onClick={() => { setDecision({ solicitud: s, aprobar: false }); setMotivo(""); }}>Rechazar</Button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <AdminDialog
        open={decision !== null}
        title={decision?.aprobar ? "Aprobar solicitud" : "Rechazar solicitud"}
        description={decision?.aprobar
          ? `¿Confirmas la aprobación de "${decision?.solicitud.accion}" para ${decision?.solicitud.recurso}?`
          : "Indica el motivo del rechazo (mín. 10 caracteres)."}
        onOpenChange={(abierto) => { if (!abierto) setDecision(null); }}
        footer={
          decision?.aprobar
            ? <><button type="button" onClick={() => setDecision(null)} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-admin-boton font-semibold text-ink hover:bg-surface-secondary">Cancelar</button><button type="button" onClick={ejecutarDecision} disabled={pendiente} className="rounded-lg bg-signal px-4 py-2 font-body text-admin-boton font-semibold text-ink hover:bg-signal/90">{pendiente ? "Procesando..." : "Confirmar aprobación"}</button></>
            : <><button type="button" onClick={() => setDecision(null)} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-admin-boton font-semibold text-ink hover:bg-surface-secondary">Cancelar</button><button type="button" onClick={ejecutarDecision} disabled={pendiente || motivo.length < 10} className="rounded-lg border border-status-error/30 bg-status-error-soft px-4 py-2 font-body text-admin-boton font-semibold text-status-error hover:bg-status-error hover:text-background-main">{pendiente ? "Procesando..." : "Confirmar rechazo"}</button></>
        }
      >
        {!decision?.aprobar && (
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm text-ink"
            placeholder="Motivo del rechazo (mín. 10 caracteres)"
            rows={3}
          />
        )}
      </AdminDialog>

      {mensaje && (
        <div className="mt-4" role="status" aria-live="polite">
          <p className="font-body text-sm text-text-secondary">{mensaje}</p>
        </div>
      )}
    </main>
  );
}
