export const CLAVE_CORREO_CONFIRMACION = "ruum:correo-confirmacion";
export const CLAVE_REENVIO_CONFIRMACION_HASTA = "ruum:reenvio-confirmacion-hasta";

export function soloDigitos(valor: string, maximo?: number) {
  const limpio = valor.replace(/\D/g, "");
  return maximo ? limpio.slice(0, maximo) : limpio;
}

export function telefonoLocalMx(valor: string) {
  const limpio = soloDigitos(valor);
  if (limpio.length > 10 && limpio.startsWith("521")) return limpio.slice(3, 13);
  if (limpio.length > 10 && limpio.startsWith("52")) return limpio.slice(2, 12);
  return limpio.slice(0, 10);
}

export function telefonoMx(diezDigitos: string) {
  const telefono = soloDigitos(diezDigitos, 10);
  return telefono ? `+52${telefono}` : "";
}

export function normalizarCorreoRegistro(valor: string) {
  return valor.trim().toLowerCase();
}

export function nombreCompleto(nombre: string, apellido: string) {
  return [nombre.trim(), apellido.trim()].filter(Boolean).join(" ");
}

export function crearRedirectConfirmacion(origen: string) {
  const destino = new URL("/auth/callback", origen);
  destino.searchParams.set("next", "/onboarding?nuevo=1");
  return destino.toString();
}
