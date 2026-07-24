import { NextResponse } from "next/server";
import { crearClienteServidor } from "../../../../lib/supabase-server";
import { crearClienteServiceRole } from "../../../../lib/supabase-service-role";
import { normalizarError, registrarEvento } from "@ruum/api/services";

type TipoCuenta = "personal" | "empresa";
type PerfilEmpresa = "administrador_flota" | "usuario_final" | "finanzas";

function normalizarCorreo(valor: unknown) {
  return typeof valor === "string" ? valor.trim().toLowerCase() : "";
}

function normalizarTexto(valor: unknown) {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

function tipoCuenta(valor: unknown): TipoCuenta {
  return valor === "empresa" ? "empresa" : "personal";
}

function perfilEmpresa(valor: unknown): PerfilEmpresa {
  if (valor === "administrador_flota" || valor === "finanzas") return valor;
  return "usuario_final";
}

export async function POST(request: Request) {
  try {
    const cliente = await crearClienteServidor();
    const serviceRole = crearClienteServiceRole();
    const body = await request.json() as Record<string, unknown>;
    const correo = normalizarCorreo(body.correo);
    const nombre = normalizarTexto(body.nombre);
    const cuenta = tipoCuenta(body.tipoCuenta);
    const perfil = cuenta === "empresa" ? perfilEmpresa(body.perfilEmpresa) : null;
    const rolUsuario = cuenta === "empresa" && perfil === "administrador_flota" ? "titular_empresa" : cuenta === "empresa" ? "usuario_autorizado" : "personal";

    const { data: tienePermiso, error: errorPermiso } = await cliente.rpc("admin_tiene_permiso", { p_permiso: "usuarios:validar" });
    if (errorPermiso) throw errorPermiso;
    if (!tienePermiso) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return NextResponse.json({ error: "CORREO_INVALIDO" }, { status: 400 });
    }

    const { data: existente } = await serviceRole.auth.admin.listUsers();
    const usuarioAuthExistente = existente.users.find((usuario) => usuario.email?.toLowerCase() === correo);
    if (usuarioAuthExistente) {
      return NextResponse.json({ error: "CORREO_YA_REGISTRADO" }, { status: 409 });
    }

    const { data: invitacion, error: errorInvitacion } = await serviceRole.auth.admin.inviteUserByEmail(correo, {
      data: {
        tipo_cuenta: cuenta,
        rol: rolUsuario,
        perfil_empresa: perfil,
        nombre
      }
    });
    if (errorInvitacion) throw errorInvitacion;
    if (!invitacion.user?.id) throw new Error("Auth no devolvio el usuario invitado.");

    const { data: usuario, error: errorUsuario } = await serviceRole
      .from("usuarios")
      .upsert({
        auth_user_id: invitacion.user.id,
        tipo_cuenta: cuenta,
        rol: rolUsuario,
        estado_verificacion: "pendiente",
        nombre,
        correo_facturacion: correo,
        metodo_pago_registrado: false
      }, { onConflict: "auth_user_id" })
      .select("id")
      .single();
    if (errorUsuario) throw errorUsuario;

    await registrarEvento(cliente, "creacion_cuenta" as never, "admin", usuario.id, {
      tipo: "invitacion_auth_usuario",
      tipo_cuenta: cuenta,
      perfil_empresa: perfil,
      rol_usuario: rolUsuario,
      auth_user_id: "[REDACTED]"
    });

    return NextResponse.json({ usuarioId: usuario.id, authUserId: invitacion.user.id }, { status: 201 });
  } catch (e) {
    const normalizado = normalizarError(e);
    return NextResponse.json({ error: normalizado.codigo, mensaje: normalizado.message }, { status: 500 });
  }
}
