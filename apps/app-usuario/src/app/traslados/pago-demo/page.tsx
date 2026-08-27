"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavegacionUsuario } from "../../NavegacionUsuario";
import { PagoStripe } from "../../PagoStripe";

export default function PaginaPagoDemo() {
  const router = useRouter();
  const [pagado, setPagado] = useState(false);

  return (
    <main className="min-h-screen bg-[#070D18] text-[#F8F8F5]">
      <NavegacionUsuario />

      <div className="w-full max-w-lg mx-auto px-4 py-6 sm:py-10 pb-28">
        {/* Encabezado */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/mis-viajes"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0A1220] px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-[#FFC400]/40 hover:text-[#FFC400]"
          >
            ← Regresar a mis viajes
          </Link>
          <span className="rounded-full border border-[#FFC400]/40 bg-[#FFC400]/10 px-3 py-1 font-display text-[10px] font-extrabold uppercase tracking-wider text-[#FFC400]">
            PAGO SEGURO
          </span>
        </div>

        {pagado ? (
          <div className="rounded-3xl border border-emerald-500/30 bg-[#0A1220] p-6 text-center shadow-2xl backdrop-blur-sm">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
              <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-display text-xl font-black uppercase text-white">¡Pago procesado con éxito!</h1>
            <p className="mt-2 font-body text-xs text-[#8E9CAE]">
              Tu traslado ha sido confirmado y tu conductor asignado iniciará la recolección en breve.
            </p>

            <div className="mt-6 space-y-3">
              <Link
                href="/traslados/demo"
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[#FFC400] font-display text-xs font-black uppercase tracking-wider text-[#0B111B] shadow-lg shadow-[#FFC400]/20 transition hover:bg-[#e6b000]"
              >
                Ver Pasaporte Digital
              </Link>
              <Link
                href="/mis-viajes"
                className="flex h-11 w-full items-center justify-center rounded-xl border border-[#1C2A3E] bg-[#141F32] font-display text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-[#FFC400]/40 hover:text-white"
              >
                Ir a Mis Traslados
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Resumen del Traslado */}
            <div className="rounded-3xl border border-[#1C2A3E] bg-[#0A1220] p-5 shadow-2xl backdrop-blur-sm">
              <p className="font-body text-[11px] font-bold uppercase tracking-wider text-[#8E9CAE]">Resumen del Traslado</p>
              
              <div className="mt-3 flex items-start justify-between border-b border-[#1C2A3E] pb-4">
                <div>
                  <h2 className="font-display text-base font-extrabold uppercase text-white">Mitsubishi Mirage 2026</h2>
                  <p className="font-body text-xs text-[#8E9CAE]">Sedan · San Mateo Atenco → CDMX</p>
                </div>
                <span className="font-display text-lg font-black text-[#FFC400]">$1,945.66</span>
              </div>

              <div className="mt-3 space-y-2 font-body text-xs text-[#94A3B8]">
                <div className="flex justify-between">
                  <span>Subtotal del traslado:</span>
                  <span className="font-mono-ruum text-slate-300">$1,677.29</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (16%):</span>
                  <span className="font-mono-ruum text-slate-300">$268.37</span>
                </div>
                <div className="flex justify-between border-t border-[#1C2A3E] pt-2 font-bold text-white">
                  <span>Total a pagar:</span>
                  <span className="font-display text-base text-[#FFC400]">$1,945.66 MXN</span>
                </div>
              </div>
            </div>

            {/* Componente de Cobro con Stripe */}
            <div className="rounded-3xl border border-[#1C2A3E] bg-[#0A1220] p-5 shadow-2xl backdrop-blur-sm">
              <h3 className="font-display text-sm font-extrabold uppercase text-white mb-4">
                Método de Pago Seguro
              </h3>
              <PagoStripe
                trasladoId="demo-pago-1"
                monto={1945.66}
                onPagado={() => setPagado(true)}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
