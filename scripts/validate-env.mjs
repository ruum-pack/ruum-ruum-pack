#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = process.argv[2] ?? "workspace";
const prod = process.env.NODE_ENV === "production";

// Cargar version desde config/app-version.json si no está en .env
if (!process.env.NEXT_PUBLIC_APP_VERSION) {
  try {
    const configPath = path.join(__dirname, "../config/app-version.json");
    if (fs.existsSync(configPath)) {
      const versionConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      process.env.NEXT_PUBLIC_APP_VERSION = versionConfig.version;
    }
  } catch (e) {
    // Continuar si no se puede leer
  }
}

// Intentar cargar variables faltantes desde .env.example en Vercel (solo desarrollo/preview)
if (process.env.VERCEL && !prod) {
  try {
    const appPath = app !== "workspace" ? path.join(__dirname, `../apps/${app}/.env.example`) : null;
    if (appPath && fs.existsSync(appPath)) {
      const exampleEnv = fs.readFileSync(appPath, "utf-8");
      for (const line of exampleEnv.split("\n")) {
        const match = line.match(/^([^=]+)=/);
        if (match && !process.env[match[1]]?.trim()) {
          // Usar valor dummy para development si no está configurado
          process.env[match[1]] = `__VERCEL_PREVIEW_${match[1]}__`;
        }
      }
    }
  } catch (e) {
    // Ignorar errores
  }
}

const requiredByApp = {
  "panel-admin": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  "app-conductor": [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_APP_VERSION",
    "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN"
  ],
  "app-usuario": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN"]
};
const required = requiredByApp[app] ?? [...new Set(Object.values(requiredByApp).flat())];
const missing = required.filter((name) => !process.env[name]?.trim());
const demo = process.env.NEXT_PUBLIC_PANEL_ADMIN_DEMO === "true";
const invalid = [];
if (prod && demo) invalid.push("NEXT_PUBLIC_PANEL_ADMIN_DEMO no puede ser true en producción");
if (prod && missing.length) invalid.push(`faltan variables: ${missing.join(", ")}`);
for (const name of required.filter((n) => n.includes("SUPABASE_URL"))) {
  const value = process.env[name];
  if (value && !/^https:\/\//.test(value) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(value) && !value.startsWith("__VERCEL")) 
    invalid.push(`${name} debe usar https://`);
}
if (prod) {
  for (const name of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    const v = process.env[name];
    if (v && !/^https:\/\//.test(v)) invalid.push(`${name} debe usar https:// en producción`);
  }
  const mapbox = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (mapbox && !/^pk\./.test(mapbox)) invalid.push("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN debe empezar con pk.");
  const isCi = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  if (version && !/^\d+\.\d+\.\d+/.test(version) && !isCi) invalid.push("NEXT_PUBLIC_APP_VERSION debe ser SemVer (ej. 1.0.0)");
  // NEXT_PUBLIC_APP_VERSION en producción real no puede ser placeholder
  if (!isCi && (version === "0.0.1" || version === "ci")) invalid.push("NEXT_PUBLIC_APP_VERSION no puede ser 0.0.1/ci en producción");
}
if (invalid.length) {
  console.error(`[env:${app}] Configuración inválida: ${invalid.join("; ")}`);
  process.exit(1);
}
console.log(`[env:${app}] configuración válida (${prod ? "production" : "non-production"}).`);
