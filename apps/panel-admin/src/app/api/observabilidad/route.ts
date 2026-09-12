import { NextResponse } from "next/server";
import { verificarConexionDb, verificarRpcSupabase } from "@ruum/api/operations";
import { crearClienteServidor } from "../../../lib/supabase-server";

const VERSION = process.env.APP_VERSION || "0.0.1-local";
const NOMBRE_SERVICIO = "panel-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const check = searchParams.get("check") || "liveness";

  if (check === "readiness") {
    return readinessCheck();
  }

  if (check === "full") {
    return fullHealthCheck();
  }

  return NextResponse.json({
    status: "ok",
    service: NOMBRE_SERVICIO,
    timestamp: new Date().toISOString(),
    version: VERSION
  }, { headers: { "cache-control": "no-store" } });
}

async function readinessCheck(): Promise<Response> {
  try {
    const cliente = await crearClienteServidor();
    const chequeo = await verificarRpcSupabase(cliente);
    if (!chequeo.ok) {
      return NextResponse.json({
        status: "degraded",
        service: NOMBRE_SERVICIO,
        version: VERSION,
        checks: { supabase: "error", mensaje: chequeo.mensaje },
        timestamp: new Date().toISOString()
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }

    return NextResponse.json({
      status: "ok",
      service: NOMBRE_SERVICIO,
      version: VERSION,
      checks: { supabase: "alive", rpc: "respondiendo" },
      timestamp: new Date().toISOString()
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({
      status: "error",
      service: NOMBRE_SERVICIO,
      version: VERSION,
      checks: { supabase: "desconectado", mensaje: e instanceof Error ? e.message : "error desconocido" },
      timestamp: new Date().toISOString()
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

async function fullHealthCheck(): Promise<Response> {
  const checks: Record<string, unknown> = {};

  checks.version = VERSION;
  checks.service = NOMBRE_SERVICIO;
  checks.host = process.env.HOSTNAME || "local";

  try {
    const cliente = await crearClienteServidor();

    const rpc = await verificarRpcSupabase(cliente);
    checks.rpc = rpc.ok ? { estado: "ok" } : { estado: "error", mensaje: rpc.mensaje };

    const db = await verificarConexionDb(cliente);
    checks.database = db.ok ? { estado: "ok" } : { estado: "error", mensaje: db.mensaje };

    const status = Object.values(checks).some((c) => typeof c === "object" && c !== null && "estado" in c && c.estado === "error")
      ? "degraded" : "ok";

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      checks
    }, { status: status === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      checks: { ...checks, error: e instanceof Error ? e.message : "error desconocido" }
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
