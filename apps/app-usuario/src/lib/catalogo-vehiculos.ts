// Compatibilidad para imports existentes. La fuente única vive en
// @ruum/shared y puede ser consumida por las tres aplicaciones.
export {
  CATALOGO_VEHICULOS,
  MARCAS_CATALOGO,
  METADATOS_CATALOGO_VEHICULOS,
  clasificacionesPorVehiculo,
  modelosPorMarca,
  resumenClasificacionVehiculo,
  tipoSugeridoParaVehiculo,
} from "@ruum/shared/catalogos";
export type { VehiculoCatalogo } from "@ruum/shared/catalogos";
