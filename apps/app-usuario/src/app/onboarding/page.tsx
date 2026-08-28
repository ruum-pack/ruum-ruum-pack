"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconoLinea, LogoRuum, PantallaPublica } from "../experiencia-publica";
import { obtenerUsuarioActual } from "@ruum/api/services";
import { crearClienteNavegador } from "../../lib/supabase-browser";

const pilares = [
  ["escudo", "Conductores certificados", "Verificación de identidad y antecedentes antes de cada traslado."],
  ["maletin", "Evidencia en cada etapa", "Fotos del vehículo al inicio y al final del recorrido."],
  ["pin", "Trazabilidad en tiempo real", "Sigue cada kilómetro con tu Pasaporte Digital."],
  ["candado", "Seguridad y confianza", "Tus datos y tu auto protegidos con póliza de seguro."],
] as const;

function ContenidoOnboarding() {
  const searchParams = useSearchParams();
  const esCuentaNueva = searchParams.get("nuevo") === "1";
  const [nombreUsuario, setNombreUsuario] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        if (!localStorage.getItem("ruum_onboarding_visto_en")) {
          localStorage.setItem("ruum_onboarding_visto_en", new Date().toISOString());
        }
      } catch {
        // Ignorar fallos de storage
      }
    }

    const nombreUrl = searchParams.get("nombre");
    if (nombreUrl) {
      setNombreUsuario(nombreUrl);
    } else {
      obtenerUsuarioActual(crearClienteNavegador())
        .then((usr) => {
          if (usr?.nombre) setNombreUsuario(usr.nombre);
        })
        .catch(() => {});
    }
  }, [searchParams]);

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
            <p className="mt-0.5 font-body text-xs leading-5 text-[#d7dce5]">
              Tu cuenta está lista. Mueve tu auto sin soltar el control.
            </p>
          </div>
        )}

        <div className="mt-7">
          <h1 className="font-display text-[24px] font-extrabold leading-[1.06] tracking-[-0.01em] text-white">
            {nombreUsuario ? `Hola ${nombreUsuario}, mueve tu auto` : "Mueve tu auto"}
            <br />
            sin soltar el control.
          </h1>
          <p className="mt-4 max-w-[275px] font-body text-xs leading-5 text-[#d7dce5]">
            Plataforma digital para traslados vehiculares con conductores certificados,
            evidencia en cada etapa y control total del viaje.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-7">
          {pilares.map(([tipo, titulo, descripcion]) => (
            <div key={titulo} className="space-y-2">
              <IconoLinea tipo={tipo} />
              <p className="max-w-[120px] font-display text-xs font-extrabold uppercase leading-4 tracking-[0.08em] text-[#e6e9ef]">
                {titulo}
              </p>
              <p className="max-w-[120px] font-body text-xs leading-5 text-[var(--ruum-dark-text-tertiary)]">
                {descripcion}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-[#1C2A3E] bg-[#0A1220] p-5 shadow-xl space-y-3">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-[#ffc400]">
            Pasaporte Digital de Traslado
          </p>
          <div className="space-y-2.5 font-body text-xs text-[#94A3B8]">
            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ffc400]/20 text-[#ffc400] font-mono-ruum text-[10px] font-bold">1</span>
              <p><strong className="text-white">Inspección Inicial:</strong> 6 fotos 360° en punto de origen.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-400 font-mono-ruum text-[10px] font-bold">2</span>
              <p><strong className="text-white">Ruta en Vivo:</strong> Trazabilidad satelital y chofer certificado.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-mono-ruum text-[10px] font-bold">3</span>
              <p><strong className="text-white">Entrega Certificada:</strong> Inspección final y confirmación sin daños.</p>
            </div>
          </div>
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
            Ir al inicio
          </Link>
        </div>
      </section>
    </PantallaPublica>
  );
}

export default function OnboardingUsuario() {
  return (
    <Suspense fallback={null}>
      <ContenidoOnboarding />
    </Suspense>
  );
}
