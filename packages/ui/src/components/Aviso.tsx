import type { ReactNode } from "react";

export interface AvisoProps {
  tono?: "info" | "atencion" | "peligro";
  children: ReactNode;
}

const ESTILOS = {
  info: "border-route/30 bg-route-soft text-route-dark",
  atencion: "border-warn/35 bg-warn-soft text-warn",
  peligro: "border-danger/30 bg-danger-soft text-danger"
} as const;

/** Mensaje semántico reutilizable para decisiones, errores y estados operativos. */
export function Aviso({ tono = "info", children }: AvisoProps) {
  return (
    <div
      role={tono === "peligro" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 font-body text-sm leading-5 shadow-1 ${ESTILOS[tono]}`}
    >
      {children}
    </div>
  );
}
