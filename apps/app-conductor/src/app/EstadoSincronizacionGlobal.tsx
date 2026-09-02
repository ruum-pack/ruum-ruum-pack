"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { calcularSyncSnapshot, obtenerUltimoSyncSnapshot, publicarSyncSnapshot, SYNC_STATUS_EVENT, type GlobalSyncSnapshot } from "../lib/offline-sync-status";
import { recordOperationalEvent } from "../lib/observability";

const CLASES: Record<GlobalSyncSnapshot["status"], string> = {
  todo_sincronizado: "border-success/30 bg-success/10 text-success",
  sin_conexion: "border-warning/40 bg-warning/10 text-warning",
  pendientes: "border-route-action/35 bg-route-soft text-route-action",
  sincronizando: "border-route-action/35 bg-route-soft text-route-action",
  accion_requerida: "border-warning/40 bg-warning/10 text-warning",
  error_recuperable: "border-warning/40 bg-warning/10 text-warning",
  conflicto_revision: "border-danger-action/45 bg-danger-soft text-danger-action"
};

// CODE-003 — mapeo de accion_requerida a UI accionable + observabilidad
function AccionRequeridaCTA({ snapshot }: { snapshot: GlobalSyncSnapshot }) {
  const isSesionExpirada = snapshot.status === "accion_requerida";
  const isConflicto = snapshot.status === "conflicto_revision";
  const isRelevante = snapshot.status === "accion_requerida" || snapshot.status === "conflicto_revision" || snapshot.status === "error_recuperable";

  useEffect(() => {
    if (!isRelevante) return;
    void recordOperationalEvent(isConflicto ? "sync_failure" : "session_expired", { status: snapshot.status, message: snapshot.message }, "warning");
  }, [snapshot.status, snapshot.message, isRelevante, isConflicto]);

  if (!isRelevante) return null;

  if (isSesionExpirada) {
    return (
      <Link href="/login?next=/panel" className="ml-3 inline-flex items-center rounded-lg bg-warning px-3 py-1 text-sm font-black text-slate-900 hover:bg-warning/90">
        Iniciar sesión
      </Link>
    );
  }
  if (isConflicto) {
    return (
      <Link href="/viajes" className="ml-3 inline-flex items-center rounded-lg bg-danger-action px-3 py-1 text-sm font-black text-white hover:bg-danger-action/90">
        Ver viajes
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => void publicarSyncSnapshot()} className="ml-3 inline-flex items-center rounded-lg border border-current px-3 py-1 text-sm font-bold hover:bg-white/10">
      Reintentar
    </button>
  );
}

export function EstadoSincronizacionGlobal() {
  const [mounted, setMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<GlobalSyncSnapshot>(obtenerUltimoSyncSnapshot());

  useEffect(() => {
    setMounted(true);
    let cancelado = false;
    void calcularSyncSnapshot().then((next) => {
      if (!cancelado) setSnapshot(next);
    });
    const actualizar = (event: Event) => {
      setSnapshot((event as CustomEvent<GlobalSyncSnapshot>).detail);
    };
    const recalcular = () => void publicarSyncSnapshot();
    window.addEventListener(SYNC_STATUS_EVENT, actualizar);
    window.addEventListener("online", recalcular);
    window.addEventListener("offline", recalcular);
    window.addEventListener("ruum:evidencia-sincronizada", recalcular);
    window.addEventListener("ruum:telemetria-sincronizada", recalcular);
    window.addEventListener("ruum:evidencia-pendiente", recalcular);
    window.addEventListener("ruum:telemetria-pendiente", recalcular);
    return () => {
      cancelado = true;
      window.removeEventListener(SYNC_STATUS_EVENT, actualizar);
      window.removeEventListener("online", recalcular);
      window.removeEventListener("offline", recalcular);
      window.removeEventListener("ruum:evidencia-sincronizada", recalcular);
      window.removeEventListener("ruum:telemetria-sincronizada", recalcular);
      window.removeEventListener("ruum:evidencia-pendiente", recalcular);
      window.removeEventListener("ruum:telemetria-pendiente", recalcular);
    };
  }, []);

  if (!mounted) {
    return <div aria-live="polite" aria-atomic="true" className="sr-only" suppressHydrationWarning />;
  }

  // R4: celebrar éxito — verde cuando online y sin pendientes (no solo null)
  if (snapshot.status === "todo_sincronizado") {
    if (typeof navigator !== "undefined" && !navigator.onLine) return null;
    // Mostrar banner verde sutil (auto-dismiss visual no necesario: SincronizacionBadge ya persiste)
    return (
      <div aria-live="polite" aria-atomic="true" className={`mx-auto mt-3 flex w-[min(100%-24px,1120px)] items-center gap-2 rounded-xl border px-4 py-2 font-body text-sm font-semibold ${CLASES.todo_sincronizado}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>Sincronizado ✓ — todo al día</span>
        <span className="ml-auto font-body text-xs opacity-70">Conectado</span>
      </div>
    );
  }

  return (
    <div aria-live="polite" aria-atomic="true" className={`mx-auto mt-3 flex w-[min(100%-24px,1120px)] items-center justify-between gap-2 rounded-xl border px-4 py-2 font-body text-sm font-semibold ${CLASES[snapshot.status]}`}>
      <span>{snapshot.message}</span>
      <AccionRequeridaCTA snapshot={snapshot} />
    </div>
  );
}

