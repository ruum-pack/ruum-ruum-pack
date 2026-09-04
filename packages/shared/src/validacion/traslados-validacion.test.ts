import { describe, expect, it } from "vitest";
import {
  ANTICIPACION_MINIMA_HORAS,
  ANIO_MINIMO_VEHICULO,
  MAX_PARADAS_TRASLADO,
  esquemaParada,
  esquemaSolicitudTraslado,
  esquemaPayloadCrearTraslado,
  erroresFormulario
} from "./traslados";

const valido = {
  vehiculoSeleccionadoId: "",
  vehiculosUsuarioIds: [],
  marca: "Nissan",
  modelo: "Versa",
  color: "gris",
  placas: "ABC123",
  vin: "VIN123",
  anio: "2022",
  transmision: "automatica",
  condicion: "seminueva",
  estadoGeneral: "Buen estado, desgaste normal",
  tieneTarjeta: true,
  tieneVerificacion: true,
  tienePlacas: true,
  puedeCircular: true,
  origenCodigoPostal: "03100",
  origenEstado: "CDMX",
  origenCiudad: "CDMX",
  origenColonia: "Del Valle",
  origenCalle: "A",
  origenNumero: "1",
  destinoCodigoPostal: "06600",
  destinoEstado: "CDMX",
  destinoCiudad: "CDMX",
  destinoColonia: "Juárez",
  destinoCalle: "B",
  destinoNumero: "2",
  entregaNombre: "Ana",
  entregaApellido: "López",
  entregaTelefono: "5512345678",
  recepcionNombre: "Luis",
  recepcionApellido: "Pérez",
  recepcionTelefono: "5587654321",
  modalidadProgramacion: "lo_antes_posible",
  fechaHoraProgramada: "",
  zonaHoraria: "America/Mexico_City",
  tipoRuta: "local",
  tipoServicio: "personal",
  motivoServicio: "entrega_cliente",
  aceptaPoliticas: true,
  paradas: []
};

describe("Reglas y Esquemas Centralizados de Traslado (@ruum/shared)", () => {
  it("exporta las constantes de negocio canónicas", () => {
    expect(ANTICIPACION_MINIMA_HORAS).toBe(2);
    expect(ANIO_MINIMO_VEHICULO).toBe(1980);
    expect(MAX_PARADAS_TRASLADO).toBe(8);
  });

  it("acepta una solicitud de traslado válida", () => {
    const res = esquemaSolicitudTraslado.safeParse(valido);
    expect(res.success).toBe(true);
    expect(erroresFormulario(res)).toEqual({});
  });

  it("rechaza si origen y destino son idénticos", () => {
    const res = esquemaSolicitudTraslado.safeParse({
      ...valido,
      destinoCodigoPostal: "03100",
      destinoColonia: "Del Valle",
      destinoCalle: "A",
      destinoNumero: "1"
    });
    expect(res.success).toBe(false);
    const errores = erroresFormulario(res);
    expect(errores.destinoCalle).toBe("El destino debe ser diferente del origen.");
  });

  it("rechaza vehículo no rodante salvo que sea rescate mecánico", () => {
    const resNoRodante = esquemaSolicitudTraslado.safeParse({
      ...valido,
      puedeCircular: false
    });
    expect(resNoRodante.success).toBe(false);

    const resRescate = esquemaSolicitudTraslado.safeParse({
      ...valido,
      condicion: "rescate_mecanico",
      puedeCircular: false
    });
    expect(resRescate.success).toBe(true);
  });

  it("valida paradas y tareas correctamente", () => {
    const escalaValida = {
      id: "p1",
      tipo: "escala" as const,
      calle: "Av Insurgentes",
      numero: "100",
      colonia: "Roma",
      codigoPostal: "06700",
      estado: "CDMX",
      ciudad: "CDMX"
    };
    expect(esquemaParada.safeParse(escalaValida).success).toBe(true);

    const tareaInvalida = {
      id: "p2",
      tipo: "tarea" as const,
      calle: "Av Insurgentes",
      numero: "100",
      colonia: "Roma",
      codigoPostal: "06700",
      estado: "CDMX",
      ciudad: "CDMX",
      tipoTarea: undefined,
      contactoNombre: "",
      contactoTelefono: "123"
    };
    expect(esquemaParada.safeParse(tareaInvalida).success).toBe(false);
  });

  it("valida payload de servicio crearTraslado", () => {
    const payloadValido = {
      claveIdempotencia: "00000000-0000-0000-0000-000000000000",
      vehiculo: {
        vehiculoId: "11111111-1111-1111-1111-111111111111"
      },
      traslado: {
        contacto_entrega_nombre: "Ana",
        contacto_entrega_telefono: "5512345678",
        contacto_recepcion_nombre: "Luis",
        contacto_recepcion_telefono: "5587654321",
        origen_direccion: "Calle A 1",
        origen_ciudad: "CDMX",
        destino_direccion: "Calle B 2",
        destino_ciudad: "CDMX",
        modalidad_programacion: "lo_antes_posible" as const
      },
      paradas: []
    };

    expect(esquemaPayloadCrearTraslado.safeParse(payloadValido).success).toBe(true);

    const payloadInvalido = {
      ...payloadValido,
      claveIdempotencia: "no-es-uuid"
    };
    expect(esquemaPayloadCrearTraslado.safeParse(payloadInvalido).success).toBe(false);
  });
});
