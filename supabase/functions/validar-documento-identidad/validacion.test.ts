import { assertRejects } from "jsr:@std/assert@1";
import { validarDocumento } from "../_shared/validacion-documento.ts";
import { leerFormularioLimitado } from "../_shared/multipart-limitado.ts";

const FORMATOS_IDENTIDAD = new Set(["jpeg", "png", "pdf"] as const);

Deno.test("identidad rechaza WEBP aunque su firma sea reconocible", () => {
  const webp = new TextEncoder().encode("RIFFxxxxxxxxWEBPxxxxxxxxxxxxxxxxxxxx");
  assertRejects(
    () => Promise.resolve().then(() => validarDocumento(webp, "identidad.webp", FORMATOS_IDENTIDAD)),
    Error,
    "WEBP no está permitido"
  );
});

Deno.test("identidad rechaza HEIC por no pertenecer a los formatos liberados", () => {
  const heic = new Uint8Array([0,0,0,24,102,116,121,112,104,101,105,99,0,0,0,0,104,101,105,99]);
  assertRejects(
    () => Promise.resolve().then(() => validarDocumento(heic, "identidad.heic", FORMATOS_IDENTIDAD)),
    Error,
    "formato documental permitido"
  );
});

Deno.test("multipart corta por Content-Length antes de leer el cuerpo", () => {
  const req = new Request("http://local.test", {
    method: "POST",
    headers: {
      "content-type": "multipart/form-data; boundary=limite",
      "content-length": String(12 * 1024 * 1024)
    },
    body: "--limite--"
  });
  assertRejects(() => leerFormularioLimitado(req, 10 * 1024 * 1024), Error, "máximo 10 MB");
});

Deno.test("multipart corta un cuerpo chunked cuando rebasa el límite", () => {
  const bloque = new Uint8Array(600 * 1024);
  const cuerpo = new ReadableStream<Uint8Array>({
    start(controlador) {
      controlador.enqueue(bloque);
      controlador.enqueue(bloque);
      controlador.close();
    }
  });
  const req = new Request("http://local.test", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=limite" },
    body: cuerpo
  });
  assertRejects(() => leerFormularioLimitado(req, 100 * 1024), Error, "máximo 10 MB");
});
