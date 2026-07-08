// Mock mínimo de PostgREST (lo que @supabase/supabase-js termina llamando)
// para poder correr el index.ts REAL del webhook de Stripe sin un proyecto
// de Supabase desplegado. Solo entiende las dos tablas que el webhook toca:
// pagos y traslados, y solo las formas de query que ese archivo emite.

import http from "node:http";
import { URL } from "node:url";

// pi_xxx -> { traslado_id, stripe_event_id }  (estado del row en `pagos`)
const PAGOS = new Map();
// traslado_id -> { estado, tipo_pago }
const TRASLADOS = new Map();

const requestsLog = [];

function semilla() {
  PAGOS.clear();
  TRASLADOS.clear();
  requestsLog.length = 0;

  PAGOS.set("pi_test_alcierre", { traslado_id: "traslado-alcierre", stripe_event_id: null });
  TRASLADOS.set("traslado-alcierre", { estado: "pago_pendiente", tipo_pago: "al_cierre" });

  PAGOS.set("pi_test_anticipado", { traslado_id: "traslado-anticipado", stripe_event_id: null });
  TRASLADOS.set("traslado-anticipado", { estado: "solicitud_creada", tipo_pago: "anticipado" });

  PAGOS.set("pi_test_idem", { traslado_id: "traslado-idem", stripe_event_id: "evt_test_idem_1" });
  TRASLADOS.set("traslado-idem", { estado: "pago_pendiente", tipo_pago: "al_cierre" });

  PAGOS.set("pi_test_fallido", { traslado_id: "traslado-fallido", stripe_event_id: null });
  TRASLADOS.set("traslado-fallido", { estado: "pago_pendiente", tipo_pago: "al_cierre" });
}
semilla();

function eqValor(parametro) {
  // PostgREST: ?columna=eq.valor
  if (!parametro || !parametro.startsWith("eq.")) return null;
  return decodeURIComponent(parametro.slice(3));
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let parsedBody = null;
    if (body) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = body;
      }
    }

    requestsLog.push({ method: req.method, path: url.pathname, query: url.search, body: parsedBody });

    // Endpoint de depuración para que el runner del test inspeccione qué llamó el webhook de verdad.
    if (url.pathname === "/__requests" && req.method === "GET") {
      requestsLog.pop(); // no es una llamada real del webhook — no contaminar el log que se está leyendo
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(requestsLog));
      return;
    }
    if (url.pathname === "/__reset" && req.method === "POST") {
      semilla();
      res.writeHead(200);
      res.end("ok");
      return;
    }

    if (url.pathname === "/rest/v1/pagos") {
      const piId = eqValor(url.searchParams.get("stripe_payment_intent_id"));

      if (req.method === "GET") {
        const fila = piId ? PAGOS.get(piId) : null;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(fila ? JSON.stringify(fila) : "null");
        return;
      }

      if (req.method === "PATCH") {
        const fila = piId ? PAGOS.get(piId) : null;
        if (fila && parsedBody) Object.assign(fila, parsedBody);
        res.writeHead(204);
        res.end();
        return;
      }
    }

    if (url.pathname === "/rest/v1/traslados") {
      const trasladoId = eqValor(url.searchParams.get("id"));

      if (req.method === "GET") {
        const fila = trasladoId ? TRASLADOS.get(trasladoId) : null;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(fila ? JSON.stringify(fila) : "null");
        return;
      }

      if (req.method === "PATCH") {
        const fila = trasladoId ? TRASLADOS.get(trasladoId) : null;
        if (fila && parsedBody) Object.assign(fila, parsedBody);
        res.writeHead(204);
        res.end();
        return;
      }
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `mock sin ruta para ${req.method} ${url.pathname}` }));
  });
});

const PUERTO = 8787;
servidor.listen(PUERTO, () => {
  console.log(`mock-supabase escuchando en :${PUERTO}`);
});
