import type { ReactNode } from "react";

export interface AvisoProps {
  tono?: "info" | "atencion" | "danger";
  children: ReactNode;
}

const ESTILOS = {
  info: "border-route-action bg-route-soft text-route-action",
  atencion: "border-warning bg-warn-soft text-warning",
  danger: "border-danger-action bg-danger-soft text-danger-action"
} as const;

/** Mensaje semántico reutilizable para decisiones, errores y estados operativos. */
export function Aviso({ tono = "info", children }: AvisoProps) {
  return (
    <div
      role={tono === "danger" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 font-body text-sm leading-5 shadow-1 ${ESTILOS[tono]}`}
    >
      {children}
    </div>
  );
}
