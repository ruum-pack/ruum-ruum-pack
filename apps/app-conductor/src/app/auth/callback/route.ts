import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { crearClienteServidor } from "@ruum/api/supabase";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "";

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
    if (!error) return NextResponse.redirect(`${origin}${type === "recovery" ? "/nueva-password" : "/panel"}`);
  }
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "recovery" | "magiclink" | "email",
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}${type === "recovery" ? "/nueva-password" : "/panel"}`);
  }

  return NextResponse.redirect(`${origin}/recuperar-password?error=enlace_invalido`);
}
