import type { SupabaseClient } from "@supabase/supabase-js";
import {
  esTransicionOperacionValida,
  type DatosNuevaOperacion,
  type EstadoOperacion,
  type Operacion,
  type ResumenOperacional
} from "@ruum/shared/types";

// FASE 1 — Repositorio de Operaciones (Torre de Control).
// Tabla public.operaciones; vínculo nullable traslados.operation_id.
// Se usa `from("operaciones" as never)` hasta regenerar tipos Supabase,
// mismo patrón que el resto del paquete para tablas nuevas.

type Cliente = SupabaseClient;

type FilaOperacion = Record<string, unknown> & {
  id: string;
};

const TABLA = "operaciones" as never;
const TABLA_TRASLADOS = "traslados" as never;

const ESTADOS_TRASLADO_CERRADOS = new Set([
  "servicio_cerrado",
  "servicio_cancelado",
  "traslado_fallido",
  "reclamo_resuelto",
  "disputa_resuelta",
  "cierre_operativo_con_incidencia_abierta"
]);

function exigirNombre(nombre: string): void {
  if (!nombre || btrim(nombre) === "") {
    throw new Error("El nombre de la operación es obligatorio.");
  }
}

function btrim(valor: string): string {
  return valor.trim();
}

function validarFechas(inicio: string | null | undefined, fin: string | null | undefined): void {
  if (inicio && fin && Date.parse(inicio) > Date.parse(fin)) {
    throw new Error("planned_start_at no puede ser posterior a planned_end_at.");
  }
}

export interface FiltrosOperaciones {
  empresa_id?: string | null;
  estado?: EstadoOperacion | "todas";
  busqueda?: string;
  limite?: number;
}

export async function createOperation(
  cliente: Cliente,
  datos: DatosNuevaOperacion
): Promise<Operacion> {
  exigirNombre(datos.nombre);
  validarFechas(datos.planned_start_at, datos.planned_end_at);

  const fila = {
    ...(datos.folio && btrim(datos.folio) !== "" ? { folio: datos.folio } : {}),
    empresa_id: datos.empresa_id ?? null,
    nombre: btrim(datos.nombre),
    descripcion: datos.descripcion ?? null,
    tipo: datos.tipo ?? "corporativa",
    prioridad: datos.prioridad ?? "media",
    planned_start_at: datos.planned_start_at ?? null,
    planned_end_at: datos.planned_end_at ?? null,
    responsable_interno_admin_id: datos.responsable_interno_admin_id ?? null,
    cliente_contacto_nombre: datos.cliente_contacto_nombre ?? null,
    cliente_contacto_telefono: datos.cliente_contacto_telefono ?? null,
    sla_horas: datos.sla_horas ?? null,
    metadata: datos.metadata ?? {}
  };

  const { data, error } = await (cliente as unknown as {
    from: (t: never) => {
      insert: (f: unknown) => {
        select: (c: string) => {
          single: () => Promise<{ data: Operacion | null; error: unknown }>;
        };
      };
    };
  })
    .from(TABLA)
    .insert(fila)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("No se pudo crear la operación.");
  return data;
}

export async function getOperation(cliente: Cliente, id: string): Promise<Operacion | null> {
  const { data, error } = await (cliente as unknown as {
    from: (t: never) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          maybeSingle: () => Promise<{ data: Operacion | null; error: unknown }>;
        };
      };
    };
  })
    .from(TABLA)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listOperations(
  cliente: Cliente,
  filtros: FiltrosOperaciones = {}
): Promise<Operacion[]> {
  let consulta = (cliente as unknown as {
    from: (t: never) => {
      select: (c: string) => {
        order: (col: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: Operacion[] | null; error: unknown }>;
        };
      };
    };
  })
    .from(TABLA)
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(filtros.limite ?? 100);

  void filtros;
  const { data, error } = await consulta;
  if (error) throw error;
  let filas = data ?? [];
  if (filtros.empresa_id) {
    filas = filas.filter((f) => (f as Operacion).empresa_id === filtros.empresa_id);
  }
  if (filtros.estado && filtros.estado !== "todas") {
    filas = filas.filter((f) => (f as Operacion).estado === filtros.estado);
  }
  if (filtros.busqueda && btrim(filtros.busqueda) !== "") {
    const q = filtros.busqueda.toLowerCase();
    filas = filas.filter((f) => {
      const op = f as Operacion;
      return op.nombre.toLowerCase().includes(q) || op.folio.toLowerCase().includes(q);
    });
  }
  return filas as Operacion[];
}

