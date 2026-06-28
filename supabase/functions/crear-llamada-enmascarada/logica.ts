/**
 * Lógica pura de crear-llamada-enmascarada — sin red ni Postgres, probada
 * con `deno test` (mismo criterio que stripe-webhook/logica.ts).
 */

export interface ResultadoValidacionTelefonos {
  valido: boolean;
  motivo?: string;
}

/**
 * PRD §4.12 — Twilio Proxy necesita el teléfono real de AMBAS partes para
 * poder crear la sesión. Si a cualquiera de las dos le falta, no tiene
 * sentido intentar la llamada con Twilio para luego fallar ahí.
 */
export function validarTelefonos(
  telefonoUsuario: string | null,
  telefonoConductor: string | null
): ResultadoValidacionTelefonos {
  if (!telefonoUsuario && !telefonoConductor) {
    return { valido: false, motivo: "Ni el usuario ni el conductor tienen un teléfono registrado." };
  }
  if (!telefonoUsuario) {
    return { valido: false, motivo: "El usuario no tiene un teléfono registrado." };
  }
  if (!telefonoConductor) {
    return { valido: false, motivo: "El conductor no tiene un teléfono registrado." };
  }
  return { valido: true };
}

export type RolLlamador = "usuario" | "conductor";

/**
 * Determina si quien llama es el usuario o el conductor de ESTE traslado
 * específico — nunca confiar en un rol que mande el cliente, siempre
 * derivarlo de a quién pertenece la fila (usuario_id/conductor_id ya
 * filtrados por RLS antes de llegar aquí).
 */
export function determinarRolLlamador(
  usuarioIdDelTraslado: string,
  conductorIdDelTraslado: string | null,
  miUsuarioId: string | null,
  miConductorId: string | null
): RolLlamador | null {
  if (miUsuarioId && miUsuarioId === usuarioIdDelTraslado) return "usuario";
  if (miConductorId && conductorIdDelTraslado && miConductorId === conductorIdDelTraslado) return "conductor";
  return null;
}

/** Una sesión de Proxy ya creada y no cerrada se reutiliza; si no existe o ya cerró, hay que crear una nueva. */
export function debeReutilizarSesion(sesionExistente: { cerrada_en: string | null } | null): boolean {
  return sesionExistente !== null && sesionExistente.cerrada_en === null;
}
