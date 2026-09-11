import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { listarVehiculosAdminPaginados, tienePermisoAdmin } from "@ruum/api/services";
import { completarExportacionAdmin, registrarExportacionAdmin } from "@ruum/api/operations";
import { crearClienteServidor } from "../../../../lib/supabase-server";

const LIMITE_FILAS = 10_000;

function celda(valor: unknown) {
  let texto = String(valor ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const traceId = request.headers.get("x-request-id") ?? randomUUID();
  const inicio = Date.now();
  const cliente = await crearClienteServidor();
  const url = new URL(request.url);
  const busqueda = url.searchParams.get("busqueda")?.trim() || null;
  const filtros = { busqueda };

  const [puedeLeer, puedeExportar] = await Promise.all([
    tienePermisoAdmin(cliente, "vehiculos:leer").catch(() => false),
    tienePermisoAdmin(cliente, "exportaciones:crear").catch(() => false)
  ]);
  if (!puedeLeer || !puedeExportar) {
    return NextResponse.json({ error: "forbidden", traceId }, { status: 403, headers: { "x-request-id": traceId } });
  }

  let registroId: string | null = null;
  try {
    registroId = await registrarExportacionAdmin(cliente, {
      recurso: "vehiculos",
      filtros,
      formato: "csv"
    });
  } catch {
    return NextResponse.json({ error: "export_init_failed", traceId }, { status: 500, headers: { "x-request-id": traceId } });
  }

  try {
    const datos = await listarVehiculosAdminPaginados(cliente, 1, LIMITE_FILAS, busqueda ?? undefined);
    const usuarioPorId = new Map(datos.usuarios.map((usuario) => [usuario.id, usuario]));
    const encabezado = "id,usuario_id,usuario,marca,modelo,anio,placas,vin,estado_documental,categoria_tarifa,gama,condicion,creado_en";
    const filas = datos.vehiculos.map((vehiculo) => {
      const usuario = usuarioPorId.get(vehiculo.usuario_id);
      const estadoDocumental = [
        vehiculo.tiene_placas ? "placas" : null,
        vehiculo.tiene_tarjeta_circulacion ? "tarjeta_circulacion" : null,
        vehiculo.tiene_verificacion ? "verificacion" : null,
        vehiculo.puede_circular_rodando ? "circula_rodando" : null
      ].filter(Boolean).join("|");
      return [
        vehiculo.id,
        vehiculo.usuario_id,
        usuario?.nombre ?? usuario?.razon_social ?? usuario?.correo_facturacion ?? "",
        vehiculo.marca,
        vehiculo.modelo,
        vehiculo.anio,
        vehiculo.placas,
        vehiculo.vin,
        estadoDocumental,
        vehiculo.categoria_tarifa,
        vehiculo.gama,
        vehiculo.condicion,
        vehiculo.creado_en
      ].map(celda).join(",");
    });
    const csv = [encabezado, ...filas].join("\n");
    const hash = createHash("sha256").update(csv).digest("hex");
    try {
      await completarExportacionAdmin(cliente, {
        id: registroId as string,
        filas: datos.vehiculos.length,
        hash
      });
    } catch (errorCompletar) {
      console.error("[export] auditoría de vehículos fallida, no se entrega CSV", errorCompletar);
      return NextResponse.json({ error: "export_audit_failed", traceId }, { status: 500, headers: { "x-request-id": traceId } });
    }
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="vehiculos-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
        "x-content-sha256": hash,
        "x-request-id": traceId,
        "server-timing": `app;dur=${Date.now() - inicio}`
      }
    });
  } catch (error) {
    await completarExportacionAdmin(cliente, {
      id: registroId as string,
      filas: 0,
      hash: "",
      error: "export_failed"
    }).catch(() => {});
    return NextResponse.json({ error: "export_failed", traceId }, { status: 500, headers: { "x-request-id": traceId } });
  }
}
