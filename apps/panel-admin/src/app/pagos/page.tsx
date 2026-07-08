"use client";

"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso, PassportCard } from "@ruum/ui";
import { listarPagosAdmin, type DatosPagosAdmin } from "@ruum/api/services";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

type Pago = Database["public"]["Tables"]["pagos"]["Row"];
type Payout = Database["public"]["Tables"]["payouts_conductor"]["Row"];
type CuentaStripe = Database["public"]["Tables"]["cuentas_conductor_stripe"]["Row"];
type Conductor = Database["public"]["Tables"]["conductores"]["Row"];
type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];

const DATOS_DEMO: DatosPagosAdmin = {
  pagosUsuarios: [
    {
      id: "demo-pago-1",
      traslado_id: "demo-admin-002",
      monto: 1800,
      momento: "anticipado",
      estado: "completado",
      metodo: "tarjeta",
      registrado_en: new Date().toISOString(),
      stripe_payment_intent_id: "pi_demo_4242",
      stripe_event_id: "evt_demo_paid"
    }
  ],
  pasaportes: [],
  payoutsConductores: [],
  cuentasStripeConductores: [],
  conductores: []
};

function moneda(monto: number | null | undefined) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(monto ?? 0);
}

function fecha(fechaIso: string | null | undefined) {
  if (!fechaIso) return "Pendiente";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fechaIso));
}

function Tabla({ columnas, children }: { columnas: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-separate border-spacing-0 font-body text-sm">
      <caption className="sr-only">Registro de pagos y payouts</caption>
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th key={columna} className="border-b border-ink/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-route/30 bg-route-soft px-2.5 py-1 font-body text-xs font-semibold text-route-dark">{children}</span>;
}

export default function PaginaPagosAdmin() {
  const [datos, setDatos] = useState<DatosPagosAdmin>(DATOS_DEMO);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setDatos(DATOS_DEMO);
        setEsDemo(true);
        setCargando(false);
        return;
      }

      try {
        const cliente = crearClienteNavegador();
        setDatos(await listarPagosAdmin(cliente));
        setEsDemo(false);
      } catch {
        setDatos(DATOS_DEMO);
        setEsDemo(true);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  const pasaportePorId = useMemo(() => new Map<string, Pasaporte>(datos.pasaportes.map((p) => [p.traslado_id, p])), [datos.pasaportes]);
  const conductorPorId = useMemo(() => new Map<string, Conductor>(datos.conductores.map((c) => [c.id, c])), [datos.conductores]);
  const cuentaPorConductor = useMemo(
    () => new Map<string, CuentaStripe>(datos.cuentasStripeConductores.map((cuenta) => [cuenta.conductor_id, cuenta])),
    [datos.cuentasStripeConductores]
  );

  const pagos = datos.pagosUsuarios;
  const payouts = datos.payoutsConductores;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold">Pagos</h1>
      <p className="mt-1 font-body text-sm text-ink/55">Cobros reales de usuarios, Stripe y payouts de conductores.</p>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">No se pudieron cargar datos reales de Supabase; se muestra un registro de ejemplo.</Aviso>
        </div>
      )}

      {cargando ? (
        <p className="mt-8 font-body text-sm text-ink/50">Cargando pagos...</p>
      ) : (
        <section className="mt-6 grid gap-6">
          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Pagos de usuarios</h2>
            <Tabla columnas={["Viaje", "Vehículo", "Tarifa", "Método", "Estatus", "Stripe PaymentIntent", "Evento Stripe", "Fecha"]}>
              {pagos.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-ink/50">No hay pagos registrados.</td></tr>
              ) : (
                pagos.map((pago: Pago) => {
                  const pasaporte = pasaportePorId.get(pago.traslado_id);
                  const vehiculo = pasaporte ? [pasaporte.vehiculo_marca, pasaporte.vehiculo_modelo].filter(Boolean).join(" ") : "Sin pasaporte";
                  return (
                    <tr key={pago.id} className="align-top">
                      <td className="border-b border-ink/10 px-3 py-3">
                        <Link href={`/viajes/${pago.traslado_id}`} className="text-route-dark">
                          {pago.traslado_id.slice(0, 8).toUpperCase()}
                        </Link>
                      </td>
                      <td className="border-b border-ink/10 px-3 py-3 text-ink/70">{vehiculo}</td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum">{moneda(pago.monto)}</td>
                      <td className="border-b border-ink/10 px-3 py-3 text-ink/70">{pago.metodo} · {pago.momento.replaceAll("_", " ")}</td>
                      <td className="border-b border-ink/10 px-3 py-3"><Badge>{pago.estado}</Badge></td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-xs text-ink/60">{pago.stripe_payment_intent_id ?? "Pendiente"}</td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-xs text-ink/60">{pago.stripe_event_id ?? "Sin evento"}</td>
                      <td className="border-b border-ink/10 px-3 py-3 text-ink/70">{fecha(pago.registrado_en)}</td>
                    </tr>
                  );
                })
              )}
            </Tabla>
          </PassportCard>

          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Pagos a conductores</h2>
            <Tabla columnas={["Conductor", "Periodo", "Bruto", "Ajustes", "Depósito neto", "Estatus", "Stripe Transfer", "Procesado"]}>
              {payouts.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-ink/50">No hay payouts registrados.</td></tr>
              ) : (
                payouts.map((payout: Payout) => {
                  const conductor = conductorPorId.get(payout.conductor_id);
                  return (
                    <tr key={payout.id} className="align-top">
                      <td className="border-b border-ink/10 px-3 py-3 text-ink/70">{conductor?.nombre ?? payout.conductor_id.slice(0, 8)}</td>
                      <td className="border-b border-ink/10 px-3 py-3 text-ink/70">{payout.periodo_inicio} → {payout.periodo_fin}</td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum">{moneda(payout.monto_bruto)}</td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum">{moneda(payout.ajustes)}</td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum">{moneda(payout.monto_neto)}</td>
                      <td className="border-b border-ink/10 px-3 py-3"><Badge>{payout.estado}</Badge></td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-xs text-ink/60">{payout.stripe_transfer_id ?? "Pendiente"}</td>
                      <td className="border-b border-ink/10 px-3 py-3 text-ink/70">{fecha(payout.procesado_en)}</td>
                    </tr>
                  );
                })
              )}
            </Tabla>
          </PassportCard>

          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Cuentas Stripe Connect</h2>
            <Tabla columnas={["Conductor", "Stripe Account", "Estado", "Actualizado"]}>
              {datos.cuentasStripeConductores.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-ink/50">No hay cuentas Stripe Connect registradas.</td></tr>
              ) : (
                datos.cuentasStripeConductores.map((cuenta) => {
                  const conductor = conductorPorId.get(cuenta.conductor_id);
                  return (
                    <tr key={cuenta.id} className="align-top">
                      <td className="border-b border-ink/10 px-3 py-3 text-ink/70">{conductor?.nombre ?? cuenta.conductor_id.slice(0, 8)}</td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-xs text-ink/60">{cuenta.stripe_account_id}</td>
                      <td className="border-b border-ink/10 px-3 py-3"><Badge>{cuenta.estado.replaceAll("_", " ")}</Badge></td>
                      <td className="border-b border-ink/10 px-3 py-3 text-ink/70">{fecha(cuenta.actualizado_en)}</td>
                    </tr>
                  );
                })
              )}
            </Tabla>
          </PassportCard>
        </section>
      )}
    </main>
  );
}
