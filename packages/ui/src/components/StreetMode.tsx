"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Modo calle (cap. 23): la app del conductor se usa de pie, con una mano y bajo el sol.
 * - Botones ≥56px, texto ≥17px, contrastes reforzados.
 * - Una acción por pantalla, progreso visible.
 * - Botón de seguridad persistente rojo emergencia, siempre ≤1 toque.
 */

export function useStreetMode(trasladoActivo: boolean) {
  const [reducirMovimiento, setReducirMovimiento] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducirMovimiento(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducirMovimiento(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.street = trasladoActivo ? "true" : "false";
    return () => {
      document.documentElement.dataset.street = "false";
    };
  }, [trasladoActivo]);
  return { street: trasladoActivo, reducirMovimiento };
}

export function StreetContainer({ activo, children, className = "" }: { activo: boolean; children: ReactNode; className?: string }) {
  return (
    <div data-street={activo ? "true" : "false"} className={`${activo ? "ruum-street text-[17px]" : ""} ${className}`}>
      {children}
    </div>
  );
}

/** Botón de seguridad persistente: rojo emergencia B3261E, ícono sirena + texto, ≥56px. */
export function SafetyButton({
  onActivar,
  etiqueta = "Seguridad",
  className = "",
}: {
  onActivar?: () => void;
  etiqueta?: string;
  className?: string;
}) {
  return (
    <a
      href="#emergencia"
      onClick={onActivar}
      aria-label={`${etiqueta} — canal de emergencia directo con soporte`}
      className={`fixed bottom-20 right-4 z-40 inline-flex min-h-[var(--ruum-button-height-street)] min-w-[var(--ruum-button-height-street)] items-center justify-center gap-2 rounded-full bg-[var(--ruum-emergency)] px-5 py-3 font-body text-[17px] font-bold text-white shadow-[var(--ruum-elevation-2)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--ruum-focus)] ${className}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
        <path d="M12 3v4M5 5l2.5 2.5M19 5l-2.5 2.5M4 13h16a8 8 0 0 1-16 0ZM10 21h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {etiqueta}
    </a>
  );
}
