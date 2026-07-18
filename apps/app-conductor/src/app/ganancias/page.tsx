"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso, Button, Card, DriverEarning, FinancialAmount, FinancialCard } from "@ruum/ui";
import { type EstadoEconomicoExplicito } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { obtenerConductorActual, obtenerGananciasConductor } from "@ruum/api/services";

type Payout = Database["public"]["Tables"]["payouts_conductor"]["Row"];

interface RegistroGanancia {
  fecha: string;
  ruta: string;
  monto: number;
  gastos: number;
  estatus: EstadoEconomicoExplicito;
  liberacion: string;
}

const FECHA_PAGO_INICIAL = "Pendiente";

function fecha(fechaIso: string) {
  if (!fechaIso.includes("-")) return fechaIso;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City"
  }).format(new Date(`${fechaIso}T12:00:00-06:00`));
}

export default function PaginaGanancias() {
  const [registros, setRegistros] = useState<RegistroGanancia[]>([]);
  const [resumenSemanal, setResumenSemanal] = useState({
    ganancias_generadas: 0,
    gastos_autorizados: 0,
    ajustes: 0,
    deposito_final: 0,
    fecha_pago: FECHA_PAGO_INICIAL,
    metodo: "Sin pago programado",
    estatus: "sin_calcular" as EstadoEconomicoExplicito
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setError("Supabase no está configurado. No se pueden consultar ganancias reales.");
        return;
      }
      try {
        const cliente = crearClienteNavegador();
        const conductor = await obtenerConductorActual(cliente);
        if (!conductor) {
          return;
        }

        const datos = await obtenerGananciasConductor(cliente, conductor.id);
        const reales = datos.payouts.map((payout: Payout) => ({
          fecha: payout.periodo_fin,
          ruta: `Periodo ${payout.periodo_inicio} -> ${payout.periodo_fin}`,
          monto: Number(payout.monto_bruto ?? 0),
          gastos: Math.max(0, Number(payout.monto_neto ?? 0) - Number(payout.monto_bruto ?? 0)),
          estatus: payout.estado === "procesado" ? "pagado" : payout.estado === "pendiente" ? "programado" : "rechazado",
          liberacion: payout.procesado_en ? payout.procesado_en.slice(0, 10) : "Pendiente"
        })) as RegistroGanancia[];

        setRegistros(reales);
        const actual = datos.payouts[0];
        setResumenSemanal(
          actual
            ? {
                ganancias_generadas: Number(actual.monto_bruto ?? 0),
                gastos_autorizados: Math.max(0, Number(actual.monto_neto ?? 0) - Number(actual.monto_bruto ?? 0)),
                ajustes: Number(actual.ajustes ?? 0),
                deposito_final: Number(actual.monto_neto ?? 0),
                fecha_pago: actual.procesado_en ? actual.procesado_en.slice(0, 10) : actual.periodo_fin,
                metodo: actual.referencia_pago ? "Transferencia bancaria" : "Depósito programado",
                estatus: actual.estado === "procesado" ? "pagado" : actual.estado === "pendiente" ? "programado" : "rechazado"
              }
            : {
                ganancias_generadas: 0,
                gastos_autorizados: 0,
                ajustes: 0,
                deposito_final: 0,
                fecha_pago: FECHA_PAGO_INICIAL,
                metodo: "Sin pago programado",
                estatus: "sin_calcular"
              }
        );
      } catch (err) {
        setError(traducirErrorOperativo(err, "No pudimos cargar tus ganancias."));
      }
    }
    cargar();
  }, []);

  const resumen = useMemo(() => {
    const ganancias = registros.reduce((total, registro) => total + registro.monto, 0);
    const gastos = registros.reduce((total, registro) => total + registro.gastos, 0);
    const retenciones = registros.filter((registro) => registro.estatus === "rechazado" || registro.estatus === "retenido" || registro.estatus === "en_validacion").reduce(
      (total, registro) => total + registro.monto,
      0
    );
    const ajustes = 0;
    const estatusResumen: EstadoEconomicoExplicito = registros.length > 0 ? "confirmado" : "sin_calcular";
    return {
      ganancias,
      gastos,
      ajustes,
      retenciones,
      deposito: Math.max(0, ganancias + gastos - ajustes - retenciones),
      vehiculosTrasladados: registros.length,
      estatusResumen
    };
  }, [registros]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/panel" className="font-body text-sm text-text-secondary underline-offset-4 hover:underline">
            Panel
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">Mis ganancias</h1>
          <p className="mt-2 font-body text-sm text-text-secondary">
            Entiende cuánto generaste, qué gastos se autorizaron y cuánto se depositará.
          </p>
        </div>
        <Link href="/viajes">
          <Button variant="secondary">Abrir viajes</Button>
        </Link>
      </header>

      {error && (
        <div className="mt-6">
          <Aviso tono="danger">{error}</Aviso>
        </div>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Vehículos trasladados</p>
          <p className="mt-2 font-display text-2xl font-semibold">{resumen.vehiculosTrasladados}</p>
        </Card>
        <FinancialCard>
          <p className="font-body text-xs uppercase tracking-wide text-[#B7C2D4]">Ganancias</p>
          <DriverEarning amount={resumen.ganancias} status={resumen.estatusResumen} currency="MXN" className="mt-2" amountClassName="font-display text-2xl" />
        </FinancialCard>
        <FinancialCard>
          <p className="font-body text-xs uppercase tracking-wide text-[#B7C2D4]">Gastos autorizados</p>
          <FinancialAmount amount={resumen.gastos} status={resumen.estatusResumen} currency="MXN" className="mt-2" amountClassName="font-display text-2xl" />
        </FinancialCard>
        <FinancialCard>
          <p className="font-body text-xs uppercase tracking-wide text-[#B7C2D4]">Ajustes</p>
          <FinancialAmount amount={resumen.ajustes} status={resumen.estatusResumen} currency="MXN" className="mt-2" amountClassName="font-display text-2xl" />
        </FinancialCard>
        <FinancialCard>
          <p className="font-body text-xs uppercase tracking-wide text-[#B7C2D4]">Retenciones</p>
          <FinancialAmount amount={resumen.retenciones} status={resumen.retenciones > 0 ? "retenido" : resumen.estatusResumen} currency="MXN" className="mt-2" amountClassName="font-display text-2xl" />
        </FinancialCard>
        <FinancialCard>
          <p className="font-body text-xs uppercase tracking-wide text-[#B7C2D4]">Depósito final</p>
          <FinancialAmount amount={resumen.deposito} status={resumenSemanal.estatus} currency="MXN" className="mt-2" amountClassName="font-display text-2xl" />
        </FinancialCard>
      </section>

      <section className="mt-6">
        <FinancialCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-[#B7C2D4]">Pagos recibidos por semana</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-[#E8EDF6]">Resumen semanal</h2>
            </div>
            <p className="font-body text-sm text-[#B7C2D4]">
              {fecha(resumenSemanal.fecha_pago)} · {resumenSemanal.metodo}
            </p>
          </div>
          <dl className="mt-5 grid gap-3 font-body text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-t border-[rgba(122,162,214,0.14)] pt-3">
              <dt className="text-[#B7C2D4]">Ganancias generadas</dt>
              <dd><DriverEarning amount={resumenSemanal.ganancias_generadas} status={resumenSemanal.estatus} currency="MXN" amountClassName="text-sm" /></dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-[rgba(122,162,214,0.14)] pt-3">
              <dt className="text-[#B7C2D4]">Gastos registrados y autorizados</dt>
              <dd><FinancialAmount amount={resumenSemanal.gastos_autorizados} status={resumenSemanal.estatus} currency="MXN" amountClassName="text-sm" /></dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-[rgba(122,162,214,0.14)] pt-3">
              <dt className="text-[#B7C2D4]">Ajustes o retenciones</dt>
              <dd><FinancialAmount amount={resumenSemanal.ajustes} status={resumenSemanal.ajustes > 0 ? "retenido" : resumenSemanal.estatus} currency="MXN" amountClassName="text-sm" /></dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-[rgba(122,162,214,0.14)] pt-3">
              <dt className="font-semibold text-[#E8EDF6]">Depósito final</dt>
              <dd><FinancialAmount amount={resumenSemanal.deposito_final} status={resumenSemanal.estatus} currency="MXN" amountClassName="text-sm font-semibold" /></dd>
            </div>
          </dl>
        </FinancialCard>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-col gap-1">
          <h2 className="font-display text-xl font-semibold">Estatus económico de viajes realizados</h2>
          <p className="font-body text-sm text-text-secondary">Estados: sin calcular, estimado, en validación, confirmado, programado, pagado, retenido y rechazado.</p>
        </div>
        <div className="grid gap-3">
          {registros.length === 0 && (
            <Card>
              <p className="font-body text-sm text-text-secondary">No hay payouts registrados para tu cuenta todavía.</p>
            </Card>
          )}
          {registros.map((registro) => (
            <FinancialCard key={`${registro.fecha}-${registro.ruta}`}>
              <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr_0.8fr_0.8fr_0.8fr] lg:items-center">
                <div>
                  <p className="font-body text-sm font-semibold text-[#E8EDF6]">{registro.ruta}</p>
                  <p className="mt-1 font-body text-xs text-[#B7C2D4]">Fecha del viaje: {fecha(registro.fecha)}</p>
                </div>
                <div>
                  <p className="font-body text-xs uppercase tracking-wide text-[#B7C2D4]">Monto generado</p>
                  <DriverEarning amount={registro.monto} status={registro.estatus} currency="MXN" className="mt-1" amountClassName="text-sm" />
                </div>
                <div>
                  <p className="font-body text-xs uppercase tracking-wide text-[#B7C2D4]">Gastos autorizados</p>
                  <FinancialAmount amount={registro.gastos} status={registro.estatus} currency="MXN" className="mt-1" amountClassName="text-sm" />
                </div>
                <div>
                  <p className="font-body text-xs uppercase tracking-wide text-[#B7C2D4]">Liberación estimada</p>
                  <p className="mt-1 font-body text-sm text-[#E8EDF6]">{fecha(registro.liberacion)}</p>
                </div>
                <FinancialAmount amount={null} status={registro.estatus} currency="MXN" amountClassName="sr-only" auxiliaryText="" />
              </div>
            </FinancialCard>
          ))}
        </div>
      </section>
    </div>
  );
}
