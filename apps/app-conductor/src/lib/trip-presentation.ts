import type { EstadoTraslado } from "@ruum/shared/types";

export type TripPresentationAction =
  | "go_origin"
  | "mark_arrived_origin"
  | "confirm_contact"
  | "inspect_vehicle"
  | "capture_origin_record"
  | "go_destination"
  | "mark_arrived_destination"
  | "capture_destination_record"
  | "confirm_delivery"
  | "close_trip"
  | "view_available_trips"
  | "contact_support"
  | "review_status"
  | "none";

export type TripPresentationIncidentStatus = {
  canContinue?: boolean;
  requiresControlTowerDecision?: boolean;
};

export type TripPresentation = {
  stage: number;
  totalStages: number;
  canContinue: boolean;
  requiresControlTowerDecision: boolean;
  title: string;
  instruction: string;
  primaryAction: {
    label: string;
    action: TripPresentationAction;
  };
  secondaryActions: string[];
  nextStep?: string;
};

const TOTAL_STAGES = 7;

function presentation(
  stage: number,
  title: string,
  instruction: string,
  action: TripPresentationAction,
  label: string,
  nextStep?: string,
  secondaryActions: string[] = ["Contactar soporte Ruum", "Reportar un problema"],
  operationalStatus: TripPresentationIncidentStatus = {}
): TripPresentation {
  return {
    stage,
    totalStages: TOTAL_STAGES,
    canContinue: operationalStatus.canContinue ?? true,
    requiresControlTowerDecision: operationalStatus.requiresControlTowerDecision ?? false,
    title,
    instruction,
    primaryAction: { label, action },
    secondaryActions,
    nextStep
  };
}

export function getTripPresentation(estado: EstadoTraslado, incidentStatus: TripPresentationIncidentStatus = {}): TripPresentation {
  switch (estado) {
    case "conductor_asignado":
    case "conductor_en_camino_al_origen":
      return presentation(
        1,
        "Dirígete al punto de recolección",
        "Revisa la dirección de recolección, abre tu app de navegación y confirma tu llegada cuando estés en el punto.",
        estado === "conductor_asignado" ? "go_origin" : "mark_arrived_origin",
        estado === "conductor_asignado" ? "Iniciar ruta" : "Confirmar llegada",
        "Al llegar, confirma que encontraste al contacto."
      );

    case "conductor_en_punto_de_recoleccion":
      return presentation(
        2,
        "Confirma que encontraste al contacto",
        "Valida que la persona de entrega y el vehículo correspondan al traslado antes de avanzar.",
        "confirm_contact",
        "Confirmar contacto y vehículo",
        "Después revisarás el vehículo antes de moverlo."
      );

    case "verificacion_vehiculo_en_proceso":
      return presentation(
        3,
        "Revisa el vehículo antes de moverlo",
        "Comprueba condiciones básicas, documentos visibles y datos del vehículo. No inicies el traslado si algo no coincide.",
        "inspect_vehicle",
        "Iniciar registro inicial",
        "Luego registrarás el estado inicial del vehículo."
      );

    case "evidencia_inicial_en_proceso":
      return presentation(
        4,
        "Registra el estado inicial del vehículo",
        "Captura los ángulos obligatorios y guarda los datos operativos antes de mover el vehículo.",
        "capture_origin_record",
        "Continuar registro inicial",
        "Con el registro completo podrás dirigirte al punto de entrega."
      );

    case "evidencia_inicial_completada":
    case "vehiculo_recibido":
    case "traslado_en_curso":
      return presentation(
        5,
        "Dirígete al punto de entrega",
        "Conduce hacia el punto de entrega y mantén el registro del vehículo y la comunicación al día.",
        estado === "traslado_en_curso" ? "mark_arrived_destination" : "go_destination",
        estado === "traslado_en_curso" ? "Confirmar llegada a destino" : "Abrir ruta de entrega",
        "Al llegar, registra el estado final del vehículo."
      );

    case "incidencia_reportada":
      if (incidentStatus.canContinue === true && incidentStatus.requiresControlTowerDecision !== true) {
        return presentation(
          5,
          "Continúa con indicación operativa",
          "El problema ya fue revisado y puedes continuar hacia el punto de entrega. Mantén comunicación por los canales autorizados.",
          "go_destination",
          "Abrir ruta de entrega",
          "Al llegar, registra el estado final del vehículo.",
          ["Contactar soporte Ruum", "Reportar un problema"],
          { canContinue: true, requiresControlTowerDecision: false }
        );
      }

      return presentation(
        5,
        "Espera indicaciones de Torre de Control",
        "Hay un problema reportado y aún no está confirmado que puedas continuar. Mantente disponible, conserva el vehículo seguro y espera la instrucción operativa.",
        "contact_support",
        "Contactar soporte Ruum",
        "Torre de Control indicará si el traslado continúa, cambia de plan o se detiene.",
        ["Emergencia", "Reportar un problema"],
        { canContinue: false, requiresControlTowerDecision: true }
      );

    case "llegada_a_destino":
    case "evidencia_final_en_proceso":
      return presentation(
        6,
        "Registra el estado final del vehículo",
        "Antes de entregar, captura el registro final y confirma que el vehículo queda documentado.",
        "capture_destination_record",
        "Continuar registro final",
        "Después confirmarás la entrega."
      );

    case "evidencia_final_completada":
    case "entrega_confirmada":
      return presentation(
        7,
        "Confirma la entrega",
        "Valida con la persona de recepción que el vehículo fue entregado y cierra la operación cuando corresponda.",
        estado === "evidencia_final_completada" ? "confirm_delivery" : "close_trip",
        estado === "evidencia_final_completada" ? "Confirmar entrega" : "Cerrar viaje",
        "El cierre enviará el traslado a validación operativa."
      );

    case "pago_pendiente":
    case "pago_completado":
    case "servicio_cerrado":
      return presentation(
        TOTAL_STAGES,
        "Traslado en validación operativa",
        "La operación principal terminó. El equipo validará pagos, registros y cualquier ajuste pendiente.",
        "review_status",
        "Revisar estado",
        undefined,
        ["Revisión de un traslado", "Contactar soporte Ruum"]
      );

    case "servicio_cancelado":
    case "traslado_fallido":
      return presentation(
        TOTAL_STAGES,
        "Traslado detenido",
        "Este traslado ya no continúa. Revisa el motivo en el historial o contacta a soporte si necesitas aclararlo.",
        "view_available_trips",
        "Volver a viajes",
        undefined,
        ["Contactar soporte Ruum"]
      );

    case "dano_no_reportado_en_revision":
    case "reclamo_abierto":
    case "reclamo_resuelto":
    case "cierre_operativo_con_incidencia_abierta":
    case "disputa_abierta":
    case "disputa_resuelta":
      return presentation(
        TOTAL_STAGES,
        "Traslado en revisión",
        "Hay una revisión de operación asociada a este traslado. Mantente atento a las indicaciones del equipo.",
        "review_status",
        "Ver revisión",
        undefined,
        ["Contactar soporte Ruum"]
      );

    default:
      return presentation(
        1,
        "Traslado aún no listo para operación",
        "Este traslado todavía no está en una etapa accionable para conductor. Vuelve a la lista para ver viajes disponibles o próximos.",
        "view_available_trips",
        "Abrir viajes disponibles",
        undefined,
        ["Contactar soporte Ruum"]
      );
  }
}
