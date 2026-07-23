import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Json } from "@ruum/shared/types";
import { listarVehiculosAdminPaginados } from "@ruum/api/services";
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

  const { data: puedeLeer } = await cliente.rpc("admin_tiene_permiso", { p_permiso: "vehiculos:leer" });
  const { data: puedeExportar } = await cliente.rpc("admin_tiene_permiso", { p_permiso: "exportaciones:crear" });
  if (!puedeLeer || !puedeExportar) {
    return NextResponse.json({ error: "forbidden", traceId }, { status: 403, headers: { "x-request-id": traceId } });
  }

  const { data: registroId, error: registroError } = await cliente.rpc("admin_registrar_exportacion", {
    p_recurso: "vehiculos",
    p_filtros: filtros as unknown as Json,
    p_formato: "csv"
  });
  if (registroError) {
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
    const { error: completarError } = await cliente.rpc("admin_completar_exportacion", {
      p_id: registroId as string,
      p_filas: datos.vehiculos.length,
      p_hash: hash
    });
    if (completarError) {
      console.error("[export] auditoría de vehículos fallida, no se entrega CSV", completarError);
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
    await cliente.rpc("admin_completar_exportacion", {
      p_id: registroId as string,
      p_filas: 0,
      p_hash: "",
      p_error: "export_failed"
    });
    return NextResponse.json({ error: "export_failed", traceId }, { status: 500, headers: { "x-request-id": traceId } });
  }
}
