import {
  payloadCanonicoDidit,
  validarFirmaWebhookDidit,
} from "./didit-webhook.ts";

const secreto = "secreto-de-prueba";

async function firmar(payload: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const resultado = await crypto.subtle.sign(
    "HMAC",
    clave,
    new TextEncoder().encode(payload),
  );
  return Array.from(
    new Uint8Array(resultado),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function ahora(): string {
  return String(Math.floor(Date.now() / 1000));
}

Deno.test("valida X-Signature-V2 con JSON canónico aunque cambie el orden del body", async () => {
  const evento = {
    decision: { nombre: "José" },
    status: "Approved",
    session_id: "session-1",
    timestamp: Number(ahora()),
    webhook_type: "status.updated",
  };
  const body = JSON.stringify({
    webhook_type: evento.webhook_type,
    session_id: evento.session_id,
    status: evento.status,
    decision: evento.decision,
    timestamp: evento.timestamp,
  });

  const resultado = await validarFirmaWebhookDidit({
    payloadCrudo: body,
    evento,
    firmaV2: await firmar(payloadCanonicoDidit(evento)),
    firmaRaw: null,
    firmaSimple: null,
    timestamp: String(evento.timestamp),
    secreto,
  });

  if (!resultado.valida || !resultado.decisionAutenticada) {
    throw new Error("La firma V2 válida fue rechazada.");
  }
});

Deno.test("acepta X-Signature raw y el fallback Simple sin confiar en decision", async () => {
  const timestamp = ahora();
  const evento = {
    timestamp: Number(timestamp),
    session_id: "session-2",
    status: "Declined",
    webhook_type: "status.updated",
    decision: { resultado: "no debe persistirse con Simple" },
  };
  const body = JSON.stringify(evento);

  const raw = await validarFirmaWebhookDidit({
    payloadCrudo: body,
    evento,
    firmaV2: null,
    firmaRaw: await firmar(body),
    firmaSimple: null,
    timestamp,
    secreto,
  });
  if (!raw.valida || !raw.decisionAutenticada) {
    throw new Error("La firma raw válida fue rechazada.");
  }

  const simple = await validarFirmaWebhookDidit({
    payloadCrudo: body,
    evento,
    firmaV2: null,
    firmaRaw: null,
    firmaSimple: await firmar(
      `${timestamp}:${evento.session_id}:${evento.status}:${evento.webhook_type}`,
    ),
    timestamp,
    secreto,
  });
  if (!simple.valida || simple.decisionAutenticada) {
    throw new Error("El fallback Simple no fue clasificado correctamente.");
  }
});

Deno.test("rechaza una firma con timestamp fuera de ventana", async () => {
  const timestamp = String(Math.floor(Date.now() / 1000) - 301);
  const evento = {
    timestamp: Number(timestamp),
    session_id: "session-3",
    status: "Approved",
    webhook_type: "status.updated",
  };
  const resultado = await validarFirmaWebhookDidit({
    payloadCrudo: JSON.stringify(evento),
    evento,
    firmaV2: await firmar(payloadCanonicoDidit(evento)),
    firmaRaw: null,
    firmaSimple: null,
    timestamp,
    secreto,
  });

  if (resultado.valida) throw new Error("Se aceptó una firma expirada.");
});
