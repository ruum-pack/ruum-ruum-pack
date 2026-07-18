import {
  ETIQUETA_ESTATUS_ECONOMICO,
  type EstadoEconomicoExplicito
} from "@ruum/shared/constants";

export type FinancialAmountStatus = EstadoEconomicoExplicito | "estimated" | "pending_confirmation";

export interface FinancialAmountProps {
  amount?: number | null;
  status: FinancialAmountStatus;
  currency?: "MXN" | string;
  className?: string;
  amountClassName?: string;
  auxiliaryText?: string;
  pendingText?: string;
}

const STATUS_ALIAS: Record<FinancialAmountStatus, EstadoEconomicoExplicito> = {
  sin_calcular: "sin_calcular",
  estimado: "estimado",
  estimated: "estimado",
  pending_confirmation: "sin_calcular",
  en_validacion: "en_validacion",
  confirmado: "confirmado",
  programado: "programado",
  pagado: "pagado",
  retenido: "retenido",
  rechazado: "rechazado"
};

const TEXTO_AUXILIAR: Partial<Record<EstadoEconomicoExplicito, string>> = {
  sin_calcular: "El importe oficial aún no está disponible.",
  estimado: "Monto estimado sujeto a validación operativa.",
  en_validacion: "Operaciones está validando el importe final.",
  programado: "Pago programado por operaciones.",
  retenido: "Importe retenido mientras se resuelve la validación.",
  rechazado: "Importe rechazado por operaciones."
};

const ESTILO_ESTATUS_FINANCIERO: Record<EstadoEconomicoExplicito, string> = {
  sin_calcular: "border-[rgba(183,194,212,0.26)] bg-[rgba(183,194,212,0.10)] text-[#B7C2D4]",
  estimado: "border-[rgba(142,197,255,0.32)] bg-[rgba(142,197,255,0.10)] text-[#8EC5FF]",
  en_validacion: "border-[rgba(245,183,73,0.36)] bg-[rgba(245,183,73,0.12)] text-warning",
  confirmado: "border-[rgba(61,220,151,0.32)] bg-[rgba(61,220,151,0.10)] text-[#65E3AD]",
  programado: "border-[rgba(142,197,255,0.32)] bg-[rgba(142,197,255,0.10)] text-[#8EC5FF]",
  pagado: "border-[rgba(61,220,151,0.32)] bg-[rgba(61,220,151,0.10)] text-[#65E3AD]",
  retenido: "border-[rgba(245,183,73,0.36)] bg-[rgba(245,183,73,0.12)] text-warning",
  rechazado: "border-[rgba(255,92,122,0.34)] bg-[rgba(255,92,122,0.12)] text-danger-action"
};

function formatearMoneda(amount: number, currency: string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

export function FinancialAmount({
  amount,
  status,
  currency = "MXN",
  className = "",
  amountClassName = "",
  auxiliaryText,
  pendingText = "Importe por confirmar"
}: FinancialAmountProps) {
  const estado = STATUS_ALIAS[status];
  const hayMonto = typeof amount === "number" && Number.isFinite(amount);
  const textoPrincipal = hayMonto ? formatearMoneda(amount, currency) : pendingText;
  const textoAuxiliar = auxiliaryText ?? TEXTO_AUXILIAR[estado];

  return (
    <div className={["grid gap-1", className].join(" ")}>
      <p className={["font-mono-ruum font-semibold tabular-nums text-[#E8EDF6]", amountClassName].join(" ")}>{textoPrincipal}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={[
            "inline-flex items-center justify-center rounded-full border px-2.5 py-1 font-body text-xs font-semibold",
            ESTILO_ESTATUS_FINANCIERO[estado]
          ].join(" ")}
        >
          {ETIQUETA_ESTATUS_ECONOMICO[estado]}
        </span>
        {textoAuxiliar && <span className="font-body text-xs leading-5 text-[#B7C2D4]">{textoAuxiliar}</span>}
      </div>
    </div>
  );
}
