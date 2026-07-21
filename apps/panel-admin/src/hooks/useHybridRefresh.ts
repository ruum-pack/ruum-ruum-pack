"use client";
import { useEffect, useRef } from "react";

type Opciones = { refrescar: () => void | Promise<void>; intervaloRespaldoMs?: number; activo?: boolean };

/** Realtime/visibilidad primero; polling lento solo como red de seguridad. */
export function useHybridRefresh({ refrescar, intervaloRespaldoMs = 180_000, activo = true }: Opciones) {
  const actual = useRef(refrescar);
  actual.current = refrescar;
  useEffect(() => {
    if (!activo) return;
    const ejecutar = () => { if (!document.hidden && navigator.onLine) void actual.current(); };
    const intervalo = window.setInterval(ejecutar, intervaloRespaldoMs);
    window.addEventListener("online", ejecutar);
    document.addEventListener("visibilitychange", ejecutar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("online", ejecutar);
      document.removeEventListener("visibilitychange", ejecutar);
    };
  }, [activo, intervaloRespaldoMs]);
}
