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
  | "recuperacion_vista"
  | "recuperacion_enviada"
  | "recuperacion_exitosa"
  | "recuperacion_error"
  | "traslado_nuevo_visto"
  | "traslado_nuevo_sin_sesion"
  | "traslado_nuevo_enviado"
  | "traslado_nuevo_exitoso"
  | "traslado_nuevo_error";

export function registrarEventoUx(evento: EventoUxUsuario, propiedades: PropiedadesAnalitica = {}) {
  if (typeof window === "undefined") return;

  const detalle = {
    evento,
    ...propiedades
  };

  window.dispatchEvent(new CustomEvent("ruum:ux", { detail: detalle }));
  window.dataLayer?.push({ event: `ruum_${evento}`, ...propiedades });
}
