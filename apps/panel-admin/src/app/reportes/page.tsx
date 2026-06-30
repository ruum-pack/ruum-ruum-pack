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

const METRICAS = [
  ["Viajes esta semana", "42"],
  ["Asignación promedio", "18 min"],
  ["Traslado promedio", "54 min"],
  ["Incidencias abiertas", "7"],
  ["Pendiente de cobro", "$18,400"],
  ["Gastos autorizados", "$3,250"]
];

export default function PaginaReportesAdmin() {
  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      <h1 className="font-display text-2xl font-semibold">Reportes</h1>
      <p className="mt-1 font-body text-sm text-ink/55">Indicadores básicos para operación, finanzas, conductores y cuentas empresariales.</p>

      <div className="mt-4">
        <Aviso tono="info">En MVP los reportes se mantienen básicos. Reportes corporativos avanzados y exportación quedan fuera de alcance.</Aviso>
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
