import type { ReactNode } from "react";

export interface AvisoProps {
  tono?: "info" | "atencion" | "peligro";
  children: ReactNode;
}

const ESTILOS = {
  info: "border-route/30 bg-route-soft text-route",
  atencion: "border-warn/60 bg-warn-soft text-warn",
  peligro: "border-danger/50 bg-danger-soft text-danger"
} as const;

/**
 * Usado para los mensajes que el PRD marca como obligatorios antes de una
 * acción (ej. §4.7: aviso de cargo por cancelación; §4.15: evidencia
 * sincronizando). El tono nunca es decorativo: refleja la categoría real
 * del aviso.
 */
export function Aviso({ tono = "info", children }: AvisoProps) {
  return (
    <div role={tono === "peligro" ? "alert" : "status"} className={`rounded-lg border px-3.5 py-3 font-body text-sm ${ESTILOS[tono]}`}>
      {children}
    </div>
  );
}
