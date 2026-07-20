"use client";

import { useEffect, useState } from "react";
import { calcularSyncSnapshot, obtenerUltimoSyncSnapshot, publicarSyncSnapshot, SYNC_STATUS_EVENT, type GlobalSyncSnapshot } from "../lib/offline-sync-status";

const CLASES: Record<GlobalSyncSnapshot["status"], string> = {
  todo_sincronizado: "border-success/30 bg-success/10 text-success",
  sin_conexion: "border-warning/40 bg-warning/10 text-warning",
  pendientes: "border-route-action/35 bg-route-soft text-route-action",
  sincronizando: "border-route-action/35 bg-route-soft text-route-action",
  accion_requerida: "border-warning/40 bg-warning/10 text-warning",
  error_recuperable: "border-warning/40 bg-warning/10 text-warning",
  conflicto_revision: "border-danger-action/45 bg-danger-soft text-danger-action"
};

export function EstadoSincronizacionGlobal() {
  const [snapshot, setSnapshot] = useState<GlobalSyncSnapshot>(obtenerUltimoSyncSnapshot());

  useEffect(() => {
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

  if (snapshot.status === "todo_sincronizado") return null;

  return (
    <div className={`mx-auto mt-3 w-[min(100%-24px,1120px)] rounded-xl border px-4 py-2 font-body text-sm font-semibold ${CLASES[snapshot.status]}`}>
      {snapshot.message}
    </div>
  );
}

