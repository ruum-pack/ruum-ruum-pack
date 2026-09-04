import type { DatosFormulario } from "./types";

export const CAMPOS_PASO_TARIFA = new Set<keyof DatosFormulario>([
  "origenCodigoPostal",
  "destinoCodigoPostal",
  "marca",
  "modelo",
  "condicion",
  "modalidadProgramacion",
  "fechaHoraProgramada"
]);

export interface TarifaGateFields {
  origenCodigoPostal: string;
  destinoCodigoPostal: string;
  marca: string;
  modelo: string;
  condicion: string;
  modalidadProgramacion: string;
  fechaHoraProgramada: string;
}

export function extraerCamposTarifa(datos: Partial<DatosFormulario>): TarifaGateFields {
  return {
    origenCodigoPostal: (datos.origenCodigoPostal ?? "").trim(),
    destinoCodigoPostal: (datos.destinoCodigoPostal ?? "").trim(),
    marca: (datos.marca ?? "").trim(),
    modelo: (datos.modelo ?? "").trim(),
    condicion: (datos.condicion ?? "").trim(),
    modalidadProgramacion: (datos.modalidadProgramacion ?? "").trim(),
    fechaHoraProgramada: (datos.fechaHoraProgramada ?? "").trim()
  };
}

/** Un CP solo participa en el cálculo cuando el usuario terminó sus 5 dígitos. */
export function codigoPostalCompleto(valor: string | null | undefined): boolean {
  return /^\d{5}$/.test((valor ?? "").trim());
}

export function generarTarifaSnapshot(datos: Partial<DatosFormulario>): string {
  return JSON.stringify(extraerCamposTarifa(datos));
}

export function haCambiadoTarifa(snapshot: string | null, datosActuales: Partial<DatosFormulario>): boolean {
  if (!snapshot) return false;
  const snapshotActual = generarTarifaSnapshot(datosActuales);
  return snapshot !== snapshotActual;
}
