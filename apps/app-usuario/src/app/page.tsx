import Link from "next/link";
import { Button, EstadoStepper, PassportCard, EstadoBadge } from "@ruum/ui";
import { PASAPORTE_DEMO } from "../lib/datos-demo";
import { BotonCerrarSesion } from "./BotonCerrarSesion";

const PILARES = [
  {
    titulo: "Conductores CONCER",
    cuerpo:
      "Cuatro niveles de certificación según experiencia, calificación y tipo de vehículo. Nunca asignamos un conductor sin verificar que cumple los requisitos para tu traslado."
  },
  {
    titulo: "Evidencia en cada extremo",
    cuerpo:
      "Fotos obligatorias del vehículo antes de salir y al llegar, con los mismos ángulos siempre. Si algo cambió en el camino, queda documentado."
  },
  {
    titulo: "Un Pasaporte por traslado",
    cuerpo:
      "Estado, evidencia, pagos y comunicación en un solo expediente digital que puedes exportar a PDF cuando lo necesites."
  }
];

async function haySesionReal(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;

  try {
    const { crearClienteServidor } = await import("../lib/supabase-server");
    const cliente = await crearClienteServidor();
    const { data } = await cliente.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

export default async function PaginaInicio() {
  const sesion = await haySesionReal();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 sm:py-20">
      <header className="mb-16 flex items-center justify-between">
        <span className="font-display text-lg font-semibold tracking-tight">Ruum Ruum</span>
        <div className="flex items-center gap-5">
          <Link href="/traslados/demo-0001" className="font-body text-sm text-ink/60 underline-offset-4 hover:underline">
            Ver un traslado de ejemplo
          </Link>
          {sesion ? (
            <BotonCerrarSesion />
          ) : (
            <Link href="/login" className="font-body text-sm font-medium text-ink/70 hover:text-ink">
              Iniciar sesión
            </Link>
          )}
        </div>
      </header>

      <section className="grid gap-12 sm:grid-cols-[1.1fr_0.9fr] sm:items-center">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Tu vehículo, documentado en cada kilómetro.
          </h1>
          <p className="mt-5 max-w-md font-body text-base text-ink/65">
            Conductores certificados, evidencia fotográfica de inicio a fin y un Pasaporte Digital con todo el
            historial de tu traslado. Sabes dónde está tu vehículo y qué le pasó.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link href="/traslados/nuevo">
              <Button>Solicitar traslado</Button>
            </Link>
            {!sesion && (
              <Link href="/registro" className="font-body text-sm font-medium text-ink/70 hover:text-ink">
                Crear mi cuenta
              </Link>
            )}
          </div>
        </div>

        <PassportCard folio="RR-DEMO">
          <div className="flex items-center justify-between">
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Traslado de ejemplo</p>
            <EstadoBadge estado={PASAPORTE_DEMO.estado} />
          </div>
          <p className="mt-3 font-mono-ruum text-sm text-ink/70">
            {PASAPORTE_DEMO.vehiculo_marca} {PASAPORTE_DEMO.vehiculo_modelo} {PASAPORTE_DEMO.vehiculo_anio}
          </p>
          <div className="mt-5">
            <EstadoStepper estado={PASAPORTE_DEMO.estado} />
          </div>
        </PassportCard>
      </section>

      <section className="mt-24 grid gap-8 sm:grid-cols-3">
        {PILARES.map((pilar) => (
          <div key={pilar.titulo}>
            <h2 className="font-display text-base font-semibold">{pilar.titulo}</h2>
            <p className="mt-2 font-body text-sm leading-relaxed text-ink/60">{pilar.cuerpo}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
