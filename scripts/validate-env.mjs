#!/usr/bin/env node
const app = process.argv[2] ?? "workspace";
const prod = process.env.NODE_ENV === "production";
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
  if (value && !/^https:\/\//.test(value)) invalid.push(`${name} debe usar https://`);
}
if (prod) {
  for (const name of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    const v = process.env[name];
    if (v && !/^https:\/\//.test(v)) invalid.push(`${name} debe usar https:// en producción`);
  }
  const mapbox = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (mapbox && !/^pk\./.test(mapbox)) invalid.push("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN debe empezar con pk.");
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  if (version && !/^\d+\.\d+\.\d+/.test(version)) invalid.push("NEXT_PUBLIC_APP_VERSION debe ser SemVer (ej. 1.0.0)");
  // NEXT_PUBLIC_APP_VERSION en producción no puede ser placeholder
  if (version === "0.0.1" || version === "ci") invalid.push("NEXT_PUBLIC_APP_VERSION no puede ser 0.0.1/ci en producción");
}
if (invalid.length) {
  console.error(`[env:${app}] Configuración inválida: ${invalid.join("; ")}`);
  process.exit(1);
}
console.log(`[env:${app}] configuración válida (${prod ? "production" : "non-production"}).`);
