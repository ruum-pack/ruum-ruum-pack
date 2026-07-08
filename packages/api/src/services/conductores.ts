import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { registrarEvento } from "./auditoria";

type Cliente = SupabaseClient<Database>;
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type PayoutRow = Database["public"]["Tables"]["payouts_conductor"]["Row"];
type CuentaStripeRow = Database["public"]["Tables"]["cuentas_conductor_stripe"]["Row"];
type DocumentoConductorRow = Database["public"]["Tables"]["documentos_conductor"]["Row"];
type PreferenciasConductorRow = Database["public"]["Tables"]["preferencias_conductor"]["Row"];
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
export type DisponibilidadOperativaConductor = "disponible" | "no_disponible";

/** Conductor asociado a la sesión de Supabase Auth actual, si existe. */
export async function obtenerConductorActual(cliente: Cliente): Promise<ConductorRow | null> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) return null;

  const { data, error } = await cliente
    .from("conductores")
    .select("*")
    .eq("auth_user_id", sesion.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function obtenerConductorIdActual(cliente: Cliente): Promise<string> {
  const conductor = await obtenerConductorActual(cliente);
  if (!conductor) throw new Error("No se encontró el conductor autenticado.");
  return conductor.id;
}

export interface DatosGananciasConductor {
  cuentaStripe: CuentaStripeRow | null;
  payouts: PayoutRow[];
}

export async function obtenerGananciasConductor(cliente: Cliente, conductorId: string): Promise<DatosGananciasConductor> {
  const [cuenta, payouts] = await Promise.all([
    cliente.from("cuentas_conductor_stripe").select("*").eq("conductor_id", conductorId).maybeSingle(),
    cliente.from("payouts_conductor").select("*").eq("conductor_id", conductorId).order("periodo_inicio", { ascending: false })
  ]);

  if (cuenta.error) throw cuenta.error;
  if (payouts.error) throw payouts.error;

  return {
    cuentaStripe: cuenta.data ?? null,
    payouts: payouts.data ?? []
  };
}

export interface DatosConfiguracionConductor {
  conductor: ConductorRow;
  documentos: DocumentoConductorRow[];
  preferencias: PreferenciasConductorRow | null;
  historial: PasaporteRow[];
}

export async function obtenerConfiguracionConductor(cliente: Cliente, conductorId: string): Promise<DatosConfiguracionConductor> {
  const [conductor, documentos, preferencias, historial] = await Promise.all([
    cliente.from("conductores").select("*").eq("id", conductorId).maybeSingle(),
    cliente.from("documentos_conductor").select("*").eq("conductor_id", conductorId).order("creado_en", { ascending: false }),
    cliente.from("preferencias_conductor").select("*").eq("conductor_id", conductorId).maybeSingle(),
    cliente
      .from("pasaporte_digital")
      .select("*")
      .eq("conductor_id", conductorId)
      .order("actualizado_en", { ascending: false })
      .limit(12)
  ]);

  if (conductor.error) throw conductor.error;
  if (documentos.error) throw documentos.error;
  if (preferencias.error) throw preferencias.error;
  if (historial.error) throw historial.error;
  if (!conductor.data) throw new Error("No se encontró el conductor.");

  return {
    conductor: conductor.data,
    documentos: documentos.data ?? [],
    preferencias: preferencias.data ?? null,
    historial: historial.data ?? []
  };
}

export type PreferenciasConductorInput = Omit<PreferenciasConductorRow, "conductor_id" | "actualizado_en">;

export async function guardarPreferenciasConductor(
  cliente: Cliente,
  conductorId: string,
  preferencias: PreferenciasConductorInput
) {
  const { error } = await cliente
    .from("preferencias_conductor")
    .upsert({ conductor_id: conductorId, ...preferencias }, { onConflict: "conductor_id" });

  if (error) throw error;

  await registrarEvento(cliente, "modificacion_traslado_activo", "conductor", conductorId, {
    accion: "actualizacion_preferencias_conductor"
  });
}

export async function obtenerDisponibilidadConductor(
  cliente: Cliente,
  conductorId: string
): Promise<DisponibilidadOperativaConductor> {
  const { data, error } = await cliente
    .from("preferencias_conductor")
    .select("modo_no_molestar")
    .eq("conductor_id", conductorId)
    .maybeSingle();

  if (error) throw error;
  return data?.modo_no_molestar ? "no_disponible" : "disponible";
}

export async function guardarDisponibilidadConductor(
  cliente: Cliente,
  conductorId: string,
  disponibilidad: DisponibilidadOperativaConductor
) {
  const conductorAutenticado = await obtenerConductorIdActual(cliente);
  if (conductorAutenticado !== conductorId) {
    throw new Error("No puedes modificar la disponibilidad de otro conductor.");
  }

  const { error } = await cliente
    .from("preferencias_conductor")
    .upsert(
      {
        conductor_id: conductorId,
        modo_no_molestar: disponibilidad === "no_disponible"
      },
      { onConflict: "conductor_id" }
    );

  if (error) throw error;

  await registrarEvento(cliente, "modificacion_traslado_activo", "conductor", conductorId, {
    accion: "actualizacion_disponibilidad_conductor",
    disponibilidad
  });
}

export async function registrarDocumentoConductor(
  cliente: Cliente,
  conductorId: string,
  tipo: string,
  nombreArchivo: string,
  url: string
) {
  const conductorAutenticado = await obtenerConductorIdActual(cliente);
  if (conductorAutenticado !== conductorId) {
    throw new Error("No puedes cargar documentos para otro conductor.");
  }

  const { error } = await cliente.from("documentos_conductor").insert({
    conductor_id: conductorId,
    tipo,
    nombre_archivo: nombreArchivo,
    url,
    estado: "en_revision"
  });

  if (error) throw error;

  await registrarEvento(cliente, "carga_documentos", "conductor", conductorId, {
    tipo,
    nombre_archivo: nombreArchivo
  });
}

export async function actualizarPerfilConductor(cliente: Cliente, conductorId: string, datos: { nombre: string; telefono: string }) {
  const conductorAutenticado = await obtenerConductorIdActual(cliente);
  if (conductorAutenticado !== conductorId) {
    throw new Error("No puedes modificar el perfil de otro conductor.");
  }

  const telefono = datos.telefono.trim();
  const { error } = await cliente
    .from("conductores")
    .update({
      nombre: datos.nombre.trim(),
      telefono: telefono ? (telefono.startsWith("+") ? telefono : `+${telefono}`).replace(/\s+/g, "") : null
    })
    .eq("id", conductorId);

  if (error) throw error;
}
