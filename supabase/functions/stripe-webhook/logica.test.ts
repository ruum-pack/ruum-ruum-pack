/// <reference lib="deno.ns" />

import { assertEquals } from "jsr:@std/assert@1";
import {
  esEventoYaProcesado,
  extraerTrasladoId,
  cuentaConductorEstaActiva,
  esEventoManejado,
  estadoTrasladoSiguienteTrasPago
} from "./logica.ts";

Deno.test("esEventoYaProcesado: false cuando nunca se guardó un evento", () => {
  assertEquals(esEventoYaProcesado("evt_123", null), false);
  assertEquals(esEventoYaProcesado("evt_123", undefined), false);
});

Deno.test("esEventoYaProcesado: false cuando el evento guardado es distinto (evento nuevo legítimo)", () => {
  assertEquals(esEventoYaProcesado("evt_nuevo", "evt_anterior"), false);
});

Deno.test("esEventoYaProcesado: true cuando Stripe reintenta el mismo evento", () => {
  assertEquals(esEventoYaProcesado("evt_123", "evt_123"), true);
});

Deno.test("extraerTrasladoId: null cuando no hay metadata", () => {
  assertEquals(extraerTrasladoId(null), null);
  assertEquals(extraerTrasladoId(undefined), null);
});

Deno.test("extraerTrasladoId: null cuando metadata existe pero sin traslado_id", () => {
  assertEquals(extraerTrasladoId({ otra_cosa: "x" }), null);
});

Deno.test("extraerTrasladoId: devuelve el id cuando está presente", () => {
  assertEquals(extraerTrasladoId({ traslado_id: "abc-123" }), "abc-123");
});

Deno.test("cuentaConductorEstaActiva: requiere AMBOS flags, no solo uno", () => {
  assertEquals(cuentaConductorEstaActiva(true, false), false);
  assertEquals(cuentaConductorEstaActiva(false, true), false);
  assertEquals(cuentaConductorEstaActiva(undefined, undefined), false);
});

Deno.test("cuentaConductorEstaActiva: true solo con charges_enabled y details_submitted", () => {
  assertEquals(cuentaConductorEstaActiva(true, true), true);
});

Deno.test("esEventoManejado: reconoce los 5 tipos de evento que sí procesamos", () => {
  assertEquals(esEventoManejado("payment_intent.succeeded"), true);
  assertEquals(esEventoManejado("payment_intent.payment_failed"), true);
  assertEquals(esEventoManejado("account.updated"), true);
  assertEquals(esEventoManejado("transfer.created"), true);
  assertEquals(esEventoManejado("transfer.reversed"), true);
});

Deno.test("esEventoManejado: rechaza tipos de evento que no manejamos", () => {
  assertEquals(esEventoManejado("charge.refunded"), false);
  assertEquals(esEventoManejado("customer.created"), false);
});

Deno.test("estadoTrasladoSiguienteTrasPago: avanza solo desde estados válidos", () => {
  assertEquals(estadoTrasladoSiguienteTrasPago("cotizacion_aceptada", "anticipado", "completado"), "servicio_confirmado");
  assertEquals(estadoTrasladoSiguienteTrasPago("entrega_confirmada", "anticipado", "completado"), "pago_completado");
  assertEquals(estadoTrasladoSiguienteTrasPago("pago_pendiente", "al_cierre", "completado"), "pago_completado");
  assertEquals(estadoTrasladoSiguienteTrasPago("pendiente_de_conductor", "anticipado", "completado"), null);
  assertEquals(estadoTrasladoSiguienteTrasPago("solicitud_creada", "al_cierre", "completado"), null);
  assertEquals(estadoTrasladoSiguienteTrasPago("entrega_confirmada", "anticipado", "fallido"), null);
});
