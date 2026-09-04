/**
 * Esquema de validación para la creación de traslados.
 * GAP 3: Centralizado en @ruum/shared/validacion para asegurar una fuente única de verdad
 * sincronizada entre cliente, API y base de datos.
 */
export {
  ANTICIPACION_MINIMA_HORAS,
  ANIO_MINIMO_VEHICULO,
  MAX_PARADAS_TRASLADO,
  REGEX_CODIGO_POSTAL,
  REGEX_TELEFONO_10_DIGITOS,
  obtenerAnioMaximoVehiculo,
  esquemaParada,
  esquemaSolicitudTraslado,
  erroresFormulario
} from "@ruum/shared/validacion";
export type { ParadaValidada, SolicitudTrasladoValidada } from "@ruum/shared/validacion";
