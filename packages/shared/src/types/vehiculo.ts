// PRD §4.2 — tipos de vehículo aceptados
export type TipoVehiculo = "sedan" | "suv" | "pick_up" | "van" | "luxury" | "coleccion";

export interface Vehiculo {
  id: string;
  usuario_id: string;
  tipo: TipoVehiculo;
  marca: string;
  modelo: string;
  anio: number;
  // Documentación obligatoria PRD §4.2
  tiene_tarjeta_circulacion: boolean;
  tiene_verificacion: boolean;
  tiene_placas: boolean;
  // Excepción §4.2: permiso legal vigente para circular sin placas/tarjeta
  permiso_especial_vigente?: string;
  // §4.2 — solo se aceptan vehículos en condiciones de circular rodando; no se aceptan arrastres
  puede_circular_rodando: boolean;
}
