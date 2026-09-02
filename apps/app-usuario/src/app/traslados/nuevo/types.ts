import type { Database, TipoVehiculo } from "@ruum/shared/types";

export type TransmisionVehiculo = "manual" | "automatica" | "electrica";
export type ModalidadProgramacion = "lo_antes_posible" | "programado";
export type TipoRutaTraslado = "local" | "foraneo";
export type TipoServicioTraslado = "personal" | "empresarial" | "agencia" | "lote" | "flotilla";
export type MotivoServicioTraslado = "entrega_cliente" | "recuperacion" | "traslado_especial";
export type CondicionVehiculo = Database["public"]["Enums"]["condicion_vehiculo"];
export type VehiculoGuardado = Database["public"]["Tables"]["vehiculos"]["Row"];

export type TipoParadaForm = "escala" | "tarea";
export type TipoTareaForm = "entrega_parcial" | "recoleccion" | "tramite" | "inspeccion" | "carga_descarga" | "otro";

export interface ParadaForm {
  id: string; // uuid local para key
  tipo: TipoParadaForm;
  // domicilio
  calle: string; numero: string; colonia: string; codigoPostal: string; estado: string; ciudad: string; referencias: string;
  lat?: number; lng?: number;
  // solo tarea
  tipoTarea?: TipoTareaForm;
  contactoNombre?: string; contactoTelefono?: string; // 10 dígitos local
  instrucciones?: string;
  requiereEvidencia?: boolean;
  tiempoEsperaMin?: string; // string para input
}

export interface DatosFormulario {
  tipo: TipoVehiculo; transmision: TransmisionVehiculo; marca: string; modelo: string; anio: string; color: string;
  placas: string; vin: string; condicion: CondicionVehiculo | ""; estadoGeneral: string; tieneTarjeta: boolean; tieneVerificacion: boolean; tienePlacas: boolean; puedeCircular: boolean;
  origenCodigoPostal: string; origenEstado: string; origenCiudad: string; origenColonia: string; origenCalle: string; origenNumero: string; origenReferencias: string; origenLat?: number; origenLng?: number;
  destinoCodigoPostal: string; destinoEstado: string; destinoCiudad: string; destinoColonia: string; destinoCalle: string; destinoNumero: string; destinoReferencias: string;
  entregaNombre: string; entregaApellido: string; entregaTelefono: string; recepcionNombre: string; recepcionApellido: string; recepcionTelefono: string; instruccionesEspeciales: string;
  modalidadProgramacion: ModalidadProgramacion; fechaHoraProgramada: string; tipoRuta: TipoRutaTraslado; ventanaRecoleccion: string; ventanaEntrega: string;
  tipoServicio: TipoServicioTraslado; motivoServicio: MotivoServicioTraslado;
  paradas: ParadaForm[];
}

export type ErroresFormulario = Partial<Record<keyof DatosFormulario, string>> & {
  paradas?: Array<Partial<Record<keyof ParadaForm, string>>>;
};
