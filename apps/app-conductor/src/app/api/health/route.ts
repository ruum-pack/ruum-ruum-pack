import { NextResponse } from "next/server";
import { crearClienteServidor } from "../../../lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HealthStatus = "ok" | "degraded" | "down";

export async function GET() {
  const iniciado = Date.now();
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";
  const ambiente = process.env.NEXT_PUBLIC_RUUM_AMBIENTE ?? process.env.NODE_ENV ?? "unknown";

  let supabase: HealthStatus = "ok";
  let supabaseLatencyMs: number | null = null;
  let supabaseError: string | null = null;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      supabase = "degraded";
      supabaseError = "Supabase no configurado";
    } else {
      const t0 = Date.now();
      const cliente = await crearClienteServidor();
      // Lightweight check: auth.getUser (no requiere datos) + ping a tabla pública
      const { error } = await cliente.from("conductores").select("id").limit(1).maybeSingle();
      supabaseLatencyMs = Date.now() - t0;
      if (error) {
        // PGRST / 400 son degradados, no down (RLS puede bloquear anon)
        const msg = error.message ?? String(error);
        if (msg.includes("401") || msg.includes("PGRST301") || msg.toLowerCase().includes("jwt")) {
          supabase = "degraded";
          supabaseError = `Supabase auth degradado: ${msg.slice(0, 120)}`;
        } else {
          supabase = "degraded";
          supabaseError = msg.slice(0, 200);
        }
      }
      // Timeout guard
      if (supabaseLatencyMs !== null && supabaseLatencyMs > 3000) {
        supabase = supabase === "ok" ? "degraded" : supabase;
      }
    }
  } catch (e) {
    supabase = "down";
    supabaseError = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
  }

  const overall: HealthStatus = supabase === "down" ? "down" : supabase === "degraded" ? "degraded" : "ok";
  const latencyMs = Date.now() - iniciado;

  const body = {
    status: overall,
    version,
    ambiente,
    timestamp: new Date().toISOString(),
    latencyMs,
    checks: {
      supabase: { status: supabase, latencyMs: supabaseLatencyMs, error: supabaseError },
      csp: { status: "ok" as HealthStatus, note: "nonce+strict-dynamic vía middleware; ver /api/csp-report" },
    },
  };

  return NextResponse.json(body, {
    status: overall === "down" ? 503 : 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Type": "application/json",
    },
  });
}
