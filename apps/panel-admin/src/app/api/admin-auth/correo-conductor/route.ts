import { NextResponse } from "next/server";
import { crearClienteServidor } from "../../../../lib/supabase-server";
import { crearClienteServiceRole } from "../../../../lib/supabase-service-role";
import { normalizarError, tienePermisoAdmin } from "@ruum/api/services";
import { obtenerAuthUserIdSolicitudConductorService } from "@ruum/api/identity";

export async function GET(request: Request) {
  try {
    const cliente = await crearClienteServidor();
    const serviceRole = crearClienteServiceRole();
    const { searchParams } = new URL(request.url);
    const solicitudId = searchParams.get("solicitud") ?? "";

    if (!solicitudId) {
      return NextResponse.json({ error: "SOLICITUD_REQUERIDA" }, { status: 400 });
    }

    if (!(await tienePermisoAdmin(cliente, "conductores:leer"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const authUserId = await obtenerAuthUserIdSolicitudConductorService(serviceRole, solicitudId);
    if (!authUserId) {
      return NextResponse.json({ correo: null }, { headers: { "cache-control": "no-store" } });
    }

    const { data, error } = await serviceRole.auth.admin.getUserById(authUserId);
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
