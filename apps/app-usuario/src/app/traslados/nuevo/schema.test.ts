import { describe, expect, it } from "vitest";
import { esquemaSolicitudTraslado } from "./schema";

const valido = {
  vehiculoSeleccionadoId: "", vehiculosUsuarioIds: [], marca: "Nissan", modelo: "Versa", color: "gris", placas: "ABC123", vin: "VIN123", anio: "2022", transmision: "automatica",
  estadoGeneral: "Buen estado, desgaste normal", tieneTarjeta: true, tieneVerificacion: true, tienePlacas: true, puedeCircular: true,
  origenCodigoPostal: "03100", origenEstado: "CDMX", origenCiudad: "CDMX", origenColonia: "Del Valle", origenCalle: "A", origenNumero: "1",
  destinoCodigoPostal: "06600", destinoEstado: "CDMX", destinoCiudad: "CDMX", destinoColonia: "Juárez", destinoCalle: "B", destinoNumero: "2",
  entregaNombre: "Ana", entregaApellido: "López", entregaTelefono: "5512345678", recepcionNombre: "Luis", recepcionApellido: "Pérez", recepcionTelefono: "5587654321",
  modalidadProgramacion: "lo_antes_posible", fechaHoraProgramada: "", zonaHoraria: "America/Mexico_City", tipoRuta: "local", tipoServicio: "personal", motivoServicio: "entrega_cliente", aceptaPoliticas: true
};

describe("esquemaSolicitudTraslado", () => {
  it("acepta una solicitud completa", () => expect(esquemaSolicitudTraslado.safeParse(valido).success).toBe(true));
  it("rechaza origen y destino iguales", () => expect(esquemaSolicitudTraslado.safeParse({ ...valido, destinoCodigoPostal: "03100", destinoColonia: "Del Valle", destinoCalle: "A", destinoNumero: "1" }).success).toBe(false));
  it("rechaza vehículos no conducibles", () => expect(esquemaSolicitudTraslado.safeParse({ ...valido, puedeCircular: false }).success).toBe(false));
  it("exige dos horas de anticipación", () => expect(esquemaSolicitudTraslado.safeParse({ ...valido, modalidadProgramacion: "programado", fechaHoraProgramada: new Date(Date.now() + 3600000).toISOString() }).success).toBe(false));
});
