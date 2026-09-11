// ─── FASE 5-6 · Facade temporal: services/admin.ts (5.12) ───
// Este fichero ya no contiene lógica: re-exporta los módulos de dominio de
// packages/api/src (operations, transfers, drivers, organizations, vehicles,
// identity, custody, incidents, claims, billing). Mantiene compatibilidad con
// consumidores de `@ruum/api/services` y se eliminará al final (5.15).
// No añadir código nuevo aquí: va en su módulo.
export type { EstadoDocumentoConductor } from "@ruum/shared/types";

/** @deprecated Importar desde `@ruum/api/transfers` en su lugar. */
export type {
  PaginacionViajes,
  FilaTrasladoMasivoNormalizada,
  ResultadoCargaTrasladosMasivos,
  EstadoCargaTrasladosMasivos,
  EstadoFilaCargaTrasladosMasivos,
  CargaTrasladosMasivosAdmin,
  FilaCargaTrasladosMasivosAdmin,
  DatosTrasladosMasivosAdmin,
  TrazabilidadMasivaTraslado
} from "../transfers/index";
/** @deprecated Importar desde `@ruum/api/transfers` en su lugar. */
export {
  listarViajesAdmin,
  listarViajesAdminPaginados,
  listarCargasTrasladosMasivosAdmin,
  obtenerTrazabilidadMasivaTraslado,
  crearTrasladosMasivosAdmin,
  procesarCargaTrasladosMasivosAdmin,
  cancelarCargaTrasladosMasivosAdmin,
  obtenerNotasInternas,
  agregarNotaInterna,
  asignarConductorAdmin,
  ESTADOS_CRITICOS_TRASLADO,
  cambiarEstatusAdmin,
  marcarTrasladoFallido
} from "../transfers/index";

/** @deprecated Importar desde `@ruum/api/drivers` en su lugar. */
export type {
  SolicitudConductorBandejaAdmin,
  DocumentoConductorResumenAdmin,
  HistorialSolicitudConRevisor,
  NotaInternaSolicitudConAdmin,
  DetalleSolicitudConductorAdmin,
  ConductorActualizableAdmin,
  ConductorCrearAdmin,
  PaginacionConductores,
  PaginacionSolicitudesConductorAdmin,
  MetricasRegistroConductor
} from "../drivers/index";
/** @deprecated Importar desde `@ruum/api/drivers` en su lugar. */
export {
  listarConductoresAdmin,
  validarDocumentoConductor,
  obtenerDetalleConductorAdmin,
  obtenerConductorAdmin,
  actualizarConductorAdmin,
  suspenderConductorAdmin,
  reactivarConductorAdmin,
  darBajaConductorAdmin,
  crearConductorAdmin,
  listarConductoresAdminPaginados,
  validarCurpUnica,
  validarLicenciaUnica,
  validarFormatoCurp,
  validarFormatoLicencia,
  verificarDocumentoIdentidadVigente,
  obtenerDocumentosConductorAdmin,
  obtenerUrlDocumentoConductor,
  obtenerVehiculosDeConductorAdmin,
  obtenerEmpresaDeConductorAdmin,
  obtenerHistorialEstatusConductorAdmin,
  registrarCambioEstatusConductor,
  obtenerAlertasVencimientoConductores,
  verificarVigenciasDocumentosConductor,
  listarSolicitudesConductorAdmin,
  listarSolicitudesConductorAdminPaginadas,
  obtenerDetalleSolicitudConductorAdmin,
  crearNotaInternaSolicitudConductorAdmin,
  revisarDocumentoConductorAdmin,
  aprobarSolicitudConductorAdmin,
  rechazarSolicitudConductorAdmin,
  activarConductorAdmin,
  cambiarEstadoConductorAdmin,
  registrarNoPresentacionConductor,
  registrarCancelacionConductor,
  obtenerMetricasRegistroConductor
} from "../drivers/index";

/** @deprecated Importar desde `@ruum/api/organizations` en su lugar. */
export type {
  DatosEmpresasAdmin,
  AltaEmpresaCorporativa,
  ResultadoAltaEmpresaCorporativa,
  ActualizacionEmpresaCorporativa,
  UsuarioEmpresaAdmin,
  DocumentoEmpresaAdmin
} from "../organizations/index";
/** @deprecated Importar desde `@ruum/api/organizations` en su lugar. */
export {
  listarEmpresasAdmin,
  crearEmpresaCorporativaAdmin,
  validarDocumentoEmpresa,
  actualizarEmpresaCorporativaAdmin,
  cambiarEstadoEmpresaAdmin,
  guardarUsuarioEmpresaAdmin,
  guardarDocumentoEmpresaAdmin,
  resolverCambioEmpresaAdmin
} from "../organizations/index";

