import { ESTILO_ESTATUS, ETIQUETA_ESTATUS_ECONOMICO, type EstatusEconomico } from "@ruum/shared/constants";

export interface EstatusBadgeEconomicoProps {
  estatus: EstatusEconomico;
  className?: string;
}

export function EstatusBadgeEconomico({ estatus, className = "" }: EstatusBadgeEconomicoProps) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-center font-body text-xs font-semibold",
        ESTILO_ESTATUS[estatus],
        className
      ].join(" ")}
    >
      {ETIQUETA_ESTATUS_ECONOMICO[estatus]}
    </span>
  );
}
