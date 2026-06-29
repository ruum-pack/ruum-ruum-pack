export interface PilarConfianza {
  titulo: string;
  cuerpo: string;
}

// PRD §14 — "La App Usuario debe enfocarse en confianza, visibilidad y
// cierre documental." Mismo copy para la landing pública y la sección de
// Inicio de un usuario con sesión: son los mensajes de seguridad/confianza
// del producto, no algo que deba variar según quién los esté leyendo.
export const PILARES_CONFIANZA: PilarConfianza[] = [
  {
    titulo: "Conductores CONCER",
    cuerpo:
      "Cuatro niveles de certificación según experiencia, calificación y tipo de vehículo. Nunca asignamos un conductor sin verificar que cumple los requisitos para tu traslado."
  },
  {
    titulo: "Evidencia en cada extremo",
    cuerpo:
      "Fotos obligatorias del vehículo antes de salir y al llegar, con los mismos ángulos siempre. Si algo cambió en el camino, queda documentado."
  },
  {
    titulo: "Un Pasaporte por traslado",
    cuerpo:
      "Estado, evidencia, pagos y comunicación en un solo expediente digital que puedes exportar a PDF cuando lo necesites."
  }
];
