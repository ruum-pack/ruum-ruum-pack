// PRD §4.12 — comunicación usuario-conductor, siempre dentro de la app o enmascarada
export interface MensajeChat {
  id: string;
  traslado_id: string;
  remitente: "usuario" | "conductor";
  contenido: string;
  enviado_en: string;
  // Chat disponible desde asignación de conductor hasta 24h después del cierre
  reportado?: boolean; // mensajes ofensivos/spam pueden ser reportados a Admin
}

export interface LlamadaEnmascarada {
  id: string;
  traslado_id: string;
  iniciada_por: "usuario" | "conductor";
  numero_virtual: string;
  duracion_segundos?: number;
  iniciada_en: string;
  finalizada_en?: string;
}
