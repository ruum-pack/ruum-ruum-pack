const MENSAJES_AUTH = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Confirma tu correo antes de iniciar sesión.",
  user_not_found: "No encontramos una cuenta con ese correo.",
  signup_disabled: "El registro no está disponible en este momento.",
  email_address_invalid: "El correo no tiene un formato válido.",
  password_too_short: "La contraseña es demasiado corta.",
  weak_password: "La contraseña no cumple los requisitos mínimos.",
  over_email_send_rate_limit: "Espera unos minutos antes de volver a intentar.",
  over_request_rate_limit: "Demasiados intentos. Espera unos minutos y vuelve a probar."
} as const;

// Mensajes emitidos a propósito por manejar_nuevo_usuario_auth() (ver
// supabase/migrations/20260710000053_conductores_unicidad_mensaje.sql)
// cuando el registro de conductor choca con un índice único existente.
const MENSAJES_DUPLICADO_CONDUCTOR: Record<string, string> = {
  curp: "Ya existe una cuenta de conductor registrada con esta CURP.",
  telefono: "Ya existe una cuenta de conductor registrada con este teléfono.",
  licencia: "Ya existe una cuenta de conductor registrada con este número de licencia.",
  desconocido: "Ya existe una cuenta de conductor con alguno de estos datos. Verifica CURP, teléfono y número de licencia."
};

type CodigoAuth = keyof typeof MENSAJES_AUTH;

const FRAGMENTOS_AUTH: Array<[string, string]> = [
  ["invalid login credentials", MENSAJES_AUTH.invalid_credentials],
  ["email not confirmed", MENSAJES_AUTH.email_not_confirmed],
  ["user not found", MENSAJES_AUTH.user_not_found],
  ["signup is disabled", MENSAJES_AUTH.signup_disabled],
  ["invalid email", MENSAJES_AUTH.email_address_invalid],
  ["password should be at least", MENSAJES_AUTH.password_too_short],
  ["weak password", MENSAJES_AUTH.weak_password],
  ["rate limit", MENSAJES_AUTH.over_request_rate_limit]
];

export function traducirErrorAuth(error: unknown, respaldo = "No pudimos iniciar tu sesión.") {
  if (!error || typeof error !== "object") return respaldo;

  const posible = error as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof posible.code === "string" ? posible.code : undefined;
  if (code && code in MENSAJES_AUTH) return MENSAJES_AUTH[code as CodigoAuth];

  const message = typeof posible.message === "string" ? posible.message : "";
  const normalizado = message.toLowerCase();

  const duplicado = normalizado.match(/conductor_duplicado:(\w+)/);
  if (duplicado) {
    return MENSAJES_DUPLICADO_CONDUCTOR[duplicado[1]] ?? MENSAJES_DUPLICADO_CONDUCTOR.desconocido;
  }

  const coincidencia = FRAGMENTOS_AUTH.find(([fragmento]) => normalizado.includes(fragmento));
  return coincidencia?.[1] ?? respaldo;
}
