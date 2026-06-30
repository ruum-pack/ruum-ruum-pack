import { Aviso, Button, PassportCard } from "@ruum/ui";

const ESTADOS = ["Pendiente", "En revisión", "Aprobado", "Rechazado", "Pagado", "Revocado", "Ajustado"];

const PAGOS_USUARIOS = [
  ["RR-TR-10291", "Daniela Fuentes", "Personal", "$1,800", "Tarjeta ****4242", "Pagado", "2026-06-29", "Factura pendiente"],
  ["RR-TR-10302", "Agencia Norte", "Agencia Norte SA", "$3,450", "Transferencia", "En revisión", "2026-06-30", "CFDI solicitado"],
  ["RR-TR-10309", "Ricardo Cervantes", "Personal", "$950", "Tarjeta ****1881", "Pendiente", "Sin pago", "No aplica"]
];

const PAGOS_CONDUCTORES = [
  ["Conductor Demo", "Semana 26", "5", "$6,300", "$420 / $300", "$-150", "$6,450", "2026-07-03", "Pendiente"],
  ["Conductora Demo 2", "Semana 26", "3", "$4,100", "$80 / $80", "$0", "$4,180", "2026-07-03", "Aprobado"],
  ["Conductor Norte", "Semana 25", "4", "$5,200", "$300 / $300", "$-200", "$5,300", "2026-06-26", "Pagado"]
];

const GASTOS = [
  ["Peaje", "RR-TR-10291", "ticket-peaje.pdf", "$180", "Aprobado", "Finanzas"],
  ["Combustible", "RR-TR-10302", "foto-ticket.jpg", "$240", "En revisión", "Pendiente"],
  ["Estacionamiento", "RR-TR-10309", "sin comprobante", "$90", "Rechazado", "Finanzas"]
];

function Tabla({ columnas, filas }: { columnas: string[]; filas: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 font-body text-sm">
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th key={columna} className="border-b border-ink/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.join("-")} className="align-top">
              {fila.map((celda) => (
                <td key={celda} className="border-b border-ink/10 px-3 py-3 text-ink/70">
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PaginaPagosAdmin() {
  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      <h1 className="font-display text-2xl font-semibold">Pagos</h1>
      <p className="mt-1 font-body text-sm text-ink/55">Cobros de usuarios, pagos a conductores y control de gastos.</p>

      <div className="mt-4">
        <Aviso tono="info">Estados disponibles: {ESTADOS.join(", ")}.</Aviso>
      </div>

      <section className="mt-6 grid gap-6">
        <PassportCard>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-semibold">Pagos de usuarios</h2>
            <Button variant="secundario">Conciliar pagos</Button>
          </div>
          <Tabla
            columnas={["Viaje", "Usuario", "Empresa", "Tarifa", "Método de pago", "Estatus", "Fecha de pago", "Facturación"]}
            filas={PAGOS_USUARIOS}
          />
        </PassportCard>

        <PassportCard>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-semibold">Pagos a conductores</h2>
            <Button variant="secundario">Preparar depósito semanal</Button>
          </div>
          <Tabla
            columnas={["Conductor", "Semana", "Viajes", "Ganancias", "Gastos rep./aut.", "Ajustes", "Depósito esperado", "Fecha de pago", "Estatus"]}
            filas={PAGOS_CONDUCTORES}
          />
        </PassportCard>

        <PassportCard>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-semibold">Gastos</h2>
            <Button variant="fantasma">Aprobar o rechazar</Button>
          </div>
          <Tabla columnas={["Tipo de gasto", "Viaje relacionado", "Comprobante", "Monto", "Estatus", "Aprobado por"]} filas={GASTOS} />
        </PassportCard>
      </section>
    </main>
  );
}
