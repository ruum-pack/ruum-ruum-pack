/**
 * OFF-002 — Ahorro batería para Galaxy A14 y gama media
 * Adapta frecuencia de tracking según nivel de batería y modo ahorro.
 * Usa Battery Status API (navigator.getBattery) con fallback a 1.0 (100%).
 */

export interface BatteryState {
  level: number; // 0..1
  charging: boolean;
  lowPower: boolean; // level < 0.2 o charging==false && level <0.2
}

export async function getBatteryState(): Promise<BatteryState> {
  const fallback: BatteryState = { level: 1, charging: true, lowPower: false };
  try {
    const nav = navigator as unknown as { getBattery?: () => Promise<{ level: number; charging: boolean }> };
    if (!nav.getBattery) return fallback;
    const bat = await nav.getBattery();
    const lowPower = bat.level < 0.2 && !bat.charging;
    return { level: bat.level, charging: bat.charging, lowPower };
  } catch {
    return fallback;
  }
}

export function intervaloTrackingMs(opts: { disponible: boolean; enViaje: boolean; battery: BatteryState }): number {
  const { disponible, enViaje, battery } = opts;
  const base = disponible || enViaje ? 20_000 : 60_000;
  // OFF-002: si batería baja (<20% y no cargando) duplica intervalo para ahorrar
  if (battery.lowPower || battery.level < 0.2) return Math.max(base, 60_000);
  // Si batería <0.5 y no en viaje, usar 60s
  if (!enViaje && battery.level < 0.5 && !battery.charging) return 60_000;
  return base;
}
