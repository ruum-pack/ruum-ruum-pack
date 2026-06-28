"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { GANANCIAS_DEMO, RESUMEN_SEMANAL_DEMO } from "../../lib/datos-demo";

type EstadoCuentaStripe = Database["public"]["Enums"]["estado_cuenta_stripe"];

const ETIQUETA_ESTATUS: Record<(typeof GANANCIAS_DEMO)[number]["estatus"], string> = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  en_revision: "En revisión"
};

const TONO_ESTATUS: Record<(typeof GANANCIAS_DEMO)[number]["estatus"], "info" | "atencion"> = {
  pagado: "info",
  pendiente: "atencion",
  en_revision: "atencion"
};

const ETIQUETA_CUENTA_STRIPE: Record<EstadoCuentaStripe, string> = {
  pendiente_onboarding: "Configuración en proceso",
  activa: "Cuenta activa",
  rechazada: "Cuenta rechazada por Stripe",
  deshabilitada: "Cuenta deshabilitada"
};

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
        // Sin sesión real o sin fila todavía — se trata igual que "sin_cuenta".
        setEstadoCuenta("sin_cuenta");
      }
    }
    cargar();
  }, []);

  // PRD §4.6 — Stripe Connect (Express) para el pago semanal al conductor.
  // No se pudo probar contra una cuenta de Stripe real en este entorno; la
  // Edge Function (crear-cuenta-conductor-stripe) está validada con
  // `deno check`, no con un onboarding real completado.
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

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="font-body text-sm text-ink/55 hover:text-ink">
        ← Panel
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold">Mis ganancias</h1>

      <div className="mt-4">
        <Aviso tono="info">
          El resumen y el detalle por viaje de abajo son 100% datos de ejemplo — los payouts reales (PRD §4.6) se
          modelan en <code>payouts_conductor</code> (Fase 6), pero todavía no hay transferencias reales que mostrar
          sin una cuenta de Stripe conectada y traslados cobrados de verdad.
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
            <div className="mt-3 flex items-center justify-between">
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

      <section className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Resumen de la semana</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 font-body text-sm">
            <dt className="text-ink/45">Ganancias generadas</dt>
            <dd className="text-right font-mono-ruum">${RESUMEN_SEMANAL_DEMO.ganancias_generadas.toLocaleString("es-MX")}</dd>
            <dt className="text-ink/45">Gastos autorizados</dt>
            <dd className="text-right font-mono-ruum">${RESUMEN_SEMANAL_DEMO.gastos_autorizados.toLocaleString("es-MX")}</dd>
            <dt className="text-ink/45">Ajustes</dt>
            <dd className="text-right font-mono-ruum">${RESUMEN_SEMANAL_DEMO.ajustes.toLocaleString("es-MX")}</dd>
            <dt className="font-semibold text-ink">Depósito final</dt>
            <dd className="text-right font-mono-ruum font-semibold">
              ${RESUMEN_SEMANAL_DEMO.deposito_final.toLocaleString("es-MX")}
            </dd>
          </dl>
          <p className="mt-3 border-t border-ink/10 pt-3 font-body text-xs text-ink/50">
            {RESUMEN_SEMANAL_DEMO.fecha_pago} · {RESUMEN_SEMANAL_DEMO.metodo}
          </p>
        </PassportCard>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="font-display text-base font-semibold">Detalle por viaje</h2>
        {GANANCIAS_DEMO.map((registro) => (
          <PassportCard key={`${registro.fecha}-${registro.ruta}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-body text-sm font-medium">{registro.ruta}</p>
                <p className="font-body text-xs text-ink/45">{registro.fecha}</p>
              </div>
              <p className="font-mono-ruum text-sm">${registro.monto.toLocaleString("es-MX")}</p>
            </div>
            {registro.gastos > 0 && (
              <p className="mt-1 font-body text-xs text-ink/50">Gastos autorizados: ${registro.gastos}</p>
            )}
            <div className="mt-2">
              <Aviso tono={TONO_ESTATUS[registro.estatus]}>{ETIQUETA_ESTATUS[registro.estatus]}</Aviso>
            </div>
          </PassportCard>
        ))}
      </section>
    </main>
  );
}
