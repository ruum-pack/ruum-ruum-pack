import type { TipoVehiculo } from "../types/vehiculo";
import catalogoJson from "../data/vehiculos-clasificacion.json";

export type TipoVehiculoFuente = "Automóviles" | "Camiones ligeros";
export type SegmentoVehiculoFuente = "Compactos" | "De Lujo" | "Deportivos" | "Minivans" | "Pick Ups" | "Subcompactos" | "SUV's";
export type CategoriaVehiculoFuente = "Ligero A" | "Ligero B";
export type GamaVehiculoFuente = "Alta" | "Entrada" | "Media" | "Premium";

export interface VehiculoCatalogo {
  marca: string;
  modelo: string;
  tipo: TipoVehiculoFuente;
  segmento: SegmentoVehiculoFuente;
  origen: string;
  paisOrigen: string;
  categoria: CategoriaVehiculoFuente;
  gama: GamaVehiculoFuente;
}

interface ArchivoCatalogoVehiculos {
  version: string;
  fuente: string;
  sha256Fuente: string;
  total: number;
  vehiculos: VehiculoCatalogo[];
}

const archivo = catalogoJson as ArchivoCatalogoVehiculos;

export const METADATOS_CATALOGO_VEHICULOS = Object.freeze({
  version: archivo.version,
  fuente: archivo.fuente,
  sha256Fuente: archivo.sha256Fuente,
  total: archivo.total,
});

export const CATALOGO_VEHICULOS: readonly VehiculoCatalogo[] = Object.freeze(archivo.vehiculos);

function claveBusqueda(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-MX");
}

function valoresUnicosOrdenados(values: string[]): string[] {
  const porClave = new Map<string, string>();
  for (const value of values) {
    const clave = claveBusqueda(value);
    if (clave && !porClave.has(clave)) porClave.set(clave, value);
  }
  return [...porClave.values()].sort((a, b) => a.localeCompare(b, "es-MX"));
}

export const MARCAS_CATALOGO = valoresUnicosOrdenados(CATALOGO_VEHICULOS.map((vehiculo) => vehiculo.marca));

export function modelosPorMarca(marca: string): string[] {
  const buscada = claveBusqueda(marca);
  if (!buscada) return [];
  return valoresUnicosOrdenados(
    CATALOGO_VEHICULOS
      .filter((vehiculo) => claveBusqueda(vehiculo.marca) === buscada)
      .map((vehiculo) => vehiculo.modelo),
  );
}

export function clasificacionesPorVehiculo(marca: string, modelo: string): VehiculoCatalogo[] {
  const marcaBuscada = claveBusqueda(marca);
  const modeloBuscado = claveBusqueda(modelo);
  if (!marcaBuscada || !modeloBuscado) return [];
  return CATALOGO_VEHICULOS.filter((vehiculo) =>
    claveBusqueda(vehiculo.marca) === marcaBuscada &&
    claveBusqueda(vehiculo.modelo) === modeloBuscado,
  );
}

function tipoRuumDesdeClasificacion(vehiculo: VehiculoCatalogo): TipoVehiculo {
  // El catálogo no contiene un atributo verificable para "Colección"; esa
  // clasificación permanece manual por unidad, igual que el blindaje.
  if (vehiculo.gama === "Premium" || vehiculo.segmento === "De Lujo") return "luxury";
  if (vehiculo.tipo === "Automóviles") return "sedan";
  if (vehiculo.segmento === "Pick Ups") return "pick_up";
  if (vehiculo.segmento === "Minivans") return "van";
  return "suv";
}

/**
 * Sugiere el tipo sólo cuando todas las filas homónimas del Excel coinciden.
 * Algunos modelos aparecen con más de un origen y tres tienen clasificaciones
 * divergentes; en esos casos no se fuerza un dato potencialmente incorrecto.
 */
export function tipoSugeridoParaVehiculo(marca: string, modelo: string): TipoVehiculo | null {
  const coincidencias = clasificacionesPorVehiculo(marca, modelo);
  const tipos = new Set(coincidencias.map(tipoRuumDesdeClasificacion));
  return tipos.size === 1 ? [...tipos][0] ?? null : null;
}

export function resumenClasificacionVehiculo(marca: string, modelo: string): string | null {
  const coincidencias = clasificacionesPorVehiculo(marca, modelo);
  if (coincidencias.length === 0) return null;
  const etiquetas = valoresUnicosOrdenados(
    coincidencias.map((vehiculo) => `${vehiculo.segmento} · Gama ${vehiculo.gama} · ${vehiculo.categoria}`),
  );
  return etiquetas.join(" / ");
}
