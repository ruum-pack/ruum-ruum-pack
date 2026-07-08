import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

import { Aviso, PassportCard } from "@ruum/ui";

const REPORTES = [
  {
    categoria: "Operativos",
    reportes: ["Viajes por día/semana/zona/tipo de servicio", "Tiempo promedio de asignación", "Tiempo promedio de traslado", "Cancelaciones", "Incidencias"]
  },
  {
    categoria: "Financieros",
    reportes: ["Ingresos por periodo", "Pagos a conductores", "Gastos autorizados", "Margen estimado", "Viajes pendientes de cobro", "Pagos pendientes"]
  },
  {
    categoria: "De conductores",
    reportes: ["Viajes realizados", "Calificación", "Incidencias", "Disponibilidad", "Ganancias", "Documentos vencidos"]
  },
  {
    categoria: "De usuarios o empresas",
    reportes: ["Viajes solicitados", "Frecuencia de uso", "Tipo de servicio", "Facturación", "Incidencias"]
  }
];

/* Valores de ejemplo — se reemplazarán por datos reales cuando el motor
   de reportes esté conectado. Se muestran como "—" para evitar confusión
   con datos operativos reales. */
const METRICAS: [string, string][] = [
  ["Viajes esta semana", "—"],
  ["Asignación promedio", "—"],
  ["Traslado promedio", "—"],
  ["Incidencias abiertas", "—"],
  ["Pendiente de cobro", "—"],
  ["Gastos autorizados", "—"]
];

export default function PaginaReportesAdmin() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold">Reportes</h1>
      <p className="mt-1 font-body text-sm text-ink/55">Indicadores básicos para operación, finanzas, conductores y cuentas empresariales.</p>

      <div className="mt-4 grid gap-2">
        <Aviso tono="info">En MVP los reportes se mantienen básicos. Reportes corporativos avanzados y exportación quedan fuera de alcance.</Aviso>
        <Aviso tono="atencion">Los indicadores muestran &quot;—&quot; hasta que el motor de reportes esté conectado. No reflejan datos reales de operación.</Aviso>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {METRICAS.map(([label, value]) => (
          <PassportCard key={label}>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">{label}</p>
            <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
          </PassportCard>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {REPORTES.map((grupo) => (
          <PassportCard key={grupo.categoria}>
            <h2 className="font-display text-xl font-semibold">{grupo.categoria}</h2>
            <ul className="mt-4 grid gap-2">
              {grupo.reportes.map((reporte) => (
                <li key={reporte} className="rounded-lg border border-ink/10 px-4 py-3 font-body text-sm text-ink/70">
                  {reporte}
                </li>
              ))}
            </ul>
          </PassportCard>
        ))}
      </section>
    </main>
  );
}
