/// <reference lib="deno.ns" />
/// <reference lib="dom" />

type Registro = Record<string, unknown>;

export type ResultadoFirmaDidit = {
  valida: boolean;
  decisionAutenticada: boolean;
};

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

// Didit normaliza los floats cuyo valor es entero antes de firmar el JSON.
function normalizarFloats(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(normalizarFloats);
  if (esRegistro(valor)) {
    return Object.fromEntries(
      Object.entries(valor).map((
        [clave, dato],
      ) => [clave, normalizarFloats(dato)]),
    );
  }
  if (
    typeof valor === "number" && Number.isFinite(valor) &&
    !Number.isInteger(valor) && valor % 1 === 0
  ) {
    return Math.trunc(valor);
  }
  return valor;
}

function ordenarClaves(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarClaves);
  if (!esRegistro(valor)) return valor;

  return Object.keys(valor)
    .sort()
    .reduce<Registro>((resultado, clave) => {
      resultado[clave] = ordenarClaves(valor[clave]);
      return resultado;
    }, {});
}

/** Serializa el envelope V3 de Didit como JSON compacto y con claves ordenadas. */
export function payloadCanonicoDidit(evento: unknown): string {
  return JSON.stringify(ordenarClaves(normalizarFloats(evento)));
}

async function hmacHex(payload: string, secreto: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await crypto.subtle.sign(
    "HMAC",
    clave,
    new TextEncoder().encode(payload),
  );
  return Array.from(
    new Uint8Array(firma),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function compararFirmas(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || a.length !== b.length) return false;
  let diferencia = 0;
  for (let indice = 0; indice < b.length; indice += 1) {
    diferencia |= a.toLowerCase().charCodeAt(indice) ^
      b.toLowerCase().charCodeAt(indice);
  }
  return diferencia === 0;
}

function timestampValido(timestamp: string | null): boolean {
  if (!timestamp) return false;
  const valor = Number(timestamp);
  return Number.isFinite(valor) &&
    Math.abs(Math.floor(Date.now() / 1000) - valor) <= 300;
}

function firmaSimpleDidit(evento: Registro): string {
  return [
    evento.timestamp,
    evento.session_id,
    evento.status,
    evento.webhook_type,
  ]
    .map((
      valor,
    ) => (valor === undefined || valor === null ? "" : String(valor)))
    .join(":");
}

/**
 * Valida V2 (recomendado), raw y Simple. Simple autentica sólo el envelope;
 * por eso decisionAutenticada es false cuando se usa ese fallback.
 */
export async function validarFirmaWebhookDidit({
  payloadCrudo,
  evento,
  firmaV2,
  firmaRaw,
  firmaSimple,
  timestamp,
  secreto,
}: {
  payloadCrudo: string;
  evento: unknown;
  firmaV2: string | null;
  firmaRaw: string | null;
  firmaSimple: string | null;
  timestamp: string | null;
  secreto: string;
}): Promise<ResultadoFirmaDidit> {
  if (!secreto || !timestampValido(timestamp) || !esRegistro(evento)) {
    return { valida: false, decisionAutenticada: false };
  }

  if (
    firmaV2 &&
    compararFirmas(
      await hmacHex(payloadCanonicoDidit(evento), secreto),
      firmaV2,
    )
  ) {
    return { valida: true, decisionAutenticada: true };
  }

  if (
    firmaRaw && compararFirmas(await hmacHex(payloadCrudo, secreto), firmaRaw)
  ) {
    return { valida: true, decisionAutenticada: true };
  }

  if (
    firmaSimple &&
    compararFirmas(
      await hmacHex(firmaSimpleDidit(evento), secreto),
      firmaSimple,
    )
  ) {
    return { valida: true, decisionAutenticada: false };
  }

  return { valida: false, decisionAutenticada: false };
}
