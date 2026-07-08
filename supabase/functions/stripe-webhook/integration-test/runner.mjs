// Firma eventos exactamente como lo hace Stripe (esquema documentado:
// signed_payload = "{timestamp}.{payload}", v1 = HMAC-SHA256 hex), y los
// envía por HTTP al index.ts REAL del webhook (corriendo de verdad con
// `deno serve`, no importado como módulo) — para probar el handler completo,
// no solo logica.ts.

import crypto from "node:crypto";

const WEBHOOK_URL = "http://localhost:8000";
const WEBHOOK_SECRET = "whsec_test_local_12345";

function firmar(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const payloadFirmado = `${timestamp}.${payload}`;
  const firma = crypto.createHmac("sha256", secret).update(payloadFirmado).digest("hex");
  return `t=${timestamp},v1=${firma}`;
}

async function enviarEvento(evento, { secret = WEBHOOK_SECRET, timestamp } = {}) {
  const payload = JSON.stringify(evento);
  const stripeSignature = firmar(payload, secret, timestamp);

  const respuesta = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": stripeSignature },
    body: payload
  });

  const texto = await respuesta.text();
  return { status: respuesta.status, texto };
}

function eventoPaymentIntent(tipo, { id, paymentIntentId, trasladoId, monto = 150000 }) {
  return {
    id,
    object: "event",
    api_version: "2025-02-24.acacia",
    created: Math.floor(Date.now() / 1000),
    type: tipo,
    data: {
      object: {
        id: paymentIntentId,
        object: "payment_intent",
        amount: monto,
        currency: "mxn",
        status: tipo === "payment_intent.succeeded" ? "succeeded" : "requires_payment_method",
        metadata: { traslado_id: trasladoId }
      }
    }
  };
}

async function obtenerRequestsMock() {
  const r = await fetch("http://localhost:8787/__requests");
  return r.json();
}

async function resetMock() {
  await fetch("http://localhost:8787/__reset", { method: "POST" });
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FALLÓ: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  // --- Caso 1: pago al cierre, completado -> pago_pendiente debe pasar a pago_completado ---
  await resetMock();
  const ev1 = eventoPaymentIntent("payment_intent.succeeded", {
    id: "evt_test_alcierre_1",
    paymentIntentId: "pi_test_alcierre",
    trasladoId: "traslado-alcierre"
  });
  const r1 = await enviarEvento(ev1);
  assert(r1.status === 200, `caso al_cierre: respuesta 200 (fue ${r1.status}: ${r1.texto})`);
  const reqs1 = await obtenerRequestsMock();
  const patchPagos1 = reqs1.find((r) => r.method === "PATCH" && r.path === "/rest/v1/pagos");
  const patchTraslados1 = reqs1.find((r) => r.method === "PATCH" && r.path === "/rest/v1/traslados");
  assert(Boolean(patchPagos1), "caso al_cierre: el webhook actualizó la fila de pagos");
  assert(patchPagos1.body.estado === "completado", "caso al_cierre: pagos.estado -> completado");
  assert(Boolean(patchTraslados1), "caso al_cierre: el webhook actualizó traslados (este es el path que se cerró hoy)");
  assert(patchTraslados1.body.estado === "pago_completado", "caso al_cierre: traslados.estado -> pago_completado");

  // --- Caso 2: pago anticipado, completado -> solicitud_creada debe pasar a documentacion_pendiente ---
  await resetMock();
  const ev2 = eventoPaymentIntent("payment_intent.succeeded", {
    id: "evt_test_anticipado_1",
    paymentIntentId: "pi_test_anticipado",
    trasladoId: "traslado-anticipado"
  });
  const r2 = await enviarEvento(ev2);
  assert(r2.status === 200, `caso anticipado: respuesta 200 (fue ${r2.status})`);
  const reqs2 = await obtenerRequestsMock();
  const patchTraslados2 = reqs2.find((r) => r.method === "PATCH" && r.path === "/rest/v1/traslados");
  assert(Boolean(patchTraslados2), "caso anticipado: el webhook actualizó traslados");
  assert(
    patchTraslados2.body.estado === "documentacion_pendiente",
    `caso anticipado: traslados.estado -> documentacion_pendiente (fue ${patchTraslados2.body.estado}) — confirma que NO rompí el camino existente`
  );

  // --- Caso 3: pago fallido -> pagos.estado = fallido, SIN tocar traslados ---
  await resetMock();
  const ev3 = eventoPaymentIntent("payment_intent.payment_failed", {
    id: "evt_test_fallido_1",
    paymentIntentId: "pi_test_fallido",
    trasladoId: "traslado-fallido"
  });
  const r3 = await enviarEvento(ev3);
  assert(r3.status === 200, `caso fallido: respuesta 200 (fue ${r3.status})`);
  const reqs3 = await obtenerRequestsMock();
  const patchPagos3 = reqs3.find((r) => r.method === "PATCH" && r.path === "/rest/v1/pagos");
  const patchTraslados3 = reqs3.find((r) => r.method === "PATCH" && r.path === "/rest/v1/traslados");
  assert(patchPagos3?.body.estado === "fallido", "caso fallido: pagos.estado -> fallido");
  assert(!patchTraslados3, "caso fallido: NO debe avanzar el estado del traslado (estadoTrasladoSiguienteTrasPago exige completado)");

  // --- Caso 4: idempotencia — mismo evento ya procesado, no debe tocar nada ---
  await resetMock();
  const ev4 = eventoPaymentIntent("payment_intent.succeeded", {
    id: "evt_test_idem_1", // coincide con el stripe_event_id ya guardado en el seed del mock
    paymentIntentId: "pi_test_idem",
    trasladoId: "traslado-idem"
  });
  const r4 = await enviarEvento(ev4);
  assert(r4.status === 200, `caso idempotencia: respuesta 200 (fue ${r4.status})`);
  const reqs4 = await obtenerRequestsMock();
  const algunPatch4 = reqs4.find((r) => r.method === "PATCH");
  assert(!algunPatch4, "caso idempotencia: el reintento de Stripe NO debe volver a escribir nada");

  // --- Caso 5: tipo de evento no manejado -> 200, sin tocar el mock para nada ---
  await resetMock();
  const ev5 = { id: "evt_test_no_manejado", object: "event", type: "charge.refunded", data: { object: {} } };
  const r5 = await enviarEvento(ev5);
  assert(r5.status === 200, `caso no-manejado: respuesta 200 (fue ${r5.status})`);
  const reqs5 = await obtenerRequestsMock();
  assert(reqs5.length === 0, "caso no-manejado: el webhook no debe llamar a Supabase para nada");

  // --- Caso 6: firma inválida -> 400, sin tocar el mock para nada ---
  await resetMock();
  const ev6 = eventoPaymentIntent("payment_intent.succeeded", {
    id: "evt_test_firma_mala",
    paymentIntentId: "pi_test_alcierre",
    trasladoId: "traslado-alcierre"
  });
  const r6 = await enviarEvento(ev6, { secret: "whsec_secreto_incorrecto" });
  assert(r6.status === 400, `caso firma inválida: respuesta 400 (fue ${r6.status}: ${r6.texto})`);
  const reqs6 = await obtenerRequestsMock();
  assert(reqs6.length === 0, "caso firma inválida: el webhook no debe llamar a Supabase para nada");

  console.log("\nTodos los casos del webhook real (index.ts, vía HTTP, firma real) pasaron.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
