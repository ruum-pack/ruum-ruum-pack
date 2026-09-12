import { NextResponse } from "next/server";
import { crearClienteServidor } from "../../../lib/supabase-server";
import { normalizarError, tienePermisoAdmin } from "@ruum/api/services";
import { listarAuditoriaSeguridad, listarExportacionesAdmin } from "@ruum/api/operations";

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

    if (!(await tienePermisoAdmin(cliente, "auditoria:leer").catch(() => false))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));
    const tipo = url.searchParams.get("tipo") || "";
    const busqueda = url.searchParams.get("busqueda") || "";

    const { eventos, total } = await listarAuditoriaSeguridad(cliente, { page, pageSize, tipo, busqueda });

    const eventosSanitizados = (eventos ?? []).map((e) => ({
      ...e,
      datos: sanitizarDatos(e.datos),
      auth_user_id: "[REDACTED]"
    }));

    const { exportaciones } = await listarExportacionesAdmin(cliente, 50);

    return NextResponse.json({
      eventos: eventosSanitizados,
      exportaciones: exportaciones ?? [],
      paginacion: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const normalizado = normalizarError(e);
    return NextResponse.json({ error: normalizado.codigo, mensaje: normalizado.message }, { status: 500 });
  }
}
