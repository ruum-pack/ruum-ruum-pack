import { NextResponse } from "next/server";
import type { Database } from "@ruum/shared/types";
import { normalizarError } from "@ruum/api/services";
import { crearClienteServidor } from "../../../../lib/supabase-server";
import { crearClienteServiceRole } from "../../../../lib/supabase-service-role";

type RolAdminOperativo = Database["public"]["Enums"]["rol_admin_operativo"];

const ROLES_ADMIN: RolAdminOperativo[] = ["operador", "supervisor", "finanzas", "compliance", "direccion"];
const LOGIN_ADMIN_URL = `${process.env.NEXT_PUBLIC_PANEL_ADMIN_URL ?? "https://admin.ruumruum.mx"}/login`;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM ?? "Ruum Ruum <onboarding@ruumruum.mx>";

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function correo(valor: unknown) {
  return texto(valor).toLowerCase();
}

function rolAdmin(valor: unknown): RolAdminOperativo {
  return ROLES_ADMIN.includes(valor as RolAdminOperativo) ? valor as RolAdminOperativo : "operador";
}

function generarPasswordTemporal() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const base = Buffer.from(bytes).toString("base64url").slice(0, 18);
  return `${base}A7!`;
}

async function enviarCorreoPasswordTemporal(parametros: {
  email: string;
  nombre: string;
  rol: RolAdminOperativo;
  passwordTemporal: string;
}) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY no esta configurado para enviar la contraseña temporal.");
  }

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: parametros.email,
      subject: "Tu acceso temporal al panel admin de Ruum Ruum",
      text: [
        `Hola ${parametros.nombre},`,
        "",
        "Creamos tu acceso operativo al panel admin de Ruum Ruum.",
        "",
        `Correo: ${parametros.email}`,
        `Rol inicial: ${parametros.rol}`,
        `Contraseña temporal: ${parametros.passwordTemporal}`,
        `Acceso: ${LOGIN_ADMIN_URL}`,
        "",
        "Por seguridad, entra con esta contraseña temporal y cámbiala desde tu cuenta lo antes posible.",
        "",
        "Si no esperabas este correo, contacta al equipo de Dirección de Ruum Ruum."
      ].join("\n")
    })
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => ({})) as { message?: string; error?: string };
    throw new Error(detalle.message ?? detalle.error ?? "No se pudo enviar el correo de acceso temporal.");
  }
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

    const passwordTemporal = generarPasswordTemporal();
    const { data: cuenta, error: errorCuenta } = await serviceRole.auth.admin.createUser({
      email,
      password: passwordTemporal,
      email_confirm: true,
      user_metadata: {
        tipo_cuenta: "admin",
        rol_operativo: rol,
        nombre
      }
    });
    if (errorCuenta) {
      if (/already|registered|exists|existe|registrad/i.test(errorCuenta.message)) {
        return NextResponse.json({ error: "CORREO_YA_REGISTRADO" }, { status: 409 });
      }
      throw errorCuenta;
    }
    if (!cuenta.user?.id) throw new Error("Auth no devolvio el usuario creado.");

    const { data: admin, error: errorAdmin } = await serviceRole
      .from("admins")
      .insert({
        auth_user_id: cuenta.user.id,
        nombre,
        rol_operativo: rol
      })
      .select("id,nombre,rol_operativo,creado_en")
      .single();
    if (errorAdmin) {
      await serviceRole.auth.admin.deleteUser(cuenta.user.id);
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
    if (errorAuditoria) {
      await serviceRole.from("admins").delete().eq("id", admin.id);
      await serviceRole.auth.admin.deleteUser(cuenta.user.id);
      throw errorAuditoria;
    }

    try {
      await enviarCorreoPasswordTemporal({ email, nombre, rol, passwordTemporal });
    } catch (errorCorreo) {
      await serviceRole.from("admins").delete().eq("id", admin.id);
      await serviceRole.auth.admin.deleteUser(cuenta.user.id);
      throw errorCorreo;
    }

    return NextResponse.json({ admin }, { status: 201 });
  } catch (e) {
    const normalizado = normalizarError(e);
    return NextResponse.json({ error: normalizado.codigo, mensaje: normalizado.message }, { status: 500 });
  }
}
