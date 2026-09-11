/**
 * FASE 5 — Dominio operations (Torre de Control): reintento idempotente para
 * operaciones admin. Movido sin cambios desde services/admin.ts.
 */
export async function withIdempotentRetry<T>(operacion: () => Promise<T>): Promise<T> {
  const maxIntentos = 3;
  let ultimoError: Error | null = null;

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      return await operacion();
    } catch (err) {
      ultimoError = err instanceof Error ? err : new Error(String(err));
      const msg = ultimoError.message;

      if (msg.includes("CONCURRENCY_CONFLICT") || msg.includes("PERMISO_INSUFICIENTE") || msg.includes("TRANSICION_INVALIDA")) {
        throw ultimoError;
      }

      if (intento < maxIntentos) {
        const espera = Math.min(200 * Math.pow(2, intento - 1), 2000);
        await new Promise((resolve) => setTimeout(resolve, espera));
      }
    }
  }

  throw ultimoError ?? new Error("Reintentos agotados sin resultado.");
}
