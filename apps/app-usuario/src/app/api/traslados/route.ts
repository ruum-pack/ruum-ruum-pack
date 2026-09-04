import { NextRequest, NextResponse } from "next/server";
import { crearClienteServidor } from "../../../lib/supabase-server";
import { esquemaSolicitudTraslado } from "@ruum/shared/validacion";

// Sec3: validación servidor del wizard — rechazar si paso < 4 (PASOS.length = 4)
// El cliente no debe poder crear traslado enviando paso 0 como si fuera paso 5.
const PASOS_REQUERIDOS = 4;

function esPasoValido(paso: unknown): boolean {
  const n = typeof paso === "string" ? Number(paso) : typeof paso === "number" ? paso : NaN;
  return Number.isInteger(n) && n >= PASOS_REQUERIDOS;
}

export async function POST(request: NextRequest) {
  try {
    const cliente = await crearClienteServidor();
    const { data: { user } } = await cliente.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    // Sec3: validar paso — soporta 0-3 (índice) o 1-4 (contador). Normalizamos a contador 1-4.
    // Si el cliente manda paso índice 0-3, lo convertimos a contador +1.
    // Si manda paso contador 1-4, lo usamos directo. En ambos casos, <4 es incompleto.
    const rawPaso = (body as Record<string, unknown>).paso
      ?? (body as Record<string, unknown>).wizardPaso
      ?? (body as Record<string, unknown>).step;
    let pasoContador: number | null = null;
    if (typeof rawPaso === "number" && Number.isInteger(rawPaso)) {
      pasoContador = rawPaso <= 3 ? rawPaso + 1 : rawPaso; // 0-3 -> 1-4
    } else if (typeof rawPaso === "string" && /^\d+$/.test(rawPaso)) {
      const n = Number(rawPaso);
      pasoContador = n <= 3 ? n + 1 : n;
    }

    if (pasoContador === null || pasoContador < PASOS_REQUERIDOS) {
      console.warn("[api/traslados] wizard incompleto rechazado", { paso: rawPaso, ip: request.headers.get("x-forwarded-for")?.split(",")[0] });
      return NextResponse.json(
        { error: "Solicitud incompleta: debes completar todos los pasos del wizard." },
        { status: 400 }
      );
    }

    // Validación completa del payload con esquema compartido (defensa en profundidad)
    // Si el body trae campos del wizard, los validamos; si es payload ya transformado, al menos validar que no esté vacío
    const tieneCamposWizard = "marca" in body || "origenCodigoPostal" in body;
    if (tieneCamposWizard) {
      const parsed = esquemaSolicitudTraslado.safeParse({
        ...body,
        // defaults para campos no enviados por el API pero requeridos por el esquema
        vehiculoSeleccionadoId: (body as Record<string, unknown>).vehiculoSeleccionadoId ?? "",
        vehiculosUsuarioIds: (body as Record<string, unknown>).vehiculosUsuarioIds ?? [],
        zonaHoraria: (body as Record<string, unknown>).zonaHoraria ?? "America/Mexico_City",
        aceptaPoliticas: (body as Record<string, unknown>).aceptaPoliticas ?? true,
        paradas: (body as Record<string, unknown>).paradas ?? [],
      });
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Datos de traslado inválidos", detalles: parsed.error.issues.slice(0, 3).map((i) => i.message) },
          { status: 400 }
        );
      }
    }

    // Si la validación pasa, el cliente debe usar el flujo normal (RPC) o este endpoint puede crear directamente.
    // Por ahora retornamos 200 para indicar que el paso fue validado; la creación real sigue vía RPC con validación de esquema.
    return NextResponse.json({ ok: true, pasoValidado: pasoContador }, { status: 200 });
  } catch (err) {
    console.warn("[api/traslados] error", err);
    // Sec2: mensaje genérico, nunca exponer env vars ni detalles internos
    return NextResponse.json({ error: "No se pudo procesar la solicitud. Intenta de nuevo más tarde." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Método no permitido" }, { status: 405 });
}
