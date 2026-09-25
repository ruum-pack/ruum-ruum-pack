"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BotonFlotanteSolicitarTrasladoProps = {
  mostrar: boolean;
};

export function BotonFlotanteSolicitarTraslado({ mostrar }: BotonFlotanteSolicitarTrasladoProps) {
  const [scrollSuficiente, setScrollSuficiente] = useState(false);

  useEffect(() => {
    if (!mostrar) {
      const timer = setTimeout(() => setScrollSuficiente(false), 0);
      return () => clearTimeout(timer);
    }

    const revisarScroll = () => {
      setScrollSuficiente(window.scrollY > 200);
    };

    revisarScroll();
    window.addEventListener("scroll", revisarScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", revisarScroll);
    };
  }, [mostrar]);

  if (!mostrar || !scrollSuficiente) {
    return null;
  }

  return (
    <Link
      href="/traslados/nuevo"
      className="fixed bottom-[80px] right-4 z-40 inline-flex min-h-[var(--ruum-button-height)] items-center justify-center rounded-full bg-white px-5 py-3 font-body text-sm font-semibold text-[var(--ruum-navy)] shadow-[var(--ruum-elevation-2)] ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:bg-[var(--ruum-neutral-bg)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--ruum-focus)] sm:right-8"
    >
      Solicitar traslado
    </Link>
  );
}
