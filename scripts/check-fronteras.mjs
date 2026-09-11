// FASE 6 — Fronteras de acceso: impide que crezca el acceso directo a
// Supabase desde apps/*/src. Uso:
//   node scripts/check-fronteras.mjs            compara contra el baseline y falla si AUMENTA
//   node scripts/check-fronteras.mjs --write    regenera scripts/fronteras-baseline.json tras una migración legítima
// La reducción de conteos siempre está permitida; el aumento, nunca.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = join(RAIZ, "scripts", "fronteras-baseline.json");
const APPS = ["app-usuario", "app-conductor", "panel-admin"];
const EXTENSIONES = new Set([".ts", ".tsx"]);

function listarFuentes(directorio) {
  const archivos = [];
  const pila = [directorio];
  while (pila.length > 0) {
    const actual = pila.pop();
    for (const entrada of readdirSync(actual)) {
      const ruta = join(actual, entrada);
      const st = statSync(ruta);
      if (st.isDirectory()) {
        if (entrada === "node_modules" || entrada === ".next" || entrada === "dist") continue;
        pila.push(ruta);
      } else if ([...EXTENSIONES].some((ext) => ruta.endsWith(ext))) {
        archivos.push(ruta);
      }
    }
  }
  return archivos;
}

function sinComentariosLinea(contenido) {
  return contenido
    .split("\n")
    .filter((linea) => {
      const recortada = linea.trim();
      return !recortada.startsWith("//") && !recortada.startsWith("*") && !recortada.startsWith("/*");
    })
    .join("\n");
}

function contarViolaciones(contenido) {
  const codigo = sinComentariosLinea(contenido);
  const from = (codigo.match(/(?<!\bArray|\bBuffer|\bObject)\.from\s*\(/g) ?? []).length;
  const rpc = (codigo.match(/\.rpc\s*\(/g) ?? []).length;
  const invoke = (codigo.match(/\.invoke\s*\(/g) ?? []).length;
  return { from, rpc, invoke };
}

function medir() {
  const resultado = {};
  for (const app of APPS) {
    const total = { from: 0, rpc: 0, invoke: 0 };
    for (const archivo of listarFuentes(join(RAIZ, "apps", app, "src"))) {
      const conteo = contarViolaciones(readFileSync(archivo, "utf8"));
      total.from += conteo.from;
      total.rpc += conteo.rpc;
      total.invoke += conteo.invoke;
    }
    resultado[app] = total;
  }
  return resultado;
}

const actual = medir();

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE_PATH, JSON.stringify(actual, null, 2) + "\n");
  console.log("[fronteras] baseline actualizado:", JSON.stringify(actual));
  process.exit(0);
}

if (!existsSync(BASELINE_PATH)) {
  console.error("[fronteras] falta scripts/fronteras-baseline.json; genera con --write");
  process.exit(2);
}

const base = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
let aumento = false;
for (const app of APPS) {
  for (const clave of ["from", "rpc", "invoke"]) {
    const antes = base[app]?.[clave] ?? 0;
    const ahora = actual[app][clave];
    const marca = ahora > antes ? "AUMENTA ✗" : ahora < antes ? "baja ✓" : "igual =";
    console.log(`[fronteras] ${app}.${clave}: ${antes} -> ${ahora} ${marca}`);
    if (ahora > antes) aumento = true;
  }
}

if (aumento) {
  console.error("[fronteras] FASE 6: hay NUEVOS accesos directos a Supabase en apps/*. Muévelos a @ruum/api.");
  process.exit(1);
}
console.log("[fronteras] OK: sin nuevos accesos directos.");
