import { describe, expect, it, vi } from "vitest";
import {
  construirItemsAtencion,
  listarAtencionPrioritaria,
  obtenerKpisTorre,
  obtenerTimelineTraslado,
  ordenarTimeline,
  type ContextoAtencion
} from "./torre";

vi.mock("../../services/traslados", () => ({ listarHistorialTraslado: vi.fn() }));
vi.mock("../../services/asignaciones", () => ({ listarHistorialAsignaciones: vi.fn() }));

import { listarHistorialTraslado } from "../../services/traslados";
import { listarHistorialAsignaciones } from "../../services/asignaciones";

function cadena(resultado: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "not", "in", "gte", "lte", "gt", "lt", "order", "limit", "range"]) {
    c[m] = () => c;
  }
  c["then"] = (ok: (v: unknown) => unknown) => Promise.resolve(resultado).then(ok);
  return c;
}

function clienteMock(respuestas: Record<string, unknown>) {
  return { from: (tabla: string) => cadena(respuestas[tabla] ?? { data: [], error: null }) };
}

const TRASLADOS = [
  {
    id: "t1", estado: "traslado_en_curso", estado_operativo: "in_transit", conductor_id: "c1",
    usuario_id: "u1", operation_id: null, tiene_incidencia_abierta: true,
    actualizado_en: "2026-09-09T10:00:00Z", creado_en: "2026-09-09T08:00:00Z",
    origen_ciudad: "CDMX", fecha_hora_programada: null, modalidad_programacion: null
  },
  {
    id: "t2", estado: "pendiente_de_conductor", estado_operativo: "planned", conductor_id: null,
    usuario_id: "u1", operation_id: "op1", tiene_incidencia_abierta: false,
    actualizado_en: "2026-09-07T10:00:00Z", creado_en: "2026-09-07T08:00:00Z",
    origen_ciudad: "CDMX", fecha_hora_programada: null, modalidad_programacion: null
  }
];

function contextoVacio(): ContextoAtencion {
  return { tracking: new Map(), slaPorTraslado: new Map(), rechazadas: new Set(), operaciones: new Map() };
}

describe("torre: priorización pura", () => {
  it("incidencia supera a sin-conductor y ordena por prioridad", () => {
    const items = construirItemsAtencion(TRASLADOS, contextoVacio(), Date.parse("2026-09-10T10:00:00Z"));
    expect(items).toHaveLength(2);
    expect(items[0].trasladoId).toBe("t1");
    expect(items[0].prioridad).toBe(100);
    expect(items[1].motivo).toContain("Sin conductor");
  });

  it("ignora traslados sin motivo de atención", () => {
    const items = construirItemsAtencion(
      [{ ...TRASLADOS[1], estado: "conductor_asignado", estado_operativo: "assigned", conductor_id: "c9", actualizado_en: "2026-09-10T09:00:00Z" }],
      contextoVacio(),
      Date.parse("2026-09-10T10:00:00Z")
    );
    expect(items).toHaveLength(0);
  });

  it("ordena timeline descendente", () => {
    const ordenados = ordenarTimeline([
      { fecha: "2026-09-08T00:00:00Z", tipo: "estado", titulo: "a", detalle: null },
      { fecha: "2026-09-09T00:00:00Z", tipo: "asignacion", titulo: "b", detalle: null }
    ]);
    expect(ordenados[0].titulo).toBe("b");
  });
});

describe("torre: KPIs con cliente mock", () => {
  const respuestas = {
    traslados: { data: TRASLADOS, error: null },
    operaciones: { count: 2, error: null },
    asignaciones: { data: [], error: null },
    tracking_salud_traslado: { data: [], error: null },
    alertas_sla_operacionales: {
      data: [{ traslado_id: "t1", categoria: "sla_vencido" }],
      error: null
    }
  };

  it("cuenta KPIs básicos", async () => {
    const kpis = await obtenerKpisTorre(clienteMock(respuestas) as never, {});
    expect(kpis.trasladosActivos).toBe(2);
    expect(kpis.sinConductor).toBe(1);
    expect(kpis.incidenciasAbiertas).toBe(1);
    expect(kpis.operacionesActivas).toBe(2);
    expect(kpis.slaVencido).toBe(1);
    expect(kpis.conductoresSinSenal).toBe(1);
  });

  it("lista atención con SLA y tracking del mock", async () => {
    const items = await listarAtencionPrioritaria(clienteMock(respuestas) as never, {});
    expect(items[0].trasladoId).toBe("t1");
    expect(items[0].prioridad).toBe(100);
  });

  it("filtra por empresa resolviendo usuarios primero", async () => {
    const conUsuarios = {
      ...respuestas,
      usuarios: { data: [], error: null }
    };
    const kpis = await obtenerKpisTorre(clienteMock(conUsuarios) as never, { empresaId: "e-sin-usuarios" });
    expect(kpis.trasladosActivos).toBe(0);
  });
});

describe("torre: timeline fusionado", () => {
  it("fusiona historial y asignaciones", async () => {
    vi.mocked(listarHistorialTraslado).mockResolvedValue([
      {
        id: "h1", traslado_id: "t1", estado_anterior: "solicitud_creada", estado_nuevo: "cotizacion_generada",
        operativo_anterior: "requested", operativo_nuevo: "requested", actor_id: null,
        actor_tipo: "sistema", motivo: null, metadata: {}, creado_en: "2026-09-08T00:00:00Z"
      }
    ]);
    vi.mocked(listarHistorialAsignaciones).mockResolvedValue([
      {
        id: "a1", traslado_id: "t1", conductor_id: "c1c1c1c1", estado: "aceptada",
        origen: "manual", creado_en: "2026-09-09T00:00:00Z"
      } as never
    ]);
    const eventos = await obtenerTimelineTraslado({} as never, "t1");
    expect(eventos).toHaveLength(2);
    expect(eventos[0].tipo).toBe("asignacion");
    expect(eventos[1].tipo).toBe("estado");
  });
});
