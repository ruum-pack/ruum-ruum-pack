#!/usr/bin/env node
/**
 * Regenera el catálogo local de códigos postales usado por
 * `@ruum/shared/utils` (consultarCodigoPostalMx).
 *
 * Entrada: el JSON completo de SEPOMEX (formato "CPdescarga.txt" convertido
 * a JSON; una fila por asentamiento, campos d_codigo/d_asenta/D_mnpio/
 * d_estado/d_ciudad). Se puede descargar desde:
 * https://www.correosdemexico.gob.mx/SSLServicios/ConsultaCP/CodigoPostal_Exportar.aspx
 *
 * Salida: un archivo `{prefijo}.json` por cada prefijo de 2 dígitos del CP
 * (00.json … 99.json), con la forma:
 *   { "01210": { "estado": "...", "ciudades": ["..."], "colonias": ["..."] } }
 *
 * Uso:
 *   node generar-codigos-postales-mx.mjs <ruta-json-sepomex> <dir-salida> [...dirs-salida-extra]
 *
 * Ejemplo (copia el resultado a las dos apps que lo consumen):
 *   node generar-codigos-postales-mx.mjs ./cp_mexico_full.json \
 *     ../../apps/app-conductor/public/data/codigos-postales \
 *     ../../apps/app-usuario/public/data/codigos-postales
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [, , rutaFuente, ...directoriosSalida] = process.argv;

if (!rutaFuente || directoriosSalida.length === 0) {
  console.error("Uso: node generar-codigos-postales-mx.mjs <ruta-json-sepomex> <dir-salida...>");
  process.exit(1);
}

const NORMALIZACION_ESTADO = {
  "Distrito Federal": "Ciudad de México",
  "Coahuila de Zaragoza": "Coahuila",
  "Michoacán de Ocampo": "Michoacán",
  "Veracruz de Ignacio de la Llave": "Veracruz",
  "Nuevo Leon": "Nuevo León"
};

function normalizarEstado(estado) {
  return NORMALIZACION_ESTADO[estado] ?? estado;
}

const filas = JSON.parse(readFileSync(rutaFuente, "utf-8"));

const porCp = new Map();
for (const fila of filas) {
  const cp = fila.d_codigo;
  if (!/^\d{5}$/.test(cp)) continue;

  let entrada = porCp.get(cp);
  if (!entrada) {
    entrada = { estado: null, ciudades: new Set(), colonias: new Set() };
    porCp.set(cp, entrada);
  }

  if (fila.d_estado) entrada.estado = normalizarEstado(fila.d_estado.trim());
  if (fila.d_ciudad) entrada.ciudades.add(fila.d_ciudad.trim());
  if (fila.D_mnpio) entrada.ciudades.add(fila.D_mnpio.trim());
  if (fila.d_asenta) entrada.colonias.add(fila.d_asenta.trim());
}

const shards = new Map();
for (const [cp, entrada] of porCp) {
  const prefijo = cp.slice(0, 2);
  if (!shards.has(prefijo)) shards.set(prefijo, {});
  shards.get(prefijo)[cp] = {
    estado: entrada.estado,
    ciudades: [...entrada.ciudades].sort((a, b) => a.localeCompare(b, "es-MX")),
    colonias: [...entrada.colonias].sort((a, b) => a.localeCompare(b, "es-MX"))
  };
}

for (const directorio of directoriosSalida) {
  mkdirSync(directorio, { recursive: true });
  for (const [prefijo, contenido] of shards) {
    writeFileSync(join(directorio, `${prefijo}.json`), JSON.stringify(contenido), "utf-8");
  }
  console.log(`${shards.size} shards escritos en ${directorio}`);
}

console.log(`Total de códigos postales: ${porCp.size}`);
