import type { TipoVehiculo } from "../types/vehiculo";

// PRD §4.2 — "Se aceptan sedán, SUV, pick up, vans, vehículos luxury y vehículos de colección."
export const ETIQUETA_TIPO_VEHICULO: Record<TipoVehiculo, string> = {
  sedan: "Sedán",
  suv: "SUV",
  pick_up: "Pick up",
  van: "Van",
  luxury: "Luxury",
  coleccion: "Colección"
};
