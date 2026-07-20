"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { limpiarSesionIntegral, type ResultadoLimpiezaSesion } from "./session-cleanup";

export function mensajePendientesLogout(resultado: ResultadoLimpiezaSesion) {
  return `No se cerró la sesión: hay ${resultado.pendingEvidence} evidencia(s) y ${resultado.pendingTelemetry} punto(s) de telemetría pendientes. Sincroniza antes de salir.`;
}

export function useCerrarSesion() {
  const router = useRouter();
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [errorCerrarSesion, setErrorCerrarSesion] = useState<string | null>(null);

  const cerrarSesion = useCallback(async () => {
    setCerrandoSesion(true);
    setErrorCerrarSesion(null);
    try {
      const resultado = await limpiarSesionIntegral();
      if (resultado.blocked) {
        setErrorCerrarSesion(mensajePendientesLogout(resultado));
        return resultado;
      }
      if (!resultado.ok) setErrorCerrarSesion("La sesión se cerró parcialmente. Reabre la app antes de iniciar con otra cuenta.");
      router.replace("/onboarding");
      router.refresh();
      return resultado;
    } catch {
      setErrorCerrarSesion("No pudimos cerrar la sesión de forma segura. Intenta nuevamente.");
      return null;
    } finally {
      setCerrandoSesion(false);
    }
  }, [router]);

  return { cerrarSesion, cerrandoSesion, errorCerrarSesion, limpiarErrorCerrarSesion: () => setErrorCerrarSesion(null) };
}
