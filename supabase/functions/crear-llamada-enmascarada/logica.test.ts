import { assertEquals } from "jsr:@std/assert@1";
import { validarTelefonos, determinarRolLlamador, debeReutilizarSesion } from "./logica.ts";

Deno.test("validarTelefonos: inválido si a ambos les falta el teléfono", () => {
  const r = validarTelefonos(null, null);
  assertEquals(r.valido, false);
});

Deno.test("validarTelefonos: inválido si solo al usuario le falta", () => {
  const r = validarTelefonos(null, "+5215587654321");
  assertEquals(r.valido, false);
  assertEquals(r.motivo, "El usuario no tiene un teléfono registrado.");
});

Deno.test("validarTelefonos: inválido si solo al conductor le falta", () => {
  const r = validarTelefonos("+5215512345678", null);
  assertEquals(r.valido, false);
  assertEquals(r.motivo, "El conductor no tiene un teléfono registrado.");
});

Deno.test("validarTelefonos: válido si ambos tienen teléfono", () => {
  const r = validarTelefonos("+5215512345678", "+5215587654321");
  assertEquals(r.valido, true);
});

Deno.test("determinarRolLlamador: identifica al usuario del traslado", () => {
  assertEquals(determinarRolLlamador("u1", "c1", "u1", null), "usuario");
});

Deno.test("determinarRolLlamador: identifica al conductor del traslado", () => {
  assertEquals(determinarRolLlamador("u1", "c1", null, "c1"), "conductor");
});

Deno.test("determinarRolLlamador: null si no es ninguno de los dos (alguien ajeno al traslado)", () => {
  assertEquals(determinarRolLlamador("u1", "c1", "u2", null), null);
  assertEquals(determinarRolLlamador("u1", "c1", null, "c2"), null);
});

Deno.test("determinarRolLlamador: null si el traslado todavía no tiene conductor asignado", () => {
  assertEquals(determinarRolLlamador("u1", null, null, "c1"), null);
});

Deno.test("debeReutilizarSesion: false si no existe ninguna sesión previa", () => {
  assertEquals(debeReutilizarSesion(null), false);
});

Deno.test("debeReutilizarSesion: false si la sesión previa ya se cerró", () => {
  assertEquals(debeReutilizarSesion({ cerrada_en: "2026-06-27T00:00:00Z" }), false);
});

Deno.test("debeReutilizarSesion: true si existe y sigue abierta", () => {
  assertEquals(debeReutilizarSesion({ cerrada_en: null }), true);
});
