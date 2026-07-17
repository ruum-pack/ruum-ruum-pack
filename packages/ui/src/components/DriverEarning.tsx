import {
  ESTILO_ESTATUS,
  ETIQUETA_ESTATUS_ECONOMICO,
  type EstadoEconomicoExplicito
} from "@ruum/shared/constants";

type DriverEarningStatus = EstadoEconomicoExplicito | "estimated" | "pending_confirmation";

export interface DriverEarningProps {
  amount?: number | null;
  status: DriverEarningStatus;
  currency?: "MXN" | string;
  className?: string;
  amountClassName?: string;
  auxiliaryText?: string;
}

const STATUS_ALIAS: Record<DriverEarningStatus, EstadoEconomicoExplicito> = {
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

function formatearMoneda(amount: number, currency: string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

export function DriverEarning({
  amount,
  status,
  currency = "MXN",
  className = "",
  amountClassName = "",
  auxiliaryText
}: DriverEarningProps) {
  const estado = STATUS_ALIAS[status];
  const hayMonto = typeof amount === "number" && Number.isFinite(amount);
  const textoPrincipal = hayMonto ? formatearMoneda(amount, currency) : "Ganancia por confirmar";
  const textoAuxiliar = auxiliaryText ?? TEXTO_AUXILIAR[estado];

  return (
    <div className={["grid gap-1", className].join(" ")}>
      <p className={["font-mono-ruum font-semibold text-text-primary", amountClassName].join(" ")}>{textoPrincipal}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={[
            "inline-flex items-center justify-center rounded-full border px-2.5 py-1 font-body text-xs font-semibold",
            ESTILO_ESTATUS[estado]
          ].join(" ")}
        >
          {ETIQUETA_ESTATUS_ECONOMICO[estado]}
        </span>
        {textoAuxiliar && <span className="font-body text-xs text-text-tertiary">{textoAuxiliar}</span>}
      </div>
    </div>
  );
}
