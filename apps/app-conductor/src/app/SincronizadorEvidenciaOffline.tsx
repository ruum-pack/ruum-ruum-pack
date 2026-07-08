"use client";

"use client";
import { useEffect, useRef } from "react";
import { sincronizarColaEvidencia } from "../lib/cola-offline";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";

export function SincronizadorEvidenciaOffline() {
  const sincronizando = useRef(false);

  useEffect(() => {
    async function drenar() {
      if (!tieneSupabaseConfigurado() || sincronizando.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      sincronizando.current = true;
      try {
        const cliente = crearClienteNavegador();
        await sincronizarColaEvidencia(cliente);
      } catch {
        // La pantalla de evidencia muestra el error contextual cuando está
        // abierta. El listener global queda silencioso para no interrumpir
        // otras tareas del conductor.
      } finally {
        sincronizando.current = false;
      }
    }

    void drenar();
    window.addEventListener("online", drenar);
    return () => window.removeEventListener("online", drenar);
  }, []);

  return null;
}
