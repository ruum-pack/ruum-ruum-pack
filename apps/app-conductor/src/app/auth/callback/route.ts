import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { crearClienteServidor } from "@ruum/api/supabase";
import { obtenerConductorActual, obtenerSolicitudConductorActual } from "@ruum/api/services";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "";

  // H-5 — "signup" solía mandar siempre a /panel. Si alguien confirma su
  // correo desde el enlace crudo del correo (en vez de escribir el código de
  // 6 dígitos dentro de la app), la cuenta queda confirmada pero sin
  // solicitud creada — porque iniciar_solicitud_conductor solo se llama
  // desde el propio flujo de /registro. Mandarlo a /panel lo dejaba varado
  // viendo un dashboard vacío. /registro ahora verifica si ya es conductor
  // (y ahí sí manda a /panel) o, si no, crea la solicitud y continúa.
  //
  // El enlace PKCE a veces no trae `type`; en ese caso se decide por el
  // estado real del usuario en lugar de asumir /panel.
  async function destinoComoConductor() {
    if (type === "recovery") return "/nueva-password";
    if (type === "signup") return "/registro";
    try {
      const solicitud = await obtenerSolicitudConductorActual(supabase);
      if (solicitud) {
        return ["listo_para_enviar", "en_revision", "requiere_correccion", "aprobado", "rechazado", "suspendido"].includes(solicitud.estado)
          ? "/panel"
          : "/registro";
      }
      return (await obtenerConductorActual(supabase)) ? "/panel" : "/registro";
    } catch {
      return "/registro";
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.redirect(`${origin}/onboarding`);

  const cookieStore = await cookies();
  const supabase = crearClienteServidor(url, anonKey, {
    getAll() { return cookieStore.getAll(); },
    setAll(cookiesToSet) {
      try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
      catch { /* Route Handler puede escribir cookies */ }
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${await destinoComoConductor()}`);
  }
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "recovery" | "magiclink" | "email",
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}${await destinoComoConductor()}`);
  }

  return NextResponse.redirect(`${origin}/recuperar-password?error=enlace_invalido`);
}
