/**
 * Valida que una ruta de redirección post-login sea estrictamente relativa y segura,
 * previniendo vulnerabilidades de Open Redirect (CWE-601).
 *
 * Criterios de validación:
 * 1. Debe comenzar con un solo slash '/' y no '//' (protocol-relative URL).
 * 2. No debe contener barras invertidas '\' (bypasses en navegadores/Windows).
 * 3. No debe contener esquemas de protocolo (ej. 'javascript:', 'data:', 'https:').
 * 4. Debe ser una ruta válida dentro del mismo origen.
 */
export function validarDestinoSeguro(
  destino: string | null | undefined,
  rutaFallback = "/panel"
): string {
  if (!destino || typeof destino !== "string") return rutaFallback;
  const limpio = destino.trim();
  if (
    limpio.startsWith("/") &&
    !limpio.startsWith("//") &&
    !limpio.startsWith("/\\") &&
    !limpio.includes("\\") &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(limpio)
  ) {
    return limpio;
  }
  return rutaFallback;
}
