"use client";
import { useEffect, useRef } from "react";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import { orquestarSincronizacionOffline } from "../lib/orquestador-sync-offline";
import { publicarSyncSnapshot } from "../lib/offline-sync-status";
import { purgarColaExpirada } from "../lib/offline";

export function SincronizadorEvidenciaOffline() {
  const sincronizando = useRef(false);

  useEffect(() => {
    // OFF-001 — purga TTL al iniciar app (7d / 15 reintentos) antes de primer sync
    void purgarColaExpirada().catch(() => undefined);

    async function drenar() {
      if (!tieneSupabaseConfigurado() || sincronizando.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      sincronizando.current = true;
      try {
        // Purga just-in-time antes de cada sincronización (huérfanos)
        await purgarColaExpirada().catch(() => undefined);
        const cliente = crearClienteNavegador();
        await orquestarSincronizacionOffline(cliente);
      } catch {
        await publicarSyncSnapshot("error_recuperable");
      } finally {
        sincronizando.current = false;
      }
    }

    void drenar();
    window.addEventListener("online", drenar);
    window.addEventListener("ruum:evidencia-pendiente", drenar);
    window.addEventListener("ruum:telemetria-pendiente", drenar);
    return () => {
      window.removeEventListener("online", drenar);
      window.removeEventListener("ruum:evidencia-pendiente", drenar);
      window.removeEventListener("ruum:telemetria-pendiente", drenar);
    };
  }, []);

  return null;
}
