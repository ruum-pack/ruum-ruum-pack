export type EstadoEconomicoExplicito =
  | "sin_calcular"
  | "estimado"
  | "en_validacion"
  | "confirmado"
  | "programado"
  | "pagado"
  | "retenido"
  | "rechazado";

export type EstatusEconomicoLegacy = "pendiente" | "revocado" | "en_revision" | "ajustado";

export type EstatusEconomico = EstadoEconomicoExplicito | EstatusEconomicoLegacy;

export const ETIQUETA_ESTATUS_ECONOMICO: Record<EstatusEconomico, string> = {
  sin_calcular: "Sin calcular",
  estimado: "Estimado",
  en_validacion: GLOSARIO_OPERATIVO.pendiente_validacion,
  confirmado: "Confirmado",
  programado: GLOSARIO_OPERATIVO.payout_pending,
  pagado: "Pagado",
  retenido: "Retenido",
  rechazado: "Rechazado",
  pendiente: "Pendiente",
  revocado: "Revocado",
  en_revision: "En revisión",
  ajustado: "Ajustado"
};

export const ESTILO_ESTATUS: Record<EstatusEconomico, string> = {
  sin_calcular: "bg-ink/[0.05] text-ink/65 border-ink/15",
  estimado: "bg-route-soft text-route-dark border-route/25",
  en_validacion: "bg-warn-soft text-warn border-warn/40",
  confirmado: "bg-control-soft text-control border-control/25",
  programado: "bg-route-soft text-route-dark border-route/25",
  pagado: "bg-control-soft text-control border-control/25",
  retenido: "bg-warn-soft text-warn border-warn/40",
  rechazado: "bg-danger-soft text-danger border-danger/25",
  pendiente: "bg-warn-soft text-warn border-warn/40",
  revocado: "bg-danger-soft text-danger border-danger/25",
  en_revision: "bg-route-soft text-route-dark border-route/25",
  ajustado: "bg-ink/[0.05] text-ink/65 border-ink/15"
};
import { GLOSARIO_OPERATIVO } from "./glosario-operativo";
