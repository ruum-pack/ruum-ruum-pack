import { NextResponse } from "next/server";
import { crearClienteServidor } from "../../../../lib/supabase-server";
import { crearClienteServiceRole } from "../../../../lib/supabase-service-role";
import { normalizarError, registrarEvento } from "@ruum/api/services";

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function textoONull(valor: unknown) {
  const limpio = texto(valor);
  return limpio ? limpio : null;
}

function correo(valor: unknown) {
  return texto(valor).toLowerCase();
}

export async function POST(request: Request) {
  try {
    const cliente = await crearClienteServidor();
    const serviceRole = crearClienteServiceRole();
    const body = await request.json() as Record<string, unknown>;
    const email = correo(body.correo);

    const { data: tienePermiso, error: errorPermiso } = await cliente.rpc("admin_tiene_permiso", { p_permiso: "conductores:validar" });
    if (errorPermiso) throw errorPermiso;
    if (!tienePermiso) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "CORREO_INVALIDO" }, { status: 400 });
    }

    const nombre = texto(body.nombre);
    const telefono = texto(body.telefono);
    const curp = texto(body.curp).toUpperCase();
    const licenciaNumero = texto(body.licencia_numero);
    if (!nombre || !telefono || !curp || !licenciaNumero) {
      return NextResponse.json({ error: "DATOS_CONDUCTOR_INCOMPLETOS" }, { status: 400 });
    }

    const { data: invitacion, error: errorInvitacion } = await serviceRole.auth.admin.inviteUserByEmail(email, {
      data: {
        tipo_cuenta: "conductor",
        nombre,
        telefono
      }
    });
    if (errorInvitacion) throw errorInvitacion;
    if (!invitacion.user?.id) throw new Error("Auth no devolvio el usuario invitado.");

    const { data: conductor, error: errorConductor } = await serviceRole
      .from("conductores")
      .insert({
        auth_user_id: invitacion.user.id,
        estado: "activo",
        nombre,
        telefono,
        curp,
        licencia_numero: licenciaNumero,
        licencia_tipo: texto(body.licencia_tipo),
        licencia_vigencia: texto(body.licencia_vigencia),
        codigo_postal: textoONull(body.codigo_postal),
        estado_residencia: textoONull(body.estado_residencia),
        ciudad_municipio: textoONull(body.ciudad_municipio),
        colonia: textoONull(body.colonia),
        calle: textoONull(body.calle),
        numero: textoONull(body.numero),
        referencias: textoONull(body.referencias),
        contacto_emergencia_nombre: texto(body.contacto_emergencia_nombre),
        contacto_emergencia_telefono: texto(body.contacto_emergencia_telefono)
      })
      .select("*")
      .single();
    if (errorConductor) {
      await serviceRole.auth.admin.deleteUser(invitacion.user.id);
      if (errorConductor.code === "23505") {
        return NextResponse.json({ error: "CONDUCTOR_DUPLICADO" }, { status: 409 });
      }
      throw errorConductor;
    }

    await registrarEvento(cliente, "creacion_conductor" as never, "admin", conductor.id, {
      accion: "invitacion_auth_segura",
      auth_user_id: "[REDACTED]"
    });

    return NextResponse.json({ conductor, authUserId: invitacion.user.id }, { status: 201 });
  } catch (e) {
    const normalizado = normalizarError(e);
    return NextResponse.json({ error: normalizado.codigo, mensaje: normalizado.message }, { status: 500 });
  }
}
