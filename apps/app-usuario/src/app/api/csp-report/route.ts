import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    // P1 CSP Report-Only — registrar reporte en staging/dev sin bloquear
    console.warn("[csp-report-usuario]", body.slice(0, 2000));
  } catch {
    // ignore
  }
  return new NextResponse(null, { status: 204 });
}

// Algunos navegadores o proxies envían reporte con GET o HEAD
export async function GET() {
  return new NextResponse(null, { status: 204 });
}

export async function HEAD() {
  return new NextResponse(null, { status: 204 });
}
