import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { sanitizarNombre, validarDocumento } from "./validacion.ts";

Deno.test("rechaza un archivo de texto renombrado como jpg", () => {
  assertRejects(
    () => Promise.resolve().then(() => validarDocumento(new TextEncoder().encode("esto no es una imagen"), "licencia.jpg")),
    Error,
    "contenido real"
  );
});

Deno.test("sanea el nombre y elimina EXIF de un JPEG estructuralmente legible", () => {
  const jpeg = new Uint8Array([
    0xff,0xd8,
    0xff,0xe1,0x00,0x0a,0x45,0x78,0x69,0x66,0x00,0x00,0x01,0x02,
    0xff,0xc0,0x00,0x11,0x08,0x02,0x58,0x03,0x20,0x03,
    0x01,0x11,0x00,0x02,0x11,0x00,0x03,0x11,0x00,
    0xff,0xda,0x00,0x0c,0x03,0x01,0x00,0x02,0x00,0x03,0x00,0x00,0x3f,0x00,
    0x00,0x01,0xff,0xd9
  ]);
  const resultado = validarDocumento(jpeg, "mi licencia final!!.jpeg");
  assertEquals(resultado.mime,"image/jpeg");
  assertEquals(resultado.ancho,800);
  assertEquals(resultado.alto,600);
  assert(resultado.exifEliminado);
  assert(!new TextDecoder("latin1").decode(resultado.bytes).includes("Exif"));
  assertEquals(resultado.nombreSeguro,"mi_licencia_final_.jpg");
});

Deno.test("rechaza una imagen con dimensiones insuficientes", () => {
  const jpeg = new Uint8Array([
    0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,0x00,0x64,0x00,0x64,0x03,
    0x01,0x11,0x00,0x02,0x11,0x00,0x03,0x11,0x00,
    0xff,0xda,0x00,0x0c,0x03,0x01,0x00,0x02,0x00,0x03,0x00,0x00,0x3f,0x00,
    0x00,0xff,0xd9
  ]);
  assertRejects(() => Promise.resolve().then(()=>validarDocumento(jpeg,"foto.jpg")),Error,"al menos 800 x 600");
});

Deno.test("valida un PDF con página, xref y EOF y corrige su extensión", () => {
  const cabecera = "%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n";
  const offset = cabecera.length;
  const pdf = `${cabecera}xref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 >>\nstartxref\n${offset}\n%%EOF\n`;
  const resultado=validarDocumento(new TextEncoder().encode(pdf),"documento.jpg");
  assertEquals(resultado.mime,"application/pdf");
  assertEquals(resultado.nombreSeguro,"documento.pdf");
});

Deno.test("sanitiza rutas y evita nombres ocultos", () => {
  assertEquals(sanitizarNombre("../Mi identificación 2026.pdf"),"documento_Mi_identificacion_2026.pdf");
});