/** @deprecated Importar desde `@ruum/api/vehicles` en su lugar. */
export type {
  DatosVehiculosAdmin,
  PaginacionAdmin,
  DatosVehiculosAdminPaginados,
  VehiculoCrearAdmin,
  VehiculoActualizarAdmin,
  HistorialAsignacionVehiculo,
  ViajeVehiculoResumen
} from "../vehicles/index";
/** @deprecated Importar desde `@ruum/api/vehicles` en su lugar. */
export {
  obtenerVehiculoAdmin,
  validarVinYPlacasUnicos,
  validarFormatoVin,
  validarFormatoPlacas,
  crearVehiculoAdmin,
  validarDominioVehiculoAdmin,
  actualizarVehiculoAdmin,
  obtenerDocumentosVehiculoAdmin,
  subirDocumentoVehiculoAdmin,
  eliminarDocumentoVehiculoAdmin,
  asociarConductorVehiculoAdmin,
  asociarEmpresaVehiculoAdmin,
  suspenderVehiculoAdmin,
  reactivarVehiculoAdmin,
  obtenerHistorialVehiculoAdmin,
  obtenerViajesDeVehiculoAdmin,
  listarVehiculosAdmin,
  listarVehiculosAdminPaginados
} from "../vehicles/index";

/** @deprecated Importar desde `@ruum/api/identity` en su lugar. */
export type {
  UsuarioActualizableAdmin,
  PaginacionUsuarios
} from "../identity/index";
/** @deprecated Importar desde `@ruum/api/identity` en su lugar. */
export {
  obtenerUsuarioAdmin,
  actualizarUsuarioAdmin,
  suspenderUsuarioAdmin,
  reactivarUsuarioAdmin,
  cerrarCuentaUsuarioAdmin,
  listarSesionesUsuario,
  revocarSesionUsuario,
  listarPagosDeUsuario,
  listarIncidenciasDeUsuario,
  listarEmpresasDeUsuario,
  obtenerAuditoriaUsuario,
  listarUsuariosAdminPaginados,
  invitarUsuarioAdmin,
  validarDocumentoUsuario,
  listarUsuariosAdmin,
  obtenerAdminActual
} from "../identity/index";

/** @deprecated Importar desde `@ruum/api/custody` en su lugar. */
export type {
  EvidenciaVehiculoTraslado
} from "../custody/index";
/** @deprecated Importar desde `@ruum/api/custody` en su lugar. */
export {
  obtenerEvidenciaVehiculo,
  exportarEvidenciaFirmada
} from "../custody/index";

/** @deprecated Importar desde `@ruum/api/incidents` en su lugar. */
export {
  listarIncidenciasAdmin
} from "../incidents/index";

/** @deprecated Importar desde `@ruum/api/claims` en su lugar. */
export {
  listarDisputasAdmin,
  resolverDisputaAdmin,
  listarReclamosSeguroAdmin,
  actualizarReclamoSeguroAdmin
} from "../claims/index";

/** @deprecated Importar desde `@ruum/api/billing` en su lugar. */
export type {
  DatosPagosAdmin,
  FinanzasTrasladoAdmin
} from "../billing/index";
/** @deprecated Importar desde `@ruum/api/billing` en su lugar. */
export {
  listarPagosAdmin,
  obtenerFinanzasTrasladoAdmin,
  ajustarPrecioFinalAdmin,
  emitirCotizacionAdmin,
  aplicarTarifaNormativaAdmin
} from "../billing/index";

/** @deprecated Importar desde `@ruum/api/operations` en su lugar (5.13). */
export type {
  AlertaSLA,
  AuditoriaOperacionMasivaAdmin,
  CategoriaExcepcionCritica,
  ClaveIndicadorDashboard,
  ExcepcionCriticaAdmin,
  IndicadorAccionableDashboard,
  MetricasDashboard,
  ResultadoAccionMasiva,
  ResultadoAccionMasivaGlobal,
  SeveridadExcepcionCritica,
  TipoSLA,
  TrasladoMapa
} from "../operations/index";
/** @deprecated Importar desde `@ruum/api/operations` en su lugar (5.13). */
export {
  actualizarAlertaSlaAdmin,
  ejecutarAccionMasiva,
  listarAlertasSLA,
  listarAuditoriaOperativaTraslados,
  listarExcepcionesCriticasAdmin,
  listarTrasladosActivosMapa,
  obtenerIndicadoresAccionablesDashboard,
  obtenerMetricasDashboard
} from "../operations/index";
