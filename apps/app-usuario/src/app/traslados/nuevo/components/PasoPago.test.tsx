/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PasoPago } from "./PasoPago";

vi.mock("../../../PagoStripe", () => ({
  PagoStripe: ({ trasladoId, monto }: { trasladoId: string; monto: number }) => (
    <button type="button">Pagar {trasladoId} {monto}</button>
  )
}));

describe("PasoPago", () => {
  it("muestra Stripe al concluir una solicitud con tarifa, aunque el registro legado indique al_cierre", () => {
    render(
      <PasoPago
        trasladoCreado={{ id: "traslado-1", tipoPago: "al_cierre", precioCotizado: 1200 }}
        pagoConfirmado={false}
        setPagoConfirmado={vi.fn()}
        errorAceptacion={null}
        onReintentarAceptacion={vi.fn()}
        aceptandoCotizacion={false}
        cotizacionAceptada
      />
    );

    expect(screen.getByText(/Completa el pago seguro con Stripe/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pagar traslado-1 1200/i })).toBeInTheDocument();
    expect(screen.queryByText(/pago al cierre/i)).not.toBeInTheDocument();
  });
});
