import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@ruum/shared/types";
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

const TAMANO_MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024;
const EXTENSIONES_DOCUMENTO_PERMITIDAS = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);
const TIPOS_MIME_DOCUMENTO_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

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

/** Solicitud más reciente de la sesión, incluida una ya enviada o rechazada. */
export async function obtenerSolicitudConductorActual(cliente: Cliente): Promise<SolicitudConductorRow | null> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) return null;

  const { data, error } = await cliente
    .from("solicitudes_conductor")
    .select("*")
    .eq("auth_user_id", sesion.user.id)
    .order("actualizado_en",{ascending:false})
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface ExpedienteSolicitudConductorV2 {
  datosPersonales: Json;
  domicilio: Json;
  licencia: Json;
  contactoEmergencia: Json;
}

export type TipoConsentimientoConductor =
  | "terminos_servicio"
  | "aviso_privacidad"
  | "autorizacion_antecedentes"
  | "declaracion_suspensiones";

export interface ConsentimientoConductor {
  tipoDocumento: TipoConsentimientoConductor;
  version: number;
}

export interface ResultadoSolicitudConductor {
  solicitudId: string | null;
  conductorId: string | null;
  estado: Database["public"]["Enums"]["estado_expediente_conductor"] | null;
  pasoActual: number;
}

function mapearResultadoSolicitud(
  fila: {
    solicitud_id: string | null;
    conductor_id: string | null;
    estado: Database["public"]["Enums"]["estado_expediente_conductor"] | null;
    paso_actual: number | null;
  } | undefined
): ResultadoSolicitudConductor {
  if (!fila) throw new Error("La operación no devolvió el expediente.");
  return {
    solicitudId: fila.solicitud_id,
    conductorId: fila.conductor_id,
    estado: fila.estado,
    pasoActual: fila.paso_actual ?? 0
  };
}

export async function iniciarSolicitudConductor(cliente: Cliente) {
  const { data, error } = await cliente.rpc("iniciar_solicitud_conductor");
  if (error) throw error;
  return mapearResultadoSolicitud(data?.[0]);
}

export async function guardarBorradorConductor(
  cliente: Cliente,
  expediente: ExpedienteSolicitudConductorV2,
  pasoActual: number
) {
  const { data, error } = await cliente.rpc("guardar_borrador_conductor", {
    p_paso_actual: pasoActual,
    p_datos_personales: expediente.datosPersonales,
    p_domicilio: expediente.domicilio,
    p_licencia: expediente.licencia,
    p_contacto_emergencia: expediente.contactoEmergencia
  });
  if (error) throw error;
  return mapearResultadoSolicitud(data?.[0]);
}

export async function registrarConsentimientosConductor(
  cliente: Cliente,
  solicitudId: string,
  consentimientos: ConsentimientoConductor[],
  canal: "web" | "android" | "ios",
  versionApp: string
) {
  const { data, error } = await cliente.rpc("registrar_consentimientos_conductor", {
    p_solicitud_id: solicitudId,
    p_consentimientos: consentimientos.map((consentimiento) => ({
      tipo_documento: consentimiento.tipoDocumento,
      version: consentimiento.version
    })),
    p_canal: canal,
    p_version_app: versionApp
  });
  if (error) throw error;
  return data;
}

export async function enviarSolicitudConductor(cliente: Cliente) {
  const { data, error } = await cliente.rpc("enviar_solicitud_conductor");
  if (error) throw error;
  return mapearResultadoSolicitud(data?.[0]);
}

export type EventoRegistroConductor =
  | "registro_iniciado"
  | "paso_visto"
  | "paso_completado"
  | "otp_error"
  | "rpc_error"
  | "documento_fallo"
  | "solicitud_enviada";

export interface DatosEventoRegistroConductor {
  sesionId: string;
  evento: EventoRegistroConductor;
  paso?: number;
  codigo?: string;
  duracionMs?: number;
}

/**
 * RT-27 — envía únicamente telemetría operativa acotada. El servidor toma
 * auth_user_id y solicitud_id de la sesión; el cliente nunca los decide.
 */
export async function registrarEventoRegistroConductor(
  cliente: Cliente,
  datos: DatosEventoRegistroConductor
) {
  const { data, error } = await cliente.rpc("registrar_evento_registro_conductor", {
    p_sesion_id: datos.sesionId,
    p_evento: datos.evento,
    p_paso: datos.paso ?? null,
    p_codigo: datos.codigo ?? null,
    p_duracion_ms: datos.duracionMs ?? null
  });
  if (error) throw error;
  return data;
}

/** Persiste PII después de autenticar; nunca usa `user_metadata`. */
export async function completarSolicitudConductorV2(
  cliente: Cliente,
  expediente: ExpedienteSolicitudConductorV2
) {
  const { data, error } = await cliente.rpc("completar_solicitud_conductor_v2", {
    p_datos_personales: expediente.datosPersonales,
    p_domicilio: expediente.domicilio,
    p_licencia: expediente.licencia,
    p_contacto_emergencia: expediente.contactoEmergencia
  });
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

async function subirDocumentoValidado(
  cliente: Cliente,
  objetivoId: string,
  tipo: TipoDocumentoConductor,
  archivo: File,
  documentoAnteriorId?: string
) {
  validarArchivoDocumentoConductor(archivo);
  const formulario = new FormData();
  formulario.set("objetivo_id", objetivoId);
  formulario.set("tipo", tipo);
  formulario.set("archivo", archivo);
  if (documentoAnteriorId) formulario.set("documento_anterior_id", documentoAnteriorId);
  const { data, error } = await cliente.functions.invoke("validar-documento-conductor", { body: formulario });
  if (error) {
    let mensaje = error.message;
    const contexto = "context" in error ? error.context : null;
    if (contexto instanceof Response) {
      try {
        const detalle = (await contexto.clone().json()) as { error?: string };
        mensaje = detalle.error ?? mensaje;
      } catch {
        // Conserva el mensaje de transporte cuando el servidor no devolvió JSON.
      }
    }
    throw new Error(mensaje);
  }
  return data as { documento_id: string; ruta: string };
}

export async function subirDocumentoConductor(
  cliente: Cliente,
  conductorId: string,
  tipo: TipoDocumentoConductor,
  archivo: File,
  documentoAnteriorId?: string
) {
  const conductorAutenticado = await obtenerConductorIdActual(cliente);
  if (conductorAutenticado !== conductorId) {
    throw new Error("No puedes cargar documentos para otro conductor.");
  }
  return subirDocumentoValidado(cliente, conductorId, tipo, archivo, documentoAnteriorId);
}

export async function subirDocumentoSolicitudConductor(
  cliente: Cliente,
  solicitudId: string,
  tipo: TipoDocumentoConductor,
  archivo: File,
  documentoAnteriorId?: string
) {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) throw new Error("Inicia sesión para subir documentos.");
  const { data: solicitud, error } = await cliente.from("solicitudes_conductor")
    .select("id").eq("id", solicitudId).eq("auth_user_id", sesion.user.id).maybeSingle();
  if (error || !solicitud) throw new Error("No puedes cargar documentos para otra solicitud.");
  return subirDocumentoValidado(cliente, solicitudId, tipo, archivo, documentoAnteriorId);
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
