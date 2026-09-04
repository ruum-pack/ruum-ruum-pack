"use client";

import { useRouter } from "next/navigation";
import { aceptarCotizacionUsuario } from "@ruum/api/services";
import { Aviso, Button } from "@ruum/ui";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { useTrasladoRealtime } from "../../../state/AppStateProvider";

export function AceptarCotizacion({
  trasladoId,
  tipoPago = "anticipado"
}: {
  trasladoId: string;
  tipoPago?: "anticipado" | "al_cierre" | null;
}) {
  const router = useRouter();
  const { aceptandoCotizacion: procesando, errorAceptacion: error, actualizar } = useTrasladoRealtime(trasladoId);

  async function aceptar() {
    actualizar({ aceptandoCotizacion: true, errorAceptacion: null });
    try {
      await aceptarCotizacionUsuario(crearClienteNavegador(), trasladoId);
      actualizar({ cotizacionAceptada: true, aceptandoCotizacion: false });
      router.refresh();
    } catch (e) {
      actualizar({
        errorAceptacion: e instanceof Error ? e.message : "No se pudo aceptar la tarifa",
        aceptandoCotizacion: false
      });
    }
  }

  return (
    <div className="mt-6">
      <p className="mb-3 font-body text-sm text-ink/65">
        {tipoPago === "anticipado"
          ? "Al aceptar podrás realizar el pago anticipado por el precio cotizado."
          : "Al aceptar, el servicio se confirmará sin solicitar un pago inicial."}
      </p>
      {error && <Aviso tono="danger">{error}</Aviso>}
      <Button onClick={aceptar} disabled={procesando}>{procesando ? "Aceptando…" : "Aceptar cotización"}</Button>
    </div>
  );
}
