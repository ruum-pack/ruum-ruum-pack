"use client";

import { useEffect, useState } from "react";
import { obtenerEstadoTrackingNativo, soportaTrackingNativo, type BackgroundTrackingStatus } from "../lib/background-tracking";

function etiqueta(status: BackgroundTrackingStatus) {
  if (status.lastError === "location_permission_missing") return "Permiso de ubicación revocado";
  if (!status.active) return "Seguimiento detenido";
  if (status.pendingCount > 0) return `${status.pendingCount} ubicaciones pendientes de sincronizar`;
  if (status.lastLocationAt && Date.now() - status.lastLocationAt > 120_000) return "GPS limitado o ubicación retrasada";
  if (status.lastSentAt) return `Ubicación compartida · último envío ${new Date(status.lastSentAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
  return "Iniciando seguimiento de ubicación";
}

export function EstadoTrackingGlobal() {
  const [status, setStatus] = useState<BackgroundTrackingStatus | null>(null);
  useEffect(() => {
    if (!soportaTrackingNativo()) return;
    let mounted = true;
    const refresh = () => void obtenerEstadoTrackingNativo().then((next) => { if (mounted) setStatus(next); }).catch(() => undefined);
    refresh();
    const id = window.setInterval(refresh, 15_000);
    return () => { mounted = false; window.clearInterval(id); };
  }, []);
  if (!status?.active && !status?.lastError) return null;
  const warning = Boolean(status?.lastError || (status?.lastLocationAt && Date.now() - status.lastLocationAt > 120_000));
  return <div role="status" className={`mx-auto mt-3 w-[min(100%-24px,1120px)] rounded-xl border px-4 py-2 font-body text-sm font-semibold ${warning ? "border-warning/40 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}`}>{status ? etiqueta(status) : "Consultando seguimiento"}</div>;
}
