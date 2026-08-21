#!/usr/bin/env node
/**
 * Script para configurar variables de entorno en Vercel
 * Uso: node scripts/setup-vercel-env.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("📋 Configuración de Variables de Entorno para Vercel\n");
console.log("=".repeat(60));

// Leer versión desde config
let appVersion = "1.0.0";
try {
  const configPath = path.join(__dirname, "../config/app-version.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    appVersion = config.version;
  }
} catch (e) {
  console.warn("⚠️  No se pudo leer config/app-version.json");
}

const variables = {
  "app-conductor": {
    "NEXT_PUBLIC_SUPABASE_URL": {
      description: "URL del proyecto Supabase",
      example: "https://project-id.supabase.co",
      required: true,
    },
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": {
      description: "Clave anónima de Supabase (Settings > API)",
      example: "eyJhbGc...",
      required: true,
    },
    "NEXT_PUBLIC_APP_URL": {
      description: "URL base de la aplicación",
      example: "https://conductor.ruum.mx",
      required: true,
    },
    "NEXT_PUBLIC_APP_VERSION": {
      description: `Versión SemVer (del config/app-version.json: ${appVersion})`,
      example: appVersion,
      required: false,
      note: "Se carga automáticamente desde config/app-version.json",
    },
    "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN": {
      description: "Token público de Mapbox (comienza con pk.)",
      example: "pk.eyJ...",
      required: true,
    },
  },
  "app-usuario": {
    "NEXT_PUBLIC_SUPABASE_URL": {
      description: "URL del proyecto Supabase",
      example: "https://project-id.supabase.co",
      required: true,
    },
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": {
      description: "Clave anónima de Supabase",
      example: "eyJhbGc...",
      required: true,
    },
    "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN": {
      description: "Token público de Mapbox",
      example: "pk.eyJ...",
      required: true,
    },
  },
  "panel-admin": {
    "NEXT_PUBLIC_SUPABASE_URL": {
      description: "URL del proyecto Supabase",
      example: "https://project-id.supabase.co",
      required: true,
    },
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": {
      description: "Clave anónima de Supabase",
      example: "eyJhbGc...",
      required: true,
    },
  },
};

console.log("\n🚀 Variables requeridas por aplicación:\n");

for (const [app, vars] of Object.entries(variables)) {
  console.log(`\n📦 ${app}`);
  console.log("-".repeat(60));

  for (const [varName, config] of Object.entries(vars)) {
    const required = config.required ? "✅ REQUERIDO" : "⚠️  AUTOMÁTICO";
    console.log(
      `  ${required.padEnd(20)} ${varName}\n` +
        `    Descripción: ${config.description}\n` +
        `    Ejemplo:     ${config.example}\n` +
        (config.note ? `    Nota:        ${config.note}\n` : "")
    );
  }
}

console.log("\n" + "=".repeat(60));
console.log("\n📝 Próximos pasos:\n");
console.log("1. Abre tu proyecto en Vercel:");
console.log("   → https://vercel.com/dashboard\n");
console.log("2. Ve a Settings → Environment Variables\n");
console.log("3. Agrega cada variable con valor para Production\n");
console.log("4. Realiza un nuevo deploy:");
console.log("   → vercel --prod\n");

console.log("📚 Para más información, ver: docs/VERCEL_DEPLOYMENT.md\n");
