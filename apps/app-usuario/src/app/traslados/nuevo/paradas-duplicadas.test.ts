import { describe, it, expect } from "vitest";
import { esquemaSolicitudTraslado } from "./schema";

const base = {
  vehiculoSeleccionadoId: "", vehiculosUsuarioIds: [], marca: "Nissan", modelo: "Versa", color: "gris", placas: "ABC123", vin: "VIN123", anio: "2022", transmision: "automatica" as const, condicion: "seminueva" as const,
  estadoGeneral: "Buen estado, desgaste normal" as const, tieneTarjeta: true, tieneVerificacion: true, tienePlacas: true, puedeCircular: true,
  origenCodigoPostal: "03100", origenEstado: "CDMX", origenCiudad: "CDMX", origenColonia: "Del Valle", origenCalle: "A", origenNumero: "1",
  destinoCodigoPostal: "06600", destinoEstado: "CDMX", destinoCiudad: "CDMX", destinoColonia: "Juárez", destinoCalle: "B", destinoNumero: "2",
  entregaNombre: "Ana", entregaApellido: "López", entregaTelefono: "5512345678", recepcionNombre: "Luis", recepcionApellido: "Pérez", recepcionTelefono: "5587654321",
  modalidadProgramacion: "lo_antes_posible" as const, fechaHoraProgramada: "", zonaHoraria: "America/Mexico_City", tipoRuta: "local" as const, tipoServicio: "personal" as const, motivoServicio: "entrega_cliente" as const, aceptaPoliticas: true as const,
};

describe("paradas duplicadas (R7)", () => {
  it("rechaza parada que duplica origen", () => {
    const res = esquemaSolicitudTraslado.safeParse({
      ...base,
      paradas: [{ id: "p1", tipo: "escala", calle: "A", numero: "1", colonia: "Del Valle", codigoPostal: "03100", estado: "CDMX", ciudad: "CDMX", referencias: "", tipoTarea: undefined }],
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues.some((i) => String(i.path).includes("paradas"))).toBe(true);
  });

  it("rechaza paradas duplicadas entre sí", () => {
    const parada = { id: "p1", tipo: "escala" as const, calle: "C", numero: "3", colonia: "Centro", codigoPostal: "06000", estado: "CDMX", ciudad: "CDMX", referencias: "" };
    const res = esquemaSolicitudTraslado.safeParse({
      ...base,
      paradas: [parada, { ...parada, id: "p2" }],
    });
    expect(res.success).toBe(false);
  });

  it("acepta hasta 8 paradas no duplicadas", () => {
    const paradas = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`, tipo: "escala" as const, calle: `Calle${i}`, numero: `${i}`, colonia: `Col${i}`, codigoPostal: "06000", estado: "CDMX", ciudad: "CDMX", referencias: "",
    }));
    expect(esquemaSolicitudTraslado.safeParse({ ...base, paradas }).success).toBe(true);
  });

  it("rechaza más de 8 paradas", () => {
    const paradas = Array.from({ length: 9 }, (_, i) => ({
      id: `p${i}`, tipo: "escala" as const, calle: `Calle${i}`, numero: `${i}`, colonia: `Col${i}`, codigoPostal: "06000", estado: "CDMX", ciudad: "CDMX", referencias: "",
    }));
    expect(esquemaSolicitudTraslado.safeParse({ ...base, paradas } as unknown as typeof base).success).toBe(false);
  });
});
