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
      "Cuatro niveles de certificación"
  },
  {
    titulo: "Evidencia en cada extremo",
    cuerpo:
      "Fotos obligatorias del vehículo antes de salir y al llegar",
  },
  {
    titulo: "Un Pasaporte por traslado.",
    cuerpo:
      "Estado, evidencia, pagos y comunicación en un solo expediente digital."
  },
];
