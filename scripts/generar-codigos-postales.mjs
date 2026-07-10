import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const fuente = resolve(process.argv[2] ?? "cp_mexico_full.json");
const destino = resolve(
  process.argv[3] ?? "apps/app-usuario/public/codigos-postales"
);

const registros = JSON.parse(await readFile(fuente, "utf8"));
if (!Array.isArray(registros)) {
  throw new TypeError("La fuente de códigos postales debe ser un arreglo JSON.");
}

const indice = new Map();

for (const registro of registros) {
  const cp = String(registro.d_codigo ?? "").padStart(5, "0");
  if (!/^\d{5}$/.test(cp)) continue;

  const actual = indice.get(cp) ?? {
    estado: String(registro.d_estado ?? "").trim(),
    ciudades: new Set(),
    colonias: new Set()
  };

  for (const ciudad of [registro.d_ciudad, registro.D_mnpio]) {
    const valor = String(ciudad ?? "").trim();
    if (valor) actual.ciudades.add(valor);
  }

  const colonia = String(registro.d_asenta ?? "").trim();
  if (colonia) actual.colonias.add(colonia);
  indice.set(cp, actual);
}

const porPrefijo = new Map();
const ordenar = (valores) =>
  [...valores].sort((a, b) => a.localeCompare(b, "es-MX"));

for (const [cp, datos] of indice) {
  const prefijo = cp.slice(0, 2);
  const grupo = porPrefijo.get(prefijo) ?? {};
  grupo[cp] = {
    estado: datos.estado,
    ciudades: ordenar(datos.ciudades),
    colonias: ordenar(datos.colonias)
  };
  porPrefijo.set(prefijo, grupo);
}

await rm(destino, { recursive: true, force: true });
await mkdir(destino, { recursive: true });

for (const [prefijo, codigos] of porPrefijo) {
  await writeFile(
    resolve(destino, `${prefijo}.json`),
    JSON.stringify(codigos),
    "utf8"
  );
}

await writeFile(
  resolve(destino, "manifest.json"),
  JSON.stringify({
    fuente: basename(fuente),
    codigosPostales: indice.size,
    archivos: porPrefijo.size
  }),
  "utf8"
);

console.log(
  `Generados ${indice.size} códigos postales en ${porPrefijo.size} archivos.`
);
