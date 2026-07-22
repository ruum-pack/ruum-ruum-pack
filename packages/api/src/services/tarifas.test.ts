import { describe, expect, it } from "vitest";
import {
  actualizarConfigTarifas,
  actualizarFactorGama,
  actualizarTarifaVehiculo,
  guardarDistanciaYTiempoTraslado,
  obtenerConfiguracionTarifas,
  simularTarifaNormativa,
  sugerirTarifaTraslado
} from "./tarifas";
import { crearClienteFake } from "./__tests__/supabase-fake";

describe("servicios de tarifas admin", () => {
  it("lee toda la configuración de tarifas desde tablas admin-only", async () => {
    const cliente = crearClienteFake({
      tablas: {
        tarifas_vehiculo: { data: [{ id: "tv1" }] },
        tarifas_gama: { data: [{ gama: "media" }] },
        tarifas_condicion: { data: [{ condicion: "operable" }] },
        tarifas_horario: { data: [{ horario: "diurno" }] },
        tarifas_dia: { data: [{ dia: "habil" }] },
        tarifas_config: {
          data: {
            id: true,
            tarifa_hora: 120,
            tope_factor_variable: 2,
            nombre_version: "RT-12",
            estado: "vigente",
            vigente_desde: "2026-07-14T00:00:00.000Z",
            notas: null,
            actualizado_por_admin_id: "admin-1"
          }
        },
        admins: { data: { id: "admin-1", nombre: "Torre Control" } },
        certificacion_pago_conductor: { data: [{ certificacion: "basico", porcentaje: 70 }] }
      },
      rpcs: { admin_tiene_permiso: { data: true } }
    });

    await expect(obtenerConfiguracionTarifas(cliente as never)).resolves.toMatchObject({
      vehiculo: [{ id: "tv1" }],
      gama: [{ gama: "media" }],
      condicion: [{ condicion: "operable" }],
      horario: [{ horario: "diurno" }],
      dia: [{ dia: "habil" }],
      config: { tarifa_hora: 120 },
      certificacionPago: [{ porcentaje: 70 }],
      adminActualizacion: { id: "admin-1", nombre: "Torre Control" }
    });
  });

  it("actualiza tarifas de vehículo con admin actual y bloquea negativos", async () => {
    const cliente = crearClienteFake({
      tablas: { admins: { data: { id: "admin-1" } }, tarifas_vehiculo: { data: [{ id: "tarifa-1" }] } },
      rpcs: { admin_tiene_permiso: { data: true } }
    });

    await expect(actualizarTarifaVehiculo(cliente as never, "tarifa-1", { base: -1, por_km: 10 })).rejects.toThrow(
      "Base y $/km deben ser mayores o iguales a 0."
    );

    await actualizarTarifaVehiculo(cliente as never, "tarifa-1", { base: 900, por_km: 18 });

    expect(cliente.llamadas).toContainEqual({
      table: "tarifas_vehiculo",
      action: "update",
      args: [{ base: 900, por_km: 18, actualizado_por_admin_id: "admin-1" }]
    });
  });

  it("avisa con un mensaje claro cuando el UPDATE no afecta ninguna fila (bloqueo silencioso de RLS)", async () => {
    const cliente = crearClienteFake({
      tablas: { admins: { data: { id: "admin-1" } }, tarifas_vehiculo: { data: [] } },
      rpcs: { admin_tiene_permiso: { data: true } }
    });

    await expect(actualizarTarifaVehiculo(cliente as never, "tarifa-1", { base: 900, por_km: 18 })).rejects.toThrow(
      /permisos de administrador/
    );
  });

  it("valida factores y configuración antes de escribir", async () => {
    const cliente = crearClienteFake({
      tablas: {
        admins: { data: { id: "admin-1" } },
        tarifas_gama: { data: [{ gama: "premium" }] },
        tarifas_config: { data: [{ id: true }] }
      },
      rpcs: { admin_tiene_permiso: { data: true } }
    });

    await expect(actualizarFactorGama(cliente as never, "premium", 0)).rejects.toThrow("El factor debe ser mayor a 0.");
    await expect(actualizarConfigTarifas(cliente as never, { tarifa_hora: 50, tope_factor_variable: 0.5 })).rejects.toThrow(
      "El tope del factor variable debe ser mayor o igual a 1."
    );

    await actualizarFactorGama(cliente as never, "premium", 1.4);
    await actualizarConfigTarifas(cliente as never, { tarifa_hora: 150, tope_factor_variable: 2 });

    expect(cliente.llamadas).toContainEqual({
      table: "tarifas_gama",
      action: "update",
      args: [{ factor: 1.4, actualizado_por_admin_id: "admin-1" }]
    });
    expect(cliente.llamadas).toContainEqual({
      table: "tarifas_config",
      action: "update",
      args: [{ tarifa_hora: 150, tope_factor_variable: 2, actualizado_por_admin_id: "admin-1" }]
    });
  });

  it("guarda distancia/tiempo no negativos y delega sugerencia al RPC", async () => {
    const cliente = crearClienteFake({
      tablas: { traslados: {}, admins: { data: { id: "admin-1", rol_operativo: "finanzas" } } },
      rpcs: { admin_tiene_permiso: { data: true }, admin_sugerir_tarifa_traslado: { data: 3450 } }
    });

    await expect(guardarDistanciaYTiempoTraslado(cliente as never, "traslado-1", { distancia_km: -1, tiempo_estimado_horas: 1 })).rejects.toThrow(
      "Distancia y tiempo deben ser mayores o iguales a 0."
    );

    await guardarDistanciaYTiempoTraslado(cliente as never, "traslado-1", { distancia_km: 12.5, tiempo_estimado_horas: 0.75 });
    await expect(sugerirTarifaTraslado(cliente as never, "traslado-1")).resolves.toBe(3450);

    expect(cliente.llamadas).toContainEqual({
      table: "traslados",
      action: "update",
      args: [{ distancia_km: 12.5, tiempo_estimado_horas: 0.75 }]
    });
    expect(cliente.rpc).toHaveBeenCalledWith("admin_sugerir_tarifa_traslado", { p_traslado_id: "traslado-1" });
  });

  it("rechaza tarifa normativa nula del RPC", async () => {
    const cliente = crearClienteFake({
      tablas: { admins: { data: { id: "admin-1", rol_operativo: "finanzas" } } },
      rpcs: { admin_tiene_permiso: { data: true }, admin_sugerir_tarifa_traslado: { data: null } }
    });

    await expect(sugerirTarifaTraslado(cliente as never, "traslado-1")).rejects.toThrow(
      "No se pudo calcular una tarifa normativa para este traslado."
    );
  });

  it("simula la tarifa normativa sin tocar traslados reales", () => {
    const configuracion = {
      vehiculo: [{ id: "tv1", categoria: "ligero_a", rango: "rango_4", base: 750, por_km: 7 }],
      gama: [{ gama: "entrada", factor: 1 }],
      condicion: [{ condicion: "seminueva", factor: 1 }],
      horario: [{ horario: "diurno", factor: 1 }],
      dia: [{ dia: "entre_semana", factor: 1 }],
      config: {
        id: true,
        tarifa_hora: 21.5,
        tope_factor_variable: 2,
        nombre_version: "RT-12",
        estado: "vigente",
        vigente_desde: "2026-07-14T00:00:00.000Z",
        notas: null,
        actualizado_en: "2026-07-14T00:00:00.000Z",
        actualizado_por_admin_id: "admin-1"
      },
      certificacionPago: [],
      adminActualizacion: { id: "admin-1", nombre: "Torre Control" }
    };

    expect(simularTarifaNormativa(configuracion as never, {
      categoria: "ligero_a",
      gama: "entrada",
      condicion: "seminueva",
      horario: "diurno",
      dia: "entre_semana",
      distanciaKm: 196,
      tiempoHoras: 2.33
    })).toMatchObject({
      rango: "rango_4",
      tarifa: 2172.09
    });
  });
});
