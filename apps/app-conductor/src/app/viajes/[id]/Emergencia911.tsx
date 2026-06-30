"use client";

import { useState } from "react";
import { Aviso, Button } from "@ruum/ui";
import { activarSoporteEmergenciaConductor } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";

export function Emergencia911({ trasladoId, esDemo }: { trasladoId: string; esDemo: boolean }) {
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activar() {
    setProcesando(true);
    setError(null);
    try {
      if (!esDemo && tieneSupabaseConfigurado()) {
        const cliente = crearClienteNavegador();
        await activarSoporteEmergenciaConductor(cliente, trasladoId);
      }
      window.location.href = "tel:911";
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos activar soporte de emergencia.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-danger/25 bg-danger-soft px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-body text-sm font-semibold text-danger">Emergencia / 911</p>
          <p className="mt-1 font-body text-xs text-ink/65">
            Activa alerta prioritaria para Torre de Control y llama a emergencias en un toque.
          </p>
        </div>
        <Button onClick={activar} disabled={procesando}>
          {procesando ? "Activando..." : "Emergencia / 911"}
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}
    </div>
  );
}
