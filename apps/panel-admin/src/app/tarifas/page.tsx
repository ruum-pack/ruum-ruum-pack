import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

import { Button, PassportCard } from "@ruum/ui";

const FUNCIONES = [
  "Crear tarifa base",
  "Tarifa por kilómetro",
  "Tarifa mínima",
  "Recargos",
  "Pagos al conductor",
  "Gastos autorizados",
  "Tarifas por tipo de viaje o empresariales",
  "Zonas o rutas frecuentes"
];

const VARIABLES = [
  "Distancia",
  "Tiempo estimado",
  "Tipo de vehículo",
  "Tipo de servicio",
  "Viaje local/foráneo/nocturno",
  "Urgencia",
  "Peajes",
  "Combustible",
  "Viáticos",
  "Nivel de riesgo o complejidad"
];

const TARIFAS = [
  ["Local sedán", "$350 base", "$18/km", "$600 mínimo", "Conductor 42%", "Nocturno +18%"],
  ["Foráneo SUV", "$650 base", "$24/km", "$1,200 mínimo", "Conductor 45%", "Peajes autorizados"],
  ["Empresarial agencia", "$500 base", "$20/km", "$900 mínimo", "Conductor 40%", "Condición comercial"]
];

export default function PaginaTarifasAdmin() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tarifas</h1>
          <p className="mt-1 font-body text-sm text-ink/55">Reglas de precio, recargos, pagos al conductor y gastos autorizados.</p>
        </div>
        <Button>Crear tarifa</Button>
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Funciones principales</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {FUNCIONES.map((item) => (
              <span key={item} className="rounded-full border border-ink/10 bg-mist px-3 py-1.5 font-body text-xs font-semibold text-ink/65">
                {item}
              </span>
            ))}
          </div>
        </PassportCard>
        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Variables sugeridas</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {VARIABLES.map((item) => (
              <span key={item} className="rounded-full border border-signal/20 bg-signal-soft px-3 py-1.5 font-body text-xs font-semibold text-ink">
                {item}
              </span>
            ))}
          </div>
        </PassportCard>
      </section>

      <section className="mt-6">
        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Tarifas activas</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] font-body text-sm">
              <caption className="sr-only">Tarifas de servicio configuradas</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink/45">
                  {["Nombre", "Base", "Kilómetro", "Mínima", "Pago conductor", "Recargos / notas"].map((h) => (
                    <th key={h} className="border-b border-ink/10 px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TARIFAS.map((fila) => (
                  <tr key={fila[0]}>
                    {fila.map((celda) => (
                      <td key={celda} className="border-b border-ink/10 px-3 py-3 text-ink/70">{celda}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PassportCard>
      </section>
    </main>
  );
}
