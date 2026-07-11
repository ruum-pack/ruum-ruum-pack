/// <reference lib="deno.ns" />
/// <reference lib="dom" />

const SOBRECARGA_MULTIPART_MAXIMA = 1024 * 1024;

export async function leerFormularioLimitado(req: Request, maximoArchivo: number): Promise<FormData> {
  const tipo = req.headers.get("content-type") ?? "";
  if (!tipo.toLowerCase().startsWith("multipart/form-data;")) {
    throw new Error("Se esperaba un formulario multipart válido.");
  }

  const maximoPeticion = maximoArchivo + SOBRECARGA_MULTIPART_MAXIMA;
  const longitud = Number(req.headers.get("content-length"));
  if (Number.isFinite(longitud) && longitud > maximoPeticion) {
    throw new Error("El archivo debe pesar máximo 10 MB.");
  }
  if (!req.body) throw new Error("El formulario no contiene datos.");

  const lector = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximoPeticion) {
      await lector.cancel("carga demasiado grande");
      throw new Error("El archivo debe pesar máximo 10 MB.");
    }
    partes.push(value);
  }

  const cuerpo = new Uint8Array(total);
  let posicion = 0;
  for (const parte of partes) {
    cuerpo.set(parte, posicion);
    posicion += parte.byteLength;
  }
  return await new Response(cuerpo, { headers: { "content-type": tipo } }).formData();
}
