import type { Vehiculo } from "../types/vehiculo";

export interface ResultadoValidacionDocumentos {
  valido: boolean;
  documentosFaltantes: string[];
}

/**
 * PRD §4.2 — "Documentación obligatoria: tarjeta de circulación, talón u
 * holograma de verificación y ambas placas." / "Excepciones: permiso legal
 * vigente para circular sin placas o sin tarjeta."
 * Un permiso especial vigente sustituye la falta de tarjeta de circulación
 * o de placas, pero no exime la condición de poder circular rodando.
 */
export function validarDocumentosVehiculo(vehiculo: Vehiculo): ResultadoValidacionDocumentos {
  const tienePermisoEspecial = Boolean(vehiculo.permiso_especial_vigente);
  const faltantes: string[] = [];

  if (!vehiculo.tiene_tarjeta_circulacion && !tienePermisoEspecial) {
    faltantes.push("tarjeta_circulacion");
  }
  if (!vehiculo.tiene_verificacion) {
    faltantes.push("verificacion");
  }
  if (!vehiculo.tiene_placas && !tienePermisoEspecial) {
    faltantes.push("placas");
  }
  if (!vehiculo.puede_circular_rodando) {
    faltantes.push("condicion_para_circular_rodando");
  }

  return { valido: faltantes.length === 0, documentosFaltantes: faltantes };
}
