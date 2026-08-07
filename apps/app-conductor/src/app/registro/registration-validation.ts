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

/**
 * Formato para visualización (con paréntesis y guiones)
 * Ej: (55) 1234-5678
 */
export function formatoTelefonoNacional(valor: string) {
  const digitos = soloDigitos(valor);
  if (!digitos) return "";
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6, 10)}`;
}

/**
 * Formato para input mask - se aplica mientras el usuario escribe
 * Mantiene el cursor en la posición correcta
 */
export function formatoTelefonoMask(valor: string) {
  return formatoTelefonoNacional(valor);
}

/**
 * Calcula la posición del cursor después de aplicar la máscara
 * para mantener una experiencia de escritura fluida
 */
export function calcularCursorTelefono(valorAnterior: string, valorNuevo: string, cursorPos: number): number {
  const digitosAnteriores = soloDigitos(valorAnterior);
  const digitosNuevos = soloDigitos(valorNuevo);
  const diff = digitosNuevos.length - digitosAnteriores.length;
  
  // Si se borró, el cursor se mueve hacia atrás
  if (diff < 0) {
    return Math.max(0, cursorPos + diff);
  }
  
  // Si se agregó, calcular nueva posición considerando los caracteres de formato
  const formatoNuevo = formatoTelefonoNacional(digitosNuevos);
  const formatoAnterior = formatoTelefonoNacional(digitosAnteriores);
  
  return Math.min(formatoNuevo.length, cursorPos + (formatoNuevo.length - formatoAnterior.length));
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
