import type { TipoVehiculo } from "@ruum/shared/types";
import catalogoJson from "../data/vehiculos.json";

export interface VehiculoCatalogo {
  marca: string;
  modelo: string;
  tipo: "Automóviles" | "Camiones ligeros";
}

const catalogo = catalogoJson as VehiculoCatalogo[];

export const MARCAS_CATALOGO = [...new Set(catalogo.map((vehiculo) => vehiculo.marca))]
  .sort((a, b) => a.localeCompare(b, "es-MX"));

export function modelosPorMarca(marca: string): string[] {
  const buscada = marca.trim().toLocaleLowerCase("es-MX");
  if (!buscada) return [];
  return [...new Set(catalogo
    .filter((vehiculo) => vehiculo.marca.toLocaleLowerCase("es-MX") === buscada)
    .map((vehiculo) => vehiculo.modelo))]
    .sort((a, b) => a.localeCompare(b, "es-MX"));
}

const MODELOS_VAN = /\b(van|transit|sprinter|hiace|urvan|promaster|crafter|transporter|caravelle|express|sienna|odyssey|pacifica|caravan)\b/i;
const MODELOS_PICKUP = /\b(pick.?up|frontier|np300|hilux|tacoma|tundra|ranger|l200|amarok|saveiro|tornado|strada|oroch|silverado|colorado|cheyenne|s10|ram|f[ -]?(150|250|350)|maverick|ridgeline|cybertruck)\b/i;

export function tipoSugeridoParaVehiculo(marca: string, modelo: string): TipoVehiculo | null {
  const marcaBuscada = marca.trim().toLocaleLowerCase("es-MX");
  const modeloBuscado = modelo.trim().toLocaleLowerCase("es-MX");
  const coincidencia = catalogo.find((vehiculo) =>
    vehiculo.marca.toLocaleLowerCase("es-MX") === marcaBuscada &&
    vehiculo.modelo.toLocaleLowerCase("es-MX") === modeloBuscado
  );
  if (!coincidencia) return null;
  if (coincidencia.tipo === "Automóviles") return "sedan";
  if (MODELOS_VAN.test(coincidencia.modelo)) return "van";
  if (MODELOS_PICKUP.test(coincidencia.modelo)) return "pick_up";
  return "suv";
}
