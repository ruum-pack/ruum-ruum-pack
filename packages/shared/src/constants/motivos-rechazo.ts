export const MOTIVOS_RECHAZO = [
  "Horario incompatible",
  "Ruta fuera de zona",
  "Vehículo no compatible con mi certificación",
  "No puedo llegar a tiempo al origen",
  "Condiciones operativas insuficientes",
  "Otro motivo operativo"
] as const;

export type MotivoRechazo = (typeof MOTIVOS_RECHAZO)[number];
