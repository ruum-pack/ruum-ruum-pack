import { NextRequest, NextResponse } from "next/server";
import { MAX_BODY, rateLimit } from "../../../lib/csp-rate-limit";

function ipDeRequest(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || (req as unknown as { ip?: string }).ip || "unknown";
}

function sanitizarCspBody(raw: string): string {
  const truncado = raw.slice(0, MAX_BODY);
  return truncado.replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}[a-zA-Z0-9._-]*/g, "[REDACTED_JWT]");
}

export async function POST(request: NextRequest) {
  const ip = ipDeRequest(request);
  const rl = await rateLimit(ip);
  if (!rl.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSec ?? 60) },
    });
  }

  // Bloquear cuerpos absurdos por Content-Length si está presente
  const lenHeader = request.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > MAX_BODY * 2) {
    return new NextResponse(null, { status: 413 });
  }

  try {
    const raw = await request.text();
    const body = sanitizarCspBody(raw);
    // Log truncado 5k (antes 2k) — visible en staging/dev
    console.warn("[csp-report-usuario]", body.slice(0, MAX_BODY));

    // Forward a observabilidad/Sentry (no bloqueante, no falla el 204)
    void (async () => {
      try {
        // Intentar parsear JSON de reporte para extraer directiva violada
        let directiva: string | undefined;
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const report = (parsed["csp-report"] as Record<string, unknown> | undefined) ?? parsed;
          directiva = (report?.["violated-directive"] ?? report?.["effective-directive"]) as string | undefined;
        } catch {}
        // Sentry server (si está configurado, es no-op si no hay DSN)
        try {
          const Sentry = await import("@sentry/nextjs");
          if (typeof (Sentry as unknown as { captureMessage?: unknown }).captureMessage === "function") {
            (Sentry as unknown as { captureMessage: (m: string, o: unknown) => void }).captureMessage("[csp-report-usuario]", {
              level: "warning",
              extra: { ip, directiva: directiva?.slice(0, 120), body: body.slice(0, 500) },
            });
          }
        } catch {}
      } catch {}
    })();
  } catch {
    // ignore — endpoint nunca debe fallar
  }
  return new NextResponse(null, { status: 204 });
}

// Algunos navegadores o proxies envían reporte con GET o HEAD — no loguear, solo 204 sin rate-limit
export async function GET() {
  return new NextResponse(null, { status: 204 });
}

export async function HEAD() {
  return new NextResponse(null, { status: 204 });
}
