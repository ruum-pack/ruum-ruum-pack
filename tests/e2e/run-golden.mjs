// Wrapper FASE 15: resuelve URL/keys del stack local vía `supabase status`
// y ejecuta el golden path E2E. Falla claro si el stack no está arriba.
import { spawnSync } from "node:child_process";

function leerStatus() {
  const r = spawnSync("supabase", ["status", "-o", "env"], { encoding: "utf8", shell: true });
  const env = {};
  // `supabase status -o env` emite una variable KEY="value" por línea.
  // (El shim de supabase en Windows puede devolver exit != 0 aun con salida válida.)
  const full = String(r.stdout ?? "");
  const re2 = /^([A-Z_]+)="(.*)"$/gm;
  let mm;
  while ((mm = re2.exec(full)) !== null) env[mm[1]] = mm[2];
  return env;
}

const env = leerStatus();
const URL = "http://127.0.0.1:54321";
const childEnv = {
  ...process.env,
  SUPABASE_URL: process.env.SUPABASE_URL ?? URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? env.ANON_KEY ?? "",
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ?? env.SERVICE_ROLE_KEY ?? ""
};

if (!childEnv.SUPABASE_ANON_KEY || !childEnv.SUPABASE_SERVICE_KEY) {
  console.error("No se resolvieron las keys del stack local.");
  process.exit(2);
}

const r = spawnSync(process.execPath, ["--test", "tests/e2e/golden-path-operacion.mjs"], {
  stdio: "inherit",
  env: childEnv
});
process.exit(r.status ?? 1);
