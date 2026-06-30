import { Aviso, Button, PassportCard } from "@ruum/ui";

const TIPOS = ["Agencia automotriz", "Lote de autos", "Arrendadora", "Flotilla", "Taller", "Aseguradora", "Grupo automotriz", "Empresa general"];

const EMPRESAS = [
  {
    razon: "Agencia Norte SA de CV",
    comercial: "Agencia Norte",
    rfc: "ANO260101AB1",
    tipo: "Agencia automotriz",
    contacto: "Mariana Gómez",
    telefono: "+52 55 1100 2200",
    correo: "operacion@agencianorte.mx",
    direccion: "Av. Industria 120, Naucalpan",
    usuarios: 8,
    vehiculos: 34,
    historial: "128 viajes",
    condiciones: "Pago por transferencia semanal",
    facturacion: "CFDI G03, CP 53370"
  },
  {
    razon: "Flotilla Centro SAPI",
    comercial: "Flotilla Centro",
    rfc: "FCE260202CD2",
    tipo: "Flotilla",
    contacto: "Raúl Medina",
    telefono: "+52 55 3300 4400",
    correo: "flota@centro.mx",
    direccion: "Eje 5 Sur 88, CDMX",
    usuarios: 15,
    vehiculos: 92,
    historial: "76 viajes",
    condiciones: "Tarifa empresarial local",
    facturacion: "CFDI G03, CP 03020"
  }
];

const FUTURO = ["Centros de costo", "Usuarios con permisos", "Reportes mensuales", "Tarifas especiales", "Crédito corporativo", "Aprobación interna de viajes"];

export default function PaginaEmpresasAdmin() {
  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Empresas</h1>
          <p className="mt-1 font-body text-sm text-ink/55">Cuentas empresariales, condiciones comerciales y facturación.</p>
        </div>
        <Button>Crear empresa</Button>
      </div>

      <section className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Tipos de empresa</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {TIPOS.map((tipo) => (
              <span key={tipo} className="rounded-full border border-ink/10 px-3 py-1.5 font-body text-xs font-semibold text-ink/65">
                {tipo}
              </span>
            ))}
          </div>
        </PassportCard>
      </section>

      <section className="mt-6 grid gap-4">
        {EMPRESAS.map((empresa) => (
          <PassportCard key={empresa.rfc}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-ink/45">{empresa.tipo}</p>
                <h2 className="mt-1 font-display text-xl font-semibold">{empresa.comercial}</h2>
                <p className="mt-1 font-body text-sm text-ink/60">{empresa.razon} · RFC {empresa.rfc}</p>
              </div>
              <Button variant="secundario">Ver cuenta</Button>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Contacto principal", empresa.contacto],
                ["Teléfono", empresa.telefono],
                ["Correo", empresa.correo],
                ["Dirección", empresa.direccion],
                ["Usuarios vinculados", `${empresa.usuarios}`],
                ["Vehículos frecuentes", `${empresa.vehiculos}`],
                ["Historial de viajes", empresa.historial],
                ["Condiciones comerciales", empresa.condiciones],
                ["Datos de facturación", empresa.facturacion]
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-body text-xs uppercase tracking-wide text-ink/45">{label}</dt>
                  <dd className="mt-1 font-body text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </PassportCard>
        ))}
      </section>

      <div className="mt-6">
        <Aviso tono="info">Fuera del MVP: {FUTURO.join(", ")}.</Aviso>
      </div>
    </main>
  );
}
