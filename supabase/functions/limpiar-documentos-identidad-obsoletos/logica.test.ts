/// <reference lib="deno.ns" />

import { assertEquals } from "jsr:@std/assert@1";
import {
  codigoSeguro,
  requiereAlertaEliminacion,
  resumirLimpieza,
  estadoHttpLimpieza,
} from "./logica.ts";

Deno.test("codigoSeguro: sanitiza códigos y nunca filtra PII", () => {
  assertEquals(codigoSeguro({ code: "NoSuchKey" }), "NoSuchKey");
  assertEquals(codigoSeguro({ status: 404 }), "http_404");
  assertEquals(codigoSeguro({ code: "../../etc/passwd" }), "desconocido");
  assertEquals(codigoSeguro(null), "desconocido");
});

Deno.test("requiereAlertaEliminacion: escala a partir de 5 intentos", () => {
  assertEquals(requiereAlertaEliminacion(4), false);
  assertEquals(requiereAlertaEliminacion(5), true);
  assertEquals(requiereAlertaEliminacion(9), true);
});

Deno.test("resumirLimpieza: cuenta eliminados/pendientes/escalados", () => {
  assertEquals(
    resumirLimpieza([{ ok: true, intento: 1 }, { ok: false, intento: 2 }, { ok: false, intento: 5 }]),
    { procesados: 3, eliminados: 1, pendientes: 2, escalados: 1 },
  );
});

Deno.test("estadoHttpLimpieza: 500 si hay escalados para alertar", () => {
  assertEquals(estadoHttpLimpieza({ procesados: 1, eliminados: 1, pendientes: 0, escalados: 0 }), 200);
  assertEquals(estadoHttpLimpieza({ procesados: 2, eliminados: 1, pendientes: 1, escalados: 1 }), 500);
});
