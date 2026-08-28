#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const EXCLUIR = new Set([
  "node_modules", ".next", ".turbo", "pnpm-lock.yaml", "dist", ".git",
  "resultados.json", "reporte.txt", "scan-secrets.mjs"
]);

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".yml", ".yaml"]);

// Patrones estrictos de detección de secretos reales hardcodeados
const PATRONES_SECRETOS = [
  { regex: /['"](sk_live_|pk_live_|rk_live_)[A-Za-z0-9_\-]{10,}['"]/, nivel: "error", label: "Stripe API key de producción hardcodeada" },
  { regex: /['"]sb_publishable_[A-Za-z0-9_\-]{10,}['"]/, nivel: "error", label: "Supabase publishable key hardcodeada" },
  { regex: /['"]whsec_[A-Za-z0-9_\-]{16,}['"]/, nivel: "error", label: "Stripe Webhook Secret hardcodeado" },
  { regex: /['"]re_[A-Za-z0-9_\-]{20,}['"]/, nivel: "error", label: "Resend API key hardcodeada" },
  { regex: /['"]sk\.[A-Za-z0-9_\-]{30,}['"]/, nivel: "error", label: "Mapbox secret token hardcodeado" },
  { regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/, nivel: "error", label: "JWT de servicio hardcodeado" },
  {
    regex: /(SUPABASE_SERVICE_ROLE_KEY|STRIPE_WEBHOOK_SECRET|RESEND_API_KEY)\s*[:=]\s*['"`][A-Za-z0-9_\-\.]{20,}['"`]/,
    nivel: "warn",
    label: "Posible asignación de secreto hardcodeado"
  }
];

function esLineaComentario(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("#")
  );
}

function esArchivoPrueba(filePath) {
  const norm = filePath.replace(/\\/g, "/");
  return (
    norm.includes(".test.") ||
    norm.includes("/test/") ||
    norm.includes("/tests/") ||
    norm.includes("/integration-test/") ||
    norm.includes("setup-e2e") ||
    norm.includes(".example")
  );
}

function scanDir(dir) {
  let hallazgos = [];
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (EXCLUIR.has(entry) || entry.startsWith(".")) continue;
      if (statSync(fullPath).isDirectory()) {
        hallazgos = hallazgos.concat(scanDir(fullPath));
      } else if (EXTENSIONS.has(extname(entry))) {
        hallazgos = hallazgos.concat(scanFile(fullPath));
      }
    }
  } catch { /* skip unreadable */ }
  return hallazgos;
}

function scanFile(filePath) {
  const hallazgos = [];
  try {
    const lines = readFileSync(filePath, "utf-8").split("\n");
    let lineNum = 0;
    const esPrueba = esArchivoPrueba(filePath);

    for (const line of lines) {
      lineNum++;
      if (esLineaComentario(line)) continue;

      for (const patron of PATRONES_SECRETOS) {
        // En archivos de prueba, permitir mock test secrets locales pero bloquear live API keys reales
        if (esPrueba && patron.label !== "Stripe API key de producción hardcodeada" && patron.label !== "JWT de servicio hardcodeado") {
          continue;
        }
        if (patron.regex.test(line)) {
          hallazgos.push({
            archivo: filePath.replace(/\\/g, "/"),
            linea: lineNum,
            nivel: patron.nivel,
            label: patron.label,
            contenido: line.trim().substring(0, 120)
          });
        }
      }
    }
  } catch { /* skip unreadable */ }
  return hallazgos;
}

const resultados = scanDir(process.cwd());
let exitCode = 0;

for (const h of resultados) {
  console.log(`[${h.nivel.toUpperCase()}] ${h.archivo}:${h.linea} — ${h.label}`);
  console.log(`  ${h.contenido}\n`);
  if (h.nivel === "error") exitCode = 1;
}

if (resultados.length === 0) {
  console.log("🔒 [scan:secrets] Escaneo completo: 0 secretos o advertencias detectadas.");
} else {
  console.log(`\nEscaneo completo. ${resultados.length} hallazgos (${resultados.filter(h => h.nivel === "error").length} errores).`);
}

process.exit(exitCode);
