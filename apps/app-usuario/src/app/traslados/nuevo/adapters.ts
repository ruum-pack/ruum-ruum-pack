import type { DatosNuevoTraslado, DatosVehiculoParaTraslado, DatosParadaParaTraslado } from "@ruum/api/services";
import type { DatosFormulario } from "./types";

export interface CoordenadasTraslado {
  origenLat?: number;
  origenLng?: number;
  destinoLat?: number;
  destinoLng?: number;
  distanciaKm?: number;
  tiempoEstimadoHoras?: number;
}
const nombre = (n: string, a: string) => [n.trim(), a.trim()].filter(Boolean).join(" ");
const telefono = (v: string) => `+52${v.replace(/\D/g, "").slice(0, 10)}`;
const direccion = (calle: string, numero: string, colonia: string, cp: string, estado: string) => [calle, numero, colonia, cp, estado].map((v) => v.trim()).filter(Boolean).join(", ");

export interface CoordenadasParada {
  lat?: number; lng?: number;
}

export function construirPayloadCreacion(datos: DatosFormulario, vehiculoSeleccionadoId: string, coords: CoordenadasTraslado & { paradasCoords?: CoordenadasParada[] }): {
  vehiculo: DatosVehiculoParaTraslado; traslado: DatosNuevoTraslado; paradas: DatosParadaParaTraslado[];
} {
  const vehiculo: DatosVehiculoParaTraslado = vehiculoSeleccionadoId ? { vehiculoId: vehiculoSeleccionadoId } : { vehiculo: {
    tipo: datos.tipo, transmision: datos.transmision, marca: datos.marca, modelo: datos.modelo, anio: Number(datos.anio), color: datos.color,
    placas: datos.placas, vin: datos.vin, condicion: datos.condicion || "seminueva", estado_general_declarado: datos.estadoGeneral, tiene_tarjeta_circulacion: datos.tieneTarjeta,
    tiene_verificacion: datos.tieneVerificacion, tiene_placas: datos.tienePlacas, puede_circular_rodando: datos.puedeCircular
  }};
  const paradas: DatosParadaParaTraslado[] = (datos.paradas ?? []).slice(0, 8).map((p, idx) => ({
    tipo: p.tipo,
    calle: p.calle, numero: p.numero, colonia: p.colonia, codigo_postal: p.codigoPostal, estado: p.estado, ciudad: p.ciudad,
    direccion: direccion(p.calle, p.numero, p.colonia, p.codigoPostal, p.estado),
    referencias: p.referencias || null,
    lat: coords.paradasCoords?.[idx]?.lat ?? p.lat ?? null,
    lng: coords.paradasCoords?.[idx]?.lng ?? p.lng ?? null,
    tipo_tarea: p.tipo === "tarea" ? (p.tipoTarea ?? "otro") : null,
    contacto_nombre: p.tipo === "tarea" ? (p.contactoNombre?.trim() || null) : null,
    contacto_telefono: p.tipo === "tarea" ? telefono(p.contactoTelefono ?? "") : null,
    instrucciones: p.tipo === "tarea" ? (p.instrucciones || null) : null,
    requiere_evidencia: p.tipo === "tarea" ? Boolean(p.requiereEvidencia) : false,
    tiempo_espera_min: p.tiempoEsperaMin ? Number(p.tiempoEsperaMin) : null
  }));
  return { vehiculo, traslado: {
    contacto_entrega_nombre: nombre(datos.entregaNombre, datos.entregaApellido), contacto_entrega_telefono: telefono(datos.entregaTelefono),
    contacto_recepcion_nombre: nombre(datos.recepcionNombre, datos.recepcionApellido), contacto_recepcion_telefono: telefono(datos.recepcionTelefono),
    origen_lat: coords.origenLat ?? null, origen_lng: coords.origenLng ?? null,
    origen_direccion: direccion(datos.origenCalle, datos.origenNumero, datos.origenColonia, datos.origenCodigoPostal, datos.origenEstado), origen_ciudad: datos.origenCiudad,
    origen_referencias: datos.origenReferencias || null, destino_lat: coords.destinoLat ?? null, destino_lng: coords.destinoLng ?? null,
    destino_direccion: direccion(datos.destinoCalle, datos.destinoNumero, datos.destinoColonia, datos.destinoCodigoPostal, datos.destinoEstado), destino_ciudad: datos.destinoCiudad,
    destino_referencias: datos.destinoReferencias || null, instrucciones_especiales: datos.instruccionesEspeciales,
    modalidad_programacion: datos.modalidadProgramacion, fecha_hora_programada: datos.fechaHoraProgramada ? new Date(datos.fechaHoraProgramada).toISOString() : null,
    tipo_ruta: datos.tipoRuta, ventana_recoleccion: datos.ventanaRecoleccion, ventana_entrega: datos.ventanaEntrega,
    tipo_servicio: datos.tipoServicio, motivo_servicio: datos.motivoServicio,
    distancia_km: coords.distanciaKm ?? null, tiempo_estimado_horas: coords.tiempoEstimadoHoras ?? null
  }, paradas };
}
