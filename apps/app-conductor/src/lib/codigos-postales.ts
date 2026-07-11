"use client";

/**
 * Fase 5 (auditoría H-4) — este archivo antes llamaba a COPOMEX (con el
 * token de demostración `pruebas`, que solo responde para CPs de ejemplo) y
 * caía a Zippopotam como respaldo, que no trae municipio fuera de CDMX.
 * Ahora reexporta la consulta compartida contra el catálogo local de SEPOMEX
 * (`public/data/codigos-postales/`), sin llamadas a APIs externas.
 */
export type { DatosCodigoPostal } from "@ruum/shared/utils";
export { consultarCodigoPostalMx } from "@ruum/shared/utils";
