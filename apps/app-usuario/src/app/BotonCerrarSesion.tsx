"use client";

import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "../lib/supabase-browser";

interface BotonCerrarSesionProps {
  compact?: boolean;
  className?: string;
}

export function BotonCerrarSesion({ compact = false, className }: BotonCerrarSesionProps) {
  const router = useRouter();

  async function cerrarSesion() {
    const cliente = crearClienteNavegador();
    await cliente.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={cerrarSesion}
      aria-label="Cerrar sesión"
      className={className ?? "font-body text-sm text-ink/60 hover:text-ink"}
    >
      {compact && (
        <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 7v5M9.2 10.5 12 13l2.8-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span>{compact ? "Cerrar" : "Cerrar sesión"}</span>
    </button>
  );
}
