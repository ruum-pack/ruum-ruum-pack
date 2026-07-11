import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { registrarEvento } from "./auditoria";

type Cliente = SupabaseClient<Database>;
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type PayoutRow = Database["public"]["Tables"]["payouts_conductor"]["Row"];
type CuentaStripeRow = Database["public"]["Tables"]["cuentas_conductor_stripe"]["Row"];
type DocumentoConductorRow = Database["public"]["Tables"]["documentos_conductor"]["Row"];
type SolicitudConductorRow = Database["public"]["Tables"]["solicitudes_conductor"]["Row"];
type PreferenciasConductorRow = Database["public"]["Tables"]["preferencias_conductor"]["Row"];
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
export type DisponibilidadOperativaConductor = "disponible" | "no_disponible";

export type TipoDocumentoConductor =
  | "licencia_frente"
  | "licencia_reverso"
  | "identificacion_oficial"
  | "documento_operativo";

const BUCKET_DOCUMENTOS_CONDUCTOR = "documentos-conductor";
const TAMANO_MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024;
const EXTENSIONES_DOCUMENTO_PERMITIDAS = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);
const TIPOS_MIME_DOCUMENTO_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function nombreArchivoSeguro(nombre: string) {
  return nombre.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function extensionArchivo(nombre: string) {
  return nombre.split(".").pop()?.toLowerCase() ?? "";
}

function validarArchivoDocumentoConductor(archivo: File) {
  if (archivo.size > TAMANO_MAX_DOCUMENTO_BYTES) {
    throw new Error("El archivo debe pesar máximo 10 MB.");
  }

  const extension = extensionArchivo(archivo.name);
  if (!EXTENSIONES_DOCUMENTO_PERMITIDAS.has(extension) || !TIPOS_MIME_DOCUMENTO_PERMITIDOS.has(archivo.type)) {
    throw new Error("El documento debe ser una imagen JPG, PNG, WEBP o un PDF.");
  }
}

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

/** Solicitud de alta activa asociada a la sesión, antes de crear `conductores`. */
export async function obtenerSolicitudConductorActual(cliente: Cliente): Promise<SolicitudConductorRow | null> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) return null;

  const { data, error } = await cliente
    .from("solicitudes_conductor")
    .select("*")
    .eq("auth_user_id", sesion.user.id)
    .not("estado", "in", '("aprobado","rechazado")')
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
  tipo: TipoDocumentoConductor,
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

  try {
    await registrarEvento(cliente, "carga_documentos", "conductor", conductorId, {
      tipo,
      nombre_archivo: nombreArchivo
    });
  } catch {
    // La auditoria es complementaria: el documento ya quedo registrado para revision.
  }
}

export async function subirDocumentoConductor(
  cliente: Cliente,
  conductorId: string,
  tipo: TipoDocumentoConductor,
  archivo: File
) {
  validarArchivoDocumentoConductor(archivo);

  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) throw new Error("Inicia sesión para subir documentos.");

  const conductorAutenticado = await obtenerConductorIdActual(cliente);
  if (conductorAutenticado !== conductorId) {
    throw new Error("No puedes cargar documentos para otro conductor.");
  }

  const ruta = [
    sesion.user.id,
    conductorId,
    `${Date.now()}-${tipo}-${nombreArchivoSeguro(archivo.name)}`
  ].join("/");

  const { error: errorStorage } = await cliente.storage
    .from(BUCKET_DOCUMENTOS_CONDUCTOR)
    .upload(ruta, archivo, { upsert: false, contentType: archivo.type });

  if (errorStorage) throw errorStorage;

  // Compensación (auditoría H-7): si el archivo ya subió a Storage pero el
  // INSERT de la fila falla, el objeto quedaría huérfano en el bucket. Lo
  // borramos y propagamos el error original para que el flujo lo reintente.
  try {
    await registrarDocumentoConductor(cliente, conductorId, tipo, archivo.name, ruta);
  } catch (errorRegistro) {
    await cliente.storage.from(BUCKET_DOCUMENTOS_CONDUCTOR).remove([ruta]).catch(() => {
      // Si la limpieza falla, no ocultamos el error real del registro; una
      // tarea de barrido de huérfanos puede recogerlo después.
    });
    throw errorRegistro;
  }

  return { ruta };
}

export async function subirDocumentoSolicitudConductor(
  cliente: Cliente,
  solicitudId: string,
  tipo: TipoDocumentoConductor,
  archivo: File
) {
  validarArchivoDocumentoConductor(archivo);
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) throw new Error("Inicia sesión para subir documentos.");

  const solicitud = await obtenerSolicitudConductorActual(cliente);
  if (!solicitud || solicitud.id !== solicitudId) {
    throw new Error("No puedes cargar documentos para otra solicitud.");
  }

  const ruta = [sesion.user.id, "solicitudes", solicitudId, `${Date.now()}-${tipo}-${nombreArchivoSeguro(archivo.name)}`].join("/");
  const { error: errorStorage } = await cliente.storage
    .from(BUCKET_DOCUMENTOS_CONDUCTOR)
    .upload(ruta, archivo, { upsert: false, contentType: archivo.type });
  if (errorStorage) throw errorStorage;

  const { error: errorRegistro } = await cliente.from("documentos_conductor").insert({
    solicitud_id: solicitudId,
    conductor_id: null,
    tipo,
    nombre_archivo: archivo.name,
    url: ruta,
    estado: "en_revision"
  });
  if (errorRegistro) {
    await cliente.storage.from(BUCKET_DOCUMENTOS_CONDUCTOR).remove([ruta]).catch(() => undefined);
    throw errorRegistro;
  }

  try {
    await registrarEvento(cliente, "carga_documentos", "conductor", solicitudId, { tipo, nombre_archivo: archivo.name });
  } catch {
    // El documento ya quedó persistido; auditoría complementaria.
  }
  return { ruta };
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
