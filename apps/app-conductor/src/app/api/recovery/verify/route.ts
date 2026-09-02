import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_RECOVERY_CONDUCTOR, COOKIE_RECOVERY_LEGACY } from "@ruum/shared/utils";
import { crearClienteServidor } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * PR-02 P0 — Verifica autorización de recuperación (conductor).
 * Misma lógica que app-usuario pero con COOKIE_RECOVERY_CONDUCTOR.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const marcador =
      cookieStore.get(COOKIE_RECOVERY_CONDUCTOR)?.value ??
      cookieStore.get(COOKIE_RECOVERY_LEGACY)?.value ??
      cookieStore.get("ruum_recovery")?.value ??
      null;

    if (!marcador) {
      return NextResponse.json({ authorized: false, reason: "no_cookie" }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    let cliente: Awaited<ReturnType<typeof crearClienteServidor>>;
    try {
      cliente = await crearClienteServidor();
    } catch {
      return NextResponse.json({ authorized: false, reason: "no_supabase" }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    const { data, error } = await cliente.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ authorized: false, reason: "no_session" }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(marcador);
    if (esUuid && marcador !== data.user.id) {
      return NextResponse.json({ authorized: false, reason: "user_mismatch" }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ authorized: true, userId: data.user.id }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ authorized: false, reason: "error", error: String(e).slice(0, 200) }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
