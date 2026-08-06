export function objetoJson(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}

export function soloDigitos(valor: string, max = 10) {
  return valor.replace(/\D/g, "").slice(0, max);
}

export function soloAlfanumericoMayusculas(valor: string, max = 12) {
  return valor.replace(/[^a-zA-Z0-9]/g, "").toLocaleUpperCase("es-MX").slice(0, max);
}

export function telefonoE164Mx(valor: string) {
  const nacional = soloDigitos(valor);
  return nacional ? `+52${nacional}` : "";
}

export function formatoTelefonoNacional(valor: string) {
  const digitos = soloDigitos(valor);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 2)}-${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 6)}-${digitos.slice(6, 10)}`;
}

export function formatoTelefonoMask(valor: string) {
  return formatoTelefonoNacional(valor);
}

export function formatoLicenciaMask(valor: string) {
  const licencia = soloAlfanumericoMayusculas(valor);
  if (licencia.length <= 4) return licencia;
  if (licencia.length <= 8) return `${licencia.slice(0, 4)} ${licencia.slice(4)}`;
  return `${licencia.slice(0, 4)} ${licencia.slice(4, 8)} ${licencia.slice(8, 12)}`;
}

export function formatoFechaIsoParcial(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 4) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;
  return `${digitos.slice(0, 4)}-${digitos.slice(4, 6)}-${digitos.slice(6)}`;
}

export function limpiarTexto(valor: string) {
  return valor.trim().replace(/\s+/g, " ");
}
