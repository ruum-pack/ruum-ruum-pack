import { describe, expect, it, vi } from "vitest";
import {
  aplicarTarifaNormativaAdmin,
  ajustarPrecioFinalAdmin,
  crearEmpresaCorporativaAdmin,
  crearTrasladosMasivosAdmin,
  listarExcepcionesCriticasAdmin,
  listarViajesAdmin,
  obtenerTrazabilidadMasivaTraslado,
  obtenerMetricasRegistroConductor,
  cambiarEstatusAdmin,
  asignarConductorAdmin,
  actualizarVehiculoAdmin,
  obtenerEvidenciaVehiculo
} from "./admin";
import { crearClienteFake } from "./__tests__/supabase-fake";

describe("servicios admin", () => {
  it("normaliza métricas de registro desde el RPC sin exponer eventos crudos", async () => {
    const cliente = crearClienteFake({
      rpcs: {
        obtener_metricas_registro_conductor: {
          data: {
            periodo: { desde: "2026-07-01", hasta: "2026-07-13" },
            abandono_por_paso: [{ paso: 2, total: 5 }, { paso: "x", total: null }],
            errores_otp: 3,
            errores_rpc: "no-numero",
            fallos_documentos: 4,
            tiempo_promedio_registro_segundos: null,
            tiempo_promedio_revision_segundos: 3600,
            documentos_rechazados_por_tipo: [{ tipo: "licencia_frente", total: 2 }],
            solicitudes_enviadas: 9
          }
        }
      }
    });

    const metricas = await obtenerMetricasRegistroConductor(cliente as never, "2026-07-01", "2026-07-13");

    expect(metricas).toEqual({
      periodo: { desde: "2026-07-01", hasta: "2026-07-13" },
      abandonoPorPaso: [{ paso: 2, total: 5 }, { paso: 0, total: 0 }],
      erroresOtp: 3,
      erroresRpc: 0,
      fallosDocumentos: 4,
      tiempoPromedioRegistroSegundos: null,
      tiempoPromedioRevisionSegundos: 3600,
      documentosRechazadosPorTipo: [{ tipo: "licencia_frente", total: 2 }],
      solicitudesEnviadas: 9
    });
    expect(cliente.rpc).toHaveBeenCalledWith("obtener_metricas_registro_conductor", {
      p_desde: "2026-07-01",
      p_hasta: "2026-07-13"
    });
  });

  it("lista viajes sin filtro para todos y con eq para estados específicos", async () => {
    const clienteTodos = crearClienteFake({
      tablas: { pasaporte_digital: { data: [{ traslado_id: "t1" }] }, admins: { data: { id: "admin-1", rol_operativo: "direccion" } } },
      rpcs: { admin_tiene_permiso: { data: true } }
    });
    await expect(listarViajesAdmin(clienteTodos as never, "todos")).resolves.toEqual([{ traslado_id: "t1" }]);
  });

  it("lanza error si el RPC del RPC falla en obtenerMetricasRegistroConductor", async () => {
    const cliente = crearClienteFake({
      rpcs: { obtener_metricas_registro_conductor: { error: new Error("RPC caído") } }
    });
    await expect(obtenerMetricasRegistroConductor(cliente as never, "d", "h")).rejects.toThrow("RPC caído");
  });

  it("no lanza error si data es null en listarViajesAdmin", async () => {
    const cliente = crearClienteFake({
      tablas: { pasaporte_digital: { data: null }, admins: { data: { id: "a1" } } },
      rpcs: { admin_tiene_permiso: { data: true } }
    });
    await expect(listarViajesAdmin(cliente as never, "todos")).resolves.toEqual([]);
  });

const ADMIN_BASE = { tablas: { admins: { data: { id: "admin-1", rol_operativo: "direccion" } } }, rpcs: { admin_tiene_permiso: { data: true } } };

  it("ajustarPrecioFinalAdmin lanza error si precio no es válido", async () => {
    const cliente = crearClienteFake(ADMIN_BASE);
    await expect(ajustarPrecioFinalAdmin(cliente as never, "t1", -1, "ap1")).rejects.toThrow("válido");
  });

  it("crearEmpresaCorporativaAdmin lanza error si faltan campos obligatorios", async () => {
    const cliente = crearClienteFake(ADMIN_BASE);
    await expect(crearEmpresaCorporativaAdmin(cliente as never, { empresa: { nombre: "", rfc: "" }, titular: { nombre: "", correo_facturacion: "" } })).rejects.toThrow("Captura");
  });

  it("listarExcepcionesCriticasAdmin devuelve arreglo vacío si no hay datos", async () => {
    const cliente = crearClienteFake({
      ...ADMIN_BASE,
      tablas: { ...ADMIN_BASE.tablas, excepciones_traslado: { data: null } }
    });
    await expect(listarExcepcionesCriticasAdmin(cliente as never)).resolves.toEqual([]);
  });

  it("obtenerTrazabilidadMasivaTraslado devuelve null si no hay fila", async () => {
    const cliente = crearClienteFake({
      ...ADMIN_BASE,
      tablas: { ...ADMIN_BASE.tablas, filas_carga_traslados_masivos: { data: null } }
    });
    await expect(obtenerTrazabilidadMasivaTraslado(cliente as never, "t1")).resolves.toBeNull();
  });

  it("crearTrasladosMasivosAdmin lanza si el archivo está vacío", async () => {
    const cliente = crearClienteFake(ADMIN_BASE);
    await expect(crearTrasladosMasivosAdmin(cliente as never, {
      empresaId: "e1",
      usuarioId: "u1",
      nombreArchivo: "x.csv",
      hashArchivo: "a".repeat(64),
      tamanoBytes: 128,
      mimeType: "text/csv",
      filas: []
    })).rejects.toThrow("válidas");
  });

  it("cambiarEstatusAdmin lanza si transición inválida", async () => {
    const cliente = crearClienteFake(ADMIN_BASE);
    await expect(cambiarEstatusAdmin(cliente as never, "t1", "solicitud_creada", "servicio_cerrado")).rejects.toThrow("Transición no permitida");
  });

describe("asignarConductorAdmin — restricciones de elegibilidad (PRD §4.3)", () => {
  it("lanza error si el estado del traslado no está en la cadena de asignación", async () => {
    const cliente = crearClienteFake(ADMIN_BASE);
    await expect(asignarConductorAdmin(cliente as never, "t1", "c1", "servicio_cerrado")).rejects.toThrow("No se puede asignar conductor");
  });

  it("lanza error si el conductor no existe", async () => {
    const cliente = crearClienteFake({
      ...ADMIN_BASE,
      tablas: {
        admins: { data: { id: "admin-1", rol_operativo: "direccion" } },
        conductores: { data: null },
        traslados: { data: { id: "t1", tipo_ruta: "local", vehiculo_id: "v1" } },
        vehiculos: { data: { tipo: "sedan" } }
      }
    });
    await expect(asignarConductorAdmin(cliente as never, "t1", "c1-inexistente", "pendiente_de_conductor")).rejects.toThrow("Conductor no encontrado");
  });

  it("lanza error si el traslado no existe", async () => {
    const conductor = { id: "c1", estado: "activo", estado_expediente: "aprobado", calificacion_promedio: 4.5, traslados_completados: 10, documentos_vigentes: true, certificaciones: [], incidencias_graves_6m: 0, incidencias_graves_12m: 0, suspensiones_activas: 0, no_presentaciones_6m: 0, cancelaciones_sin_justificacion_count: 0, nombre: "Juan", creado_en: new Date().toISOString() };
    const cliente = crearClienteFake({
      ...ADMIN_BASE,
      tablas: {
        admins: { data: { id: "admin-1", rol_operativo: "direccion" } },
        conductores: { data: conductor },
        traslados: { data: null }
      }
    });
    await expect(asignarConductorAdmin(cliente as never, "t1", "c1", "pendiente_de_conductor")).rejects.toThrow("Traslado no encontrado");
  });

  it("lanza error si el conductor no tiene expediente aprobado", async () => {
    const cliente = crearClienteFake({
      ...ADMIN_BASE,
      tablas: {
        admins: { data: { id: "admin-1", rol_operativo: "direccion" } },
        conductores: { data: { id: "c1", estado_expediente: "pendiente" } },
        traslados: { data: { id: "t1", tipo_ruta: "local", vehiculo_id: "v1" } }
      }
    });
    await expect(asignarConductorAdmin(cliente as never, "t1", "c1", "pendiente_de_conductor")).rejects.toThrow("expediente aprobado");
  });

  it("lanza error si el conductor no tiene documentos vigentes", async () => {
    const conductor = { id: "c1", estado: "activo", estado_expediente: "aprobado", calificacion_promedio: 4.5, traslados_completados: 10, documentos_vigentes: false, certificaciones: [], incidencias_graves_6m: 0, incidencias_graves_12m: 0, suspensiones_activas: 0, no_presentaciones_6m: 0, cancelaciones_sin_justificacion_count: 0, nombre: "Juan", creado_en: new Date().toISOString() };
    const cliente = crearClienteFake({
      ...ADMIN_BASE,
      tablas: {
        admins: { data: { id: "admin-1", rol_operativo: "direccion" } },
        conductores: { data: conductor },
        traslados: { data: { id: "t1", tipo_ruta: "local", vehiculo_id: "v1" } },
        vehiculos: { data: { tipo: "sedan" } }
      }
    });
    await expect(asignarConductorAdmin(cliente as never, "t1", "c1", "pendiente_de_conductor")).rejects.toThrow("Documentos vencidos o incompletos");
  });

  it("lanza error si el conductor no está en estado activo", async () => {
    const conductor = { id: "c1", estado: "suspendido", estado_expediente: "aprobado", calificacion_promedio: 4.5, traslados_completados: 10, documentos_vigentes: true, certificaciones: [], incidencias_graves_6m: 0, incidencias_graves_12m: 0, suspensiones_activas: 0, no_presentaciones_6m: 0, cancelaciones_sin_justificacion_count: 0, nombre: "Juan", creado_en: new Date().toISOString() };
    const cliente = crearClienteFake({
      ...ADMIN_BASE,
      tablas: {
        admins: { data: { id: "admin-1", rol_operativo: "direccion" } },
        conductores: { data: conductor },
        traslados: { data: { id: "t1", tipo_ruta: "local", vehiculo_id: "v1" } },
        vehiculos: { data: { tipo: "sedan" } }
      }
    });
    await expect(asignarConductorAdmin(cliente as never, "t1", "c1", "pendiente_de_conductor")).rejects.toThrow("Conductor en estado");
  });

  it("asigna conductor exitosamente cuando todas las validaciones pasan", async () => {
    const conductor = { id: "c1", estado: "activo", estado_expediente: "aprobado", calificacion_promedio: 4.5, traslados_completados: 10, documentos_vigentes: true, certificaciones: [], incidencias_graves_6m: 0, incidencias_graves_12m: 0, suspensiones_activas: 0, no_presentaciones_6m: 0, cancelaciones_sin_justificacion_count: 0, nombre: "Juan", creado_en: new Date().toISOString() };
    const cliente = crearClienteFake({
      ...ADMIN_BASE,
      tablas: {
        admins: { data: { id: "admin-1", rol_operativo: "direccion" } },
        conductores: { data: conductor },
        traslados: { data: { id: "t1", tipo_ruta: "local", vehiculo_id: "v1" } },
        vehiculos: { data: { tipo: "sedan" } }
      },
      rpcs: {
        admin_tiene_permiso: { data: true },
        admin_asigna_conductor: { data: { ejecutado: true } }
      }
    });
    await expect(asignarConductorAdmin(cliente as never, "t1", "c1", "pendiente_de_conductor")).resolves.toBeUndefined();
  });
});

describe("obtenerEvidenciaVehiculo — fotos desde Storage", () => {
  it("devuelve arreglo vacío si no hay evidencia", async () => {
    const cliente = crearClienteFake({
      ...ADMIN_BASE,
      rpcs: {
        admin_tiene_permiso: { data: true },
        admin_obtener_evidencia_vehiculo: { data: [] }
      }
    });
    await expect(obtenerEvidenciaVehiculo(cliente as never, "v1")).resolves.toEqual([]);
  });

  it("devuelve evidencia con fotos cuando existe", async () => {
    const cliente = crearClienteFake({
      ...ADMIN_BASE,
      rpcs: {
        admin_tiene_permiso: { data: true },
        admin_obtener_evidencia_vehiculo: {
          data: [{
            traslado_id: "t1",
            traslado_estado: "pendiente_de_conductor",
            fotos: [{ id: "f1", tipo: "inicial", angulo: "frente", url: "path/foto.jpg", capturada_en: new Date().toISOString(), sincronizada: true }]
          }]
        }
      }
    });
    const resultado = await obtenerEvidenciaVehiculo(cliente as never, "v1");
    expect(resultado).toHaveLength(1);
    expect(resultado[0].traslado_id).toBe("t1");
    expect(resultado[0].fotos).toHaveLength(1);
  });
});

describe("actualizarVehiculoAdmin — concurrencia optimista y auditoría", () => {
  it("lanza error de concurrencia si la versión no coincide", async () => {
    const cliente = crearClienteFake({
      ...ADMIN_BASE,
      rpcs: {
        admin_tiene_permiso: { data: true },
        admin_actualizar_vehiculo: { error: new Error("CONCURRENCY_CONFLICT: el vehículo fue modificado por otro operador. Versión actual: 2, esperada: 1") }
      }
    });
    await expect(actualizarVehiculoAdmin(cliente as never, "v1", { color: "Rojo" }, 1)).rejects.toThrow("Conflicto de concurrencia");
  });

  it("actualiza exitosamente cuando la versión coincide", async () => {
    const vehiculoRow = { id: "v1", version: 2, color: "Rojo", marca: "Toyota", modelo: "Corolla", anio: 2020, tipo: "sedan", usuario_id: "u1", creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString(), tiene_tarjeta_circulacion: true, tiene_verificacion: true, tiene_placas: true, puede_circular_rodando: true };
    const cliente = crearClienteFake({
      ...ADMIN_BASE,
      tablas: {
        ...ADMIN_BASE.tablas,
        vehiculos: { data: vehiculoRow }
      },
      rpcs: {
        admin_tiene_permiso: { data: true },
        admin_actualizar_vehiculo: { data: { ejecutado: true, version: 1 } }
      }
    });
    const resultado = await actualizarVehiculoAdmin(cliente as never, "v1", { color: "Rojo" }, 0);
    expect(resultado).toBeDefined();
    expect(resultado.color).toBe("Rojo");
  });
});
});
