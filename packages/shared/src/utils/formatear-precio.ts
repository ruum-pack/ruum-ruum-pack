// PRD §4.6 — "El precio puede ser dinámico." Utilidad de presentación, sin
// lógica de negocio: formatea un monto en pesos mexicanos para mostrar en UI.
export function formatearPrecio(monto: number, moneda: string = "MXN"): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda }).format(monto);
}
