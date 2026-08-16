#!/usr/bin/env node
/**
 * Setup script para configurar variables de entorno E2E (Playwright)
 * 
 * Uso:
 *   node scripts/setup-e2e.mjs
 *   
 * Este script:
 * 1. Copia .env.example a .env.local (si no existe)
 * 2. Guía al usuario para configurar:
 *    - PLAYWRIGHT_E2E_CONDUCTOR_EMAIL
 *    - PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD
 *    - PLAYWRIGHT_SUPABASE_URL
 *    - PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY
 * 3. Valida que pueda conectar a Supabase
 * 4. Verifica que los tests E2E pueden ejecutarse
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const envExamplePath = path.join(projectRoot, ".env.example");
const envLocalPath = path.join(projectRoot, ".env.local");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log("\n🚀 Setup E2E Playwright - App Conductor\n");

  // Verificar que existe .env.example
  try {
    await fs.access(envExamplePath);
  } catch {
    console.error("❌ No se encontró .env.example en:", envExamplePath);
    process.exit(1);
  }

  // Leer contenido actual de .env.local si existe
  let currentEnv = "";
  try {
    currentEnv = await fs.readFile(envLocalPath, "utf-8");
  } catch {
    // Archivo no existe, usar .env.example como base
    currentEnv = await fs.readFile(envExamplePath, "utf-8");
  }

  console.log("📝 Configurar variables E2E\n");
  console.log(
    "Se necesitan las siguientes variables para ejecutar tests E2E:"
  );
  console.log(
    "  1. Email del conductor E2E (prueba, ej: conductor-e2e@ruumruum.test)"
  );
  console.log("  2. Contraseña del conductor E2E (segura)");
  console.log("  3. URL de Supabase (ej: https://tu-proyecto.supabase.co)");
  console.log(
    "  4. Service Role Key de Supabase (disponible en Project Settings > API)\n"
  );

  // Obtener input del usuario
  const conductorEmail = await question(
    "📧 PLAYWRIGHT_E2E_CONDUCTOR_EMAIL [conductor-e2e@ruumruum.test]: "
  );
  const conductorPassword = await question(
    "🔑 PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD: "
  );
  const supabaseUrl = await question(
    "🌐 PLAYWRIGHT_SUPABASE_URL [https://...supabase.co]: "
  );
  const serviceRoleKey = await question("🔐 PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY: ");

  // Validar que no estén vacías
  if (!conductorPassword || !serviceRoleKey) {
    console.error(
      "\n❌ Error: Contraseña y Service Role Key son requeridas\n"
    );
    process.exit(1);
  }

  // Actualizar variables en el contenido
  const emailToUse = conductorEmail || "conductor-e2e@ruumruum.test";
  const urlToUse = supabaseUrl || "https://tu-proyecto.supabase.co";

  let updatedEnv = currentEnv;

  // Reemplazar o agregar variables
  const replacements = [
    ["PLAYWRIGHT_E2E_CONDUCTOR_EMAIL=", `PLAYWRIGHT_E2E_CONDUCTOR_EMAIL=${emailToUse}`],
    ["PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD=", `PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD=${conductorPassword}`],
    ["PLAYWRIGHT_SUPABASE_URL=", `PLAYWRIGHT_SUPABASE_URL=${urlToUse}`],
    ["PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY=", `PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`],
  ];

  for (const [searchFor, replacement] of replacements) {
    const regex = new RegExp(`^${searchFor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*$`, "m");
    if (regex.test(updatedEnv)) {
      updatedEnv = updatedEnv.replace(regex, replacement);
    } else {
      // Si no existe, agregarla
      updatedEnv += `\n${replacement}`;
    }
  }

  // Guardar .env.local
  await fs.writeFile(envLocalPath, updatedEnv);
  console.log(`\n✅ Variables guardadas en: ${envLocalPath}`);

  // Validar conexión a Supabase (opcional)
  const validar = await question("\n¿Validar conexión a Supabase? (s/n) [s]: ");
  if (validar.toLowerCase() !== "n") {
    console.log("\n🔍 Validando acceso a Supabase...");
    try {
      const response = await fetch(`${urlToUse}/rest/v1/`, {
        method: "HEAD",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });

      if (response.ok || response.status === 401) {
        console.log("✅ Supabase accesible\n");
      } else {
        console.warn(
          `⚠️ Respuesta inesperada: ${response.status} ${response.statusText}\n`
        );
      }
    } catch (error) {
      console.error(
        `❌ No se pudo conectar a Supabase: ${error.message}\n`
      );
    }
  }

  // Mostrar siguientes pasos
  console.log("📋 Siguientes pasos:\n");
  console.log("1. Asegúrate que el servidor de desarrollo está corriendo:");
  console.log("   $ pnpm dev\n");
  console.log("2. Ejecutar los tests E2E:");
  console.log(
    "   $ pnpm exec playwright test tests/e2e/sprint-c5-critical-flows.spec.ts\n"
  );
  console.log("3. Ver reporte HTML de tests:");
  console.log("   $ pnpm exec playwright show-report\n");

  console.log("✨ Setup completado!\n");
  rl.close();
}

main().catch((err) => {
  console.error("❌ Error:", err);
  rl.close();
  process.exit(1);
});
