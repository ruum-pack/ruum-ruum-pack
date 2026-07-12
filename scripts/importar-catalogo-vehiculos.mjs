import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const entrada = process.argv[2];
const salida = process.argv[3] ?? "apps/app-usuario/src/data/vehiculos.json";

if (!entrada) {
  throw new Error("Uso: node scripts/importar-catalogo-vehiculos.mjs <entrada.json> [salida.json]");
}

const datos = JSON.parse(await readFile(resolve(entrada), "utf8"));
if (!Array.isArray(datos)) throw new Error("El catálogo debe ser un arreglo JSON.");

const permitidos = new Set(["Automóviles", "Camiones ligeros"]);
const unicos = new Map();

for (const registro of datos) {
  const marca = typeof registro?.marca === "string" ? registro.marca.trim() : "";
  const modelo = typeof registro?.modelo === "string" ? registro.modelo.trim() : "";
  const tipo = typeof registro?.tipo === "string" ? registro.tipo.trim() : "";
  if (!marca || !modelo || !permitidos.has(tipo)) continue;
  const clave = `${marca}|${modelo}|${tipo}`.toLocaleLowerCase("es-MX");
  if (!unicos.has(clave)) unicos.set(clave, { marca, modelo, tipo });
}

const catalogo = [...unicos.values()].sort((a, b) =>
  a.marca.localeCompare(b.marca, "es-MX") || a.modelo.localeCompare(b.modelo, "es-MX")
);

const destino = resolve(salida);
await mkdir(dirname(destino), { recursive: true });
await writeFile(destino, `${JSON.stringify(catalogo, null, 2)}\n`, "utf8");
console.log(`Catálogo generado: ${catalogo.length} registros en ${destino}`);
