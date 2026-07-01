import type { EstadoTraslado } from "@ruum/shared/types";

// El PRD define 32 estados técnicos (§6) para que el sistema sea preciso.
// Pero "App Usuario debe enfocarse en confianza y visibilidad" (PRD §14),
// no en nomenclatura interna. Esta es la traducción a 7 etapas que alguien
// reconoce de su propio viaje — una decisión de UX, no una regla del PRD.
export interface EtapaTraslado {
  id: string;
  etiqueta: string;
  estados: EstadoTraslado[];
}

export const ETAPAS_TRASLADO: EtapaTraslado[] = [
  {
    id: "solicitud",
    etiqueta: "Solicitud",
    estados: [
      "usuario_pendiente_verificacion",
      "usuario_verificado",
      "solicitud_creada",
      "documentacion_pendiente",
      "documentacion_en_revision",
      "documentacion_validada"
    ]
  },
  {
    id: "confirmacion",
    etiqueta: "Confirmación",
    estados: ["cotizacion_generada", "servicio_confirmado", "pendiente_de_conductor"]
  },
  {
    id: "conductor",
    etiqueta: "Conductor asignado",
    estados: ["conductor_asignado"]
  },
  {
    id: "recoleccion",
    etiqueta: "Recolección",
    estados: [
      "conductor_en_camino_al_origen",
      "conductor_en_punto_de_recoleccion",
      "verificacion_vehiculo_en_proceso",
      "evidencia_inicial_en_proceso",
      "evidencia_inicial_completada",
      "vehiculo_recibido"
    ]
  },
  {
    id: "transito",
    etiqueta: "En tránsito",
    estados: ["traslado_en_curso", "incidencia_reportada", "llegada_a_destino"]
  },
  {
    id: "entrega",
    etiqueta: "Entrega",
    estados: ["evidencia_final_en_proceso", "evidencia_final_completada", "entrega_confirmada"]
  },
  {
    id: "cierre",
    etiqueta: "Cierre",
    estados: ["pago_pendiente", "pago_completado", "servicio_cerrado"]
  }
];

// Estados que se ramifican fuera del camino feliz: se muestran como aviso,
// no como posición en el stepper (PRD §6: ocurren después del cierre o
// rompen el flujo lineal).
export const ESTADOS_RAMIFICADOS: EstadoTraslado[] = [
  "servicio_cancelado",
  "traslado_fallido",
  "dano_no_reportado_en_revision",
  "reclamo_abierto",
  "reclamo_resuelto",
  "cierre_operativo_con_incidencia_abierta",
  "disputa_abierta",
  "disputa_resuelta"
];

export function indiceEtapaActual(estado: EstadoTraslado): number {
  return ETAPAS_TRASLADO.findIndex((etapa) => etapa.estados.includes(estado));
}
