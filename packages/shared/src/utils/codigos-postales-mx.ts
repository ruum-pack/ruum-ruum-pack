/**
 * Fase 5 (auditoría H-4) — reemplaza las consultas a COPOMEX (token de
 * demostración `pruebas`, solo responde para un puñado de CPs de ejemplo) y
 * al fallback de Zippopotam (sin municipios fuera de CDMX) por un catálogo
 * oficial de SEPOMEX embebido en cada app como JSON estático, particionado
 * por los primeros dos dígitos del CP para no cargar el catálogo completo
 * de una sola vez.
 *
 * Cada app (app-conductor, app-usuario) debe copiar los mismos archivos en
 * `public/data/codigos-postales/{prefijo}.json` — usa
 * `packages/shared/scripts/generar-codigos-postales-mx.mjs` para
 * regenerarlos si SEPOMEX publica una actualización del catálogo.
 */

export type DatosCodigoPostal = {
  estado: string;
  ciudades: string[];
  colonias: string[];
};

type ShardCodigosPostales = Record<string, DatosCodigoPostal>;

const REGEX_CP = /^\d{5}$/;
const RUTA_BASE_POR_DEFECTO = "/data/codigos-postales";

// Este paquete se mantiene agnóstico de entorno (sin lib "DOM" en tsconfig,
// porque también lo consumen edge functions). Tipamos `fetch` de forma
// estructural en vez de depender de los tipos globales del navegador.
type RespuestaFetchMinima = { ok: boolean; json: () => Promise<unknown> };
type FuncionFetch = (url: string) => Promise<RespuestaFetchMinima>;

function obtenerFetch(): FuncionFetch | null {
  const fetchGlobal = (globalThis as { fetch?: FuncionFetch }).fetch;
  return typeof fetchGlobal === "function" ? fetchGlobal : null;
}

// Una promesa en caché por prefijo: evita descargas duplicadas si varias
// consultas caen en el mismo shard mientras la primera todavía está en vuelo.
const cacheShards = new Map<string, Promise<ShardCodigosPostales | null>>();

async function obtenerShard(prefijo: string, rutaBase: string): Promise<ShardCodigosPostales | null> {
  const clave = `${rutaBase}/${prefijo}`;
  const existente = cacheShards.get(clave);
  if (existente) return existente;

  const promesa = (async () => {
    const fetchDisponible = obtenerFetch();
    if (!fetchDisponible) return null;
    try {
      const respuesta = await fetchDisponible(`${rutaBase}/${prefijo}.json`);
      if (!respuesta.ok) return null;
      return (await respuesta.json()) as ShardCodigosPostales;
    } catch {
      // Sin conexión o el shard no existe (prefijo sin CPs asignados).
      return null;
    }
  })();

  cacheShards.set(clave, promesa);
  const resultado = await promesa;
  if (!resultado) cacheShards.delete(clave); // permite reintentar si fue un error transitorio de red
  return resultado;
}

/**
 * Busca estado, ciudades/municipios y colonias para un CP mexicano de 5
 * dígitos usando el catálogo local (sin llamadas a APIs externas, funciona
 * offline una vez que el shard correspondiente se descargó una vez).
 */
export async function consultarCodigoPostalMx(
  cp: string,
  opciones?: { rutaBase?: string }
): Promise<DatosCodigoPostal | null> {
  if (!REGEX_CP.test(cp)) return null;
  const rutaBase = opciones?.rutaBase ?? RUTA_BASE_POR_DEFECTO;
  const shard = await obtenerShard(cp.slice(0, 2), rutaBase);
  return shard?.[cp] ?? null;
}
