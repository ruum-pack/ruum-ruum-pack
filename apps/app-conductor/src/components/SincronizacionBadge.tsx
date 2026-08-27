"use client";

import { useEffect, useState } from "react";
import {
  calcularSyncSnapshot,
  obtenerUltimoSyncSnapshot,
  publicarSyncSnapshot,
  SYNC_STATUS_EVENT,
  type GlobalSyncSnapshot
} from "../lib/offline-sync-status";

export function SincronizacionBadge() {
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

  const total = snapshot.pendingEvidence + snapshot.pendingTelemetry;

  if (total === 0) {
    return (
      <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/25">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Todo sincronizado
      </span>
    );
  }

  let texto = `Sincronizando ${total} elementos...`;
  let showAlert = false;
  if (snapshot.pendingEvidence > 0) {
    texto = `Sincronizando ${snapshot.pendingEvidence} foto${snapshot.pendingEvidence > 1 ? "s" : ""}... Mantén la app abierta o recupera señal`;
    showAlert = true;
  } else if (snapshot.pendingTelemetry > 0) {
    texto = `Sincronizando telemetría... Mantén la app abierta`;
    showAlert = true;
  }

  return (
    <div className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-4 py-2 rounded-xl text-xs font-semibold leading-normal flex items-center justify-center gap-2 text-center">
      {showAlert && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )}
      <span>{texto}</span>
    </div>
  );
}
