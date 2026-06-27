import type { FotoEvidencia, TipoEvidencia } from "../types/evidencia";
import { ANGULOS_OBLIGATORIOS } from "../types/evidencia";

export interface ResultadoEvidencia {
  completa: boolean;
  angulosFaltantes: string[];
}

/**
 * PRD §4.4 — "El viaje no puede iniciar sin evidencia inicial completa" /
 * "El servicio no puede cerrarse sin evidencia final completa."
 * Evidencia completa = los 5 ángulos obligatorios presentes y sincronizados
 * para el tipo (inicial o final) correspondiente.
 */
export function evidenciaCompleta(fotos: FotoEvidencia[], tipo: TipoEvidencia): ResultadoEvidencia {
  const fotosDelTipo = fotos.filter((f) => f.tipo === tipo && f.sincronizada);
  const angulosPresentes = new Set(fotosDelTipo.map((f) => f.angulo));

  const angulosFaltantes = ANGULOS_OBLIGATORIOS.filter((a) => !angulosPresentes.has(a));

  return { completa: angulosFaltantes.length === 0, angulosFaltantes };
}

/**
 * PRD §4.4 — "Si la evidencia final muestra un daño que no estaba presente en
 * la evidencia inicial y no fue reportado como incidencia durante el
 * traslado, el sistema abre automáticamente una incidencia de daño no
 * reportado." Esta función solo determina SI corresponde abrir la incidencia
 * automática; la comparación foto-por-foto y el juicio sobre el daño en sí
 * son responsabilidad de Admin (Torre de Control), no de esta regla pura.
 */
export function debeAbrirIncidenciaDanoNoReportado(
  danoDetectadoEnFinal: boolean,
  danoPresenteEnInicial: boolean,
  incidenciaYaReportadaDuranteTraslado: boolean
): boolean {
  return danoDetectadoEnFinal && !danoPresenteEnInicial && !incidenciaYaReportadaDuranteTraslado;
}
