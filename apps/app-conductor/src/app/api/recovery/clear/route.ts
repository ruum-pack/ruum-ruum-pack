import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_RECOVERY_CONDUCTOR, COOKIE_RECOVERY_LEGACY, RUTA_COOKIE_RECOVERY } from "@ruum/shared/utils";

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

export async function POST() {
  const cookieStore = await cookies();
  const opts = opcionesExpiracion();
  try {
    cookieStore.set(COOKIE_RECOVERY_CONDUCTOR, "", opts);
    cookieStore.set(COOKIE_RECOVERY_LEGACY, "", opts);
    cookieStore.set("ruum_recovery", "", opts);
    try { cookieStore.delete(COOKIE_RECOVERY_CONDUCTOR); } catch {}
    try { cookieStore.delete(COOKIE_RECOVERY_LEGACY); } catch {}
    try { cookieStore.delete("ruum_recovery"); } catch {}
  } catch {}
  return NextResponse.json({ cleared: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  return POST();
}
