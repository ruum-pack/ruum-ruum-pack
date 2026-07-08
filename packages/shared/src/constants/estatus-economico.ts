export type EstatusEconomico = "pagado" | "pendiente" | "revocado" | "en_revision" | "ajustado";

export const ETIQUETA_ESTATUS_ECONOMICO: Record<EstatusEconomico, string> = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  revocado: "Revocado",
  en_revision: "En revisión",
  ajustado: "Ajustado"
};

export const ESTILO_ESTATUS: Record<EstatusEconomico, string> = {
  pagado: "bg-control-soft text-control border-control/25",
  pendiente: "bg-warn-soft text-warn border-warn/40",
  revocado: "bg-danger-soft text-danger border-danger/25",
  en_revision: "bg-route-soft text-route-dark border-route/25",
  ajustado: "bg-ink/[0.05] text-ink/65 border-ink/15"
};
