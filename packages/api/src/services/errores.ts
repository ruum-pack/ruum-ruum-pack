export type CodigoErrorAplicacion =
  | "forbidden" | "conflict" | "validation" | "database" | "network" | "unknown";

export class ErrorAplicacion extends Error {
  constructor(public readonly codigo: CodigoErrorAplicacion, mensaje: string, public readonly causa?: unknown) {
    super(mensaje);
    this.name = "ErrorAplicacion";
  }
}

type ErrorSupabaseLike = { code?: string; message?: string; status?: number };

export function normalizarError(error: unknown, mensajeFallback = "No se pudo completar la operación."): ErrorAplicacion {
  if (error instanceof ErrorAplicacion) return error;
  const dato = (error ?? {}) as ErrorSupabaseLike;
  const codigo = dato.code ?? "";
  if (dato.status === 401 || codigo === "PGRST301") return new ErrorAplicacion("forbidden", "Tu sesión expiró. Inicia sesión nuevamente.", error);
  if (dato.status === 403 || codigo === "42501") return new ErrorAplicacion("forbidden", "No tienes permiso para realizar esta acción.", error);
  if (codigo === "40001" || codigo === "409" || codigo === "23505" || codigo === "VERSION_CONFLICT") return new ErrorAplicacion("conflict", "El registro cambió mientras lo editabas. Actualiza la información e inténtalo de nuevo.", error);
  if (codigo === "23503" || codigo === "23514" || codigo === "22023") return new ErrorAplicacion("validation", dato.message ?? "Los datos enviados no son válidos.", error);
  if (codigo === "PGRST116") return new ErrorAplicacion("unknown", "El registro ya no existe o no está disponible.", error);
  if (codigo.startsWith("PGRST") || (dato.status !== undefined && dato.status >= 500 && dato.status < 600)) return new ErrorAplicacion("database", "Error en la base de datos. Intenta de nuevo.", error);
  if (error instanceof TypeError) return new ErrorAplicacion("network", "No fue posible conectar con el servicio. Revisa tu conexión.", error);
  return new ErrorAplicacion("unknown", error instanceof Error && error.message ? error.message : mensajeFallback, error);
}

export function mensajeError(error: unknown, fallback?: string) {
  return normalizarError(error, fallback).message;
}
