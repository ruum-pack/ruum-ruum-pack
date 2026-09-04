import type { TipoVehiculo, Usuario } from "@ruum/shared/types";
import { CAMPOS_PASO_TARIFA } from "./tarifa-gate";
import type { CondicionVehiculo, DatosFormulario } from "./types";

export const PASOS = [
  "Conoce tu tarifa",
  "¿Qué vehículo trasladamos?",
  "¿Dónde lo recogemos y llevamos?",
  "Detalles del servicio",
  "Pago"
] as const;

export const CAMPOS_PASO_VEHICULO_ESENCIAL = new Set(["marca", "modelo", "anio", "condicion", "transmision"]);
export const CAMPOS_PASO_VEHICULO_DETALLE = new Set(["vehiculoSeleccionadoId", "color", "placas", "vin", "estadoGeneral", "tieneTarjeta", "tieneVerificacion", "tienePlacas", "puedeCircular"]);
export const CAMPOS_PASO_VEHICULO = new Set([...CAMPOS_PASO_VEHICULO_ESENCIAL, ...CAMPOS_PASO_VEHICULO_DETALLE]);
export const CAMPOS_PASO_RUTA = new Set([
  "origenCodigoPostal", "origenEstado", "origenCiudad", "origenColonia", "origenCalle", "origenNumero",
  "destinoCodigoPostal", "destinoEstado", "destinoCiudad", "destinoColonia", "destinoCalle", "destinoNumero",
  "entregaNombre", "entregaApellido", "entregaTelefono", "recepcionNombre", "recepcionApellido", "recepcionTelefono",
  "paradas"
]);
export const CAMPOS_RUTA_ORIGEN = new Set([
  "origenCodigoPostal", "origenEstado", "origenCiudad", "origenColonia", "origenCalle", "origenNumero"
]);
export const CAMPOS_RUTA_DESTINO_CONTACTOS = new Set([
  "destinoCodigoPostal", "destinoEstado", "destinoCiudad", "destinoColonia", "destinoCalle", "destinoNumero",
  "entregaNombre", "entregaApellido", "entregaTelefono", "recepcionNombre", "recepcionApellido", "recepcionTelefono"
]);

export function pasoDeCampo(campo: string): number {
  if (CAMPOS_PASO_TARIFA.has(campo as keyof DatosFormulario)) return 0;
  if (CAMPOS_PASO_VEHICULO.has(campo)) return 1;
  if (CAMPOS_PASO_RUTA.has(campo) || campo === "paradas") return 2;
  return 3;
}

export function esCampoEsencialVehiculo(campo: string): boolean {
  return CAMPOS_PASO_VEHICULO_ESENCIAL.has(campo);
}

export const ESTADOS_GENERALES_VEHICULO = [
  "Excelente, sin daños visibles",
  "Buen estado, desgaste normal",
  "Detalles estéticos menores",
  "Rayones o golpes visibles"
] as const;

export const SLOTS_HORARIOS = [
  { id: "manana", etiqueta: "Mañana · 09:00–13:00", hora: "09:00" },
  { id: "tarde", etiqueta: "Tarde · 13:00–18:00", hora: "14:00" },
  { id: "noche", etiqueta: "Noche · 18:00–21:00", hora: "18:30" },
  { id: "personalizado", etiqueta: "Elegir hora exacta", hora: "" },
] as const;

export const VENTANAS_PREDEFINIDAS = [
  "Flexible (sin preferencia)",
  "Mañana 09:00–13:00",
  "Tarde 13:00–18:00",
  "Noche 18:00–21:00",
  "Otra (especificar)",
] as const;

export const CONDICIONES_VEHICULO: Array<{ valor: CondicionVehiculo; etiqueta: string }> = [
  { valor: "nueva", etiqueta: "Nueva" },
  { valor: "seminueva", etiqueta: "Seminueva" },
  { valor: "rescate_mecanico", etiqueta: "Rescate mecánico" }
];

export const VALORES_INICIALES: DatosFormulario = {
  tipo: "sedan",
  transmision: "automatica",
  marca: "",
  modelo: "",
  anio: "",
  color: "",
  placas: "",
  vin: "",
  condicion: "",
  estadoGeneral: "",
  tieneTarjeta: false,
  tieneVerificacion: false,
  tienePlacas: false,
  puedeCircular: false,
  origenCodigoPostal: "",
  origenEstado: "",
  origenCiudad: "",
  origenColonia: "",
  origenCalle: "",
  origenNumero: "",
  origenReferencias: "",
  destinoCodigoPostal: "",
  destinoEstado: "",
  destinoCiudad: "",
  destinoColonia: "",
  destinoCalle: "",
  destinoNumero: "",
  destinoReferencias: "",
  entregaNombre: "",
  entregaApellido: "",
  entregaTelefono: "",
  recepcionNombre: "",
  recepcionApellido: "",
  recepcionTelefono: "",
  instruccionesEspeciales: "",
  modalidadProgramacion: "lo_antes_posible",
  fechaHoraProgramada: "",
  tipoRuta: "local",
  ventanaRecoleccion: "",
  ventanaEntrega: "",
  tipoServicio: "personal",
  motivoServicio: "entrega_cliente",
  paradas: []
};

