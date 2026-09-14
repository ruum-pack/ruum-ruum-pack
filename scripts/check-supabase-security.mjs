import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve("supabase/migrations");
const generatedSnapshots = new Set(["20260807061826_remote_schema.sql"]);
const explicitlyPublicTables = new Set([
  // Catálogo legal versionado, sin datos de cuentas/operación.
  "versiones_documento_consentimiento",
  // Catálogo operativo público usado por el flujo de cotización.
  "operaciones",
]);

const quitarComentarios = (texto) => texto
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--[^\r\n]*/g, "");

const hallazgos = [];
for (const nombre of fs.readdirSync(migrationsDir).filter((entrada) => entrada.endsWith(".sql"))) {
  if (generatedSnapshots.has(nombre)) continue;
  const texto = quitarComentarios(fs.readFileSync(path.join(migrationsDir, nombre), "utf8"));
  for (const sentencia of texto.split(";")) {
    if (!/^\s*grant\b/i.test(sentencia) || !/\bto\s+(?:[^;]*,\s*)?"?anon"?\b/i.test(sentencia)) continue;
    const tabla = sentencia.match(/\bon\s+(?:table\s+)?"?public"?\."?([a-z_][a-z0-9_]*)"?/i)?.[1];
    if (tabla && !explicitlyPublicTables.has(tabla)) {
      hallazgos.push(`${nombre}: GRANT a anon sobre public.${tabla}`);
    }
  }
}

if (hallazgos.length) {
  console.error("Se detectaron grants de tabla a anon fuera del allowlist:");
  for (const hallazgo of hallazgos) console.error(`- ${hallazgo}`);
  process.exit(1);
}

console.log("Supabase security grant scan: OK (snapshots generados excluidos; tablas públicas explícitas revisadas).");
