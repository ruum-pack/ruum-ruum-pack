/**
 * Utilidades compartidas para traslados masivos mediante CSV.
 * Utilizado por apps/panel-admin y apps/app-usuario para garantizar
 * interoperabilidad, validación estricta y generación de plantillas.
 */

export const COLUMNAS_REQUERIDAS = [
  "vehiculo_marca",
  "vehiculo_modelo",
  "vehiculo_anio",
  "condicion",
  "origen_codigo_postal",
  "origen_colonia",
  "origen_calle",
  "origen_numero",
  "destino_codigo_postal",
  "destino_colonia",
  "destino_calle",
  "destino_numero"
] as const;

export const COLUMNAS_PLANTILLA = [
  "referencia_externa",
  "centro_costo",
  "orden_compra",
  "prioridad",
  "vehiculo_placas",
  "vehiculo_vin",
  "vehiculo_marca",
  "vehiculo_modelo",
  "vehiculo_anio",
  "vehiculo_color",
  "condicion",
  "contacto_entrega_nombre",
  "contacto_entrega_telefono",
  "contacto_recepcion_nombre",
  "contacto_recepcion_telefono",
  "origen_codigo_postal",
  "origen_colonia",
  "origen_calle",
  "origen_numero",
  "origen_referencias",
  "destino_codigo_postal",
  "destino_colonia",
  "destino_calle",
  "destino_numero",
  "destino_referencias",
  "modalidad_programacion",
  "fecha_hora_programada",
  "ventana_recoleccion",
  "ventana_entrega",
  "instrucciones_especiales"
] as const;

export const COLUMNAS_TECNICAS_OPCIONALES = [
  "origen_lat",
  "origen_lng",
  "destino_lat",
  "destino_lng",
  "distancia_km",
  "tiempo_estimado_horas"
] as const;

export const CAMPOS_PERMITIDOS = new Set<string>([
  ...COLUMNAS_PLANTILLA,
  ...COLUMNAS_TECNICAS_OPCIONALES
]);

export const EJEMPLO_CSV_PLANTILLA = [
  COLUMNAS_PLANTILLA.join(","),
  [
    "FLOT-001",
    "CC-NORTE",
    "OC-45881",
    "normal",
    "ABC123",
    "",
    "Nissan",
    "Versa",
    "2024",
    "Blanco",
    "seminueva",
    "Operaciones",
    "+525500000000",
    "Recepcion",
    "+525500000001",
    "06700",
    "Roma Norte",
    "Av. Reforma",
    "100",
    "Acceso por estacionamiento",
    "04360",
    "Copilco Universidad",
    "Av. Universidad",
    "300",
    "Entregar en recepción",
    "programado",
    "2026-07-20T12:00:00-06:00",
    "2026-07-20T11:00:00-06:00",
    "2026-07-20T14:00:00-06:00",
    "Unidad prioritaria"
  ].join(",")
].join("\n");

export type FilaCsv = Record<string, string>;

export interface RevisionArchivo {
  filas: FilaCsv[];
  errores: string[];
}

export function normalizarEncabezado(valor: string): string {
  return valor.trim().toLowerCase().replace(/\s+/g, "_");
}

export function separarCsv(linea: string, delimitador: string): string[] {
  const celdas: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let indice = 0; indice < linea.length; indice += 1) {
    const caracter = linea[indice];
    const siguiente = linea[indice + 1];
    if (caracter === '"' && siguiente === '"') {
      actual += '"';
      indice += 1;
      continue;
    }
    if (caracter === '"') {
      entreComillas = !entreComillas;
      continue;
    }
    if (caracter === delimitador && !entreComillas) {
      celdas.push(actual.trim());
      actual = "";
      continue;
    }
    actual += caracter;
  }

  celdas.push(actual.trim());
  return celdas;
}

export function revisarCsv(contenido: string): RevisionArchivo {
  const lineas = contenido.replace(/^\uFEFF/, "").split(/\r?\n/).filter((linea) => linea.trim());
  if (lineas.length < 2) {
    return { filas: [], errores: ["El archivo debe incluir encabezados y al menos una fila."] };
  }

  const delimitador = lineas[0]!.split(";").length > lineas[0]!.split(",").length ? ";" : ",";
  const encabezados = separarCsv(lineas[0]!, delimitador).map(normalizarEncabezado);
  const desconocidas = encabezados.filter((encabezado) => !CAMPOS_PERMITIDOS.has(encabezado));
  const faltantes = COLUMNAS_REQUERIDAS.filter((columna) => !encabezados.includes(columna));
  const errores = [
    ...desconocidas.map((columna) => `Columna no permitida: ${columna}`),
    ...faltantes.map((columna) => `Columna requerida faltante: ${columna}`)
  ];

  const filas = lineas.slice(1).map((linea) => {
    const celdas = separarCsv(linea, delimitador);
    return encabezados.reduce<FilaCsv>((fila, encabezado, indice) => {
      if (CAMPOS_PERMITIDOS.has(encabezado)) {
        fila[encabezado] = celdas[indice]?.trim() ?? "";
      }
      return fila;
    }, {});
  });

  return { filas, errores };
}
