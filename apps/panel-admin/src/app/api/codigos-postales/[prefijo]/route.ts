import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

const PREFIJO_VALIDO = /^\d{2}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ prefijo: string }> }) {
  const { prefijo } = await params;
  if (!PREFIJO_VALIDO.test(prefijo)) {
    return NextResponse.json({ error: "PREFIJO_INVALIDO" }, { status: 400 });
  }

  try {
    const ruta = join(process.cwd(), "..", "app-usuario", "public", "data", "codigos-postales", `${prefijo}.json`);
    const contenido = await readFile(ruta, "utf8");
    return new NextResponse(contenido, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800"
      }
    });
  } catch {
    return NextResponse.json({}, { status: 404 });
  }
}
