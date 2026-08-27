"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Button } from "@ruum/ui";
import { formatearPrecio } from "@ruum/shared/utils";
import { tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { PagoStripe, tieneStripePublicoConfigurado } from "../../PagoStripe";

export interface PagoTrasladoProps {
  trasladoId: string;
  monto: number;
}

export function PagoTraslado({ trasladoId, monto }: PagoTrasladoProps) {
  const router = useRouter();
  const [pagado, setPagado] = useState(false);

  if (pagado) {
    return (
      <div className="mt-6">
        <Aviso tono="info">
          Pago confirmado. Puede tardar unos segundos en reflejarse mientras Stripe termina de procesarlo.
        </Aviso>
        <Button variant="secondary" className="mt-3" onClick={() => router.refresh()}>
          Actualizar estado
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-body text-xs uppercase tracking-wide text-ink/45">Pago pendiente</p>
        <p className="font-mono-ruum text-sm font-medium text-ink/80">{formatearPrecio(monto)}</p>
      </div>

      {!tieneSupabaseConfigurado() ? (
        <Aviso tono="danger">Supabase no está configurado. No se puede capturar el pago.</Aviso>
      ) : !tieneStripePublicoConfigurado() ? (
        <Aviso tono="info">
          Stripe no está configurado — el cobro real no está disponible en este entorno.
        </Aviso>
      ) : (
        <PagoStripe trasladoId={trasladoId} onPagado={() => setPagado(true)} />
      )}
    </div>
  );
}
