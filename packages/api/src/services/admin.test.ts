import { describe, expect, it } from "vitest";
import {
  aplicarTarifaNormativaAdmin,
  ajustarPrecioFinalAdmin,
  crearEmpresaCorporativaAdmin,
  crearTrasladosMasivosAdmin,
  listarExcepcionesCriticasAdmin,
  listarViajesAdmin,
  obtenerTrazabilidadMasivaTraslado,
  obtenerMetricasRegistroConductor
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
    expect(clienteTodos.llamadas.some((l) => l.table === "pasaporte_digital" && l.action === "eq")).toBe(false);

    const clienteFiltrado = crearClienteFake({
      tablas: { pasaporte_digital: { data: [] }, admins: { data: { id: "admin-1", rol_operativo: "direccion" } } },
      rpcs: { admin_tiene_permiso: { data: true } }
    });
    await listarViajesAdmin(clienteFiltrado as never, "pendiente_de_conductor");
    expect(clienteFiltrado.llamadas).toContainEqual({
      table: "pasaporte_digital",
      action: "eq",
      args: ["estado", "pendiente_de_conductor"]
    });
  });

  it("ajusta precio final con auditoría de admin y rechaza montos inválidos", async () => {
    const cliente = crearClienteFake({
      tablas: {
        admins: { data: { id: "admin-1", rol_operativo: "finanzas" } },
        traslados: { data: null },
        registro_auditoria: { data: null }
      },
      rpcs: { admin_tiene_permiso: { data: true } }
    });

    await expect(ajustarPrecioFinalAdmin(cliente as never, "traslado-1", -1)).rejects.toThrow(
      "La tarifa final debe ser un número válido mayor o igual a 0."
    );

    await ajustarPrecioFinalAdmin(cliente as never, "traslado-1", 2500);

    expect(cliente.llamadas).toContainEqual({
      table: "traslados",
      action: "update",
      args: [{ precio_final: 2500 }]
    });
    expect(cliente.llamadas).toContainEqual({
      table: "registro_auditoria",
      action: "insert",
      args: [{
        traslado_id: "traslado-1",
        evento: "modificacion_traslado_activo",
        actor: "admin",
        actor_id: "admin-1",
        datos: { traslado_id: "traslado-1", precio_final: 2500 }
      }]
    });
  });

  it("aplica tarifa normativa sin enviar precio libre desde el cliente", async () => {
    const cliente = crearClienteFake({
      rpcs: { admin_aplica_tarifa_normativa: { data: 3450.75 } }
    });

    await expect(aplicarTarifaNormativaAdmin(cliente as never, "traslado-1")).resolves.toBe(3450.75);

    expect(cliente.rpc).toHaveBeenCalledWith("admin_aplica_tarifa_normativa", { p_traslado_id: "traslado-1" });
  });

  it("crea traslados masivos corporativos por RPC y bloquea lotes vacíos", async () => {
    const cliente = crearClienteFake({
      tablas: { admins: { data: { id: "admin-1", rol_operativo: "direccion" } } },
      rpcs: {
        admin_tiene_permiso: { data: true },
        admin_crea_traslados_masivos: {
          data: {
            carga_id: "carga-1",
            total_filas: 1,
            filas_creadas: 1,
            filas_error: 0,
            estado: "procesada"
          }
        }
      }
    });

    await expect(
      crearTrasladosMasivosAdmin(cliente as never, {
        empresaId: "empresa-1",
        usuarioId: "usuario-1",
        nombreArchivo: "traslados.csv",
        filas: []
      })
    ).rejects.toThrow("El archivo no contiene filas válidas para enviar.");

    await expect(
      crearTrasladosMasivosAdmin(cliente as never, {
        empresaId: "empresa-1",
        usuarioId: "usuario-1",
        nombreArchivo: "traslados.csv",
        filas: [{
          vehiculo_marca: "Nissan",
          vehiculo_modelo: "Versa",
          vehiculo_anio: "2024",
          vehiculo_tipo: "sedan",
          vehiculo_placas: "ABC123",
          categoria_tarifa: "ligero_a",
          gama: "entrada",
          condicion: "seminueva",
          origen_lat: "19.43",
          origen_lng: "-99.13",
          destino_lat: "19.50",
          destino_lng: "-99.20"
        }]
      })
    ).resolves.toMatchObject({ carga_id: "carga-1", filas_creadas: 1 });

    expect(cliente.rpc).toHaveBeenCalledWith("admin_crea_traslados_masivos", {
      p_empresa_id: "empresa-1",
      p_usuario_id: "usuario-1",
      p_nombre_archivo: "traslados.csv",
      p_filas: [expect.objectContaining({ vehiculo_placas: "ABC123" })]
    });
  });

  it("obtiene trazabilidad masiva por traslado", async () => {
    const cliente = crearClienteFake({
      tablas: {
        admins: { data: { id: "admin-1", rol_operativo: "direccion" } },
        filas_carga_traslados_masivos: {
          data: {
            id: "fila-1",
            carga_id: "carga-1",
            numero_fila: 4,
            estado: "creada",
            referencia_externa: "CORP-44",
            datos: {},
            errores: [],
            vehiculo_id: "vehiculo-1",
            traslado_id: "traslado-1",
            creado_en: "2026-07-18T00:00:00.000Z"
          }
        },
        cargas_traslados_masivos: {
          data: {
            id: "carga-1",
            empresa_id: "empresa-1",
            usuario_id: "usuario-1",
            creado_por_admin_id: "admin-1",
            nombre_archivo: "masivos.csv",
            total_filas: 4,
            filas_creadas: 4,
            filas_error: 0,
            estado: "procesada",
            creado_en: "2026-07-18T00:00:00.000Z"
          }
        }
      },
      rpcs: { admin_tiene_permiso: { data: true } }
    });

    await expect(obtenerTrazabilidadMasivaTraslado(cliente as never, "traslado-1")).resolves.toMatchObject({
      fila: { referencia_externa: "CORP-44" },
      carga: { nombre_archivo: "masivos.csv" }
    });
  });

  it("crea empresa corporativa con titular por RPC y valida datos mínimos", async () => {
    const cliente = crearClienteFake({
      tablas: { admins: { data: { id: "admin-1", rol_operativo: "direccion" } } },
      rpcs: {
        admin_tiene_permiso: { data: true },
        admin_crea_empresa_corporativa: {
          data: { empresa_id: "empresa-1", usuario_id: "usuario-1" }
        }
      }
    });

    await expect(
      crearEmpresaCorporativaAdmin(cliente as never, {
        empresa: { nombre: "Flotilla Norte", rfc: "" },
        titular: { nombre: "Ana Operaciones", correo_facturacion: "ana@empresa.test" }
      })
    ).rejects.toThrow("Captura el RFC de la empresa.");

    await expect(
      crearEmpresaCorporativaAdmin(cliente as never, {
        empresa: {
          nombre: "Flotilla Norte",
          rfc: "abc010101ab1",
          condiciones_pago: "Pago semanal"
        },
        titular: {
          nombre: "Ana Operaciones",
          telefono: "+525500000000",
          correo_facturacion: "ANA@EMPRESA.TEST"
        }
      })
    ).resolves.toEqual({ empresa_id: "empresa-1", usuario_id: "usuario-1" });

    expect(cliente.rpc).toHaveBeenCalledWith("admin_crea_empresa_corporativa", {
      p_empresa: expect.objectContaining({ nombre: "Flotilla Norte", rfc: "ABC010101AB1" }),
      p_titular: expect.objectContaining({ nombre: "Ana Operaciones", correo_facturacion: "ana@empresa.test" })
    });
  });

  it("lista excepciones críticas con acciones obligatorias", async () => {
    const cliente = crearClienteFake({
      tablas: {
        admins: { data: { id: "admin-1", rol_operativo: "supervisor" } },
        registro_auditoria: {
          data: [{
            id: "evento-1",
            traslado_id: "traslado-1",
            evento: "activacion_soporte_emergencia",
            actor: "conductor",
            actor_id: "conductor-1",
            datos: { traslado_id: "traslado-1" },
            ip: null,
            dispositivo: null,
            timestamp: "2026-07-18T10:00:00.000Z"
          }]
        },
        usuarios: { data: [] },
        conductores: { data: [] },
        traslados: { data: [] },
        incidencias: { data: [] }
      },
      rpcs: { admin_tiene_permiso: { data: true } }
    });

    await expect(listarExcepcionesCriticasAdmin(cliente as never)).resolves.toEqual([
      expect.objectContaining({
        categoria: "emergencia",
        severidad: "critica",
        accionPrincipal: expect.objectContaining({ etiqueta: "Abrir traslado" }),
        accionEscalamiento: expect.objectContaining({ etiqueta: "Escalar a supervisor" })
      })
    ]);
  });
});
