"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import { listarPagosAdmin, type DatosPagosAdmin } from "@ruum/api/services";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AdminPageHeader, AdminFiltroActivo, limpiarParamsFiltroUrl } from "../admin-ui";
import { AdminLoadingState, AdminEmptyState, AdminErrorState, AdminTabs, AdminBadge } from "../admin-components";

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

const TABS = [
  { value: "usuarios", label: "Pagos de usuarios" },
  { value: "conductores", label: "Pagos a conductores" },
  { value: "bancarios", label: "Datos bancarios" }
] as const;

type TabValor = (typeof TABS)[number]["value"];

function moneda(monto: number | null | undefined) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(monto ?? 0);
}

function fecha(fechaIso: string | null | undefined) {
  if (!fechaIso) return "Pendiente";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fechaIso));
}

function ultimos4(valor: string | null | undefined) {
  if (!valor) return "Pendiente";
  return `•••• ${valor.slice(-4)}`;
}

function pasaporteConTrasladoId(pasaporte: Pasaporte): pasaporte is Pasaporte & { traslado_id: string } {
  return Boolean(pasaporte.traslado_id);
}

function exportarCSV(datos: DatosPagosAdmin) {
  const filas = datos.pagosUsuarios.map((p) => ({
    Traslado: p.traslado_id,
    Monto: p.monto,
    Metodo: p.metodo,
    Estado: p.estado,
    Fecha: p.registrado_en
  }));
  const blob = new Blob([JSON.stringify(filas, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pagos-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PaginaPagosAdmin() {
  const [filtroPendientes, setFiltroPendientes] = useState(false);
  const [tab, setTab] = useState<TabValor>("usuarios");
  const [datos, setDatos] = useState<DatosPagosAdmin>(DATOS_DEMO);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
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
        setError("No pudimos cargar los datos de pagos.");
        setEsDemo(false);
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

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

  if (cargando) {
    return (
      <main className="admin-page-shell">
        <AdminLoadingState label="Cargando datos de pagos" />
      </main>
    );
  }

  if (error && !esDemo && datos.pagosUsuarios.length === 0) {
    return (
      <main className="admin-page-shell">
        <AdminErrorState title={error} action={<Button onClick={cargar}>Reintentar</Button>} />
      </main>
    );
  }

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Administración"
        titulo="Pagos"
        descripcion="Cobros de usuarios, pagos a conductores y datos bancarios operativos."
        estadoConexion={esDemo ? "demo" : "datos_en_vivo"}
        contadorResultados={datos.pagosUsuarios.length + datos.payoutsConductores.length}
        accionesSecundarias={<Button variant="quiet" onClick={() => exportarCSV(datos)} disabled={datos.pagosUsuarios.length === 0}>Exportar</Button>}
      />

      {filtroPendientes && (
        <AdminFiltroActivo
          etiqueta="Pagos pendientes"
          onLimpiar={() => { setFiltroPendientes(false); limpiarParamsFiltroUrl(["filtro"]); }}
        />
      )}

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">No se pudieron cargar datos reales de Supabase; se muestra un registro de ejemplo.</Aviso>
        </div>
      )}

      <div className="mt-6">
        <AdminTabs items={TABS.map((t) => ({ value: t.value, label: t.label }))} value={tab} onValueChange={setTab} label="Secciones de pagos" />
      </div>

      <section className="mt-4 grid gap-6">
        {tab === "usuarios" && (
          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Pagos de usuarios</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px] border-separate border-spacing-0 font-body text-sm">
                <caption className="sr-only">Pagos de usuarios</caption>
                <thead>
                  <tr>
                    {["Traslado", "Vehículo", "Tarifa", "Método", "Estatus", "PaymentIntent", "Evento Stripe", "Fecha"].map((col) => (
                      <th key={col} className="border-b border-ink/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagos.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-text-tertiary">No hay pagos registrados.</td></tr>
                  ) : pagos.map((pago: Pago) => {
                    const pasaporte = pago.traslado_id ? pasaportePorId.get(pago.traslado_id) : null;
                    const vehiculo = pasaporte ? [pasaporte.vehiculo_marca, pasaporte.vehiculo_modelo].filter(Boolean).join(" ") : "Sin pasaporte";
                    return (
                      <tr key={pago.id} className="align-top">
                        <td className="border-b border-ink/10 px-3 py-3" data-label="Traslado">
                          {pago.traslado_id ? <Link href={`/viajes/${pago.traslado_id}`} className="text-status-info">{pago.traslado_id.slice(0, 8).toUpperCase()}</Link> : <span className="text-text-tertiary">Sin traslado</span>}
                        </td>
                        <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Vehículo">{vehiculo}</td>
                        <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum" data-label="Tarifa">{moneda(pago.monto)}</td>
                        <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Método">{pago.metodo} · {pago.momento.replaceAll("_", " ")}</td>
                        <td className="border-b border-ink/10 px-3 py-3" data-label="Estatus"><AdminBadge tone={pago.estado === "pendiente" ? "warning" : pago.estado === "fallido" ? "danger" : "success"}>{pago.estado}</AdminBadge></td>
                        <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-admin-tabla text-text-secondary" data-label="PaymentIntent">{pago.stripe_payment_intent_id ?? "Pendiente"}</td>
                        <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-admin-tabla text-text-secondary" data-label="Evento">{pago.stripe_event_id ?? "Sin evento"}</td>
                        <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Fecha">{fecha(pago.registrado_en)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PassportCard>
        )}

        {tab === "conductores" && (
          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Pagos a conductores</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px] border-separate border-spacing-0 font-body text-sm">
                <caption className="sr-only">Pagos a conductores</caption>
                <thead>
                  <tr>
                    {["Conductor", "Periodo", "Bruto", "Ajustes", "Depósito neto", "Estatus", "Referencia", "Procesado"].map((col) => (
                      <th key={col} className="border-b border-ink/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payouts.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-text-tertiary">No hay payouts registrados.</td></tr>
                  ) : payouts.map((payout: Payout) => {
                    const conductor = conductorPorId.get(payout.conductor_id);
                    return (
                      <tr key={payout.id} className="align-top">
                        <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Conductor">{conductor?.nombre ?? payout.conductor_id.slice(0, 8)}</td>
                        <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Periodo">{payout.periodo_inicio} → {payout.periodo_fin}</td>
                        <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum" data-label="Bruto">{moneda(payout.monto_bruto)}</td>
                        <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum" data-label="Ajustes">{moneda(payout.ajustes)}</td>
                        <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum" data-label="Depósito neto">{moneda(payout.monto_neto)}</td>
                        <td className="border-b border-ink/10 px-3 py-3" data-label="Estatus"><AdminBadge tone={payout.estado === "pendiente" ? "warning" : payout.estado === "fallido" ? "danger" : "success"}>{payout.estado}</AdminBadge></td>
                        <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-admin-tabla text-text-secondary" data-label="Referencia">{payout.referencia_pago ?? "Pendiente"}</td>
                        <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Procesado">{fecha(payout.procesado_en)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PassportCard>
        )}

        {tab === "bancarios" && (
          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Datos bancarios de conductores</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px] border-separate border-spacing-0 font-body text-sm">
                <caption className="sr-only">Datos bancarios</caption>
                <thead>
                  <tr>
                    {["Conductor", "Banco", "CLABE", "Tarjeta", "Estado", "Actualizado"].map((col) => (
                      <th key={col} className="border-b border-ink/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datos.datosBancariosConductores.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-text-tertiary">No hay datos bancarios registrados.</td></tr>
                  ) : datos.datosBancariosConductores.map((cuenta) => {
                    const conductor = conductorPorId.get(cuenta.conductor_id);
                    return (
                      <tr key={cuenta.id} className="align-top">
                        <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Conductor">{conductor?.nombre ?? cuenta.conductor_id.slice(0, 8)}</td>
                        <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Banco">{cuenta.banco}</td>
                        <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-admin-tabla text-text-secondary" data-label="CLABE">{ultimos4(cuenta.clabe)}</td>
                        <td className="border-b border-ink/10 px-3 py-3 font-mono-ruum text-admin-tabla text-text-secondary" data-label="Tarjeta">{ultimos4(cuenta.numero_tarjeta)}</td>
                        <td className="border-b border-ink/10 px-3 py-3" data-label="Estado"><AdminBadge>{cuenta.estado.replaceAll("_", " ")}</AdminBadge></td>
                        <td className="border-b border-ink/10 px-3 py-3 text-text-secondary" data-label="Actualizado">{fecha(cuenta.actualizado_en)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PassportCard>
        )}
      </section>
    </main>
  );
}
