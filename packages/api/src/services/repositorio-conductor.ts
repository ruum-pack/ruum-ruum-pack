/**
 * ARQ-003 — Repository Pattern + Zod RPC para App Conductor
 * Encapsula acceso a `conductores` y `traslados` vía Supabase con validación Zod
 * antes de cada RPC / query. Uso recomendado:
 *
 *   const repo = createConductorRepository(cliente)
 *   await repo.avanzarTraslado(trasladoId, "conductor_en_camino")
 *   await repo.aceptarViaje(trasladoId)
 *   await repo.guardarDatosBancarios({...})
 *
 * Mantiene compatibilidad: las funciones sueltas en `conductores.ts` / `traslados.ts`
 * siguen existiendo, pero nuevo código debe usar el repositorio.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import {
  rpcValidado,
  esquemaConductorAvanzaTraslado,
  esquemaConductorAceptaViaje,
  esquemaGuardarDatosBancarios,
} from "./_rpc-validado";

type Cliente = SupabaseClient<Database>;
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

export interface ConductorRepository {
  /** Obtiene conductor del usuario autenticado (auth_user_id) */
  obtenerActual(): Promise<ConductorRow | null>;
  /** Obtiene conductor por id (validado) */
  obtenerPorId(conductorId: string): Promise<ConductorRow | null>;
  /** Guarda datos bancarios vía RPC tipada y validada */
  guardarDatosBancarios(args: { titularCuenta: string; banco: string; clabe: string; numeroTarjeta?: string | null }): Promise<unknown>;
  /** Acepta viaje disponible (valida elegibilidad igual que traslados.ts) */
  aceptarViaje(trasladoId: string): Promise<void>;
  /** Avanza traslado al siguiente evento validado por Zod */
  avanzarTraslado(trasladoId: string, evento: typeof esquemaConductorAvanzaTraslado._type["p_evento"]): Promise<unknown>;
  /** Lista pasaportes del conductor */
  listarPasaportes(conductorId: string): Promise<PasaporteRow[]>;
}

export function createConductorRepository(cliente: Cliente): ConductorRepository {
  return {
    async obtenerActual() {
      const { data: sesion } = await cliente.auth.getUser();
      if (!sesion.user) return null;
      const { data, error } = await cliente.from("conductores").select("*").eq("auth_user_id", sesion.user.id).maybeSingle();
      if (error) throw error;
      return data;
    },

    async obtenerPorId(conductorId: string) {
      // Validación UUID antes de query (falla rápido, evita round-trip)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conductorId)) {
        throw new Error("conductorId debe ser un UUID válido");
      }
      const { data, error } = await cliente.from("conductores").select("*").eq("id", conductorId).maybeSingle();
      if (error) throw error;
      return data;
    },

    async guardarDatosBancarios(args) {
      const payload = {
        p_titular_cuenta: args.titularCuenta.trim(),
        p_banco: args.banco.trim(),
        p_clabe: args.clabe.replace(/\D/g, ""),
        p_numero_tarjeta: args.numeroTarjeta?.trim() ? args.numeroTarjeta.trim() : null,
      };
      const { data, error } = await rpcValidado(cliente, "conductor_guarda_datos_bancarios", esquemaGuardarDatosBancarios, payload);
      if (error) throw error;
      if (!data) throw new Error("No se pudieron guardar los datos bancarios.");
      return data;
    },

    async aceptarViaje(trasladoId: string) {
      const { error } = await rpcValidado(cliente, "conductor_acepta_viaje", esquemaConductorAceptaViaje, { p_traslado_id: trasladoId });
      if (error) throw new Error((error as { message?: string }).message || "El viaje ya no está disponible para aceptación.");
    },

    async avanzarTraslado(trasladoId: string, evento) {
      const { data, error } = await rpcValidado(cliente, "conductor_avanza_traslado", esquemaConductorAvanzaTraslado, {
        p_traslado_id: trasladoId,
        p_evento: evento,
      });
      if (error) throw error;
      return data;
    },

    async listarPasaportes(conductorId: string) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conductorId)) {
        throw new Error("conductorId inválido");
      }
      const { data, error } = await cliente.from("pasaporte_digital").select("*").eq("conductor_id", conductorId).order("creado_en", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  };
}

// Factory también para traslados genéricos (re-exportado)
export function createTrasladoRepository(cliente: Cliente) {
  const conductorRepo = createConductorRepository(cliente);
  return {
    conductor: conductorRepo,
    async obtenerPasaporte(trasladoId: string) {
      const { data, error } = await cliente.from("pasaporte_digital").select("*").eq("traslado_id", trasladoId).maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}
