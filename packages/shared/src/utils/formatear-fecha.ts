// Utilidad de presentación, sin lógica de negocio (mismo criterio que
// formatear-precio.ts): convierte una fecha ISO en algo legible para
// pantallas de seguimiento (inicio, historial) sin que cada app reimplemente
// su propio cálculo de "hace cuánto fue esto".
export function formatearFechaRelativa(fechaIso: string, ahora: Date = new Date()): string {
  const fecha = new Date(fechaIso);
  const minutos = Math.round((ahora.getTime() - fecha.getTime()) / 60000);

  if (minutos < 1) return "Justo ahora";
  if (minutos < 60) return `Hace ${minutos} min`;

  const horas = Math.round(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;

  const dias = Math.round(horas / 24);
  if (dias < 7) return `Hace ${dias} ${dias === 1 ? "día" : "días"}`;

  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(fecha);
}
