import { Capacitor, registerPlugin } from "@capacitor/core";

export interface BackgroundTrackingStatus {
  remoteUrl?: string;
  userId?: string | null;
  active: boolean;
  tripId?: string | null;
  lastLocationAt: number;
  lastSentAt: number;
  pendingCount: number;
  lastError?: string | null;
}

interface BackgroundTrackingPlugin {
  start(options: {
    userId: string;
    tripId: string;
    tripCode?: string;
    tripState: string;
    supabaseUrl: string;
    anonKey: string;
    accessToken: string;
    refreshToken?: string;
  }): Promise<BackgroundTrackingStatus>;
  stop(): Promise<void>;
  clearCredentials(): Promise<void>;
  requestBackgroundLocation(): Promise<{ granted: boolean; state: string }>;
  getStatus(): Promise<BackgroundTrackingStatus>;
  updateTripState(options: { tripState: string }): Promise<BackgroundTrackingStatus>;
}

const BackgroundTracking = registerPlugin<BackgroundTrackingPlugin>("BackgroundTracking");

export function soportaTrackingNativo() {
  return Capacitor.getPlatform() === "android";
}

export async function iniciarTrackingNativo(options: Parameters<BackgroundTrackingPlugin["start"]>[0]) {
  return BackgroundTracking.start(options);
}

export async function detenerTrackingNativo() { return BackgroundTracking.stop(); }
export async function limpiarCredencialesTrackingNativo() { return BackgroundTracking.clearCredentials(); }
export async function solicitarUbicacionSegundoPlanoNativa() { return BackgroundTracking.requestBackgroundLocation(); }

export async function obtenerEstadoTrackingNativo() {
  return BackgroundTracking.getStatus();
}

export async function actualizarEstadoTrackingNativo(tripState: string) {
  return BackgroundTracking.updateTripState({ tripState });
}
