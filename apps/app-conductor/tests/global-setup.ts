import { chromium, type FullConfig } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const AUTH_DIR = path.resolve(process.cwd(), "tests/.auth");
const AUTH_STATE_PATH = path.join(AUTH_DIR, "conductor.json");

const E2E_CONDUCTOR_ID = "00000000-0000-4000-8000-00000000e201";
const E2E_OWNER_ID = "00000000-0000-4000-8000-00000000e202";
const E2E_VEHICLE_ID = "00000000-0000-4000-8000-00000000e203";
const E2E_AVAILABLE_TRIP_ID = "00000000-0000-4000-8000-00000000e204";
const E2E_ACTIVE_TRIP_ID = "00000000-0000-4000-8000-00000000e205";
const E2E_PAYOUT_ID = "00000000-0000-4000-8000-00000000e206";

type AdminClient = SupabaseClient;

function requiredEnv(...names: string[]) {
  const value = names.map((name) => process.env[name]).find(Boolean);
  if (!value) {
    throw new Error(`Falta configurar una variable de entorno para E2E: ${names.join(" o ")}`);
  }
  return value;
}

function optionalEnv(defaultValue: string, ...names: string[]) {
  return names.map((name) => process.env[name]).find(Boolean) ?? defaultValue;
}

async function upsert(admin: AdminClient, table: string, values: Record<string, unknown>, onConflict = "id") {
  const { error } = await admin.from(table).upsert(values, { onConflict });
  if (error) throw new Error(`No se pudo preparar ${table}: ${error.message}`);
}

async function findAuthUserId(admin: AdminClient, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user.id;
    if (data.users.length < 100) break;
  }
  return null;
}

async function ensureAuthUser(admin: AdminClient, email: string, password: string, tipoRegistro: "conductor" | "usuario") {
  const existingId = await findAuthUserId(admin, email);
  if (existingId) {
    const { error } = await admin.auth.admin.updateUserById(existingId, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        tipo_registro: tipoRegistro,
        version_registro: tipoRegistro === "conductor" ? 2 : undefined,
        nombre: tipoRegistro === "conductor" ? "Conductor E2E Ruum" : "Usuario E2E Ruum",
        telefono: tipoRegistro === "conductor" ? "5510000201" : "5510000202",
        tipo_cuenta: tipoRegistro === "usuario" ? "personal" : undefined
      }
    });
    if (error) throw error;
    return existingId;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      tipo_registro: tipoRegistro,
      version_registro: tipoRegistro === "conductor" ? 2 : undefined,
      nombre: tipoRegistro === "conductor" ? "Conductor E2E Ruum" : "Usuario E2E Ruum",
      telefono: tipoRegistro === "conductor" ? "5510000201" : "5510000202",
      tipo_cuenta: tipoRegistro === "usuario" ? "personal" : undefined
    }
  });
  if (error) throw error;
  if (!data.user?.id) throw new Error(`No se pudo crear el usuario Auth E2E ${email}.`);
  return data.user.id;
}

