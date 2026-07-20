"use client";
import { useEffect, useRef } from "react";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import { orquestarSincronizacionOffline } from "../lib/orquestador-sync-offline";
import { publicarSyncSnapshot } from "../lib/offline-sync-status";

export function SincronizadorEvidenciaOffline() {
  const sincronizando = useRef(false);

  useEffect(() => {
    async function drenar() {
      if (!tieneSupabaseConfigurado() || sincronizando.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      sincronizando.current = true;
      try {
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
