/**
 * /auth/callback — Intercepta los deep links de Supabase Auth.
 *
 * Supabase redirige aquí tras confirmar email (signup), recuperar contraseña
 * (recovery) o usar magic link. Intercambia el code/token_hash por sesión y
 * redirige al destino correcto.
 *
 * Usa crearClienteServidor del propio lib del proyecto (no @supabase/ssr
 * directamente, que no está en las dependencias de app-usuario).
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { crearClienteServidor } from "@ruum/api/supabase";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "";
  const nextSolicitado = searchParams.get("next") ?? "/";
  const next = nextSolicitado.startsWith("/") && !nextSolicitado.startsWith("//") ? nextSolicitado : "/";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  /* Sin Supabase configurado — redirigir al inicio */
  if (!url || !anonKey) {
    return NextResponse.redirect(`${origin}/`);
  }

  const cookieStore = await cookies();
  const supabase = crearClienteServidor(url, anonKey, {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      } catch {
        /* Route Handler puede escribir cookies sin problema */
      }
    },
  });

  /* PKCE flow — code de autorización */
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destino = type === "recovery" ? "/nueva-password" : next;
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  /* Email OTP flow — token_hash */
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "recovery" | "magiclink" | "email",
      token_hash: tokenHash,
    });
    if (!error) {
      const destino = type === "recovery" ? "/nueva-password" : next;
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  /* Token inválido o expirado */
  const destinoError = type === "recovery"
    ? "/recuperar-password?error=enlace_invalido"
    : "/login?reason=email_confirmation&error=enlace_invalido";
  return NextResponse.redirect(`${origin}${destinoError}`);
}