async function ensureConductor(admin: AdminClient, authUserId: string) {
  const { data: existing, error: selectError } = await admin
    .from("conductores")
    .select("id, estado_expediente")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (selectError) throw selectError;

  const conductorId = existing?.id ?? E2E_CONDUCTOR_ID;
  if (!existing) {
    await upsert(admin, "conductores", {
      id: conductorId,
      auth_user_id: authUserId,
      nombre: "Conductor E2E Ruum",
      telefono: "+525510000201",
      curp: "EERC900101HDFRRL09",
      licencia_numero: "E2E-LIC-0201",
      licencia_tipo: "B",
      licencia_vigencia: "2030-12-31"
    });
  }

  const { error: updateError } = await admin
    .from("conductores")
    .update({
      nombre: "Conductor E2E Ruum",
      telefono: "+525510000201",
      curp: "EERC900101HDFRRL09",
      licencia_numero: "E2E-LIC-0201",
      licencia_tipo: "B",
      licencia_vigencia: "2030-12-31",
      estado: "activo",
      documentos_vigentes: true,
      nivel_por_experiencia: "ejecutivo",
      nivel_por_calificacion: "ejecutivo",
      calificacion_promedio: 5,
      traslados_completados: 12,
      suspensiones_activas: 0,
      no_presentaciones_6m: 0,
      incidencias_graves_6m: 0,
      incidencias_graves_12m: 0
    })
    .eq("id", conductorId);
  if (updateError) throw updateError;

  const { data: conductorActualizado, error: estadoError } = await admin
    .from("conductores")
    .select("estado_expediente")
    .eq("id", conductorId)
    .maybeSingle();
  if (estadoError) throw estadoError;

  const estadoActual = conductorActualizado?.estado_expediente;
  if (estadoActual && estadoActual !== "aprobado") {
    const transiciones: Record<string, string[]> = {
      borrador: ["correo_pendiente", "datos_incompletos", "documentos_pendientes", "listo_para_enviar", "en_revision", "aprobado"],
      correo_pendiente: ["datos_incompletos", "documentos_pendientes", "listo_para_enviar", "en_revision", "aprobado"],
      datos_incompletos: ["documentos_pendientes", "listo_para_enviar", "en_revision", "aprobado"],
      documentos_pendientes: ["listo_para_enviar", "en_revision", "aprobado"],
      listo_para_enviar: ["en_revision", "aprobado"],
      en_revision: ["aprobado"],
      requiere_correccion: ["listo_para_enviar", "en_revision", "aprobado"],
      suspendido: ["aprobado"]
    };
    for (const destino of transiciones[estadoActual] ?? []) {
      const { error } = await admin.rpc("cambiar_estado_expediente_conductor", {
        p_conductor_id: conductorId,
        p_destino: destino
      });
      if (error) throw new Error(`No se pudo aprobar el expediente E2E (${destino}): ${error.message}`);
    }
  }

  return conductorId;
}

