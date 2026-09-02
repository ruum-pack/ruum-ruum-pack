import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_RECOVERY_USUARIO, COOKIE_RECOVERY_LEGACY, MAX_AGE_RECOVERY_S, RUTA_COOKIE_RECOVERY } from "@ruum/shared/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function opcionesExpiracion() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    secure: isProd,
    sameSite: "lax" as const,
    maxAge: 0,
    path: RUTA_COOKIE_RECOVERY,
  };
}

/**
 * PR-02 P0 — Invalida el contexto temporal de recovery después de updateUser exitoso.
 * Debe llamarse tras `supabase.auth.updateUser({ password })`.
 * Borra las cookies httpOnly de recovery para que no sea reutilizable.
 */
export async function POST() {
  const cookieStore = await cookies();
  const opts = opcionesExpiracion();
  try {
    cookieStore.set(COOKIE_RECOVERY_USUARIO, "", opts);
    cookieStore.set(COOKIE_RECOVERY_LEGACY, "", opts);
    cookieStore.set("ruum_recovery", "", opts);
    // También probar delete
    try { cookieStore.delete(COOKIE_RECOVERY_USUARIO); } catch {}
    try { cookieStore.delete(COOKIE_RECOVERY_LEGACY); } catch {}
    try { cookieStore.delete("ruum_recovery"); } catch {}
  } catch {}
  return NextResponse.json({ cleared: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  return POST();
}
