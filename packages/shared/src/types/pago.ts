// PRD §4.6
export type MomentoPago = "anticipado" | "al_cierre";
export type EstadoPago = "pendiente" | "completado" | "reembolsado" | "fallido";

export interface Pago {
  id: string;
  traslado_id: string;
  monto: number;
  momento: MomentoPago;
  estado: EstadoPago;
  metodo: string;
  registrado_en: string;
}
