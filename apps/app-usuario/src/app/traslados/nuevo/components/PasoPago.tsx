"use client";
import { memo } from "react";
import Link from "next/link";
import { Button, PassportCard, Aviso } from "@ruum/ui";
import { PagoStripe } from "../../../PagoStripe";

export interface PasoPagoProps {
  trasladoCreado: {
    id: string;
    tipoPago: "anticipado" | "al_cierre";
    precioCotizado: number | null;
  };
  pagoConfirmado: boolean;
  setPagoConfirmado: (v: boolean) => void;
  errorAceptacion: string | null;
  onReintentarAceptacion: () => void;
  aceptandoCotizacion: boolean;
  cotizacionAceptada: boolean;
}

export const PasoPago = memo(function PasoPago({
  trasladoCreado,
  pagoConfirmado,
  setPagoConfirmado,
  errorAceptacion,
  onReintentarAceptacion,
  aceptandoCotizacion,
  cotizacionAceptada
}: PasoPagoProps) {
  return (
    <div className="space-y-4">
      <PassportCard>
        <div className="grid gap-2">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Solicitud creada</p>
          {trasladoCreado.precioCotizado != null ? (
            <p className="font-display text-4xl font-bold leading-tight text-ink">
              ${Number(trasladoCreado.precioCotizado).toLocaleString("es-MX")}
              <span className="ml-1 font-body text-sm font-normal text-ink/55">MXN</span>
            </p>
          ) : (
            <p className="font-body text-sm leading-6 text-ink/65">
              Nuestro equipo aplicará la tarifa correspondiente. Te avisaremos y podrás aceptar la cotización desde tu Pasaporte Digital.
            </p>
          )}
        </div>
      </PassportCard>

      {pagoConfirmado ? (
        <Aviso tono="info">
          Pago confirmado. Puede tardar unos segundos en reflejarse mientras Stripe termina de procesarlo. Da seguimiento a tu traslado desde “Mis traslados”.
        </Aviso>
      ) : trasladoCreado.precioCotizado == null ? (
        <Aviso tono="info">
          No se requiere pago en este momento. Te avisaremos en cuanto exista una cotización autorizada.
        </Aviso>
      ) : trasladoCreado.tipoPago === "al_cierre" ? (
        <Aviso tono="info">
          Tu traslado quedó confirmado con pago al cierre. El cobro se activará más adelante, cuando el servicio esté por concluir.
        </Aviso>
      ) : errorAceptacion ? (
        <div className="space-y-3">
          <Aviso tono="danger">{errorAceptacion}</Aviso>
          <Button variant="secondary" onClick={onReintentarAceptacion}>
            Reintentar
          </Button>
        </div>
      ) : aceptandoCotizacion || !cotizacionAceptada ? (
        <p className="font-body text-sm text-ink/55">Confirmando tarifa para iniciar el pago…</p>
      ) : (
        <div className="space-y-3">
          <PagoStripe
            trasladoId={trasladoCreado.id}
            monto={trasladoCreado.precioCotizado ?? 0}
            onPagado={() => setPagoConfirmado(true)}
          />
        </div>
      )}

      <div className="pt-2">
        <Link
          href="/mis-viajes"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/20 bg-mist px-4 py-2 font-body text-sm font-medium text-ink transition hover:border-ink/40"
        >
          Ver mis traslados
        </Link>
      </div>
    </div>
  );
});
