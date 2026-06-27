import Link from "next/link";
import { Aviso, PassportCard } from "@ruum/ui";
import { GANANCIAS_DEMO, RESUMEN_SEMANAL_DEMO } from "../../lib/datos-demo";

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

export default function PaginaGanancias() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="font-body text-sm text-ink/55 hover:text-ink">
        ← Panel
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold">Mis ganancias</h1>

      <div className="mt-4">
        <Aviso tono="info">
          Esta pantalla es 100% datos de ejemplo. El pago semanal al conductor (PRD §4.6) todavía no tiene una tabla
          propia en el esquema — es un proceso distinto al cobro al usuario (supabase/migrations/0007_pagos.sql) y
          queda pendiente de modelarse junto con la integración de pagos.
        </Aviso>
      </div>

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
