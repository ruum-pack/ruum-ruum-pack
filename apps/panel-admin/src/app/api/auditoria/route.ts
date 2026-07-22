import { NextResponse } from "next/server";
import { crearClienteServidor } from "../../../lib/supabase-server";
import { normalizarError } from "@ruum/api/services";

const CAMPOS_SENSIBLES_VISUALIZACION = new Set([
  "auth_user_id", "token", "secret", "password", "cvv", "card_number",
  "numero_tarjeta", "cvv2", "pin", "refresh_token", "session_id",
  "cookie", "authorization", "api_key", "api_secret"
]);

function sanitizarDatos(datos: unknown): unknown {
  if (typeof datos !== "object" || datos === null) return datos;
  if (Array.isArray(datos)) return datos.map(sanitizarDatos);
  const entrada = datos as Record<string, unknown>;
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(entrada)) {
    if (CAMPOS_SENSIBLES_VISUALIZACION.has(clave)) {
      salida[clave] = "[REDACTED]";
    } else if (typeof valor === "object" && valor !== null) {
      salida[clave] = sanitizarDatos(valor);
    } else {
      salida[clave] = valor;
    }
  }
  return salida;
}

export async function GET(request: Request) {
  try {
    const cliente = await crearClienteServidor();
    const url = new URL(request.url);

    const { data: tienePermiso } = await cliente.rpc("admin_tiene_permiso", { p_permiso: "auditoria:leer" });
    if (!tienePermiso) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));
    const tipo = url.searchParams.get("tipo") || "";
    const busqueda = url.searchParams.get("busqueda") || "";

    let query = cliente.from("auditoria_admin_seguridad").select("*", { count: "exact" });

    if (tipo && tipo !== "todas") {
      if (tipo === "denegado") {
        query = query.ilike("tipo", "%denegado%");
      } else {
        query = query.eq("tipo", tipo);
      }
    }

    if (busqueda.trim()) {
      const q = `%${busqueda.trim()}%`;
      query = query.or(`recurso.ilike.${q},accion.ilike.${q},rol.ilike.${q},motivo.ilike.${q}`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: eventos, error, count } = await query
      .order("creado_en", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const eventosSanitizados = (eventos ?? []).map((e) => ({
      ...e,
      datos: sanitizarDatos(e.datos),
      auth_user_id: "[REDACTED]"
    }));

    let exportacionesQuery = cliente.from("exportaciones_admin").select("*", { count: "exact" });
    const { data: exportaciones, error: expError, count: expCount } = await exportacionesQuery
      .order("creada_en", { ascending: false })
      .limit(50);

    if (expError) throw expError;

    return NextResponse.json({
      eventos: eventosSanitizados,
      exportaciones: exportaciones ?? [],
      paginacion: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize)
      }
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const normalizado = normalizarError(e);
    return NextResponse.json({ error: normalizado.codigo, mensaje: normalizado.message }, { status: 500 });
  }
}
