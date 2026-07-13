export interface TrasladoParaCobro {
  precio_cotizado: number | null;
  precio_final: number | null;
}

export const PISO_COBRO_MXN = 699;
export const TECHO_COBRO_MXN = 100000;

export function montoAutorizadoParaCobro(traslado: TrasladoParaCobro): number | null {
  const monto = traslado.precio_final ?? traslado.precio_cotizado;
  return typeof monto === "number" && Number.isFinite(monto) ? monto : null;
}

export function validarRangoMontoCobro(monto: number | null): { valido: true } | { valido: false; error: string } {
  if (monto === null || monto <= 0) {
    return { valido: false, error: "El traslado todavía no cuenta con una cotización válida." };
  }

  if (monto < PISO_COBRO_MXN || monto > TECHO_COBRO_MXN) {
    return {
      valido: false,
      error: `El monto a cobrar ($${monto} MXN) está fuera del rango esperado ($${PISO_COBRO_MXN}-${TECHO_COBRO_MXN} MXN). Revísalo en panel-admin antes de cobrar.`
    };
  }

  return { valido: true };
}
