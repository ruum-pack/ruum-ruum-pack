// Inventario FASE 6: lista cada .from/.rpc/.invoke en apps/*/src con archivo y línea.
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = dirname(fileURLToPath(import.meta.url));
const APPS = ["app-usuario", "app-conductor", "panel-admin"];

function listarFuentes(directorio) {
  const archivos = [];
  const pila = [directorio];
  while (pila.length > 0) {
    const actual = pila.pop();
    for (const entrada of readdirSync(actual)) {
      const ruta = join(actual, entrada);
      const st = statSync(ruta);
      if (st.isDirectory()) {
        if (["node_modules", ".next", "dist"].includes(entrada)) continue;
        pila.push(ruta);
      } else if (ruta.endsWith(".ts") || ruta.endsWith(".tsx")) {
        archivos.push(ruta);
      }
    }
  }
  return archivos.sort();
}

for (const app of APPS) {
  console.log(`\n## ${app}`);
  for (const archivo of listarFuentes(join(RAIZ, "apps", app, "src"))) {
    const lineas = readFileSync(archivo, "utf8").split("\n");
    lineas.forEach((texto, i) => {
      const t = texto.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
      for (const m of texto.matchAll(/(?<!\bArray|\bBuffer|\bObject)(\.from\s*\(|\.rpc\s*\(|\.invoke\s*\()/g)) {
        console.log(`${relative(RAIZ, archivo)}:${i + 1} :: ${m[1].trim()} :: ${texto.trim().slice(0, 120)}`);
      }
    });
  }
}
