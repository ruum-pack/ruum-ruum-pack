#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, basename, resolve } from "node:path";

// Directorios excluidos (builds, dependencias, artefactos temporales)
const DIRS_EXCLUIDOS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".idea",
  ".vscode",
  ".husky",
  ".vercel",
  ".claude",
  "Nueva carpeta",
  "dist",
  "build",
  "out",
  "coverage",
  "test-results",
  "playwright-report",
  "lhci-reports",
  ".lighthouse-ci",
  ".lighthouseci",
  "storybook-static",
  "backups",
  ".gradle"
]);

// Archivos individuales excluidos
const ARCHIVOS_EXCLUIDOS = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "deno.lock",
  "scan-secrets.mjs",
  "scan-secrets.test.mjs",
  "resultados.json",
  "reporte.txt",
  ".DS_Store"
]);

// Extensiones binarias que no deben inspeccionarse
const EXTENSIONES_BINARIAS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".svg",
  ".pdf", ".docx", ".xlsx", ".zip", ".tar", ".gz",
  ".mp4", ".webm", ".woff", ".woff2", ".ttf", ".eot",
  ".keystore", ".jks", ".class", ".jar"
]);

// Extensiones de texto inspeccionadas
const EXTENSIONES_VALIDAS = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs",
  ".json", ".yml", ".yaml",
  ".sql", ".sh", ".bash", ".zsh",
  ".pem", ".key", ".env", ".md", ".txt"
]);

// Passwords conocidas / comprometidas en historial
const PASSWORDS_CONOCIDAS_E2E = [
  "SeguraE2E2026!",
  "RuumE2E-owner-2026!"
];

// Comprueba si un valor es un placeholder de prueba / plantilla permitido
export function esValorPlaceholder(valor) {
  if (!valor || typeof valor !== "string") return true;
  const v = valor.trim().replace(/^['"`]|['"`]$/g, "");
  if (!v || v === "undefined" || v === "null") return true;

  // Si es una variable de entorno de JS o Shell (ej: process.env.X, $VAR, ${VAR})
  if (
    v.startsWith("process.env.") ||
    v.startsWith("Deno.env.") ||
    v.startsWith("$") ||
    v.startsWith("${") ||
    v.includes("process.env") ||
    v.includes("Deno.env") ||
    v.startsWith("env.") ||
    v.startsWith("config.")
  ) {
    return true;
  }

  // Prefijos y patrones de placeholders estándar
  const patronesPlaceholder = [
    /^your[-_]/i,
    /[-_]here$/i,
    /^<.*>$/,
    /^TODO/i,
    /^CHANGE_ME/i,
    /^PLACEHOLDER/i,
    /^INSERT_/i,
    /^REPLACE_/i,
    /dummy/i,
    /mock/i,
    /fake/i,
    /sample/i,
    /test[-_]?placeholder/i,
    /test[-_]?dummy/i,
    /test[-_]?local/i,
    /^pk\.ci$/i,
    /^pk_test_ci$/i,
    /^sk_test_ci$/i,
    /^ci-anon-key$/i,
    /^0\.0\.0-ci$/i,
    /^ci$/i,
    /^localhost/i,
    /^http:\/\/localhost/i,
    /^https:\/\/ci\.supabase\.test/i,
    /^\.{3,}$/,
    /^pk_test_your_/i,
    /^sk_test_your_/i,
    /^your-mapbox/i,
    /^your-session/i,
    /^your-jwt/i,
    /^your-supabase/i,
    /^your-e2e/i,
    /^your-api-key/i,
    /^your-resend/i,
    /^your-stripe/i
  ];

  return patronesPlaceholder.some((regex) => regex.test(v));
}

// Verifica si un JWT es de Supabase service_role decodificando payload base64
export function esJwtServiceRole(jwt) {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return false;
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = Buffer.from(payloadBase64, "base64").toString("utf-8");
    const payload = JSON.parse(jsonStr);
    return payload.role === "service_role" || payload.role === "supabase_admin";
  } catch {
    return false;
  }
}

// Verifica si una cadena parece un JWT válido (3 partes base64url)
export function esJwtValido(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  if (!token.startsWith("eyJhbGciOi")) return false;
  // Validar longitud mínima de firma y payload para descartar "eyJhbGciOi..."
  return parts[0].length >= 10 && parts[1].length >= 10 && parts[2].length >= 10;
}

// Enmascara secretos para no imprimirlos en claro en consola ni logs
export function enmascarar(texto) {
  if (!texto) return "";
  const t = String(texto).trim();
  if (t.length <= 8) return "***";
  if (
    t.startsWith("sk_live_") ||
    t.startsWith("sk_test_") ||
    t.startsWith("rk_live_") ||
    t.startsWith("whsec_") ||
    t.startsWith("re_") ||
    t.startsWith("sk.eyJ")
  ) {
    const prefix = t.substring(0, Math.min(10, t.length));
    const suffix = t.substring(Math.max(0, t.length - 4));
    return `${prefix}...[REDACTED]...${suffix}`;
  }
  if (t.startsWith("eyJ")) {
    return `eyJ...[REDACTED_JWT]...${t.substring(Math.max(0, t.length - 6))}`;
  }
  return `${t.substring(0, 3)}...[REDACTED]...${t.substring(t.length - 3)}`;
}

// Determina si un archivo debe inspeccionarse
export function debeInspeccionarArchivo(nombreArchivo) {
  if (ARCHIVOS_EXCLUIDOS.has(nombreArchivo)) return false;

  const ext = extname(nombreArchivo).toLowerCase();
  if (EXTENSIONES_BINARIAS.has(ext)) return false;

  // Inspeccionar explícitamente archivos .env* o con extensiones de texto / clave
  if (
    nombreArchivo === ".env" ||
    nombreArchivo.startsWith(".env.") ||
    nombreArchivo.endsWith(".env") ||
    EXTENSIONES_VALIDAS.has(ext)
  ) {
    return true;
  }

  return false;
}

function esLineaComentario(line, filePath) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return true;
  // En archivos .env, .sh, .yml, .yaml, comentarios inician con #
  const ext = extname(filePath).toLowerCase();
  const base = basename(filePath).toLowerCase();
  if (base.startsWith(".env") || ext === ".sh" || ext === ".yml" || ext === ".yaml" || ext === ".conf") {
    if (trimmed.startsWith("#")) return true;
  }
  return false;
}

