#!/usr/bin/env node
const app = process.argv[2] ?? "workspace";
const prod = process.env.NODE_ENV === "production";
const requiredByApp = {
  "panel-admin": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  "app-conductor": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN"],
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
if (invalid.length) {
  console.error(`[env:${app}] Configuración inválida: ${invalid.join("; ")}`);
  process.exit(1);
}
console.log(`[env:${app}] configuración válida (${prod ? "production" : "non-production"}).`);
