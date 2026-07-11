/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "documentos-identidad";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function codigoSeguro(error: unknown) {
  if (!error || typeof error !== "object") return "desconocido";
  const valor = error as { code?: unknown; status?: unknown; name?: unknown };
  if (typeof valor.code === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(valor.code)) return valor.code;
  if (typeof valor.status === "number") return `http_${valor.status}`;
  if (typeof valor.name === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(valor.name)) return valor.name;
  return "desconocido";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ error: "Servicio no configurado." }, 500);
  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) return json({ error: "No autorizado." }, 401);

  const servicio = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: pendientes, error: errorReclamo } = await servicio
    .rpc("reclamar_limpieza_documentos_identidad", { p_limite: 50 });
  if (errorReclamo) {
    console.error("Error reclamando limpieza de identidad", { codigo: codigoSeguro(errorReclamo) });
    return json({ error: "No fue posible iniciar la limpieza." }, 500);
  }

  let eliminados = 0;
  let pendientesError = 0;
  let escalados = 0;
  for (const documento of pendientes ?? []) {
    const { error } = await servicio.storage.from(BUCKET).remove([documento.ruta]);
    if (!error) {
      eliminados += 1;
      await servicio.from("documentos_identidad_usuario").update({
        eliminado_storage_en: new Date().toISOString(),
        error_eliminacion: null,
        requiere_alerta_eliminacion: false
      }).eq("id", documento.documento_id);
      continue;
    }

    pendientesError += 1;
    const requiereAlerta = documento.intento >= 5;
    if (requiereAlerta) escalados += 1;
    await servicio.from("documentos_identidad_usuario").update({
      error_eliminacion: codigoSeguro(error),
      requiere_alerta_eliminacion: requiereAlerta
    }).eq("id", documento.documento_id);
    console.error("Fallo eliminando identidad obsoleta", {
      codigo: codigoSeguro(error), intento: documento.intento, alerta: requiereAlerta
    });
  }

  return json(
    { procesados: (pendientes ?? []).length, eliminados, pendientes: pendientesError, escalados },
    escalados > 0 ? 500 : 200
  );
});
