import test from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  scanDir,
  scanFile,
  runScan,
  esValorPlaceholder,
  esJwtServiceRole,
  esJwtValido,
  debeInspeccionarArchivo,
  enmascarar
} from "../../scripts/scan-secrets.mjs";

const ROOT_DIR = resolve(import.meta.dirname, "../..");
const FIXTURES_DIR = join(ROOT_DIR, "tests", "fixtures");
const POSITIVE_DIR = join(FIXTURES_DIR, "test-secret-positive");
const NEGATIVE_DIR = join(FIXTURES_DIR, "test-secret-negative");

test("scan:secrets — Detecta secretos falsos en test-secret-positive", () => {
  const hallazgos = scanDir(POSITIVE_DIR);
  assert.ok(hallazgos.length >= 6, `Se esperaban múltiples hallazgos, se encontraron: ${hallazgos.length}`);

  const labels = hallazgos.map((h) => h.label);

  // 1. Supabase service_role
  assert.ok(
    labels.some((l) => l.includes("Supabase Service Role")),
    "Debe detectar Supabase Service Role"
  );

  // 2. Stripe Live Key
  assert.ok(
    labels.some((l) => l.includes("Stripe API Key de producción (live)")),
    "Debe detectar Stripe Live API Key"
  );

  // 3. Stripe Webhook Secret
  assert.ok(
    labels.some((l) => l.includes("Stripe Webhook Secret")),
    "Debe detectar Stripe Webhook Secret"
  );

  // 4. Resend API Key
  assert.ok(
    labels.some((l) => l.includes("Resend API Key")),
    "Debe detectar Resend API Key"
  );

  // 5. Mapbox Secret Token
  assert.ok(
    labels.some((l) => l.includes("Mapbox Secret Token")),
    "Debe detectar Mapbox Secret Token"
  );

  // 6. Clave Privada
  assert.ok(
    labels.some((l) => l.includes("Clave privada")),
    "Debe detectar Clave Privada en archivo .key"
  );

  // 7. Contraseña conocida E2E
  assert.ok(
    labels.some((l) => l.includes("Contraseña conocida de pruebas E2E expuesta")),
    "Debe detectar contraseña E2E comprometida"
  );
});

test("scan:secrets — Ignora valores placeholder permitidos en test-secret-negative", () => {
  const hallazgos = scanDir(NEGATIVE_DIR);
  assert.equal(
    hallazgos.length,
    0,
    `No debe haber hallazgos en test-secret-negative. Hallazgos encontrados: ${JSON.stringify(hallazgos)}`
  );
});

test("scan:secrets — CLI devuelve exit code 1 ante detección positiva", () => {
  assert.throws(
    () => {
      execFileSync(process.execPath, [join(ROOT_DIR, "scripts", "scan-secrets.mjs"), POSITIVE_DIR], {
        encoding: "utf-8",
        stdio: "pipe"
      });
    },
    (err) => {
      assert.equal(err.status, 1, "Exit code debe ser 1 ante detección de secretos");
      return true;
    }
  );
});

test("scan:secrets — CLI devuelve exit code 0 ante fixture negativo limpio", () => {
  const output = execFileSync(
    process.execPath,
    [join(ROOT_DIR, "scripts", "scan-secrets.mjs"), NEGATIVE_DIR],
    {
      encoding: "utf-8",
      stdio: "pipe"
    }
  );
  assert.ok(output.includes("0 secretos detectados"));
});

