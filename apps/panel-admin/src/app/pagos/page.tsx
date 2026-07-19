"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso, PassportCard } from "@ruum/ui";
import { listarPagosAdmin, type DatosPagosAdmin } from "@ruum/api/services";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

type Pago = Database["public"]["Tables"]["pagos"]["Row"];
type Payout = Database["public"]["Tables"]["payouts_conductor"]["Row"];
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
      registrado_en: "2026-07-15T12:00:00.000Z",
      stripe_payment_intent_id: "pi_demo_4242",
      stripe_event_id: "evt_demo_paid"
    }
  ],
  pasaportes: [],
  payoutsConductores: [],
  datosBancariosConductores: [],
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
    <div className="admin-responsive-table">
      <table className="w-full min-w-[860px] border-separate border-spacing-0 font-body text-sm">
      <caption className="sr-only">Registro de pagos y payouts</caption>
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th key={columna} className="border-b border-ink/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">
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
  return <span className="rounded-full border border-status-info/30 bg-status-info-soft px-2.5 py-1 font-body text-xs font-semibold text-status-info">{children}</span>;
}

function ultimos4(valor: string | null | undefined) {
  if (!valor) return "Pendiente";
  return `•••• ${valor.slice(-4)}`;
}

function pasaporteConTrasladoId(pasaporte: Pasaporte): pasaporte is Pasaporte & { traslado_id: string } {
  return Boolean(pasaporte.traslado_id);
}

export default function PaginaPagosAdmin() {
  const [filtroPendientes, setFiltroPendientes] = useState(false);
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
        if (puedeUsarDatosDemo()) {
          setDatos(DATOS_DEMO);
          setEsDemo(true);
        } else {
          setDatos({ pagosUsuarios: [], pasaportes: [], payoutsConductores: [], datosBancariosConductores: [], conductores: [] });
          setEsDemo(false);
        }
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  useEffect(() => {
    setFiltroPendientes(new URLSearchParams(window.location.search).get("filtro") === "pendientes");
  }, []);

  const pasaportePorId = useMemo(
    () => new Map<string, Pasaporte>(datos.pasaportes.filter(pasaporteConTrasladoId).map((p) => [p.traslado_id, p])),
    [datos.pasaportes]
  );
  const conductorPorId = useMemo(() => new Map<string, Conductor>(datos.conductores.map((c) => [c.id, c])), [datos.conductores]);
  const pagos = filtroPendientes ? datos.pagosUsuarios.filter((pago) => pago.estado === "pendiente") : datos.pagosUsuarios;
  const payouts = filtroPendientes ? datos.payoutsConductores.filter((payout) => payout.estado === "pendiente") : datos.payoutsConductores;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold">Pagos</h1>
      <p className="mt-1 font-body text-sm text-text-secondary">Cobros de usuarios, pagos a conductores y datos bancarios operativos.</p>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">No se pudieron cargar datos reales de Supabase; se muestra un registro de ejemplo.</Aviso>
        </div>
      )}

      {cargando ? (
        <p className="mt-8 font-body text-sm text-text-tertiary">Cargando pagos...</p>
      ) : (
        <section className="mt-6 grid gap-6">
          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Pagos de usuarios</h2>
            <Tabla columnas={["Traslado", "Vehículo", "Tarifa", "Método", "Estatus", "Stripe PaymentIntent", "Evento Stripe", "Fecha"]}>
              {pagos.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-text-tertiary">No hay pagos registrados.</td></tr>
              ) : (
                pagos.map((pago: Pago) => {
                  const pasaporte = pago.traslado_id ? pasaportePorId.get(pago.traslado_id) : null;
                  const vehiculo = pasaporte ? [pasaporte.vehiculo_marca, pasaporte.vehiculo_modelo].filter(Boolean).join(" ") : "Sin pasaporte";
                  return (
                    <tr key={pago.id} className="align-top">
                      <td className="border-b border-ink/10 px-3 py-3" data-label="Traslado">
                        {pago.traslado_id ? (
                          <Link href={`/viajes/${pago.traslado_id}`} className="text-status-info">
                            {pago.traslado_id.slice(0, 8).toUpperCase()}
                          </Link>
                        ) : (
                          <span className="text-text-tertiary">Sin traslado</span>
                        )}
                      </td>
                      <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Vehículo">{vehiculo}</td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum" data-label="Tarifa">{moneda(pago.monto)}</td>
                      <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Método">{pago.metodo} · {pago.momento.replaceAll("_", " ")}</td>
                      <td className="border-b border-ink/10 px-3 py-3" data-label="Estatus"><Badge>{pago.estado}</Badge></td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-admin-tabla text-text-secondary" data-label="PaymentIntent">{pago.stripe_payment_intent_id ?? "Pendiente"}</td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-admin-tabla text-text-secondary" data-label="Evento">{pago.stripe_event_id ?? "Sin evento"}</td>
                      <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Fecha">{fecha(pago.registrado_en)}</td>
                    </tr>
                  );
                })
              )}
            </Tabla>
          </PassportCard>

          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Pagos a conductores</h2>
            <Tabla columnas={["Conductor", "Periodo", "Bruto", "Ajustes", "Deposito neto", "Estatus", "Referencia", "Procesado"]}>
              {payouts.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-text-tertiary">No hay payouts registrados.</td></tr>
              ) : (
                payouts.map((payout: Payout) => {
                  const conductor = conductorPorId.get(payout.conductor_id);
                  return (
                    <tr key={payout.id} className="align-top">
                      <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Conductor">{conductor?.nombre ?? payout.conductor_id.slice(0, 8)}</td>
                      <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Periodo">{payout.periodo_inicio} → {payout.periodo_fin}</td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum" data-label="Bruto">{moneda(payout.monto_bruto)}</td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum" data-label="Ajustes">{moneda(payout.ajustes)}</td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum" data-label="Depósito neto">{moneda(payout.monto_neto)}</td>
                      <td className="border-b border-ink/10 px-3 py-3" data-label="Estatus"><Badge>{payout.estado}</Badge></td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-admin-tabla text-text-secondary" data-label="Referencia">{payout.referencia_pago ?? "Pendiente"}</td>
                      <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Procesado">{fecha(payout.procesado_en)}</td>
                    </tr>
                  );
                })
              )}
            </Tabla>
          </PassportCard>

          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Datos bancarios de conductores</h2>
            <Tabla columnas={["Conductor", "Banco", "CLABE", "Tarjeta", "Estado", "Actualizado"]}>
              {datos.datosBancariosConductores.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-text-tertiary">No hay datos bancarios registrados.</td></tr>
              ) : (
                datos.datosBancariosConductores.map((cuenta) => {
                  const conductor = conductorPorId.get(cuenta.conductor_id);
                  return (
                    <tr key={cuenta.id} className="align-top">
                      <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Conductor">{conductor?.nombre ?? cuenta.conductor_id.slice(0, 8)}</td>
                      <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Banco">{cuenta.banco}</td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-admin-tabla text-text-secondary" data-label="CLABE">{ultimos4(cuenta.clabe)}</td>
                      <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-admin-tabla text-text-secondary" data-label="Tarjeta">{ultimos4(cuenta.numero_tarjeta)}</td>
                      <td className="border-b border-ink/10 px-3 py-3" data-label="Estado"><Badge>{cuenta.estado.replaceAll("_", " ")}</Badge></td>
                      <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Actualizado">{fecha(cuenta.actualizado_en)}</td>
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
