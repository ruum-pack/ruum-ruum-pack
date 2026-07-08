"use client";

import { useEffect, useRef, useState } from "react";
import { Aviso, Button } from "@ruum/ui";
import { activarSoporteEmergenciaConductor } from "@ruum/api/services";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { crearClienteNavegador } from "../../../lib/supabase-browser";

const SEGUNDOS_CONFIRMACION = 3;

export function Emergencia911({ trasladoId }: { trasladoId: string }) {
  const [procesando, setProcesando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(SEGUNDOS_CONFIRMACION);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const intervaloRef = useRef<number | null>(null);

  function limpiarConfirmacion() {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervaloRef.current) {
      window.clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      limpiarConfirmacion();
    };
  }, []);

  async function activar() {
    limpiarConfirmacion();
    setConfirmando(false);
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      await activarSoporteEmergenciaConductor(cliente, trasladoId);
      window.location.href = "tel:911";
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos activar soporte de emergencia.");
    } finally {
      setProcesando(false);
    }
  }

  function manejarTapEmergencia() {
    if (procesando) {
      return;
    }

    if (confirmando) {
      void activar();
      return;
    }

    setError(null);
    setConfirmando(true);
    setSegundosRestantes(SEGUNDOS_CONFIRMACION);

    const terminaEn = Date.now() + SEGUNDOS_CONFIRMACION * 1000;
    intervaloRef.current = window.setInterval(() => {
      setSegundosRestantes(Math.max(1, Math.ceil((terminaEn - Date.now()) / 1000)));
    }, 250);

    timeoutRef.current = window.setTimeout(() => {
      limpiarConfirmacion();
      setConfirmando(false);
      setSegundosRestantes(SEGUNDOS_CONFIRMACION);
    }, SEGUNDOS_CONFIRMACION * 1000);
  }

  return (
    <div className="mt-6 rounded-lg border border-danger/25 bg-danger-soft px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-body text-sm font-semibold text-danger">Emergencia / 911</p>
          <p className="mt-1 font-body text-xs text-ink/65">
            Activa alerta prioritaria para Torre de Control y llama a emergencias.
          </p>
        </div>
        <Button
          variant={confirmando ? "peligro" : "secundario"}
          className={confirmando ? "w-full sm:w-auto sm:min-w-[18rem]" : "w-full sm:w-auto"}
          onClick={manejarTapEmergencia}
          disabled={procesando}
          aria-live="polite"
        >
          {procesando
            ? TEXTOS_CARGANDO.activando
            : confirmando
              ? `¿Confirmar emergencia? Toca de nuevo · ${segundosRestantes}s`
              : "Emergencia / 911"}
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
