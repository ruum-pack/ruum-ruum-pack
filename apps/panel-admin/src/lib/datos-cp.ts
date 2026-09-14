import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Directorio de shards de códigos postales para el panel-admin.
 * Fuente propia primero (`apps/panel-admin/public/data/codigos-postales`,
 * generada con `pnpm cp:generar`); fallback legacy al monorepo local
 * (`../app-usuario/...`) para no romper entornos ya generados.
 * Nunca depende de otra app en deploys por app (standalone/Vercel).
 */
function candidatos(): string[] {
  // Se calculan en cada llamada (no en la carga del módulo) para no congelar
  // un cwd distinto al de ejecución (tests, standalone, workers).
  return [
    join(process.cwd(), "public", "data", "codigos-postales"),
    join(process.cwd(), "..", "app-usuario", "public", "data", "codigos-postales"),
  ];
}

export function dirDatosCP(): string {
  const rutas = candidatos();
  const encontrado = rutas.find((dir) => existsSync(dir));
  if (!encontrado) {
    throw new Error(
      `Datos de códigos postales no encontrados (buscado en: ${rutas.join(" | ")}). Ejecuta pnpm cp:generar.`,
    );
  }
  return encontrado;
}

export function rutaShardCP(prefijo: string): string {
  return join(dirDatosCP(), `${prefijo}.json`);
}
