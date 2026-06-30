import { Aviso, Button, PassportCard } from "@ruum/ui";

const ESTADOS = ["Pendiente de carga", "En revisión", "Aprobado", "Rechazado", "Vencido", "Requiere actualización"];

const CONDUCTORES = [
  ["Conductor Demo", "Licencia de conducir", "Aprobado", "Vence 14 nov 2027"],
  ["Conductora Demo 2", "Identificación oficial", "En revisión", "Cargado hoy"],
  ["Conductor con documentos vencidos", "Comprobante de domicilio", "Vencido", "Venció 02 jun 2026"],
  ["Conductor Demo", "Constancia de situación fiscal", "Requiere actualización", "Régimen fiscal ilegible"]
];

const EMPRESAS = [
  ["Agencia Norte SA", "Constancia fiscal", "Aprobado", "RFC validado"],
  ["Flotilla Centro", "Datos de facturación", "En revisión", "Uso CFDI pendiente"],
  ["Grupo Automotriz Sur", "Convenio comercial", "Pendiente de carga", "Requerido para tarifa especial"],
  ["Aseguradora Delta", "Documento de autorización", "Requiere actualización", "Firmante no coincide"]
];

function ListaDocumentos({ titulo, filas }: { titulo: string; filas: string[][] }) {
  return (
    <PassportCard>
      <h2 className="font-display text-xl font-semibold">{titulo}</h2>
      <div className="mt-4 grid gap-3">
        {filas.map(([entidad, documento, estado, nota]) => (
          <div key={`${entidad}-${documento}`} className="rounded-lg border border-ink/10 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-body text-sm font-semibold">{entidad}</p>
                <p className="mt-1 font-body text-sm text-ink/60">{documento}</p>
                <p className="mt-1 font-body text-xs text-ink/45">{nota}</p>
              </div>
              <span className="rounded-full border border-route/30 bg-route-soft px-3 py-1.5 font-body text-xs font-semibold text-route">{estado}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Ver documento", "Aprobar", "Rechazar", "Solicitar actualización", "Descargar", "Agregar comentario interno"].map((accion) => (
                <Button key={accion} variant="fantasma">
                  {accion}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PassportCard>
  );
}

export default function PaginaDocumentosAdmin() {
  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      <h1 className="font-display text-2xl font-semibold">Documentos</h1>
      <p className="mt-1 font-body text-sm text-ink/55">Validación documental de conductores, usuarios y empresas.</p>
      <div className="mt-4">
        <Aviso tono="info">Estados sugeridos: {ESTADOS.join(", ")}.</Aviso>
      </div>
      <section className="mt-6 grid gap-6">
        <ListaDocumentos titulo="Documentos de conductores" filas={CONDUCTORES} />
        <ListaDocumentos titulo="Documentos de usuarios o empresas" filas={EMPRESAS} />
      </section>
    </main>
  );
}
