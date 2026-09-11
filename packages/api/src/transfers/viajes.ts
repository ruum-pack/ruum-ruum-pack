import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminAnyPermission, assertAdminPermission } from "../services/permisos-admin";
import {
  columnaOrdenPasaporte,
  esRecursoSupabasePendiente,
  esRpcNoEncontrado,
  esRpcPaginacionNoDisponible
} from "../operations/infrastructure/supabase-errores";

type Cliente = SupabaseClient<Database>;
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export interface PaginacionViajes {
  data: PasaporteRow[];
  paginacion: {
    pagina: number;
    tamano: number;
    total: number;
    total_paginas: number;
  };
}

/** PRD §17.4 — lista de viajes con paginación de servidor. */
export async function listarViajesAdmin(cliente: Cliente, filtro: EstadoTraslado | "todos"): Promise<PasaporteRow[]> {
  await assertAdminPermission(cliente, "viajes:leer");
  let query = cliente.from("pasaporte_digital").select("*").order("creado_en", { ascending: false });
  if (filtro !== "todos") {
    query = query.eq("estado", filtro);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listarViajesAdminPaginados(
  cliente: Cliente,
  pagina: number,
  tamano: number,
  filtroEstado: EstadoTraslado | "todos",
  busqueda?: string,
  ordenColumna?: string,
  ordenDireccion?: string
): Promise<PaginacionViajes> {
  await assertAdminPermission(cliente, "viajes:leer");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "listar_viajes_admin_paginados",
    args: {
      p_pagina: number;
      p_tamano: number;
      p_filtro_estado: string;
      p_busqueda?: string;
      p_orden_columna?: string;
      p_orden_direccion?: string;
    }
  ) => Promise<{ data: PaginacionViajes | null; error: unknown }>;
  const { data, error } = await rpc("listar_viajes_admin_paginados", {
    p_pagina: pagina,
    p_tamano: tamano,
    p_filtro_estado: filtroEstado,
    p_busqueda: busqueda?.trim() || undefined,
    p_orden_columna: ordenColumna,
    p_orden_direccion: ordenDireccion
  });
  if (error && esRpcPaginacionNoDisponible(error)) {
    return listarViajesAdminPaginadosFallback(cliente, pagina, tamano, filtroEstado, busqueda, ordenColumna, ordenDireccion);
  }
  if (error) throw error;
  if (!data) return { data: [], paginacion: { pagina: 1, tamano: 25, total: 0, total_paginas: 0 } };
  return data;
}

async function listarViajesAdminPaginadosFallback(
  cliente: Cliente,
  pagina: number,
  tamano: number,
  filtroEstado: EstadoTraslado | "todos",
  busqueda?: string,
  ordenColumna?: string,
  ordenDireccion?: string
): Promise<PaginacionViajes> {
  const paginaNormalizada = Math.max(pagina, 1);
  const tamanoNormalizado = Math.min(Math.max(tamano, 1), 100);
  const desde = (paginaNormalizada - 1) * tamanoNormalizado;
  const hasta = desde + tamanoNormalizado - 1;
  const columna = columnaOrdenPasaporte(ordenColumna);
  const ascending = ordenDireccion === "asc";

  let query = cliente
    .from("pasaporte_digital")
    .select("*", { count: "exact" })
    .order(columna, { ascending, nullsFirst: false })
    .range(desde, hasta);

  if (filtroEstado !== "todos") {
    query = query.eq("estado", filtroEstado);
  }

  const termino = busqueda?.trim();
  if (termino) {
    const patron = termino.replace(/%/g, "\\%").replace(/,/g, "\\,");
    query = query.or([
      `origen_ciudad.ilike.%${patron}%`,
      `destino_ciudad.ilike.%${patron}%`,
      `vehiculo_marca.ilike.%${patron}%`,
      `vehiculo_modelo.ilike.%${patron}%`,
      `vehiculo_placas.ilike.%${patron}%`,
      `conductor_nombre.ilike.%${patron}%`
    ].join(","));
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const total = count ?? data?.length ?? 0;
  return {
    data: data ?? [],
    paginacion: {
      pagina: paginaNormalizada,
      tamano: tamanoNormalizado,
      total,
      total_paginas: total === 0 ? 0 : Math.ceil(total / tamanoNormalizado)
    }
  };
}
