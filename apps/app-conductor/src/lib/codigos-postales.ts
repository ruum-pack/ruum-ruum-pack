"use client";

export type DatosCodigoPostal = {
  estado: string;
  ciudades: string[];
  colonias: string[];
};

const ESTADOS_MX = new Set([
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Coahuila de Zaragoza",
  "Colima",
  "Distrito Federal",
  "Durango",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "México",
  "Michoacán",
  "Michoacán de Ocampo",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Veracruz de Ignacio de la Llave",
  "Yucatán",
  "Zacatecas"
]);

const ALCALDIAS_CDMX_POR_PREFIJO: Record<string, string> = {
  "01": "Álvaro Obregón",
  "02": "Azcapotzalco",
  "03": "Benito Juárez",
  "04": "Coyoacán",
  "05": "Cuajimalpa de Morelos",
  "06": "Cuauhtémoc",
  "07": "Gustavo A. Madero",
  "08": "Iztacalco",
  "09": "Iztapalapa",
  "10": "La Magdalena Contreras",
  "11": "Miguel Hidalgo",
  "12": "Milpa Alta",
  "13": "Tláhuac",
  "14": "Tlalpan",
  "15": "Venustiano Carranza",
  "16": "Xochimilco"
};

function unicos(valores: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      valores
        .map((valor) => valor?.trim())
        .filter((valor): valor is string => Boolean(valor))
    )
  ).sort((a, b) => a.localeCompare(b, "es-MX"));
}

function extraerRegistrosCopomex(data: unknown) {
  if (Array.isArray(data)) {
    return data
      .map((item) => (item as { response?: unknown }).response)
      .filter((respuesta) => respuesta && typeof respuesta === "object");
  }
  const respuesta = (data as { response?: unknown }).response;
  if (Array.isArray(respuesta)) return respuesta;
  if (respuesta && typeof respuesta === "object") return [respuesta];
  return [];
}

function estadoNormalizado(estado: string) {
  if (estado === "Distrito Federal") return "Ciudad de México";
  if (estado === "Coahuila de Zaragoza") return "Coahuila";
  if (estado === "Michoacán de Ocampo") return "Michoacán";
  if (estado === "Veracruz de Ignacio de la Llave") return "Veracruz";
  if (estado === "Nuevo Leon") return "Nuevo León";
  return estado;
}

function esEstadoValido(estado: string) {
  return ESTADOS_MX.has(estado.trim());
}

function alcaldiaCdmxPorCp(cp: string) {
  return ALCALDIAS_CDMX_POR_PREFIJO[cp.slice(0, 2)] ?? "";
}

async function consultarCpCopomex(cp: string): Promise<DatosCodigoPostal | null> {
  const respuesta = await fetch(`https://api.copomex.com/query/info_cp/${cp}?token=pruebas`);
  if (!respuesta.ok) return null;

  const registros = extraerRegistrosCopomex(await respuesta.json()) as Array<{
    estado?: string;
    ciudad?: string;
    municipio?: string;
    asentamiento?: string;
  }>;
  const estado = registros.find((registro) => registro.estado)?.estado ?? "";
  if (!estado || !esEstadoValido(estado)) return null;

  return {
    estado: estadoNormalizado(estado),
    ciudades: unicos(registros.flatMap((registro) => [registro.ciudad, registro.municipio])),
    colonias: unicos(registros.map((registro) => registro.asentamiento))
  };
}

async function consultarCpZippopotam(cp: string): Promise<DatosCodigoPostal | null> {
  const respuesta = await fetch(`https://api.zippopotam.us/mx/${cp}`);
  if (!respuesta.ok) return null;

  const data = (await respuesta.json()) as {
    places?: Array<{ "place name"?: string; state?: string }>;
  };
  const lugares = data.places ?? [];
  const estado = lugares.find((lugar) => lugar.state)?.state ?? "";
  if (!estado || !esEstadoValido(estado)) return null;

  const estadoFinal = estadoNormalizado(estado);
  return {
    estado: estadoFinal,
    ciudades: estadoFinal === "Ciudad de México" ? unicos([alcaldiaCdmxPorCp(cp)]) : [],
    colonias: unicos(lugares.map((lugar) => lugar["place name"]))
  };
}

export async function consultarCodigoPostalMx(cp: string): Promise<DatosCodigoPostal | null> {
  return (await consultarCpCopomex(cp)) ?? (await consultarCpZippopotam(cp));
}
