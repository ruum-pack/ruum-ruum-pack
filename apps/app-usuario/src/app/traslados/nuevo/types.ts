import type { Database, TipoVehiculo } from "@ruum/shared/types";

export type TransmisionVehiculo = "manual" | "automatica" | "electrica";
export type ModalidadProgramacion = "lo_antes_posible" | "programado";
export type TipoRutaTraslado = "local" | "foraneo";
export type TipoServicioTraslado = "personal" | "empresarial" | "agencia" | "lote" | "flotilla";
export type MotivoServicioTraslado = "entrega_cliente" | "recuperacion" | "traslado_especial";
export type VehiculoGuardado = Database["public"]["Tables"]["vehiculos"]["Row"];

export interface DatosFormulario {
  tipo: TipoVehiculo; transmision: TransmisionVehiculo; marca: string; modelo: string; anio: string; color: string;
  placas: string; vin: string; estadoGeneral: string; tieneTarjeta: boolean; tieneVerificacion: boolean; tienePlacas: boolean; puedeCircular: boolean;
  origenCodigoPostal: string; origenEstado: string; origenCiudad: string; origenColonia: string; origenCalle: string; origenNumero: string; origenReferencias: string; origenLat?: number; origenLng?: number;
  destinoCodigoPostal: string; destinoEstado: string; destinoCiudad: string; destinoColonia: string; destinoCalle: string; destinoNumero: string; destinoReferencias: string;
  entregaNombre: string; entregaApellido: string; entregaTelefono: string; recepcionNombre: string; recepcionApellido: string; recepcionTelefono: string; instruccionesEspeciales: string;
  modalidadProgramacion: ModalidadProgramacion; fechaHoraProgramada: string; tipoRuta: TipoRutaTraslado; ventanaRecoleccion: string; ventanaEntrega: string;
  tipoServicio: TipoServicioTraslado; motivoServicio: MotivoServicioTraslado; precioEstimado: string;
}

export type ErroresFormulario = Partial<Record<keyof DatosFormulario, string>>;