export async function updateOperation(
  cliente: Cliente,
  id: string,
  cambios: Partial<DatosNuevaOperacion & { estado: EstadoOperacion }>
): Promise<Operacion> {
  if (cambios.nombre !== undefined) exigirNombre(cambios.nombre);
  if (cambios.planned_start_at !== undefined || cambios.planned_end_at !== undefined) {
    const actual = await getOperation(cliente, id);
    validarFechas(
      cambios.planned_start_at !== undefined ? cambios.planned_start_at : actual?.planned_start_at,
      cambios.planned_end_at !== undefined ? cambios.planned_end_at : actual?.planned_end_at
    );
  }

  if (cambios.estado !== undefined) {
    const actual = await getOperation(cliente, id);
    if (!actual) throw new Error("Operación no encontrada.");
    if (!esTransicionOperacionValida(actual.estado, cambios.estado)) {
      throw new Error(`Transición de operación inválida: ${actual.estado} -> ${cambios.estado}.`);
    }
  }

  const { data, error } = await (cliente as unknown as {
    from: (t: never) => {
      update: (f: unknown) => {
        eq: (col: string, v: string) => {
          select: (c: string) => {
            single: () => Promise<{ data: Operacion | null; error: unknown }>;
          };
        };
      };
    };
  })
    .from(TABLA)
    .update({ ...cambios, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("No se pudo actualizar la operación.");
  return data;
}

export async function addTransferToOperation(
  cliente: Cliente,
  trasladoId: string,
  operationId: string
): Promise<void> {
  const { error } = await (cliente as unknown as {
    from: (t: never) => {
      update: (f: unknown) => {
        eq: (col: string, v: string) => Promise<{ error: unknown }>;
      };
    };
  })
    .from(TABLA_TRASLADOS)
    .update({ operation_id: operationId })
    .eq("id", trasladoId);

  if (error) throw error;
}

export async function removeTransferFromOperation(
  cliente: Cliente,
  trasladoId: string
): Promise<void> {
  const { error } = await (cliente as unknown as {
    from: (t: never) => {
      update: (f: unknown) => {
        eq: (col: string, v: string) => Promise<{ error: unknown }>;
      };
    };
  })
    .from(TABLA_TRASLADOS)
    .update({ operation_id: null })
    .eq("id", trasladoId);

  if (error) throw error;
}

export interface TrasladoDeOperacion {
  id: string;
  estado: string;
  conductor_id: string | null;
  tiene_incidencia_abierta: boolean;
}

export async function listarTrasladosDeOperacion(
  cliente: Cliente,
  operationId: string
): Promise<TrasladoDeOperacion[]> {
  const { data, error } = await (cliente as unknown as {
    from: (t: never) => {
      select: (c: string) => {
        eq: (col: string, v: string) => Promise<{
          data: TrasladoDeOperacion[] | null;
          error: unknown;
        }>;
      };
    };
  })
    .from(TABLA_TRASLADOS)
    .select("id,estado,conductor_id,tiene_incidencia_abierta")
    .eq("operation_id", operationId);

  if (error) throw error;
  return data ?? [];
}

export async function obtenerResumenOperacional(
  cliente: Cliente,
  operationId: string
): Promise<ResumenOperacional> {
  const operacion = await getOperation(cliente, operationId);
  if (!operacion) throw new Error("Operación no encontrada.");

  const traslados = await listarTrasladosDeOperacion(cliente, operationId);
  const por_estado: Record<string, number> = {};
  let con_conductor = 0;
  let con_incidencia = 0;
  let cerrados = 0;

  for (const t of traslados) {
    por_estado[t.estado] = (por_estado[t.estado] ?? 0) + 1;
    if (t.conductor_id) con_conductor += 1;
    if (t.tiene_incidencia_abierta) con_incidencia += 1;
    if (ESTADOS_TRASLADO_CERRADOS.has(t.estado)) cerrados += 1;
  }

  const total = traslados.length;
  return {
    operacion_id: operationId,
    folio: operacion.folio,
    total_traslados: total,
    por_estado,
    con_conductor,
    sin_conductor: total - con_conductor,
    con_incidencia_abierta: con_incidencia,
    avance_pct: total === 0 ? 0 : Math.round((cerrados / total) * 100)
  };
}

export function filaEsOperacion(fila: FilaOperacion): fila is FilaOperacion & Operacion {
  return typeof fila["folio"] === "string" && typeof fila["nombre"] === "string";
}
