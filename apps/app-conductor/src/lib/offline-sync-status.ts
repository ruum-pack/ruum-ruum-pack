import type { OfflineSyncStatus } from "./offline-active-trip-cache";
import { contarColaEvidencia } from "./cola-offline";
import { contarColaTelemetria } from "./cola-telemetria-offline";

export interface GlobalSyncSnapshot {
  status: OfflineSyncStatus;
  pendingEvidence: number;
  pendingTelemetry: number;
  message: string;
  updatedAt: string;
}

const EVENTO_SYNC_STATUS = "ruum:sync-status-updated";
let ultimoSnapshot: GlobalSyncSnapshot = {
  status: "todo_sincronizado",
  pendingEvidence: 0,
  pendingTelemetry: 0,
  message: "Todo sincronizado.",
  updatedAt: new Date(0).toISOString()
};

function mensaje(status: OfflineSyncStatus, pendientes: number) {
  if (status === "sin_conexion") return pendientes > 0 ? `${pendientes} elementos pendientes sin conexión.` : "Sin conexión.";
  if (status === "pendientes") return `${pendientes} elementos pendientes.`;
  if (status === "sincronizando") return "Sincronizando información local.";
  if (status === "accion_requerida") return "Acción requerida para continuar sincronización.";
  if (status === "error_recuperable") return "Error recuperable. Se reintentará automáticamente.";
  if (status === "conflicto_revision") return "Conflicto enviado a revisión.";
  return "Todo sincronizado.";
}

export function obtenerUltimoSyncSnapshot() {
  return ultimoSnapshot;
}

export async function calcularSyncSnapshot(statusPreferido?: OfflineSyncStatus): Promise<GlobalSyncSnapshot> {
  const [pendingEvidence, pendingTelemetry] = await Promise.all([contarColaEvidencia(), contarColaTelemetria()]);
  const pendientes = pendingEvidence + pendingTelemetry;
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const status: OfflineSyncStatus =
    statusPreferido ?? (!online ? "sin_conexion" : pendientes > 0 ? "pendientes" : "todo_sincronizado");

  return {
    status,
    pendingEvidence,
    pendingTelemetry,
    message: mensaje(status, pendientes),
    updatedAt: new Date().toISOString()
  };
}

export async function publicarSyncSnapshot(statusPreferido?: OfflineSyncStatus) {
  ultimoSnapshot = await calcularSyncSnapshot(statusPreferido);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<GlobalSyncSnapshot>(EVENTO_SYNC_STATUS, { detail: ultimoSnapshot }));
  }
  return ultimoSnapshot;
}

export const SYNC_STATUS_EVENT = EVENTO_SYNC_STATUS;

