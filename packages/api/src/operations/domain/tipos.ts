import type { Database } from "@ruum/shared/types";

/**
 * FASE 5 — Dominio operations (Torre de Control): tipos del tablero, mapa,
 * excepciones, SLA y acciones masivas. Movidos sin cambios desde
 * services/admin.ts (5.3, primera extracción).
 */
export type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export interface MetricasDashboard {
  viajesActivos: number;
  pendientesAsignacion: number;
  cerradosHoy: number;
  conductoresActivos: number;
  incidenciasAbiertas: number;
}

export type ClaveIndicadorDashboard =
  | "traslados_activos"
  | "inician_60_min"
  | "sin_asignacion"
  | "riesgo_sla"
  | "con_incidencia"
  | "finalizados_hoy";

export interface IndicadorAccionableDashboard {
  clave: ClaveIndicadorDashboard;
  titulo: string;
  valor: number;
  ventanaTemporal: string;
  variacion: number;
  umbral: string;
  subgrupoCritico: string;
  href: string;
  severidad: "normal" | "atencion" | "critico";
  actualizadoEn: string;
}

export interface AuditoriaOperacionMasivaAdmin {
  id: string;
  accion: string;
  afectados: number;
  exitosos: number;
  omitidos: number;
  bloqueados: number;
  timestamp: string;
  detalle: string;
  folios: string[];
}

export interface ResultadoAccionMasiva {
  traslado_id: string;
  estado: "aplicado" | "omitido" | "bloqueado";
  detalle: string;
}

export interface ResultadoAccionMasivaGlobal {
  trace_id: string;
  accion: string;
  total: number;
  aplicados: number;
  omitidos: number;
  bloqueados: number;
  resultados: ResultadoAccionMasiva[];
}

export interface TrasladoMapa {
  traslado_id: string;
  estado: EstadoTraslado;
  conductor_nombre: string | null;
  vehiculo_marca: string | null;
  vehiculo_modelo: string | null;
  tiene_incidencia_abierta: boolean;
  origen_lat: number | null;
  origen_lng: number | null;
  origen_ciudad: string;
  destino_lat: number | null;
  destino_lng: number | null;
  destino_ciudad: string;
  conductor_lat: number | null;
  conductor_lng: number | null;
  gps_actualizado_en: string | null;
  gps_recibido_en: string | null;
  gps_precision_m: number | null;
  gps_fuente: string | null;
  gps_online: boolean | null;
  coordenadas_sensibles_protegidas: boolean;
  actualizado_en: string;
}

export type CategoriaExcepcionCritica =
  | "emergencia"
  | "sla_vencido"
  | "sla_en_riesgo"
  | "traslado_sin_conductor"
  | "conductor_sin_senal"
  | "desviacion_ruta"
  | "incidencia_sin_responsable"
  | "documentacion_bloqueante";

export type SeveridadExcepcionCritica = "critica" | "alta" | "media";

export interface ExcepcionCriticaAdmin {
  id: string;
  categoria: CategoriaExcepcionCritica;
  severidad: SeveridadExcepcionCritica;
  estado: "abierta" | "acusada" | "escalada" | "resuelta" | "cerrada";
  prioridad: number;
  folioOEntidad: string;
  descripcion: string;
  creadoEn: string;
  actualizadoEn: string;
  venceEn: string | null;
  responsable: string | null;
  slaRestanteHoras: number | null;
  porcentajeConsumido: number | null;
  notificacionEstado: string | null;
  metadata?: Record<string, unknown>;
  accionPrincipal: {
    etiqueta: string;
    href: string;
  };
  accionEscalamiento: {
    etiqueta: string;
    href: string;
  };
}

export type TipoSLA =
  | "cuenta_nueva_usuario"
  | "documentos_usuario"
  | "conductor_primera_vez"
  | "documentos_conductor";

export interface AlertaSLA {
  id: string;
  tipo: TipoSLA;
  nombre: string;
  creado_en: string;
  horas_transcurridas: number;
  horas_limite: number;
  porcentaje_consumido: number;
  requiere_alerta: boolean;     // ≥80% del SLA
  vencido: boolean;             // >100% del SLA
}