// Patrones de detección de secretos
export const PATRONES_SECRETOS = [
  // 1. Stripe Live / Restricted Keys
  {
    regex: /\b(sk_live_[0-9a-zA-Z]{20,}|rk_live_[0-9a-zA-Z]{20,})\b/,
    nivel: "error",
    label: "Stripe API Key de producción (live) hardcodeada",
    validar: (match) => !esValorPlaceholder(match[0])
  },
  // 2. Stripe Test Keys (no placeholder)
  {
    regex: /\b(sk_test_[0-9a-zA-Z]{20,}|rk_test_[0-9a-zA-Z]{20,})\b/,
    nivel: "error",
    label: "Stripe Secret Key de prueba hardcodeada con valor simulado o real",
    validar: (match, _line, esEjemplo) => !esEjemplo && !esValorPlaceholder(match[0])
  },
  // 3. Stripe Webhook Secret
  {
    regex: /\b(whsec_[0-9a-zA-Z]{20,})\b/,
    nivel: "error",
    label: "Stripe Webhook Secret hardcodeado",
    validar: (match, _line, esEjemplo) => !esEjemplo && !esValorPlaceholder(match[0])
  },
  // 4. Resend API Key
  {
    regex: /\b(re_[0-9a-zA-Z_]{20,})\b/,
    nivel: "error",
    label: "Resend API Key hardcodeada",
    validar: (match, _line, esEjemplo) => !esEjemplo && !esValorPlaceholder(match[0])
  },
  // 5. Mapbox Secret Token (sk.eyJ...)
  {
    regex: /\b(sk\.eyJ[0-9a-zA-Z_-]{20,})\b/,
    nivel: "error",
    label: "Mapbox Secret Token hardcodeado",
    validar: (match, _line, esEjemplo) => !esEjemplo && !esValorPlaceholder(match[0])
  },
  // 6. Clave Privada RSA / EC / DSA / OpenSSH
  {
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
    nivel: "error",
    label: "Clave privada hardcodeada",
    validar: (_match, rawLine, esEjemplo) => {
      // Ignorar si es una expresión regular de reemplazo/parseo en código (ej: /-----BEGIN.../)
      if (rawLine.includes("/-----BEGIN") || rawLine.includes("/^-----BEGIN")) {
        return false;
      }
      // En archivos .example, permitir si solo contiene "..."
      if (esEjemplo && (rawLine.includes("...") || rawLine.includes("\\n...\\n"))) {
        return false;
      }
      return true;
    }
  },
  // 7. Asignaciones de service_role en env o código
  {
    regex: /(?:SUPABASE_SERVICE_ROLE_KEY|PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*['"]?([^'"\s#;]+)['"]?/i,
    nivel: "error",
    label: "Supabase Service Role Key asignada hardcodeada",
    validar: (match, _line, esEjemplo) => {
      if (esEjemplo) return false;
      const val = match[1];
      if (esValorPlaceholder(val)) return false;
      return val.length >= 16;
    }
  },
  // 8. Asignaciones de secretos de proveedores
  {
    regex: /(?:STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RESEND_API_KEY|MAPBOX_SECRET_TOKEN)\s*[:=]\s*['"]?([^'"\s#;]+)['"]?/i,
    nivel: "error",
    label: "Secreto de proveedor (Stripe/Resend/Mapbox) asignado hardcodeado",
    validar: (match, _line, esEjemplo) => {
      if (esEjemplo) return false;
      const val = match[1];
      if (esValorPlaceholder(val)) return false;
      return val.length >= 10;
    }
  },
  // 9. Contraseñas conocidas y comprometidas E2E
  {
    regex: new RegExp(`(?:^|[^a-zA-Z0-9_])(${PASSWORDS_CONOCIDAS_E2E.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})(?:[^a-zA-Z0-9_]|$)`),
    nivel: "error",
    label: "Contraseña conocida de pruebas E2E expuesta",
    validar: (_match, _line, esEjemplo) => !esEjemplo
  },
  // 10. Asignaciones de contraseñas no-placeholder en archivos no-ejemplo
  {
    regex: /(?:PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD|PLAYWRIGHT_E2E_OWNER_PASSWORD|TEST_DRIVER_PASSWORD|TEST_PASSWORD)\s*[:=]\s*['"]?([^'"\s#;]+)['"]?/i,
    nivel: "error",
    label: "Contraseña E2E hardcodeada con valor real",
    validar: (match, _line, esEjemplo) => {
      if (esEjemplo) return false;
      const val = match[1];
      if (esValorPlaceholder(val)) return false;
      return val.length >= 6;
    }
  }
];

export function scanFile(filePath) {
  const hallazgos = [];
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const esEjemplo = filePath.includes(".example");
    let lineNum = 0;

    for (const rawLine of lines) {
      lineNum++;
      if (esLineaComentario(rawLine, filePath)) continue;

      // 1. Chequeo de JWTs completos en la línea
      const jwtMatches = rawLine.match(/eyJhbGciOi[A-Za-z0-9\-_+/=]+\.eyJ[A-Za-z0-9\-_+/=]+\.[A-Za-z0-9\-_+/=]+/g);
      if (jwtMatches) {
        for (const jwt of jwtMatches) {
          if (esValorPlaceholder(jwt)) continue;
          if (esJwtValido(jwt)) {
            const esServiceRole = esJwtServiceRole(jwt);
            hallazgos.push({
              archivo: filePath.replace(/\\/g, "/"),
              linea: lineNum,
              nivel: "error",
              label: esServiceRole ? "Supabase Service Role JWT hardcodeado" : "JWT de autenticación/servicio hardcodeado",
              contenido: enmascarar(jwt)
            });
          }
        }
      }

      // 2. Chequeo de patrones configurados
      for (const patron of PATRONES_SECRETOS) {
        const match = rawLine.match(patron.regex);
        if (match) {
          const esValido = patron.validar ? patron.validar(match, rawLine, esEjemplo, rawLine) : true;
          if (esValido) {
            hallazgos.push({
              archivo: filePath.replace(/\\/g, "/"),
              linea: lineNum,
              nivel: patron.nivel,
              label: patron.label,
              contenido: enmascarar(match[0])
            });
          }
        }
      }
    }
  } catch {
    /* skip unreadable */
  }
  return hallazgos;
}

