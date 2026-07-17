"use client";

import { useCallback, useEffect, useRef } from "react";
import { registrarEventoRegistroConductor } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

type EventoRegistro = Parameters<typeof registrarEventoRegistroConductor>[1]["evento"];

export function useRegistrationTelemetry(paso: number) {
  const sesionRef = useRef("");
  const inicioRef = useRef(0);
  const ultimoPasoRef = useRef(0);

  const registrarTelemetria = useCallback((evento: EventoRegistro, pasoEvento?: number, codigo?: string) => {
    if (!tieneSupabaseConfigurado() || !sesionRef.current) return;
    const duracionMs = inicioRef.current ? Math.max(0, Date.now() - inicioRef.current) : undefined;
    void registrarEventoRegistroConductor(crearClienteNavegador(), {
      sesionId: sesionRef.current,
      evento,
      paso: pasoEvento,
      codigo,
      duracionMs
    }).catch(() => {
      // La observabilidad nunca debe bloquear ni distraer el alta.
    });
  }, []);

  useEffect(() => {
    if (sesionRef.current) return;
    sesionRef.current = crypto.randomUUID();
    inicioRef.current = Date.now();
    registrarTelemetria("registro_iniciado", 1);
  }, [registrarTelemetria]);

  useEffect(() => {
    const pasoVisible = paso + 1;
    if (!sesionRef.current || ultimoPasoRef.current === pasoVisible) return;
    ultimoPasoRef.current = pasoVisible;
    registrarTelemetria("paso_visto", pasoVisible);
  }, [paso, registrarTelemetria]);

  return registrarTelemetria;
}
