"use client";

"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso, Button, EstatusBadgeEconomico, PassportCard } from "@ruum/ui";
import { TEXTOS_CARGANDO, type EstatusEconomico } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { obtenerConductorActual, obtenerGananciasConductor } from "@ruum/api/services";

type EstadoCuentaStripe = Database["public"]["Enums"]["estado_cuenta_stripe"];
type Payout = Database["public"]["Tables"]["payouts_conductor"]["Row"];

interface RegistroGanancia {
  fecha: string;
  ruta: string;
  monto: number;
  gastos: number;
  estatus: EstatusEconomico;
  liberacion: string;
}

const ETIQUETA_CUENTA_STRIPE: Record<EstadoCuentaStripe, string> = {
  pendiente_onboarding: "Configuración en proceso",
  activa: "Cuenta activa",
  rechazada: "Cuenta rechazada por Stripe",
  deshabilitada: "Cuenta deshabilitada"
};

function moneda(valor: number) {
  return `$${valor.toLocaleString("es-MX")}`;
}

function fecha(fechaIso: string) {
  if (!fechaIso.includes("-")) return fechaIso;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City"
  }).format(new Date(`${fechaIso}T12:00:00-06:00`));
}

export default function PaginaGanancias() {
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuentaStripe | "sin_cuenta" | null>(null);
  const [registros, setRegistros] = useState<RegistroGanancia[]>([]);
  const [resumenSemanal, setResumenSemanal] = useState({
    ganancias_generadas: 0,
    gastos_autorizados: 0,
    ajustes: 0,
    deposito_final: 0,
    fecha_pago: new Date().toISOString().slice(0, 10),
    metodo: "Sin payout programado"
  });
  const [conectando, setConectando] = useState(false);
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
          setEstadoCuenta("sin_cuenta");
          return;
        }

        const datos = await obtenerGananciasConductor(cliente, conductor.id);
        setEstadoCuenta(datos.cuentaStripe?.estado ?? "sin_cuenta");

        const reales = datos.payouts.map((payout: Payout) => ({
          fecha: payout.periodo_fin,
          ruta: `Periodo ${payout.periodo_inicio} -> ${payout.periodo_fin}`,
          monto: Number(payout.monto_bruto ?? 0),
          gastos: Math.max(0, Number(payout.monto_neto ?? 0) - Number(payout.monto_bruto ?? 0)),
          estatus: payout.estado === "procesado" ? "pagado" : payout.estado === "pendiente" ? "pendiente" : "revocado",
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
                metodo: actual.stripe_transfer_id ? "Stripe Connect" : "Transferencia pendiente"
              }
            : {
                ganancias_generadas: 0,
                gastos_autorizados: 0,
                ajustes: 0,
                deposito_final: 0,
                fecha_pago: new Date().toISOString().slice(0, 10),
                metodo: "Sin payout programado"
              }
        );
      } catch (err) {
        setEstadoCuenta("sin_cuenta");
        setError(err instanceof Error ? err.message : "No pudimos cargar tus ganancias.");
      }
    }
    cargar();
  }, []);

  async function conectarStripe() {
    setConectando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const { data, error: errorFuncion } = await cliente.functions.invoke("crear-cuenta-conductor-stripe");
      if (errorFuncion) throw errorFuncion;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("Stripe no devolvió una URL de configuración.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos iniciar la conexión con Stripe.");
      setConectando(false);
    }
  }

  const resumen = useMemo(() => {
    const ganancias = registros.reduce((total, registro) => total + registro.monto, 0);
    const gastos = registros.reduce((total, registro) => total + registro.gastos, 0);
    const retenciones = registros.filter((registro) => registro.estatus === "revocado" || registro.estatus === "en_revision").reduce(
      (total, registro) => total + registro.monto,
      0
    );
    const ajustes = registros.filter((registro) => registro.estatus === "ajustado").reduce((total, registro) => total + registro.gastos, 0);
    return {
      ganancias,
      gastos,
      ajustes,
      retenciones,
      deposito: Math.max(0, ganancias + gastos - ajustes - retenciones),
      vehiculosTrasladados: registros.length
    };
  }, [registros]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="font-body text-sm text-ink/55 underline-offset-4 hover:underline">
            Panel
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">Mis ganancias</h1>
          <p className="mt-2 font-body text-sm text-ink/60">
            Entiende cuánto generaste, qué gastos se autorizaron y cuánto se depositará.
          </p>
        </div>
        <Link href="/viajes">
          <Button variant="secundario">Ver viajes</Button>
        </Link>
      </header>

      {error && (
        <div className="mt-6">
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}

      {tieneSupabaseConfigurado() && (
        <section className="mt-6">
          <PassportCard>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Cuenta de pagos (Stripe)</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-body text-sm">
                {estadoCuenta === null
                  ? "Consultando…"
                  : estadoCuenta === "sin_cuenta"
                    ? "Todavía no has conectado una cuenta de pagos."
                    : ETIQUETA_CUENTA_STRIPE[estadoCuenta]}
              </p>
              {(estadoCuenta === "sin_cuenta" || estadoCuenta === "pendiente_onboarding") && (
                <Button onClick={conectarStripe} disabled={conectando}>
                  {conectando ? TEXTOS_CARGANDO.conectando : estadoCuenta === "sin_cuenta" ? "Conectar Stripe" : "Continuar configuración"}
                </Button>
              )}
            </div>
          </PassportCard>
        </section>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Vehículos trasladados</p>
          <p className="mt-2 font-display text-2xl font-semibold">{resumen.vehiculosTrasladados}</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Ganancias</p>
          <p className="mt-2 font-display text-2xl font-semibold">{moneda(resumen.ganancias)}</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Gastos autorizados</p>
          <p className="mt-2 font-display text-2xl font-semibold">{moneda(resumen.gastos)}</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Ajustes</p>
          <p className="mt-2 font-display text-2xl font-semibold">{moneda(resumen.ajustes)}</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Retenciones</p>
          <p className="mt-2 font-display text-2xl font-semibold">{moneda(resumen.retenciones)}</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Depósito final</p>
          <p className="mt-2 font-display text-2xl font-semibold">{moneda(resumen.deposito)}</p>
        </PassportCard>
      </section>

      <section className="mt-6">
        <PassportCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Pagos recibidos por semana</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Resumen semanal</h2>
            </div>
            <p className="font-body text-sm text-ink/55">
              {fecha(resumenSemanal.fecha_pago)} · {resumenSemanal.metodo}
            </p>
          </div>
          <dl className="mt-5 grid gap-3 font-body text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="text-ink/45">Ganancias generadas</dt>
              <dd className="font-mono-ruum">{moneda(resumenSemanal.ganancias_generadas)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="text-ink/45">Gastos registrados y autorizados</dt>
              <dd className="font-mono-ruum">{moneda(resumenSemanal.gastos_autorizados)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="text-ink/45">Ajustes o retenciones</dt>
              <dd className="font-mono-ruum">{moneda(resumenSemanal.ajustes)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="font-semibold text-ink">Depósito final</dt>
              <dd className="font-mono-ruum font-semibold">{moneda(resumenSemanal.deposito_final)}</dd>
            </div>
          </dl>
        </PassportCard>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-col gap-1">
          <h2 className="font-display text-xl font-semibold">Estatus económico de viajes realizados</h2>
          <p className="font-body text-sm text-ink/55">Estados: Pagado, Pendiente, Revocado, En revisión y Ajustado.</p>
        </div>
        <div className="grid gap-3">
          {registros.length === 0 && (
            <PassportCard>
              <p className="font-body text-sm text-ink/55">No hay payouts registrados para tu cuenta todavía.</p>
            </PassportCard>
          )}
          {registros.map((registro) => (
            <PassportCard key={`${registro.fecha}-${registro.ruta}`}>
              <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr_0.8fr_0.8fr_0.8fr] lg:items-center">
                <div>
                  <p className="font-body text-sm font-semibold">{registro.ruta}</p>
                  <p className="mt-1 font-body text-xs text-ink/45">Fecha del viaje: {fecha(registro.fecha)}</p>
                </div>
                <div>
                  <p className="font-body text-xs uppercase tracking-wide text-ink/45">Monto generado</p>
                  <p className="mt-1 font-mono-ruum text-sm">{moneda(registro.monto)}</p>
                </div>
                <div>
                  <p className="font-body text-xs uppercase tracking-wide text-ink/45">Gastos autorizados</p>
                  <p className="mt-1 font-mono-ruum text-sm">{moneda(registro.gastos)}</p>
                </div>
                <div>
                  <p className="font-body text-xs uppercase tracking-wide text-ink/45">Liberación estimada</p>
                  <p className="mt-1 font-body text-sm">{fecha(registro.liberacion)}</p>
                </div>
                <EstatusBadgeEconomico estatus={registro.estatus} />
              </div>
            </PassportCard>
          ))}
        </div>
      </section>
    </div>
  );
}
