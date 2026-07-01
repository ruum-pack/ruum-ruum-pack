import type { Traslado } from "./traslado";
import type { Conductor } from "./conductor";
import type { Vehiculo } from "./vehiculo";
import type { FotoEvidencia } from "./evidencia";
import type { Incidencia } from "./incidencia";
import type { Pago } from "./pago";
import type { MensajeChat, LlamadaEnmascarada } from "./comunicacion";
import type { CalificacionTraslado } from "./conductor";
import type { RegistroAuditoria } from "./auditoria";

// PRD §5.1 — Pasaporte Digital de Traslado: expediente vivo durante el viaje
// y expediente cerrado al finalizar. Visible para Usuario y Admin.
export interface PasaporteDigital {
  traslado: Traslado;
  vehiculo: Vehiculo;
  conductor?: Conductor;
  evidencia_inicial: FotoEvidencia[];
  evidencia_final: FotoEvidencia[];
  incidencias: Incidencia[];
  pagos: Pago[];
  mensajes: MensajeChat[];
  llamadas: LlamadaEnmascarada[];
  calificacion?: CalificacionTraslado;
  bitacora: RegistroAuditoria[];
  // PRD §4.4 — un Pasaporte puede cerrarse operativamente con incidencia
  // abierta; el usuario debe ver claramente este estatus, no un cierre total.
  cerrado_con_incidencia_abierta: boolean;
}
