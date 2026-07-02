import Link from "next/link";
import { IconoLinea, LogoRuum, PantallaPublica } from "../experiencia-publica";

const pilares = [
  ["escudo", "Conductores certificados"],
  ["maletin", "Evidencia en cada etapa"],
  ["pin", "Trazabilidad en tiempo real"],
  ["candado", "Seguridad y confianza"]
] as const;

export default function OnboardingUsuario() {
  return (
    <PantallaPublica>
      <section className="flex min-h-screen flex-col px-6 pb-9 pt-12">
        <LogoRuum />
        <div className="mt-9 h-0.5 w-7 rounded-full bg-[#1683ff]" />

        <div className="mt-7">
          <h1 className="font-display text-[24px] font-extrabold leading-[1.06] tracking-[-0.01em] text-white">
            Mueve tu auto
            <br />
            sin soltar el control.
          </h1>
          <p className="mt-4 max-w-[275px] font-body text-[11px] leading-5 text-[#a9bdd7]">
            Plataforma digital para traslados vehiculares con conductores certificados, evidencia en cada etapa y
            control total del viaje.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-14 gap-y-7">
          {pilares.map(([tipo, titulo]) => (
            <div key={titulo} className="space-y-3">
              <IconoLinea tipo={tipo} />
              <p className="max-w-[105px] font-display text-[8px] font-extrabold uppercase leading-3 tracking-[0.1em] text-[#c8d9ee]">
                {titulo}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-auto">
          <Link
            href="/"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#2487ff] px-5 py-3 font-display text-sm font-bold text-white shadow-[0_10px_28px_rgba(36,135,255,0.25)] transition hover:bg-[#167cff]"
          >
            Continuar
          </Link>
        </div>
      </section>
    </PantallaPublica>
  );
}
