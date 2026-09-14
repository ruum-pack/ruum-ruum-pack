type ClienteRateLimit = {
  rpc: (nombre: string, parametros: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

export type ResultadoRateLimit = {
  permitido: boolean;
  reintentarEn: number;
};

/** Consume un contador atómico en Postgres. Fallar cerrado evita bypass si
 * la política o la función de rate limit no están desplegadas. */
export async function consumirRateLimit(
  cliente: ClienteRateLimit,
  bucket: string,
  rateKey: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<ResultadoRateLimit> {
  const { data, error } = await cliente.rpc("consumir_rate_limit", {
    p_bucket: bucket,
    p_rate_key: rateKey,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(error.message ?? "Rate limit no disponible.");

  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila || typeof fila !== "object") {
    throw new Error("Rate limit no devolvió un resultado.");
  }
  const resultado = fila as { permitido?: unknown; reintentar_en?: unknown };
  return {
    permitido: resultado.permitido === true,
    reintentarEn: typeof resultado.reintentar_en === "number"
      ? resultado.reintentar_en
      : windowSeconds,
  };
}
