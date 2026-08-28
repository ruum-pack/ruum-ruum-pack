"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconoLinea, LogoRuum, PantallaPublica } from "../experiencia-publica";
import { obtenerUsuarioActual } from "@ruum/api/services";
import { crearClienteNavegador } from "../../lib/supabase-browser";
import { registrarEventoUx } from "../../lib/analytics";

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
  const [estaAutenticado, setEstaAutenticado] = useState(false);

  useEffect(() => {
    registrarEventoUx("onboarding_visto", { nuevo: esCuentaNueva });

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
      setEstaAutenticado(true);
    } else {
      obtenerUsuarioActual(crearClienteNavegador())
        .then((usr) => {
          if (usr?.nombre) {
            setNombreUsuario(usr.nombre);
            setEstaAutenticado(true);
          } else if (usr) {
            setEstaAutenticado(true);
          }
        })
        .catch(() => {});
    }
  }, [searchParams, esCuentaNueva]);

  return (
    <PantallaPublica>
      <section className="flex min-h-screen flex-col px-6 pb-9 pt-8">
        {/* Navegación superior */}
        <div className="flex items-center justify-between">
          <Link href="/" className="font-body text-xs text-[#FFC400] transition hover:text-white">
            ← Inicio
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="font-body text-xs text-[#94A3B8] transition hover:text-white"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="rounded-lg bg-[#FFC400]/20 px-3 py-1 font-body text-xs font-semibold text-[#FFC400] border border-[#FFC400]/40 transition hover:bg-[#FFC400]/30"
            >
              Registro
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <LogoRuum />
        </div>
        <div className="mt-6 h-0.5 w-7 rounded-full bg-[#FFC400]" />

        {esCuentaNueva && (
          <div className="mt-5 rounded-lg border border-[#FFC400]/30 bg-[#FFC400]/10 px-4 py-3">
            <p className="font-body text-xs font-semibold text-[#FFC400]">
              ¡Cuenta creada exitosamente!
            </p>
            <p className="mt-0.5 font-body text-xs leading-5 text-[#d7dce5]">
              Tu cuenta está lista. Ya puedes mover tu auto con seguridad y control total.
            </p>
          </div>
        )}

        <div className="mt-6">
          <h1 className="font-display text-[24px] font-extrabold leading-[1.06] tracking-[-0.01em] text-white">
            {nombreUsuario ? `Hola ${nombreUsuario}, mueve tu auto` : "Mueve tu auto"}
            <br />
            sin soltar el control.
          </h1>
          <p className="mt-3.5 max-w-[320px] font-body text-xs leading-5 text-[#B7C2D4]">
            Plataforma digital para traslados vehiculares con conductores certificados,
            evidencia fotográfica 360° y seguimiento en tiempo real.
          </p>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-x-8 gap-y-6">
          {pilares.map(([tipo, titulo, descripcion]) => (
            <div key={titulo} className="space-y-1.5">
              <IconoLinea tipo={tipo} />
              <p className="font-display text-xs font-extrabold uppercase leading-4 tracking-[0.08em] text-[#e6e9ef]">
                {titulo}
              </p>
              <p className="font-body text-xs leading-5 text-[#8E9CAE]">
                {descripcion}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-7 rounded-2xl border border-[#1C2A3E] bg-[#0A1220] p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-[#FFC400]">
              Pasaporte Digital de Traslado
            </p>
            <span className="rounded-full bg-[#FFC400]/10 px-2 py-0.5 font-mono-ruum text-[10px] font-bold text-[#FFC400]">
              EN CADA VIAJE
            </span>
          </div>
          <div className="space-y-2.5 font-body text-xs text-[#94A3B8]">
            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#FFC400]/20 text-[#FFC400] font-mono-ruum text-[10px] font-bold">1</span>
              <p><strong className="text-white">Inspección Inicial:</strong> 6 fotos 360° en punto de origen antes de mover el auto.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-400 font-mono-ruum text-[10px] font-bold">2</span>
              <p><strong className="text-white">Ruta en Vivo:</strong> Trazabilidad satelital y chofer certificado asignado.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-mono-ruum text-[10px] font-bold">3</span>
              <p><strong className="text-white">Entrega Certificada:</strong> Inspección final con evidencia y confirmación sin daños.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-2.5 pt-4">
          {estaAutenticado || esCuentaNueva ? (
            <>
              <Link
                href="/traslados/nuevo"
                onClick={() => registrarEventoUx("onboarding_completado", { accion: "solicitar_traslado" })}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#FFC400] px-5 py-3 font-display text-sm font-extrabold text-[#151515] shadow-[0_10px_28px_rgba(255,196,0,0.24)] transition hover:bg-[#e0ac00] active:scale-[0.99]"
              >
                Solicitar mi primer traslado
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#5F6368] bg-transparent px-5 py-3 font-display text-sm font-bold text-white transition hover:border-[#FFC400] hover:bg-[#FFC400]/10"
              >
                Ir al inicio
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/registro"
                onClick={() => registrarEventoUx("onboarding_completado", { accion: "crear_cuenta" })}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#FFC400] px-5 py-3 font-display text-sm font-extrabold text-[#151515] shadow-[0_10px_28px_rgba(255,196,0,0.24)] transition hover:bg-[#e0ac00] active:scale-[0.99]"
              >
                Crear mi cuenta
              </Link>
              <Link
                href="/login"
                onClick={() => registrarEventoUx("onboarding_completado", { accion: "iniciar_sesion" })}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#5F6368] bg-transparent px-5 py-3 font-display text-sm font-bold text-white transition hover:border-[#FFC400] hover:bg-[#FFC400]/10"
              >
                Iniciar sesión
              </Link>
              <div className="pt-1 text-center">
                <Link href="/" className="font-body text-xs text-[#8E9CAE] transition hover:text-white">
                  Volver al inicio público
                </Link>
              </div>
            </>
          )}
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
