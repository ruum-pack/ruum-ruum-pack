import Link from "next/link";
import { IconoLinea, LogoRuum, PantallaPublica } from "../experiencia-publica";

const pilares = [
  ["escudo", "Conductores certificados", "Verificación de identidad antes de cada traslado."],
  ["maletin", "Evidencia en cada etapa", "Fotos del vehículo al inicio y al final del recorrido."],
  ["pin", "Trazabilidad en tiempo real", "Sigue cada paso con el Pasaporte Digital."],
  ["candado", "Seguridad y confianza", "Tus datos y tu auto, siempre protegidos."],
] as const;

interface Props {
  searchParams: Promise<{ nuevo?: string }>;
}

export default async function OnboardingUsuario({ searchParams }: Props) {
  const params = await searchParams;
  const esCuentaNueva = params.nuevo === "1";

  return (
    <PantallaPublica>
      <section className="flex min-h-screen flex-col px-6 pb-9 pt-12">
        <LogoRuum />
        <div className="mt-9 h-0.5 w-7 rounded-full bg-[#f5a623]" />

        {esCuentaNueva && (
          <div className="mt-5 rounded-lg border border-[#f5a623]/30 bg-[#f5a623]/10 px-4 py-3">
            <p className="font-body text-xs font-semibold text-[#f5a623]">
              Cuenta creada
            </p>
            <p className="mt-0.5 font-body text-[11px] leading-4 text-[#d7dce5]">
              Tu cuenta está lista. Mueve tu auto sin soltar el control.
            </p>
          </div>
        )}

        <div className="mt-7">
          <h1 className="font-display text-[24px] font-extrabold leading-[1.06] tracking-[-0.01em] text-white">
            Mueve tu auto
            <br />
            sin soltar el control.
          </h1>
          <p className="mt-4 max-w-[275px] font-body text-[11px] leading-5 text-[#d7dce5]">
            Plataforma digital para traslados vehiculares con conductores certificados,
            evidencia en cada etapa y control total del viaje.
          </p>
        </div>

        {/* Pilares con descripción */}
        <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-7">
          {pilares.map(([tipo, titulo, descripcion]) => (
            <div key={titulo} className="space-y-2">
              <IconoLinea tipo={tipo} />
              <p className="max-w-[120px] font-display text-[11px] font-extrabold uppercase leading-4 tracking-[0.08em] text-[#e6e9ef]">
                {titulo}
              </p>
              <p className="max-w-[120px] font-body text-[10px] leading-4 text-[#8d96a8]">
                {descripcion}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-auto space-y-2 pt-8">
          <Link
            href="/traslados/nuevo"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#f5a623] px-5 py-3 font-display text-sm font-bold text-[#1a1f2e] shadow-[0_10px_28px_rgba(245,166,35,0.24)] transition hover:bg-[#d88f16] focus-visible:ring-2 focus-visible:ring-[#f5a623]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1f2e]"
          >
            Solicitar mi primer traslado
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[#687287] bg-transparent px-5 py-3 font-display text-sm font-bold text-white transition hover:border-[#f5a623] hover:bg-[#f5a623]/10 focus-visible:ring-2 focus-visible:ring-[#f5a623]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1f2e]"
          >
            Explorar primero
          </Link>
        </div>
      </section>
    </PantallaPublica>
  );
}