test("scan:secrets — esValorPlaceholder reconoce patrones válidos y rechaza secretos reales", () => {
  // Placeholders permitidos
  assert.equal(esValorPlaceholder(""), true);
  assert.equal(esValorPlaceholder("your-supabase-anon-key"), true);
  assert.equal(esValorPlaceholder("your-api-key"), true);
  assert.equal(esValorPlaceholder("your-e2e-password-here"), true);
  assert.equal(esValorPlaceholder("sk_test_your_stripe_secret"), true);
  assert.equal(esValorPlaceholder("pk_test_ci"), true);
  assert.equal(esValorPlaceholder("ci-anon-key"), true);
  assert.equal(esValorPlaceholder("process.env.RESEND_API_KEY"), true);
  assert.equal(esValorPlaceholder("$STAGING_SERVICE_ROLE_KEY"), true);
  assert.equal(esValorPlaceholder("dummy_service_key"), true);
  assert.equal(esValorPlaceholder("<YOUR_TOKEN_HERE>"), true);
  assert.equal(esValorPlaceholder("TODO"), true);
  assert.equal(esValorPlaceholder("CHANGE_ME"), true);

  // Secretos reales (no placeholders)
  assert.equal(esValorPlaceholder("sk_live_51AbcDefGhIjKlMnOpQrStUvWxYz1234567890"), false);
  assert.equal(esValorPlaceholder("whsec_abcdef1234567890abcdef1234567890"), false);
  assert.equal(esValorPlaceholder("re_12345678_abcdefghijklmnopqrstuvwxyz"), false);
  assert.equal(esValorPlaceholder("SeguraE2E2026!"), false);
});

test("scan:secrets — esJwtServiceRole detecta payload service_role decodificado", () => {
  // JWT sintético con role: service_role
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payloadSr = Buffer.from(JSON.stringify({ role: "service_role", iss: "supabase" })).toString("base64url");
  const jwtSr = `${header}.${payloadSr}.signature1234567890`;

  assert.equal(esJwtValido(jwtSr), true);
  assert.equal(esJwtServiceRole(jwtSr), true);

  // JWT sintético de usuario normal (role: authenticated)
  const payloadUser = Buffer.from(JSON.stringify({ role: "authenticated", sub: "user-123" })).toString("base64url");
  const jwtUser = `${header}.${payloadUser}.signature1234567890`;

  assert.equal(esJwtValido(jwtUser), true);
  assert.equal(esJwtServiceRole(jwtUser), false);
});

test("scan:secrets — debeInspeccionarArchivo cubre .env*, .key, .pem y extensiones críticas", () => {
  // Archivos que DEBEN ser inspeccionados (sin punto ciego)
  assert.equal(debeInspeccionarArchivo(".env"), true);
  assert.equal(debeInspeccionarArchivo(".env.local"), true);
  assert.equal(debeInspeccionarArchivo(".env.test"), true);
  assert.equal(debeInspeccionarArchivo(".env.production"), true);
  assert.equal(debeInspeccionarArchivo(".env.development"), true);
  assert.equal(debeInspeccionarArchivo("server.pem"), true);
  assert.equal(debeInspeccionarArchivo("private.key"), true);
  assert.equal(debeInspeccionarArchivo("route.ts"), true);
  assert.equal(debeInspeccionarArchivo("index.js"), true);

  // Archivos y extensiones excluidos
  assert.equal(debeInspeccionarArchivo("pnpm-lock.yaml"), false);
  assert.equal(debeInspeccionarArchivo("image.png"), false);
  assert.equal(debeInspeccionarArchivo("document.pdf"), false);
});

test("scan:secrets — enmascarar oculta información confidencial", () => {
  const maskedLive = enmascarar("sk_live_51AbcDefGhIjKlMnOpQrStUvWxYz1234567890");
  assert.ok(maskedLive.startsWith("sk_live_"));
  assert.ok(maskedLive.includes("[REDACTED]"));
  assert.ok(!maskedLive.includes("GhIjKlMnOpQrStUvWxYz"));

  const maskedJwt = enmascarar("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.abcdef");
  assert.ok(maskedJwt.includes("[REDACTED_JWT]"));
  assert.ok(!maskedJwt.includes("eyJpc3MiOiJzdXBhYmFzZSJ9"));
});

test("scan:secrets — Repositorio limpio pasa escaneo completo con exit code 0", () => {
  const { hallazgos, exitCode } = runScan(ROOT_DIR, { excludeFixtures: true });
  assert.equal(exitCode, 0, `El repositorio contiene hallazgos bloqueantes: ${JSON.stringify(hallazgos)}`);
  assert.equal(hallazgos.length, 0);
});
