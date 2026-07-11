"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { aceptarCotizacionUsuario } from "@ruum/api/services";
import { Aviso, Button } from "@ruum/ui";
import { crearClienteNavegador } from "../../../lib/supabase-browser";

export function AceptarCotizacion({ trasladoId, tipoPago }: { trasladoId: string; tipoPago: "anticipado" | "al_cierre" }) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aceptar() {
    setProcesando(true);
    setError(null);
    try {
      await aceptarCotizacionUsuario(crearClienteNavegador(), trasladoId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aceptar la cotización.");
      setProcesando(false);
    }
  }

  return (
    <div className="mt-6">
      <p className="mb-3 font-body text-sm text-ink/65">
        {tipoPago === "anticipado"
          ? "Al aceptar podrás realizar el pago anticipado por el precio cotizado."
          : "Al aceptar, el servicio se confirmará sin solicitar un pago inicial."}
      </p>
      {error && <Aviso tono="peligro">{error}</Aviso>}
      <Button onClick={aceptar} disabled={procesando}>{procesando ? "Aceptando…" : "Aceptar cotización"}</Button>
    </div>
  );
}
