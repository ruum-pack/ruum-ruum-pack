// FASE 6 — CIERRE ARQUITECTÓNICO.
// Regla final: apps/* no acceden Supabase PostgREST/RPC/Functions directamente.
// Únicamente se permiten excepciones explícitas, acotadas por archivo+tipo+máximo
// en fronteras-allowlist.json (Storage/offline/health de infraestructura).
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWLIST_PATH = join(RAIZ, "scripts", "fronteras-allowlist.json");
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

function contar(contenido) {
  const codigo = sinComentariosLinea(contenido);
  return {
    from: (codigo.match(/(?<!\bArray|\bBuffer|\bObject)\.from\s*\(/g) ?? []).length,
    rpc: (codigo.match(/\.rpc\s*\(/g) ?? []).length,
    invoke: (codigo.match(/\.invoke\s*\(/g) ?? []).length
  };
}

if (!existsSync(ALLOWLIST_PATH)) {
  console.error("[fronteras] falta scripts/fronteras-allowlist.json");
  process.exit(2);
}
const allow = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
let hayViolaciones = false;

for (const app of APPS) {
  const src = join(RAIZ, "apps", app, "src");
  const reglas = allow[app] ?? [];
  const totales = { from: 0, rpc: 0, invoke: 0 };
  const permitidos = { from: 0, rpc: 0, invoke: 0 };
  const violaciones = { from: 0, rpc: 0, invoke: 0 };

  for (const archivo of listarFuentes(src)) {
    const rel = relative(src, archivo).split(sep).join("/");
    const c = contar(readFileSync(archivo, "utf8"));
    for (const kind of ["from", "rpc", "invoke"]) {
      totales[kind] += c[kind];
      const regla = reglas.find((r) => r.file === rel && r.kind === kind);
      const permitido = Math.min(c[kind], regla?.max ?? 0);
      permitidos[kind] += permitido;
      const extra = c[kind] - permitido;
      if (extra > 0) {
        violaciones[kind] += extra;
        console.error(`[fronteras] VIOLACIÓN ${app}/${rel}: ${kind}=${c[kind]}, permitido=${regla?.max ?? 0}`);
      }
    }
  }

  for (const regla of reglas) {
    const ruta = join(src, regla.file);
    if (!existsSync(ruta)) {
      console.error(`[fronteras] allowlist obsoleta: no existe ${app}/${regla.file}`);
      hayViolaciones = true;
    }
  }

  console.log(`[fronteras] ${app}: raw=${JSON.stringify(totales)} allow=${JSON.stringify(permitidos)} violaciones=${JSON.stringify(violaciones)}`);
  if (Object.values(violaciones).some((v) => v > 0)) hayViolaciones = true;
}

if (hayViolaciones) {
  console.error("[fronteras] FASE 6 NO CERRADA: mueve el acceso a @ruum/api o documenta una excepción estrictamente infraestructural.");
  process.exit(1);
}
console.log("[fronteras] FASE 6 CERRADA: 0 accesos directos no justificados en apps/*.");