async function prepareFixture(admin: AdminClient, conductorId: string, ownerAuthUserId: string) {
  await upsert(admin, "preferencias_conductor", {
    conductor_id: conductorId,
    modo_no_molestar: false,
    notificaciones_push: true,
    alertas_viaje: true,
    alertas_pago: true,
    alertas_documentos: true
  }, "conductor_id");

  const { data: existingOwner, error: ownerSelectError } = await admin
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", ownerAuthUserId)
    .maybeSingle();
  if (ownerSelectError) throw ownerSelectError;

  const ownerId = existingOwner?.id ?? E2E_OWNER_ID;
  await upsert(admin, "usuarios", {
    id: ownerId,
    auth_user_id: ownerAuthUserId,
    tipo_cuenta: "personal",
    rol: "personal",
    estado_verificacion: "verificado",
    traslados_completados_sin_incidencia: 3,
    metodo_pago_registrado: true
  });

  await upsert(admin, "vehiculos", {
    id: E2E_VEHICLE_ID,
    usuario_id: ownerId,
    tipo: "suv",
    marca: "Toyota",
    modelo: "RAV4 E2E",
    anio: 2024,
    color: "Azul",
    placas: "E2E-204",
    vin: "E2ERUUM0000000204",
    tiene_tarjeta_circulacion: true,
    tiene_verificacion: true,
    tiene_placas: true,
    puede_circular_rodando: true,
    categoria_tarifa: "ligero_b",
    gama: "media",
    condicion: "seminueva"
  });

  const trasladoBase = {
    usuario_id: ownerId,
    vehiculo_id: E2E_VEHICLE_ID,
    contacto_entrega_nombre: "Contacto origen E2E",
    contacto_entrega_telefono: "+525510000301",
    contacto_recepcion_nombre: "Contacto destino E2E",
    contacto_recepcion_telefono: "+525510000302",
    origen_lat: 19.4326077,
    origen_lng: -99.133208,
    origen_direccion: "Plaza de la Constitución 1",
    origen_ciudad: "Ciudad de México",
    origen_referencias: "Acceso por calle lateral",
    destino_lat: 19.359004,
    destino_lng: -99.276935,
    destino_direccion: "Santa Fe, Vasco de Quiroga 3800",
    destino_ciudad: "Ciudad de México",
    destino_referencias: "Recepción principal",
    precio_cotizado: 1450,
    precio_final: 1450,
    tipo_pago: "anticipado",
    modalidad_programacion: "programado",
    fecha_hora_programada: "2026-07-21T16:00:00-06:00",
    tipo_ruta: "local",
    tipo_servicio: "personal",
    motivo_servicio: "traslado_especial",
    instrucciones_especiales: "Fixture E2E. No usar para operación real.",
    distancia_km: 18.4,
    tiempo_estimado_horas: 0.85,
    presupuesto_usuario: 1500,
    cotizacion_expira_en: "2026-07-21T12:00:00-06:00"
  };

  await upsert(admin, "traslados", {
    ...trasladoBase,
    id: E2E_AVAILABLE_TRIP_ID,
    estado: "pendiente_de_conductor",
    conductor_id: null,
    clave_idempotencia: "00000000-0000-4000-8000-00000000e214"
  });

  await upsert(admin, "traslados", {
    ...trasladoBase,
    id: E2E_ACTIVE_TRIP_ID,
    estado: "evidencia_inicial_en_proceso",
    conductor_id: conductorId,
    clave_idempotencia: "00000000-0000-4000-8000-00000000e215",
    fecha_hora_programada: "2026-07-21T18:00:00-06:00"
  });

  for (const [index, tipo] of ["licencia_frente", "licencia_reverso", "identificacion_oficial", "documento_operativo"].entries()) {
    await upsert(admin, "documentos_conductor", {
      id: `00000000-0000-4000-8000-00000000e22${index}`,
      conductor_id: conductorId,
      tipo,
      nombre_archivo: `${tipo}.pdf`,
      url: `e2e/conductor/${tipo}.pdf`,
      estado: "aprobado",
      version: 1,
      es_actual: true
    });
  }

  await upsert(admin, "payouts_conductor", {
    id: E2E_PAYOUT_ID,
    conductor_id: conductorId,
    periodo_inicio: "2026-07-13",
    periodo_fin: "2026-07-19",
    monto_bruto: 3200,
    ajustes: 120,
    monto_neto: 3080,
    estado: "pendiente"
  });
}

async function globalSetup(config: FullConfig) {
  loadEnvConfig(process.cwd());

  const supabaseUrl = requiredEnv("PLAYWRIGHT_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const serviceRoleKey = requiredEnv("PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const conductorEmail = requiredEnv("PLAYWRIGHT_E2E_CONDUCTOR_EMAIL", "E2E_CONDUCTOR_EMAIL");
  const conductorPassword = requiredEnv("PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD", "E2E_CONDUCTOR_PASSWORD");
  const ownerEmail = optionalEnv("usuario-e2e-conductor@ruumruum.test", "PLAYWRIGHT_E2E_OWNER_EMAIL", "E2E_OWNER_EMAIL");
  const ownerPassword = optionalEnv("RuumE2E-owner-2026!", "PLAYWRIGHT_E2E_OWNER_PASSWORD", "E2E_OWNER_PASSWORD");
  const baseURL = String(config.projects[0].use.baseURL ?? "http://localhost:3001");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const conductorAuthUserId = await ensureAuthUser(admin, conductorEmail, conductorPassword, "conductor");
  const ownerAuthUserId = await ensureAuthUser(admin, ownerEmail, ownerPassword, "usuario");
  const conductorId = await ensureConductor(admin, conductorAuthUserId);
  await prepareFixture(admin, conductorId, ownerAuthUserId);

  await mkdir(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Correo").fill(conductorEmail);
    await page.getByLabel("Contraseña").fill(conductorPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL((url) => url.pathname === "/panel", { timeout: 30_000 });
    await page.context().storageState({ path: AUTH_STATE_PATH });
  } finally {
    await browser.close();
  }
}

export default globalSetup;