// Usuario sin historial (PRD §4.6): valor temporal mientras se confirma
// la sesión real. Nunca se usa para insertar registros.
export const USUARIO_PENDIENTE: Usuario = {
  id: "",
  tipo_cuenta: "personal",
  rol: "personal",
  estado_verificacion: "pendiente",
  traslados_completados_sin_incidencia: 0,
  metodo_pago_registrado: false,
  creado_en: new Date().toISOString()
};

export type PrefijoDomicilio = "origen" | "destino";
export type SubpasoRuta = "origen" | "destino_contactos";

export const RETRASO_GUARDADO_BORRADOR_MS = 600;
export const RETRASO_CONSULTA_CODIGO_POSTAL_MS = 350;

export function soloDigitos(valor: string, maximo?: number) {
  const limpio = valor.replace(/\D/g, "");
  return maximo ? limpio.slice(0, maximo) : limpio;
}

export function telefonoLocalMx(valor: string) {
  const limpio = soloDigitos(valor);
  const sinCodigoPais = limpio.length > 10 && limpio.startsWith("52") ? limpio.slice(2) : limpio;
  return sinCodigoPais.slice(0, 10);
}

export function telefonoMx(diezDigitos: string) {
  const telefono = soloDigitos(diezDigitos, 10);
  return telefono ? `+52${telefono}` : "";
}

export function nombreCompleto(nombre: string, apellido: string) {
  return [nombre.trim(), apellido.trim()].filter(Boolean).join(" ");
}

export const PATRON_MENSAJE_DE_NEGOCIO = /vehículo|precio cotizado|usuario autenticado|sesión/i;

export function mensajeAmigableErrorCreacion(err: unknown): string {
  if (err instanceof Error) {
    if (/No hay tarifa configurada/i.test(err.message)) {
      return "No pudimos calcular la tarifa automática porque falta una regla tarifaria. Nuestro equipo completará la tarifa para esta ruta y te avisará en minutos.";
    }
    if (PATRON_MENSAJE_DE_NEGOCIO.test(err.message)) return err.message;
    console.error("[traslados/nuevo] Error inesperado al crear la solicitud:", err);
    return "No pudimos crear la solicitud por un problema técnico. Intenta de nuevo en unos segundos; si sigue fallando, contáctanos por soporte.";
  }
  console.error("[traslados/nuevo] Error inesperado (no-Error) al crear la solicitud:", err);
  return "No pudimos crear la solicitud. Intenta de nuevo.";
}

export function domicilioCompleto({
  calle,
  numero,
  colonia,
  codigoPostal,
  ciudad,
  estado
}: {
  calle: string;
  numero: string;
  colonia: string;
  codigoPostal: string;
  ciudad: string;
  estado: string;
}) {
  return [
    [calle.trim(), numero.trim()].filter(Boolean).join(" "),
    colonia.trim() ? `Col. ${colonia.trim()}` : "",
    codigoPostal.trim() ? `CP ${codigoPostal.trim()}` : "",
    ciudad.trim(),
    estado.trim()
  ]
    .filter(Boolean)
    .join(", ");
}

export function referenciasDomicilio(referencias: string, estado: string, codigoPostal: string) {
  return [
    referencias.trim(),
    estado.trim() ? `Estado: ${estado.trim()}` : "",
    codigoPostal.trim() ? `CP: ${codigoPostal.trim()}` : ""
  ]
    .filter(Boolean)
    .join(" | ");
}

export function formatearDistancia(km: number) {
  return `${km.toLocaleString("es-MX", { maximumFractionDigits: 1 })} km`;
}

export function formatearTiempo(horas: number) {
  const minutosTotales = Math.round(horas * 60);
  const horasEnteras = Math.floor(minutosTotales / 60);
  const minutos = minutosTotales % 60;
  if (horasEnteras <= 0) return `${minutos} min`;
  return `${horasEnteras} h ${minutos.toString().padStart(2, "0")} min`;
}
