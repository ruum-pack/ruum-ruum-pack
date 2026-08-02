import { NextResponse } from "next/server";
import type { Database } from "@ruum/shared/types";
import { normalizarError } from "@ruum/api/services";
import { crearClienteServidor } from "../../../../lib/supabase-server";
import { crearClienteServiceRole } from "../../../../lib/supabase-service-role";

type RolAdminOperativo = Database["public"]["Enums"]["rol_admin_operativo"];

const ROLES_ADMIN: RolAdminOperativo[] = ["operador", "supervisor", "finanzas", "compliance", "direccion"];

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function correo(valor: unknown) {
  return texto(valor).toLowerCase();
}

function rolAdmin(valor: unknown): RolAdminOperativo {
  return ROLES_ADMIN.includes(valor as RolAdminOperativo) ? valor as RolAdminOperativo : "operador";
}

export async function POST(request: Request) {
  try {
    const cliente = await crearClienteServidor();
    const serviceRole = crearClienteServiceRole();
    const body = await request.json() as Record<string, unknown>;

    const email = correo(body.correo);
    const nombre = texto(body.nombre);
    const rol = rolAdmin(body.rol);
    const motivo = texto(body.motivo);

    const { data: tienePermiso, error: errorPermiso } = await cliente.rpc("admin_tiene_permiso", { p_permiso: "capacidades:administrar" });
    if (errorPermiso) throw errorPermiso;
    if (!tienePermiso) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "CORREO_INVALIDO" }, { status: 400 });
    }
    if (nombre.length < 3) {
      return NextResponse.json({ error: "NOMBRE_OBLIGATORIO" }, { status: 400 });
    }
    if (motivo.length < 10) {
      return NextResponse.json({ error: "MOTIVO_MINIMO_10_CARACTERES" }, { status: 400 });
    }

    const { data: authActual, error: errorAuthActual } = await cliente.auth.getUser();
    if (errorAuthActual || !authActual.user) {
      return NextResponse.json({ error: "SESION_ADMIN_INVALIDA" }, { status: 401 });
    }

    const { data: existentes } = await serviceRole.auth.admin.listUsers();
    const usuarioAuthExistente = existentes.users.find((usuario) => usuario.email?.toLowerCase() === email);
    if (usuarioAuthExistente) {
      return NextResponse.json({ error: "CORREO_YA_REGISTRADO" }, { status: 409 });
    }

    const { data: invitacion, error: errorInvitacion } = await serviceRole.auth.admin.inviteUserByEmail(email, {
      data: {
        tipo_cuenta: "admin",
        rol_operativo: rol,
        nombre
      }
    });
    if (errorInvitacion) {
      if (/already|registered|exists|existe|registrad/i.test(errorInvitacion.message)) {
        return NextResponse.json({ error: "CORREO_YA_REGISTRADO" }, { status: 409 });
      }
      throw errorInvitacion;
    }
    if (!invitacion.user?.id) throw new Error("Auth no devolvio el usuario invitado.");

    const { data: admin, error: errorAdmin } = await serviceRole
      .from("admins")
      .insert({
        auth_user_id: invitacion.user.id,
        nombre,
        rol_operativo: rol
      })
      .select("id,nombre,rol_operativo,creado_en")
      .single();
    if (errorAdmin) {
      await serviceRole.auth.admin.deleteUser(invitacion.user.id);
      if (errorAdmin.code === "23505") {
        return NextResponse.json({ error: "ADMIN_DUPLICADO" }, { status: 409 });
      }
      throw errorAdmin;
    }

    const { data: actor } = await serviceRole
      .from("admins")
      .select("id,rol_operativo")
      .eq("auth_user_id", authActual.user.id)
      .maybeSingle();

    const { error: errorAuditoria } = await serviceRole.from("auditoria_admin_seguridad").insert({
      auth_user_id: authActual.user.id,
      admin_id: actor?.id ?? null,
      rol: actor?.rol_operativo ?? null,
      tipo: "mutacion",
      recurso: "admins",
      accion: "invitar_admin_panel",
      motivo,
      datos: {
        admin_objetivo_id: admin.id,
        rol_operativo: rol,
        correo: "[REDACTED]",
        auth_user_id: "[REDACTED]"
      }
    });
    if (errorAuditoria) throw errorAuditoria;

    return NextResponse.json({ admin, authUserId: invitacion.user.id }, { status: 201 });
  } catch (e) {
    const normalizado = normalizarError(e);
    return NextResponse.json({ error: normalizado.codigo, mensaje: normalizado.message }, { status: 500 });
  }
}
