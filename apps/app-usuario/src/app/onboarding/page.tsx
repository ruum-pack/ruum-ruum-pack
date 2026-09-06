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
          <Link href="/" className="font-body text-xs text-route-action transition hover:text-text-primary">
            ← Inicio
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="font-body text-xs text-text-secondary transition hover:text-text-primary"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="rounded-lg border border-signal/40 bg-signal/10 px-3 py-1 font-body text-xs font-semibold text-signal transition hover:bg-signal/20"
            >
              Registro
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <LogoRuum />
        </div>
        <div className="mt-6 h-0.5 w-7 rounded-full bg-signal" />

        {esCuentaNueva && (
          <div className="mt-5 rounded-lg border border-signal/30 bg-signal/10 px-4 py-3">
            <p className="font-body text-xs font-semibold text-signal">
              ¡Cuenta creada exitosamente!
            </p>
            <p className="mt-0.5 font-body text-xs leading-5 text-text-secondary">
              Tu cuenta está lista. Ya puedes mover tu auto con seguridad y control total.
            </p>
          </div>
        )}

        <div className="mt-6">
          <h1 className="font-display text-[24px] font-extrabold leading-[1.06] tracking-[-0.01em] text-text-primary">
            {nombreUsuario ? `Hola ${nombreUsuario}, mueve tu auto` : "Mueve tu auto"}
            <br />
            sin soltar el control.
          </h1>
          <p className="mt-3.5 max-w-[320px] font-body text-xs leading-5 text-text-secondary">
            Plataforma digital para traslados vehiculares con conductores certificados,
            evidencia fotográfica 360° y seguimiento en tiempo real.
          </p>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-x-8 gap-y-6">
          {pilares.map(([tipo, titulo, descripcion]) => (
            <div key={titulo} className="space-y-1.5">
              <IconoLinea tipo={tipo} />
              <p className="font-display text-xs font-extrabold uppercase leading-4 tracking-[0.08em] text-text-primary">
                {titulo}
              </p>
              <p className="font-body text-xs leading-5 text-text-tertiary">
                {descripcion}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-7 space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-[var(--ruum-shadow-2)]">
          <div className="flex items-center justify-between">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-signal">
              Pasaporte Digital de Traslado
            </p>
            <span className="rounded-full bg-signal/10 px-2 py-0.5 font-mono-ruum text-[10px] font-bold text-signal">
              EN CADA VIAJE
            </span>
          </div>
          <div className="space-y-2.5 font-body text-xs text-text-secondary">
            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-signal/20 font-mono-ruum text-[10px] font-bold text-signal">1</span>
              <p><strong className="text-text-primary">Inspección Inicial:</strong> 6 fotos 360° en punto de origen antes de mover el auto.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-route/20 font-mono-ruum text-[10px] font-bold text-route-action">2</span>
              <p><strong className="text-text-primary">Ruta en Vivo:</strong> Trazabilidad satelital y chofer certificado asignado.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-control/20 font-mono-ruum text-[10px] font-bold text-control">3</span>
              <p><strong className="text-text-primary">Entrega Certificada:</strong> Inspección final con evidencia y confirmación sin daños.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-2.5 pt-4">
          {estaAutenticado || esCuentaNueva ? (
            <>
              <Link
                href="/traslados/nuevo"
                onClick={() => registrarEventoUx("onboarding_completado", { accion: "solicitar_traslado" })}
                className="ruum-public-primary-button inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 py-3 font-display text-sm font-extrabold text-on-primary transition hover:brightness-95 active:scale-[0.99]"
              >
                Solicitar mi primer traslado
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-transparent px-5 py-3 font-display text-sm font-bold text-text-primary transition hover:border-signal hover:bg-signal/10"
              >
                Ir al inicio
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/registro"
                onClick={() => registrarEventoUx("onboarding_completado", { accion: "crear_cuenta" })}
                className="ruum-public-primary-button inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 py-3 font-display text-sm font-extrabold text-on-primary transition hover:brightness-95 active:scale-[0.99]"
              >
                Crear mi cuenta
              </Link>
              <Link
                href="/login"
                onClick={() => registrarEventoUx("onboarding_completado", { accion: "iniciar_sesion" })}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-transparent px-5 py-3 font-display text-sm font-bold text-text-primary transition hover:border-signal hover:bg-signal/10"
              >
                Iniciar sesión
              </Link>
              <div className="pt-1 text-center">
                <Link href="/" className="font-body text-xs text-text-tertiary transition hover:text-text-primary">
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
