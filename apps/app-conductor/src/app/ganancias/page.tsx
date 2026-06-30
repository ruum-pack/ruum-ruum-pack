"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { GANANCIAS_DEMO, RESUMEN_SEMANAL_DEMO } from "../../lib/datos-demo";

type EstadoCuentaStripe = Database["public"]["Enums"]["estado_cuenta_stripe"];
type EstatusEconomico = "pagado" | "pendiente" | "revocado" | "en_revision" | "ajustado";

interface RegistroGanancia {
  fecha: string;
  ruta: string;
  monto: number;
  gastos: number;
  estatus: EstatusEconomico;
  liberacion: string;
}

const REGISTROS: RegistroGanancia[] = [
  ...GANANCIAS_DEMO.map((registro, i) => ({
    ...registro,
    estatus: registro.estatus === "pagado" ? "pagado" : registro.estatus === "pendiente" ? "pendiente" : "en_revision",
    liberacion: ["2026-06-26", "2026-06-26", "2026-07-03"][i] ?? "2026-07-03"
  })) as RegistroGanancia[],
  {
    fecha: "2026-06-27",
    ruta: "CDMX → Toluca",
    monto: 1300,
    gastos: 80,
    estatus: "ajustado",
    liberacion: "2026-07-03"
  },
  {
    fecha: "2026-06-28",
    ruta: "Querétaro → CDMX",
    monto: 1600,
    gastos: 0,
    estatus: "revocado",
    liberacion: "En revisión"
  }
];

const ETIQUETA_ESTATUS: Record<EstatusEconomico, string> = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  revocado: "Revocado",
  en_revision: "En revisión",
  ajustado: "Ajustado"
};

const ESTILO_ESTATUS: Record<EstatusEconomico, string> = {
  pagado: "bg-ok-soft text-ok border-ok/25",
  pendiente: "bg-warn-soft text-warn border-warn/40",
  revocado: "bg-danger-soft text-danger border-danger/25",
  en_revision: "bg-route-soft text-route border-route/25",
  ajustado: "bg-ink/[0.05] text-ink/65 border-ink/15"
};

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
  const [conectando, setConectando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) return;
      try {
        const cliente = crearClienteNavegador();
        const { data } = await cliente.from("cuentas_conductor_stripe").select("estado").maybeSingle();
        setEstadoCuenta(data?.estado ?? "sin_cuenta");
      } catch {
        setEstadoCuenta("sin_cuenta");
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
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos iniciar la conexión con Stripe.");
      setConectando(false);
    }
  }

  const resumen = useMemo(() => {
    const ganancias = REGISTROS.reduce((total, registro) => total + registro.monto, 0);
    const gastos = REGISTROS.reduce((total, registro) => total + registro.gastos, 0);
    const retenciones = REGISTROS.filter((registro) => registro.estatus === "revocado" || registro.estatus === "en_revision").reduce(
      (total, registro) => total + registro.monto,
      0
    );
    const ajustes = REGISTROS.filter((registro) => registro.estatus === "ajustado").reduce((total, registro) => total + registro.gastos, 0);
    return {
      ganancias,
      gastos,
      ajustes,
      retenciones,
      deposito: Math.max(0, ganancias + gastos - ajustes - retenciones)
    };
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
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

      <div className="mt-4">
        <Aviso tono="info">
          El detalle de payouts sigue usando datos de ejemplo hasta conectar viajes cobrados y transferencias reales.
        </Aviso>
      </div>

      {tieneSupabaseConfigurado() && (
        <section className="mt-6">
          <PassportCard>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Cuenta de pagos (Stripe)</p>
            {error && (
              <div className="mt-2">
                <Aviso tono="peligro">{error}</Aviso>
              </div>
            )}
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
                  {conectando ? "Conectando…" : estadoCuenta === "sin_cuenta" ? "Conectar Stripe" : "Continuar configuración"}
                </Button>
              )}
            </div>
          </PassportCard>
        </section>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              {fecha(RESUMEN_SEMANAL_DEMO.fecha_pago)} · {RESUMEN_SEMANAL_DEMO.metodo}
            </p>
          </div>
          <dl className="mt-5 grid gap-3 font-body text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="text-ink/45">Ganancias generadas</dt>
              <dd className="font-mono-ruum">{moneda(RESUMEN_SEMANAL_DEMO.ganancias_generadas)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="text-ink/45">Gastos registrados y autorizados</dt>
              <dd className="font-mono-ruum">{moneda(RESUMEN_SEMANAL_DEMO.gastos_autorizados)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="text-ink/45">Ajustes o retenciones</dt>
              <dd className="font-mono-ruum">{moneda(RESUMEN_SEMANAL_DEMO.ajustes)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="font-semibold text-ink">Depósito final</dt>
              <dd className="font-mono-ruum font-semibold">{moneda(RESUMEN_SEMANAL_DEMO.deposito_final)}</dd>
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
          {REGISTROS.map((registro) => (
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
                <span className={`rounded-full border px-3 py-1.5 text-center font-body text-xs font-semibold ${ESTILO_ESTATUS[registro.estatus]}`}>
                  {ETIQUETA_ESTATUS[registro.estatus]}
                </span>
              </div>
            </PassportCard>
          ))}
        </div>
      </section>
    </main>
  );
}
