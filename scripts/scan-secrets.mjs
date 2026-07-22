#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const EXCLUIR = new Set([
  "node_modules", ".next", ".turbo", "pnpm-lock.yaml", "dist", ".git",
  "resultados.json", "reporte.txt", "scan-secrets.mjs"
]);

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".yml", ".yaml"]);

const PATRONES = [
  { regex: /(?<!env\()['"](sk_live_|pk_live_)[A-Za-z0-9_\-]{10,}['"]/, nivel: "error", label: "API key de producción" },
  { regex: /(?<!env\()['"]sb_publishable_[A-Za-z0-9_\-]{10,}['"]/, nivel: "error", label: "Supabase publishable key" },
  { regex: /(?<!requiredEnv|Deno\.env\.get)SUPABASE_SERVICE_ROLE_KEY/, nivel: "warn", label: "Service role key sin env var" },
  { regex: /(?<!Deno\.env\.get|envRequerida|requiredEnv)STRIPE_WEBHOOK_SECRET/, nivel: "warn", label: "Webhook secret sin env var" },
  { regex: /(?<!Deno\.env\.get|envRequerida|requiredEnv)RESEND_API_KEY/, nivel: "warn", label: "Resend API key sin env var" },
  { regex: /(?<!Deno\.env\.get|envRequerida|requiredEnv)MAPBOX_ACCESS_TOKEN/, nivel: "warn", label: "Mapbox token sin env var" },
  { regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/, nivel: "error", label: "JWT hardcodeado" },
];

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
    for (const line of lines) {
      lineNum++;
      for (const patron of PATRONES) {
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

console.log(`\nEscaneo completo. ${resultados.length} hallazgos (${resultados.filter(h => h.nivel === "error").length} errores).`);
process.exit(exitCode);
