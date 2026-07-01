// PRD §3 — "Funciones empresariales: una empresa puede tener máximo dos
// usuarios internos: titular y usuario autorizado." Ver también
// rules/limite-empresa.ts para la validación del límite de miembros.
export interface Empresa {
  id: string;
  nombre: string;
  creado_en: string;
}
