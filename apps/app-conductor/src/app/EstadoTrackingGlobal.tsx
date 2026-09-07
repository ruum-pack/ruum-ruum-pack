"use client";

import { useEffect, useState } from "react";
import { obtenerEstadoTrackingNativo, soportaTrackingNativo, type BackgroundTrackingStatus } from "../lib/background-tracking";
import { getBatteryState } from "../lib/battery";

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
    let id: number | undefined;
    const refresh = () => void obtenerEstadoTrackingNativo().then((next) => { if (mounted) setStatus(next); }).catch(() => undefined);
    const iniciar = async () => {
      refresh();
      const battery = await getBatteryState().catch(() => ({ level: 1, charging: true, lowPower: false } as const));
      const intervalo = battery.lowPower || battery.level < 0.2 ? 60_000 : 15_000;
      id = window.setInterval(refresh, intervalo);
    };
    void iniciar();
    return () => { mounted = false; if (id !== undefined) window.clearInterval(id); };
  }, []);
  if (!status?.active && !status?.lastError) return null;
  const warning = Boolean(status?.lastError || (status?.lastLocationAt && Date.now() - status.lastLocationAt > 120_000));
  return <output className={`mx-auto mt-3 block w-[min(100%-24px,1120px)] rounded-xl border px-4 py-2 font-body text-sm font-semibold ${warning ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300" : "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>{status ? etiqueta(status) : "Consultando seguimiento"}</output>;
}
