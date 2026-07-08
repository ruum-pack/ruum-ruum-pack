// Forma común para evaluar cualquier SLA del PRD (§4.1, §4.13, §4.14, §15)
export interface ResultadoSLA {
  dentro_de_sla: boolean;
  horas_transcurridas: number;
  horas_limite: number;
  porcentaje_consumido: number; // PRD §4.1 — Admin recibe alerta al superar 80% del SLA
  requiere_alerta: boolean;
}
