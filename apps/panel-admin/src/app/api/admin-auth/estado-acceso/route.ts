import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { crearClienteServidor } from "../../../../lib/supabase-server";
import { crearClienteServiceRole } from "../../../../lib/supabase-service-role";
import { normalizarError, registrarEvento } from "@ruum/api/services";

type Recurso = "usuario" | "conductor";
type Accion = "suspender" | "reactivar" | "baja";

function esRecurso(valor: unknown): valor is Recurso {
  return valor === "usuario" || valor === "conductor";
}

function esAccion(valor: unknown): valor is Accion {
  return valor === "suspender" || valor === "reactivar" || valor === "baja";
}

async function obtenerAuthUserId(serviceRole: ReturnType<typeof crearClienteServiceRole>, recurso: Recurso, id: string) {
  const tabla = recurso === "usuario" ? "usuarios" : "conductores";
  const { data, error } = await serviceRole.from(tabla).select("auth_user_id").eq("id", id).maybeSingle();
  if (error) throw error;
  return data?.auth_user_id ?? null;
}

async function crearClientePermisos(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return crearClienteServidor();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase no está configurado: define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  }

  return createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function POST(request: Request) {
  try {
    const cliente = await crearClientePermisos(request);
    const serviceRole = crearClienteServiceRole();
    const body = await request.json() as Record<string, unknown>;
    const recurso = body.recurso;
    const accion = body.accion;
    const id = typeof body.id === "string" ? body.id : "";
    const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";

    if (!esRecurso(recurso) || !esAccion(accion) || !id) {
      return NextResponse.json({ error: "SOLICITUD_INVALIDA" }, { status: 400 });
    }

    const permiso = recurso === "usuario" ? "usuarios:validar" : "conductores:sancionar";
    const { data: tienePermiso, error: errorPermiso } = await cliente.rpc("admin_tiene_permiso", { p_permiso: permiso });
    if (errorPermiso) throw errorPermiso;
    if (!tienePermiso) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const authUserId = await obtenerAuthUserId(serviceRole, recurso, id);
    if (!authUserId) {
      return NextResponse.json({ error: "AUTH_USER_NO_ENCONTRADO" }, { status: 404 });
    }

    if (recurso === "usuario") {
      const estado = accion === "reactivar" ? "activa" : accion === "baja" ? "cerrada" : "suspendida";
      const { error } = await cliente.rpc("admin_actualizar_estado_cuenta_usuario" as never, {
        p_usuario_id: id,
        p_estado: estado,
        p_motivo: motivo || null
      } as never);
      if (error) throw error;
    }

    const banDuration = accion === "reactivar" ? "none" : "876000h";
    const { error: errorAuth } = await serviceRole.auth.admin.updateUserById(authUserId, { ban_duration: banDuration } as never);
    if (errorAuth) throw errorAuth;

    await registrarEvento(cliente, `${recurso}_${accion}_auth` as never, "admin", id, {
      motivo,
      auth_user_id: "[REDACTED]",
      auth_revocado: accion !== "reactivar"
    });

    return NextResponse.json({ ok: true, authRevocado: accion !== "reactivar" }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const normalizado = normalizarError(e);
    return NextResponse.json({ error: normalizado.codigo, mensaje: normalizado.message }, { status: 500 });
  }
}
