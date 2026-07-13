/// <reference lib="deno.ns" />

import { assertEquals } from "jsr:@std/assert@1";
import { montoAutorizadoParaCobro, validarRangoMontoCobro } from "./logica.ts";

Deno.test("montoAutorizadoParaCobro: usa precio_final por encima de precio_cotizado", () => {
  assertEquals(montoAutorizadoParaCobro({ precio_cotizado: 2400, precio_final: 2750 }), 2750);
});

Deno.test("montoAutorizadoParaCobro: usa precio_cotizado si no hay precio_final", () => {
  assertEquals(montoAutorizadoParaCobro({ precio_cotizado: 2400, precio_final: null }), 2400);
});

Deno.test("montoAutorizadoParaCobro: no inventa monto cuando solo existe presupuesto_usuario fuera del contrato", () => {
  const traslado = {
    precio_cotizado: null,
    precio_final: null,
    presupuesto_usuario: 99999
  };

  assertEquals(montoAutorizadoParaCobro(traslado), null);
});

Deno.test("validarRangoMontoCobro: rechaza ausencia de cotizacion autorizada", () => {
  assertEquals(validarRangoMontoCobro(null), {
    valido: false,
    error: "El traslado todavía no cuenta con una cotización válida."
  });
});

Deno.test("validarRangoMontoCobro: aplica piso y techo al monto autorizado", () => {
  assertEquals(validarRangoMontoCobro(698).valido, false);
  assertEquals(validarRangoMontoCobro(699), { valido: true });
  assertEquals(validarRangoMontoCobro(100000), { valido: true });
  assertEquals(validarRangoMontoCobro(100001).valido, false);
});
