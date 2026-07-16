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
      className="fixed bottom-[80px] right-4 z-40 inline-flex items-center justify-center rounded-full bg-white px-5 py-3 font-body text-sm font-semibold text-[#14213d] shadow-3 ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:bg-[#f7f8fb] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#14213d] sm:right-8"
    >
      Solicitar traslado
    </Link>
  );
}
