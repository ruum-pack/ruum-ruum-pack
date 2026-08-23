import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    // P2 CSP Report-Only — log para staging, no bloquear
    console.warn("[csp-report]", body.slice(0, 2000));
  } catch {
    // ignore
  }
  return new NextResponse(null, { status: 204 });
}

// Algunos navegadores envían report con GET
export async function GET() {
  return new NextResponse(null, { status: 204 });
}
