"use client";
import { useEffect } from "react";
import { useLiveRegion } from "../components/LiveRegionProvider";
import { recordOperationalEvent } from "../lib/observability";

const EVENTOS_A11Y_USUARIO: Record<string, string> = {
  "ruum:cotizacion-calculada": "Cotización calculada con éxito.",
  "ruum:traslado-creado": "Solicitud de traslado creada exitosamente.",
  "ruum:pago-procesado": "Pago procesado correctamente.",
  "ruum:pago-fallido": "No se pudo procesar el pago. Por favor revisa tu método de pago.",
  "ruum:sesion-cerrada": "Sesión cerrada correctamente."
};

export function OperationalAccessibilityBridge() {
  const live = useLiveRegion();

  useEffect(() => {
    const handlers = Object.entries(EVENTOS_A11Y_USUARIO).map(([name, message]) => {
      const h = () => live.announce(message);
      window.addEventListener(name, h);
      return [name, h] as const;
    });

    const offline = () => live.alert("Sin conexión a Internet. Algunas funciones no estarán disponibles.");
    const online = () => live.announce("Conexión a Internet restablecida.");
    const rejected = (event: PromiseRejectionEvent) => {
      void recordOperationalEvent("startup_failure", {
        reason: event.reason instanceof Error ? event.reason.name : "unhandled_rejection"
      });
    };

    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("unhandledrejection", rejected);

    return () => {
      handlers.forEach(([n, h]) => window.removeEventListener(n, h));
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("unhandledrejection", rejected);
    };
  }, [live]);

  return null;
}