export function scanDir(dir, options = {}) {
  const { excludeFixtures = false } = options;
  let hallazgos = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      let stats;
      try {
        stats = statSync(fullPath);
      } catch {
        continue;
      }

      if (stats.isDirectory()) {
        // Excluir carpetas ignoradas
        if (DIRS_EXCLUIDOS.has(entry)) continue;
        if (excludeFixtures && entry === "fixtures") continue;
        hallazgos = hallazgos.concat(scanDir(fullPath, options));
      } else if (stats.isFile()) {
        if (debeInspeccionarArchivo(entry)) {
          hallazgos = hallazgos.concat(scanFile(fullPath));
        }
      }
    }
  } catch {
    /* skip unreadable */
  }
  return hallazgos;
}

export function runScan(targetPath = process.cwd(), options = {}) {
  const resolved = resolve(targetPath);
  if (!existsSync(resolved)) {
    console.error(`❌ Ruta no encontrada: ${resolved}`);
    return { hallazgos: [], exitCode: 1 };
  }

  const stats = statSync(resolved);
  let hallazgos = [];

  if (stats.isDirectory()) {
    hallazgos = scanDir(resolved, options);
  } else if (stats.isFile()) {
    hallazgos = scanFile(resolved);
  }

  let exitCode = 0;
  for (const h of hallazgos) {
    console.log(`[${h.nivel.toUpperCase()}] ${h.archivo}:${h.linea} — ${h.label}`);
    console.log(`  Secreto detectado: ${h.contenido}\n`);
    if (h.nivel === "error") exitCode = 1;
  }

  if (hallazgos.length === 0) {
    console.log(`🔒 [scan:secrets] Escaneo completado en "${targetPath}": 0 secretos detectados.`);
  } else {
    const errores = hallazgos.filter((h) => h.nivel === "error").length;
    console.log(`\n❌ [scan:secrets] Escaneo completado: ${hallazgos.length} hallazgos (${errores} errores bloqueantes).`);
  }

  return { hallazgos, exitCode };
}

// Ejecución directa por CLI
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename || "")) {
  const target = process.argv[2] || process.cwd();
  // Cuando se escanea la raíz del proyecto, excluir fixtures de prueba deliberados
  const isRootScan = !process.argv[2] || resolve(process.argv[2]) === process.cwd();
  const { exitCode } = runScan(target, { excludeFixtures: isRootScan });
  process.exit(exitCode);
}
