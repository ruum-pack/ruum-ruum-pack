import type { Conductor, NivelCONCER } from "../types/conductor";
import type { TipoVehiculo } from "../types/vehiculo";
import {
  ORDEN_NIVEL,
  NIVELES_CONCER,
  REQUISITOS_NIVEL_CONCER,
  type TipoRuta,
  type RequisitosNivel
} from "../constants/niveles-concer";
import { nivelPorCalificacion } from "./calificacion-nivel";

export type { TipoRuta };

/**
 * PRD §4.3 — Matriz de elegibilidad de conductores.
 * Devuelve el nivel más alto cuyos requisitos de experiencia/certificación
 * cumple el conductor (traslados completados, certificaciones vigentes y
 * ausencia de incidencias graves en la ventana correspondiente).
 *
 * NO considera la calificación por sí sola más allá del mínimo de la matriz;
 * la calificación como tope independiente se evalúa en nivelPorCalificacion
 * (§4.13) y se combina en nivelOperativoVigente, conforme indica el PRD:
 * "ambos criterios deben cumplirse de forma simultánea".
 */
export function nivelPorExperienciaYCertificacion(
  conductor: Conductor,
  requisitos: Record<NivelCONCER, RequisitosNivel> = REQUISITOS_NIVEL_CONCER
): NivelCONCER {
  let nivelAlcanzado: NivelCONCER = "basico";

  for (const nivel of NIVELES_CONCER) {
    const req = requisitos[nivel];

    const cumpleTraslados = conductor.traslados_completados >= req.traslados_completados_min;
    const cumpleCalificacion = conductor.calificacion_promedio >= req.calificacion_min;
    const cumpleCertificaciones = req.certificaciones_requeridas.every((tipo) =>
      conductor.certificaciones.some((c) => c.tipo === tipo && c.vigente)
    );

    const incidenciasEnVentana =
      req.ventana_meses_sin_incidencias_graves <= 6
        ? conductor.incidencias_graves_6m
        : conductor.incidencias_graves_12m;
    const sinIncidenciasGraves =
      req.ventana_meses_sin_incidencias_graves === 0 || incidenciasEnVentana === 0;

    if (cumpleTraslados && cumpleCalificacion && cumpleCertificaciones && sinIncidenciasGraves) {
      nivelAlcanzado = nivel;
    } else {
      // La matriz es acumulativa (cada nivel exige lo del anterior + más),
      // así que en cuanto un nivel falla, los superiores también fallan.
      break;
    }
  }

  return nivelAlcanzado;
}

/**
 * PRD §4.3 + §4.13 — "El nivel operativo vigente de un conductor es el menor
 * entre el nivel alcanzado por experiencia y certificación (matriz) y el
 * nivel permitido por su calificación actual; ambos criterios deben
 * cumplirse de forma simultánea."
 * Devuelve null si la calificación está por debajo de 4.0 (pierde elegibilidad).
 */
export function nivelOperativoVigente(
  conductor: Conductor,
  requisitos: Record<NivelCONCER, RequisitosNivel> = REQUISITOS_NIVEL_CONCER
): NivelCONCER | null {
  const porCalificacion = nivelPorCalificacion(conductor.calificacion_promedio);
  if (!porCalificacion) return null;

  const porExperiencia = nivelPorExperienciaYCertificacion(conductor, requisitos);

  const idxMenor = Math.min(ORDEN_NIVEL[porExperiencia], ORDEN_NIVEL[porCalificacion]);
  return NIVELES_CONCER.find((n) => ORDEN_NIVEL[n] === idxMenor) ?? null;
}

export function vehiculosPermitidos(
  nivel: NivelCONCER,
  requisitos: Record<NivelCONCER, RequisitosNivel> = REQUISITOS_NIVEL_CONCER
): TipoVehiculo[] {
  return requisitos[nivel].vehiculos_permitidos;
}

export function rutasPermitidas(
  nivel: NivelCONCER,
  requisitos: Record<NivelCONCER, RequisitosNivel> = REQUISITOS_NIVEL_CONCER
): TipoRuta[] {
  return requisitos[nivel].rutas_permitidas;
}

export interface ResultadoElegibilidad {
  elegible: boolean;
  motivo?: string;
}

/**
 * PRD §4.3 — "El conductor puede ver viajes disponibles solo si cumple
 * criterios de elegibilidad." Función principal que decide si un viaje debe
 * mostrarse a un conductor dado su estado, documentos, nivel operativo
 * vigente, tipo de vehículo del traslado y tipo de ruta.
 */
export function esElegibleParaViaje(
  conductor: Conductor,
  tipoVehiculo: TipoVehiculo,
  tipoRuta: TipoRuta,
  requisitos: Record<NivelCONCER, RequisitosNivel> = REQUISITOS_NIVEL_CONCER
): ResultadoElegibilidad {
  if (conductor.estado !== "activo" && conductor.estado !== "modo_prueba_supervisada") {
    return { elegible: false, motivo: `Conductor en estado: ${conductor.estado}` };
  }

  if (!conductor.documentos_vigentes) {
    return { elegible: false, motivo: "Documentos vencidos o incompletos" };
  }

  const nivel = nivelOperativoVigente(conductor, requisitos);
  if (!nivel) {
    return {
      elegible: false,
      motivo: `Calificación ${conductor.calificacion_promedio} por debajo del mínimo (4.0)`
    };
  }

  if (!vehiculosPermitidos(nivel, requisitos).includes(tipoVehiculo)) {
    return { elegible: false, motivo: `Nivel ${nivel} no autorizado para vehículo ${tipoVehiculo}` };
  }

  if (!rutasPermitidas(nivel, requisitos).includes(tipoRuta)) {
    return { elegible: false, motivo: `Nivel ${nivel} no autorizado para ruta ${tipoRuta}` };
  }

  return { elegible: true };
}
