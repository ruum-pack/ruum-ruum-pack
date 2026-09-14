import { spawnSync } from "node:child_process";

const modo = process.env.SUPABASE_DRIFT_MODE === "linked" ? "--linked" : "--local";
const resultado = spawnSync("supabase", [
  "db", "diff", modo, "--schema", "public,storage", "--use-migra",
], { encoding: "utf8" });

if (resultado.status !== 0) {
  process.stderr.write(resultado.stderr || resultado.stdout || "supabase db diff falló.\n");
  process.exit(resultado.status ?? 1);
}

const diff = (resultado.stdout || "").trim();
if (diff) {
  console.error(`Se detectó drift de esquema/policies (${modo}). No se permiten cambios manuales; crea una migración versionada.`);
  console.error(diff);
  process.exit(1);
}

console.log(`Supabase schema/policy drift: OK (${modo}).`);
