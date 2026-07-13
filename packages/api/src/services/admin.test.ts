import { describe, expect, it } from "vitest";
import {
  ajustarPrecioFinalAdmin,
  listarViajesAdmin,
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
    const clienteTodos = crearClienteFake({ tablas: { pasaporte_digital: { data: [{ traslado_id: "t1" }] } } });
    await expect(listarViajesAdmin(clienteTodos as never, "todos")).resolves.toEqual([{ traslado_id: "t1" }]);
    expect(clienteTodos.llamadas.some((l) => l.table === "pasaporte_digital" && l.action === "eq")).toBe(false);

    const clienteFiltrado = crearClienteFake({ tablas: { pasaporte_digital: { data: [] } } });
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
        admins: { data: { id: "admin-1" } },
        traslados: { data: null },
        registro_auditoria: { data: null }
      }
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
});
