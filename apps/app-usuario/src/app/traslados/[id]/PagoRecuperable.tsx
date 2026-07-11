"use client";

import { useEffect, useState } from "react";
import { PagoTraslado } from "./PagoTraslado";

export function PagoRecuperable({ trasladoId, monto, cotizacionExpiraEn }: {
  trasladoId: string;
  monto: number;
  cotizacionExpiraEn: string;
}) {
  const [vigente, setVigente] = useState(false);

  useEffect(() => {
    const expiraEn = new Date(cotizacionExpiraEn).getTime();
    const comprobar = () => setVigente(expiraEn > Date.now());
    const comprobacionInicial = window.setTimeout(comprobar, 0);
    const vencimiento = window.setTimeout(comprobar, Math.max(0, expiraEn - Date.now()));
    return () => {
      window.clearTimeout(comprobacionInicial);
      window.clearTimeout(vencimiento);
    };
  }, [cotizacionExpiraEn]);

  return vigente ? <PagoTraslado trasladoId={trasladoId} monto={monto} /> : null;
}
