import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { rutaShardCP } from "@/lib/datos-cp";

const PREFIJO_VALIDO = /^\d{2}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ prefijo: string }> }) {
  const { prefijo } = await params;
  if (!PREFIJO_VALIDO.test(prefijo)) {
    return NextResponse.json({ error: "PREFIJO_INVALIDO" }, { status: 400 });
  }

  try {
    const contenido = await readFile(rutaShardCP(prefijo), "utf8");
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
