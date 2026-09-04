"use client";

type ValorAnalitica = string | number | boolean | null | undefined;
type PropiedadesAnalitica = Record<string, ValorAnalitica>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, ValorAnalitica>>;
  }
}

export type EventoUxUsuario =
  | "login_visto"
  | "login_enviado"
  | "login_exitoso"
  | "login_error"
  | "registro_visto"
  | "registro_paso_visto"
  | "registro_enviado"
  | "registro_exitoso"
  | "registro_error"
  | "onboarding_visto"
  | "onboarding_completado"
  | "recuperacion_vista"
  | "recuperacion_enviada"
  | "recuperacion_exitosa"
  | "recuperacion_error"
  | "traslado_nuevo_visto"
  | "traslado_nuevo_sin_sesion"
  | "traslado_nuevo_enviado"
  | "traslado_nuevo_exitoso"
  | "traslado_nuevo_error"
  | "tarifa_gate_vista"
  | "tarifa_gate_calculada"
  | "tarifa_gate_no_disponible"
  | "tarifa_gate_aceptada"
  | "tarifa_gate_abandonada"
  | "soporte_enviado"
  | "soporte_visto"
  // 3.1 Eventos mejorados Fase 3
  | "traslado_paso_iniciado"
  | "traslado_paso_completado"
  | "tarifa_validacion_fallida"
  | "traslado_abandono"
  | "traslado_geocodificacion_error"
  | "traslado_rate_limit_hit"
  | "traslado_validacion_fallida";

export interface EventoTraslado {
  nombre: string;
  propiedades: {
    paso?: number;
    duracion_ms?: number;
    duracion_total_ms?: number;
    monto?: number;
    tarifa_anterior?: number;
    tarifa_nueva?: number;
    error_code?: string;
    razon?: string;
    timestamp: string;
  };
}

export function registrarEventoUx(evento: EventoUxUsuario, propiedades: PropiedadesAnalitica = {}) {
  if (typeof window === "undefined") return;

  const base: PropiedadesAnalitica = {
    timestamp: new Date().toISOString(),
    ...propiedades,
  };

  const detalle = {
    evento,
    ...base,
  };

  window.dispatchEvent(new CustomEvent("ruum:ux", { detail: detalle }));
  window.dataLayer?.push({ event: `ruum_${evento}`, ...base });

  // 3.1 forward a Sentry breadcrumb (no-op si no hay DSN)
  try {
    const w = window as unknown as { Sentry?: { addBreadcrumb?: (b: unknown) => void } };
    w.Sentry?.addBreadcrumb?.({ category: "ux", message: evento, data: base, level: "info" });
  } catch {}
}

// Helpers Fase 3 — tracking de duración por paso y abandono
const pasoInicioMs = new Map<number, number>();
let flujoInicioMs: number | null = null;

export function iniciarFlujoTraslado() {
  flujoInicioMs = Date.now();
  pasoInicioMs.clear();
}

export function registrarPasoIniciado(paso: number) {
  pasoInicioMs.set(paso, Date.now());
  if (flujoInicioMs === null) flujoInicioMs = Date.now();
  registrarEventoUx("traslado_paso_iniciado", { paso, timestamp: new Date().toISOString() });
}

export function registrarPasoCompletado(paso: number) {
  const inicio = pasoInicioMs.get(paso);
  const duracion_ms = inicio ? Date.now() - inicio : undefined;
  registrarEventoUx("traslado_paso_completado", { paso, duracion_ms, timestamp: new Date().toISOString() });
}

export function registrarAbandono(paso: number, razon: string) {
  const duracion_total_ms = flujoInicioMs ? Date.now() - flujoInicioMs : undefined;
  registrarEventoUx("traslado_abandono", { paso, duracion_total_ms, razon, timestamp: new Date().toISOString() });
}
