// PRD §5.1 — cada traslado tiene un Pasaporte Digital identificable.
// Genera un identificador legible y único en el momento de creación de la
// solicitud (PRD §6: "Solicitud creada"). El folio en sí no está
// especificado por el PRD; se usa un formato simple AAAA-XXXXXXX.
export function generarIdPasaporte(fecha: Date = new Date()): string {
  const anio = fecha.getFullYear();
  const aleatorio = Math.random().toString(36).slice(2, 9).toUpperCase();
  return `RR-${anio}-${aleatorio}`;
}
