import { NextResponse } from "next/server";
import { crearClienteServidor } from "../../../../lib/supabase-server";
import { crearClienteServiceRole } from "../../../../lib/supabase-service-role";
import { normalizarError } from "@ruum/api/services";

export async function GET(request: Request) {
  try {
    const cliente = await crearClienteServidor();
    const serviceRole = crearClienteServiceRole();
    const { searchParams } = new URL(request.url);
    const solicitudId = searchParams.get("solicitud") ?? "";

    if (!solicitudId) {
      return NextResponse.json({ error: "SOLICITUD_REQUERIDA" }, { status: 400 });
    }

    const { data: tienePermiso, error: errorPermiso } = await cliente.rpc("admin_tiene_permiso", { p_permiso: "conductores:leer" });
    if (errorPermiso) throw errorPermiso;
    if (!tienePermiso) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { data: solicitud, error: errorSolicitud } = await serviceRole
      .from("solicitudes_conductor")
      .select("auth_user_id")
      .eq("id", solicitudId)
      .maybeSingle();
    if (errorSolicitud) throw errorSolicitud;
    if (!solicitud?.auth_user_id) {
      return NextResponse.json({ correo: null }, { headers: { "cache-control": "no-store" } });
    }

    const { data, error } = await serviceRole.auth.admin.getUserById(solicitud.auth_user_id);
    if (error) throw error;

    return NextResponse.json(
      { correo: data.user?.email?.toLowerCase() ?? null },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    const normalizado = normalizarError(e);
    return NextResponse.json({ error: normalizado.codigo, mensaje: normalizado.message }, { status: 500 });
  }
}
