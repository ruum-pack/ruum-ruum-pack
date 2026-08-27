"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconoLinea, LogoRuum, PantallaPublica } from "../experiencia-publica";
import { obtenerUsuarioActual } from "@ruum/api/services";

const pilares = [
  ["escudo", "Conductores certificados", "Verificación de identidad antes de cada traslado."],
  ["maletin", "Evidencia en cada etapa", "Fotos del vehículo al inicio y al final del recorrido."],
  ["pin", "Trazabilidad en tiempo real", "Sigue cada paso con el Pasaporte Digital."],
  ["candado", "Seguridad y confianza", "Tus datos y tu auto, siempre protegidos."],
] as const;

function DemoPasaporte() {
  const [etapa, setEtapa] = useState<"recoleccion" | "en_camino" | "entregado">("en_camino");

  return (
    <div className="rounded-[16px] border border-white/10 bg-[#1a2230] p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono-ruum text-xs font-semibold uppercase tracking-wide text-[#ffc400]">#RM-DEMO · PASAPORTE DIGITAL</p>
          <h3 className="mt-2 font-display text-base font-black text-white">Nissan Versa 2022 · Sedán</h3>
          <p className="font-body text-xs text-[#b7c2d4]">Placas ABC-123-A · Gris acero</p>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 font-body text-xs font-bold text-emerald-400">
          {etapa === "recoleccion" ? "Recolección" : etapa === "en_camino" ? "En camino" : "Entregado ✓"}
        </span>
      </div>

      {/* Mini selector interactivo */}
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-black/30 p-1">
        {(["recoleccion", "en_camino", "entregado"] as const).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEtapa(e)}
            className={[
              "rounded-md py-1 text-[11px] font-bold transition-all",
              etapa === e
                ? "bg-[#ffc400] text-slate-950 shadow-xs"
                : "text-[#b7c2d4] hover:text-white"
            ].join(" ")}
          >
            {e === "recoleccion" ? "1. Inicio" : e === "en_camino" ? "2. Ruta" : "3. Fin"}
          </button>
        ))}
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-[#ffc400] transition-all duration-300"
          style={{ width: etapa === "recoleccion" ? "30%" : etapa === "en_camino" ? "65%" : "100%" }}
        />
      </div>
      <p className="mt-1 font-body text-xs text-[#8b98ad]">
        {etapa === "recoleccion" && "30% completado · Inspección fotográfica inicial realizada"}
        {etapa === "en_camino" && "65% completado · Próximo: Entrega en punto de destino · ETA 10:32"}
        {etapa === "entregado" && "100% completado · Vehículo entregado sin daños nuevos"}
      </p>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0d1626] p-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-[#ffc400] font-display text-sm font-black text-[#0d1626]">AR</div>
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-bold text-white">Ana R. · 4.9★ · 312 traslados</p>
          <p className="font-body text-xs text-[#8b98ad]">Certificada · ID verificado</p>
        </div>
        <Link href="/traslados/demo" className="rounded-lg bg-[#ffc400] px-3 py-1.5 font-display text-xs font-bold text-[#0d1626]">
          Ver demo
        </Link>
      </div>
      <div className="mt-3 flex items-center gap-2 font-body text-xs text-[#8b98ad]">
        <span className="inline-flex h-1 flex-1 rounded-full bg-gradient-to-r from-[#ffc400] via-[#3aa5ff] to-[#3ddc97] opacity-60" />
        <span>Escandón, CDMX → Centro, Puebla</span>
      </div>
      <p className="mt-3 text-center font-body text-xs text-[#8b98ad]">Así verás tu Pasaporte en tiempo real. <Link href="/traslados/demo" className="font-semibold text-[#ffc400] underline-offset-2 hover:underline">Ver demo completa</Link></p>
    </div>
  );
}

function ContenidoOnboarding() {
  const searchParams = useSearchParams();
  const esCuentaNueva = searchParams.get("nuevo") === "1";
  const [nombreUsuario, setNombreUsuario] = useState<string | null>(null);

  useEffect(() => {
    // Registrar activación inicial 24h
    if (typeof window !== "undefined") {
      try {
        if (!localStorage.getItem("ruum_onboarding_visto_en")) {
          localStorage.setItem("ruum_onboarding_visto_en", new Date().toISOString());
        }
      } catch {
        // Ignorar fallos de storage
      }
    }

    // Cargar nombre de usuario
    const nombreUrl = searchParams.get("nombre");
    if (nombreUrl) {
      setNombreUsuario(nombreUrl);
    } else {
      obtenerUsuarioActual()
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

        <div className="mt-8">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-[#ffc400]">
            {nombreUsuario ? `${nombreUsuario}, tu Pasaporte estará listo en 3 pasos` : "Tu Pasaporte estará listo en 3 pasos"}
          </p>
          <p className="mt-1 font-body text-xs leading-5 text-[#b7c2d4]">Así se ve el seguimiento que tendrás. Toca las etapas para probarlo.</p>
          <div className="mt-3">
            <DemoPasaporte />
          </div>
          <Link href="/traslados/demo" className="mt-3 inline-flex w-full items-center justify-center gap-1 font-body text-xs font-semibold text-[#ffc400] underline-offset-4 hover:underline">
            Ver demostración interactiva completa →
          </Link>
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

export default function OnboardingUsuario() {
  return (
    <Suspense fallback={null}>
      <ContenidoOnboarding />
    </Suspense>
  );
}
