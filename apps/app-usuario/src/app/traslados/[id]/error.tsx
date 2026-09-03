"use client";

import { useEffect } from "react";
import Link from "next/link";
import { NavegacionUsuario } from "../../NavegacionUsuario";

export default function ErrorTraslado({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ErrorTraslado]", error);
  }, [error]);

  return (
    <main className="user-v2-scope user-v2-page user-v2-secondary-screen">
      <NavegacionUsuario variante="claro" />
      <div className="w-full max-w-md mx-auto py-20 px-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-400 mb-4">
          <svg className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="font-display text-xs font-bold uppercase tracking-widest text-[#FFC400]">
          Expediente temporalmente no disponible
        </p>
        <h1 className="mt-2 font-display text-xl sm:text-2xl font-black text-white">
          No pudimos cargar los detalles del traslado
        </h1>
        <p className="mt-3 font-body text-xs leading-relaxed text-[#8E9CAE]">
          Ocurrió un inconveniente al consultar el Pasaporte Digital. Puede deberse a un problema de conexión temporal o sesión expirada.
        </p>
        {error?.digest && (
          <p className="mt-2 font-mono-ruum text-[10px] text-slate-500">
            Código de referencia: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#FFC400] px-5 py-2.5 font-display text-xs font-black uppercase tracking-wider text-[#0B111B] shadow-md transition hover:bg-[#e6b000]"
          >
            Reintentar
          </button>
          <Link
            href="/mis-viajes"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#1C2A3E] bg-[#0A1220] px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-[#FFC400]/40 hover:text-white"
          >
            Ver mis traslados
          </Link>
        </div>
      </div>
    </main>
  );
}
