import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { crearTraslado } from "@ruum/api/services";
import { limpiarBorradorTrasladoLocal } from "../../../../lib/borrador-traslado";
import { construirPayloadCreacion, type CoordenadasTraslado } from "../adapters";
import type { DatosFormulario } from "../types";

export function useNuevoTraslado() {
  async function crear(
    cliente: SupabaseClient<Database>, datos: DatosFormulario, vehiculoSeleccionadoId: string,
    coordenadas: CoordenadasTraslado, claveIdempotencia: string
  ) {
    if (!claveIdempotencia) throw new Error("No se pudo generar la clave de seguridad de la solicitud.");
    const payload = construirPayloadCreacion(datos, vehiculoSeleccionadoId, coordenadas);
    const traslado = await crearTraslado(cliente, payload.vehiculo, payload.traslado, claveIdempotencia);
    limpiarBorradorTrasladoLocal();
    return traslado;
  }
  return { crear };
}
