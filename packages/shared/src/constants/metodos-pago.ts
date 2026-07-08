// PRD §4.6 — "No se acepta efectivo." / "Ruum Ruum solo acepta métodos electrónicos."
// El PRD no enumera proveedores o medios específicos (tarjeta, transferencia, etc.):
// esa integración queda pendiente de definición con el proveedor de pagos (ver
// "Pending decisions" en la documentación de producto). Esta constante solo
// codifica la regla dura: efectivo nunca es un método válido.
export const METODOS_PAGO_PROHIBIDOS = ["efectivo"] as const;

export function esMetodoPagoValido(metodo: string): boolean {
  return !METODOS_PAGO_PROHIBIDOS.includes(metodo.toLowerCase() as "efectivo");
}
