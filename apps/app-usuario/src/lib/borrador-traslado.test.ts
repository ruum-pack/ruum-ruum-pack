/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("borrador-traslado (R7)", () => {
  const clave = "ruumruum.traslados-nuevo.borrador.v2";

  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  function baseDatos(overrides: Record<string, unknown> = {}) {
    return {
      claveIdempotencia: crypto.randomUUID(),
      paso: 0,
      tipo: "sedan",
      transmision: "automatica",
      marca: "Nissan",
      modelo: "Versa",
      anio: "2022",
      color: "blanco",
      condicion: "seminueva",
      estadoGeneral: "Buen estado",
      tieneTarjeta: true,
      tieneVerificacion: true,
      tienePlacas: true,
      puedeCircular: true,
      origenCodigoPostal: "03100",
      origenEstado: "CDMX",
      origenCiudad: "CDMX",
      origenColonia: "Del Valle",
      destinoCodigoPostal: "06600",
      destinoEstado: "CDMX",
      destinoCiudad: "CDMX",
      destinoColonia: "Juarez",
      entregaNombre: "Ana",
      entregaApellido: "Lopez",
      recepcionNombre: "Luis",
      recepcionApellido: "Perez",
      modalidadProgramacion: "lo_antes_posible",
      fechaHoraProgramada: "",
      tipoRuta: "local",
      ventanaRecoleccion: "manana",
      ventanaEntrega: "tarde",
      tipoServicio: "personal",
      motivoServicio: "entrega_cliente",
      ...overrides,
    };
  }

  it("guarda y lee borrador válido con vigencia 24h", async () => {
    const { guardarBorradorTrasladoLocal, leerBorradorTrasladoLocal } = await import("./borrador-traslado");
    const datos = baseDatos();
    guardarBorradorTrasladoLocal(datos as never);
    const leido = leerBorradorTrasladoLocal();
    expect(leido).not.toBeNull();
    expect(leido?.marca).toBe("Nissan");
    expect(leido?.claveIdempotencia).toBe(datos.claveIdempotencia);
    expect(leido?.versionEsquema).toBe(2);
    // expira ~24h en futuro
    expect(new Date(leido!.expiraEn).getTime()).toBeGreaterThan(Date.now() + 23 * 3600 * 1000);
  });

  it("excluye contenido vacío -> retorna null", async () => {
    const { guardarBorradorTrasladoLocal, leerBorradorTrasladoLocal } = await import("./borrador-traslado");
    // Todos vacíos excepto booleans -> hayContenido false -> null
    const vacio = baseDatos({ tipo: "", marca: "", modelo: "", anio: "", color: "", condicion: "", estadoGeneral: "", origenCodigoPostal: "", origenEstado: "", origenCiudad: "", origenColonia: "", destinoCodigoPostal: "", destinoEstado: "", destinoCiudad: "", destinoColonia: "", entregaNombre: "", entregaApellido: "", recepcionNombre: "", recepcionApellido: "", modalidadProgramacion: "", fechaHoraProgramada: "", tipoRuta: "", ventanaRecoleccion: "", ventanaEntrega: "", tipoServicio: "", motivoServicio: "", transmision: "" });
    guardarBorradorTrasladoLocal(vacio as never);
    expect(leerBorradorTrasladoLocal()).toBeNull();
  });

  it("retorna null si expirado y limpia storage", async () => {
    const { leerBorradorTrasladoLocal } = await import("./borrador-traslado");
    const expirado = {
      versionEsquema: 2,
      claveIdempotencia: crypto.randomUUID(),
      guardadoEn: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
      expiraEn: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      paso: 0,
      tipo: "sedan", transmision: "automatica", marca: "Nissan", modelo: "Versa", anio: "2022", color: "gris", condicion: "seminueva", estadoGeneral: "ok",
      tieneTarjeta: true, tieneVerificacion: true, tienePlacas: true, puedeCircular: true,
      origenCodigoPostal: "03100", origenEstado: "CDMX", origenCiudad: "CDMX", origenColonia: "Del Valle",
      destinoCodigoPostal: "06600", destinoEstado: "CDMX", destinoCiudad: "CDMX", destinoColonia: "Juarez",
      entregaNombre: "Ana", entregaApellido: "Lopez", recepcionNombre: "Luis", recepcionApellido: "Perez",
      modalidadProgramacion: "lo_antes_posible", fechaHoraProgramada: "", tipoRuta: "local", ventanaRecoleccion: "", ventanaEntrega: "", tipoServicio: "", motivoServicio: ""
    };
    localStorage.setItem(clave, JSON.stringify(expirado));
    expect(leerBorradorTrasladoLocal()).toBeNull();
    expect(localStorage.getItem(clave)).toBeNull(); // limpiado
  });

  it("retorna null si campo excede 180 y limpia", async () => {
    const { leerBorradorTrasladoLocal } = await import("./borrador-traslado");
    const largo = "a".repeat(181);
    const datos = {
      versionEsquema: 2,
      claveIdempotencia: crypto.randomUUID(),
      guardadoEn: new Date().toISOString(),
      expiraEn: new Date(Date.now() + 3600000).toISOString(),
      paso: 0,
      tipo: largo, transmision: "", marca: "", modelo: "", anio: "", color: "", condicion: "", estadoGeneral: "",
      tieneTarjeta: false, tieneVerificacion: false, tienePlacas: false, puedeCircular: false,
      origenCodigoPostal: "", origenEstado: "", origenCiudad: "", origenColonia: "",
      destinoCodigoPostal: "", destinoEstado: "", destinoCiudad: "", destinoColonia: "",
      entregaNombre: "", entregaApellido: "", recepcionNombre: "", recepcionApellido: "",
      modalidadProgramacion: "", fechaHoraProgramada: "", tipoRuta: "", ventanaRecoleccion: "", ventanaEntrega: "", tipoServicio: "", motivoServicio: ""
    };
    localStorage.setItem(clave, JSON.stringify(datos));
    expect(leerBorradorTrasladoLocal()).toBeNull();
  });

  it("valida claveIdempotencia UUID y genera nuevo si inválida", async () => {
    const { leerBorradorTrasladoLocal } = await import("./borrador-traslado");
    const datos = {
      versionEsquema: 2,
      claveIdempotencia: "no-uuid",
      guardadoEn: new Date().toISOString(),
      expiraEn: new Date(Date.now() + 3600000).toISOString(),
      paso: 0,
      tipo: "sedan", transmision: "", marca: "", modelo: "", anio: "", color: "", condicion: "", estadoGeneral: "",
      tieneTarjeta: false, tieneVerificacion: false, tienePlacas: false, puedeCircular: false,
      origenCodigoPostal: "", origenEstado: "", origenCiudad: "", origenColonia: "",
      destinoCodigoPostal: "", destinoEstado: "", destinoCiudad: "", destinoColonia: "",
      entregaNombre: "Ana", entregaApellido: "", recepcionNombre: "", recepcionApellido: "",
      modalidadProgramacion: "", fechaHoraProgramada: "", tipoRuta: "", ventanaRecoleccion: "", ventanaEntrega: "", tipoServicio: "", motivoServicio: ""
    };
    localStorage.setItem(clave, JSON.stringify(datos));
    const leido = leerBorradorTrasladoLocal();
    expect(leido).not.toBeNull();
    expect(leido?.claveIdempotencia).toMatch(/^[0-9a-f-]{36}$/i);
    expect(leido?.claveIdempotencia).not.toBe("no-uuid");
  });

  it("limpiarBorradorTrasladoLocal remueve clave", async () => {
    const { guardarBorradorTrasladoLocal, limpiarBorradorTrasladoLocal, leerBorradorTrasladoLocal } = await import("./borrador-traslado");
    guardarBorradorTrasladoLocal(baseDatos() as never);
    expect(leerBorradorTrasladoLocal()).not.toBeNull();
    limpiarBorradorTrasladoLocal();
    expect(leerBorradorTrasladoLocal()).toBeNull();
  });

  it("preserva paso 4 (límite superior corregido a PASO_MAXIMO)", async () => {
    const { guardarBorradorTrasladoLocal, leerBorradorTrasladoLocal, PASO_MAXIMO } = await import("./borrador-traslado");
    expect(PASO_MAXIMO).toBe(4);
    const datos = baseDatos({ paso: 4 });
    guardarBorradorTrasladoLocal(datos as never);
    // Simular recarga leyendo crudo: debe volver como 4, no 0
    const leido = leerBorradorTrasladoLocal();
    expect(leido?.paso).toBe(4);
  });

  it("preserva paso intermedio 3", async () => {
    const { guardarBorradorTrasladoLocal, leerBorradorTrasladoLocal } = await import("./borrador-traslado");
    const datos = baseDatos({ paso: 3 });
    guardarBorradorTrasladoLocal(datos as never);
    const leido = leerBorradorTrasladoLocal();
    expect(leido?.paso).toBe(3);
  });

  it("paso 5 o 99 fuera de rango cae a 0", async () => {
    const { leerBorradorTrasladoLocal } = await import("./borrador-traslado");
    const raw = {
      versionEsquema: 2,
      claveIdempotencia: crypto.randomUUID(),
      guardadoEn: new Date().toISOString(),
      expiraEn: new Date(Date.now() + 3600000).toISOString(),
      paso: 5,
      tipo: "sedan", transmision: "automatica", marca: "Nissan", modelo: "Versa", anio: "2022", color: "gris", condicion: "seminueva", estadoGeneral: "ok",
      tieneTarjeta: true, tieneVerificacion: true, tienePlacas: true, puedeCircular: true,
      origenCodigoPostal: "03100", origenEstado: "CDMX", origenCiudad: "CDMX", origenColonia: "Del Valle",
      destinoCodigoPostal: "06600", destinoEstado: "CDMX", destinoCiudad: "CDMX", destinoColonia: "Juarez",
      entregaNombre: "Ana", entregaApellido: "Lopez", recepcionNombre: "Luis", recepcionApellido: "Perez",
      modalidadProgramacion: "lo_antes_posible", fechaHoraProgramada: "", tipoRuta: "local", ventanaRecoleccion: "", ventanaEntrega: "", tipoServicio: "personal", motivoServicio: "entrega_cliente"
    };
    localStorage.setItem(clave, JSON.stringify(raw));
    expect(leerBorradorTrasladoLocal()?.paso).toBe(0);

    localStorage.setItem(clave, JSON.stringify({ ...raw, paso: 99 }));
    expect(leerBorradorTrasladoLocal()?.paso).toBe(0);
  });

  describe("formatearTiempoRelativoBorrador (UX 2)", () => {
    it("formatea segundos, minutos, horas y días correctamente", async () => {
      const { formatearTiempoRelativoBorrador } = await import("./borrador-traslado");
      const baseMs = 1700000000000;

      // Segundos (<60s)
      expect(formatearTiempoRelativoBorrador(new Date(baseMs - 20000).toISOString(), baseMs)).toBe("hace unos segundos");
      // Minutos
      expect(formatearTiempoRelativoBorrador(new Date(baseMs - 60000).toISOString(), baseMs)).toBe("hace 1 minuto");
      expect(formatearTiempoRelativoBorrador(new Date(baseMs - 120000).toISOString(), baseMs)).toBe("hace 2 minutos");
      expect(formatearTiempoRelativoBorrador(new Date(baseMs - 35 * 60000).toISOString(), baseMs)).toBe("hace 35 minutos");
      // Horas
      expect(formatearTiempoRelativoBorrador(new Date(baseMs - 3600000).toISOString(), baseMs)).toBe("hace 1 hora");
      expect(formatearTiempoRelativoBorrador(new Date(baseMs - 5 * 3600000).toISOString(), baseMs)).toBe("hace 5 horas");
      // Días
      expect(formatearTiempoRelativoBorrador(new Date(baseMs - 24 * 3600000).toISOString(), baseMs)).toBe("hace 1 día");
      expect(formatearTiempoRelativoBorrador(new Date(baseMs - 48 * 3600000).toISOString(), baseMs)).toBe("hace 2 días");
    });
  });
});

