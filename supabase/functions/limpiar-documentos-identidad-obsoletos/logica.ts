export const BUCKET_DOCUMENTOS_IDENTIDAD = "documentos-identidad";
export const LIMITE_RECLAMO_LIMPIEZA = 50;
export const UMBRAL_ALERTA_INTENTOS = 5;

export function codigoSeguro(error: unknown): string {
  if (!error || typeof error !== "object") return "desconocido";
  const valor = error as { code?: unknown; status?: unknown; name?: unknown };
  if (typeof valor.code === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(valor.code)) return valor.code;
  if (typeof valor.status === "number") return `http_${valor.status}`;
  if (typeof valor.name === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(valor.name)) return valor.name;
  return "desconocido";
}

export function requiereAlertaEliminacion(intento: number): boolean {
  return intento >= UMBRAL_ALERTA_INTENTOS;
}

export interface ResumenLimpieza {
  procesados: number;
  eliminados: number;
  pendientes: number;
  escalados: number;
}

export function resumirLimpieza(resultados: Array<{ ok: boolean; intento: number }>): ResumenLimpieza {
  let eliminados = 0;
  let pendientes = 0;
  let escalados = 0;
  for (const r of resultados) {
    if (r.ok) {
      eliminados += 1;
      continue;
    }
    pendientes += 1;
    if (requiereAlertaEliminacion(r.intento)) escalados += 1;
  }
  return { procesados: resultados.length, eliminados, pendientes, escalados };
}

export function estadoHttpLimpieza(resumen: ResumenLimpieza): number {
  return resumen.escalados > 0 ? 500 : 200;
}
