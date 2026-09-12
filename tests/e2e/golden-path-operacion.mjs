// FASE 15 — Golden path E2E: empresa crea operación, 5 vehículos, 5 traslados,
// asignación, aceptación, recolección, evidencia, tracking, entrega,
// confirmación, pago, cierre y operación completada.
// Atraviesa PostgREST + Auth + RLS + triggers + RPC reales contra el stack
// local. Las inserciones marcadas FIXTURE usan service_role (alta de datos
// base); todo el flujo de negocio usa JWT del rol correspondiente.
// Requiere: supabase local corriendo.
//   pnpm test:e2e:golden
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_KEY ?? "";
const SUF = Date.now().toString(36).toUpperCase();

if (!ANON || !SERVICE) {
  throw new Error("Faltan SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY en el entorno");
}

const HEADERS_SVC = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json"
};

async function api(path, { token = ANON, method = "GET", body = undefined, key = ANON } = {}) {
  const res = await fetch(`${URL}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${path} -> ${res.status} (no JSON): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return data;
}

const rpc = (fn, args, token) =>
  api(`/rest/v1/rpc/${fn}`, { method: "POST", body: args, token });

// RPC con service_role (solo setup operativo donde el esquema lo exige)
const rpcSvc = (fn, args) =>
  api(`/rest/v1/rpc/${fn}`, { method: "POST", body: args, token: SERVICE, key: SERVICE });

// FIXTURE: service_role (alta de datos base, bypass RLS)
const svc = (path, opts = {}) =>
  api(path, { ...opts, token: SERVICE, key: SERVICE });

async function crearAuth(email) {
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...HEADERS_SVC, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Golden-15-ok", email_confirm: true })
  });
  if (!res.ok) throw new Error(`admin users -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).id;
}

async function signIn(email) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Golden-15-ok" })
  });
  if (!res.ok) throw new Error(`sign-in ${email} -> ${res.status}`);
  return (await res.json()).access_token;
}

const email = (tag) => `e2e15-${tag}-${SUF}@local.test`.toLowerCase();
const NOWD = () => String(Date.now());
const telUnico = (dig, pref) => `55${pref}${dig}${NOWD().slice(-5)}`.slice(0, 10);
const LETRA = ["A", "B", "C", "D", "E"];
const curpUnica = (i) =>
  `GOLD000101HDF${SUF.slice(-2).toUpperCase()}${LETRA[i]}${SUF.slice(-3, -2).toUpperCase()}${NOWD().slice(-1)}`;
const TRASLADOS = [];
let ids = {};

describe("golden path operación (FASE 15)", () => {
  before(async () => {
    // FIXTURE: identidades
    const adminAuth = await crearAuth(email("torre"));
    const titularAuth = await crearAuth(email("titular"));
    const condAuth = {};
    for (const t of ["a", "b", "c", "d", "e"]) condAuth[t] = await crearAuth(email(`cond-${t}`));
    const outAuth = await crearAuth(email("out"));

    await svc("/rest/v1/admins", {
      method: "POST", body: { auth_user_id: adminAuth, nombre: "Torre E2E", rol_operativo: "direccion" }
    });

    // Empresa + titular (RPC real de Torre)
    const adminJwt = await signIn(email("torre"));
    const rfc = `GOL260101${SUF.slice(-3)}`;
    const emp = await rpc("admin_crea_empresa_corporativa", {
      p_empresa: {
        nombre: `E2E15 ${SUF}`, rfc, razon_social: `E2E15 ${SUF} SA de CV`,
        correo_facturacion: email("fact")
      },
      p_titular: { nombre: "Titular E2E", telefono: "+525500000015", correo_facturacion: email("tit"), metodo_pago_registrado: true }
    }, adminJwt);
    ids.empresa = emp.empresa_id;
    ids.titular = emp.usuario_id;
    // Vincular auth al titular (FIXTURE)
    await svc(`/rest/v1/usuarios?id=eq.${ids.titular}`, {
      method: "PATCH", body: { auth_user_id: titularAuth }
    });
    await svc("/rest/v1/empresa_miembros", {
      method: "POST", body: { empresa_id: ids.empresa, usuario_id: ids.titular, rol_clave: "owner", estado: "activo" }
    });

    // FIXTURE: onboarding real por conductor (solicitud -> Torre aprueba -> conductor activo)
    ids.conductores = {};
    const tags = ["a", "b", "c", "d", "e"];
    const lic = (t) => `E2ELIC${SUF.slice(-4)}${t}`.toUpperCase();
    for (let i = 0; i < tags.length; i++) {
      const t = tags[i];
      const dig = String(i + 1);
      const sol = await svc("/rest/v1/solicitudes_conductor", {
        method: "POST",
        body: {
          auth_user_id: condAuth[t], estado: "en_revision", paso_actual: 5,
          datos_personales: { nombre: `Cond ${t} E2E`, telefono: telUnico(dig, "12"), curp: curpUnica(i) },
          domicilio: { codigo_postal: "01000", estado: "Ciudad de México", ciudad_municipio: "Álvaro Obregón", colonia: "San Ángel", calle: "Prueba", numero: "15" },
          licencia: { numero: lic(t), tipo: "A", vigencia: "2030-12-31" },
          contacto_emergencia: { nombre: "Contacto", telefono: telUnico(dig, "87") },
          enviado_en: new Date().toISOString(), version_registro: 2, origen_modelo: "v2_minimo"
        }
      });
      const solId = sol[0].id;
      for (const [tipo, archivo] of [["licencia_frente", "frente.jpg"], ["licencia_reverso", "reverso.jpg"], ["identificacion_oficial", "id.jpg"]]) {
        await svc("/rest/v1/documentos_conductor", {
          method: "POST",
          body: { solicitud_id: solId, tipo, nombre_archivo: archivo, url: `e2e/${SUF}/${t}/${archivo}`, estado: "aprobado", version: 1, es_actual: true }
        });
      }
      const vigentes = await svc("/rest/v1/versiones_documento_consentimiento?vigente_hasta=is.null&select=tipo_documento,version,hash_documento");
      for (const v of vigentes) {
        await svc("/rest/v1/consentimientos_usuario", {
          method: "POST",
          body: {
            auth_user_id: condAuth[t], solicitud_id: solId, tipo_documento: v.tipo_documento,
            version: v.version, canal: "web", version_app: "e2e-15", hash_documento: v.hash_documento
          }
        });
      }
      await rpc("aprobar_solicitud_conductor_admin", {
        p_solicitud_id: solId, p_motivo: "Golden E2E"
      }, adminJwt);
      const [cond] = await svc(`/rest/v1/conductores?auth_user_id=eq.${condAuth[t]}&select=id,estado,estado_expediente`);
      assert.equal(cond.estado_expediente, "aprobado", `expediente ${t} aprobado`);
      ids.conductores[t] = cond.id;
    }
    const outRow = await svc("/rest/v1/usuarios", {
      method: "POST",
      body: { auth_user_id: outAuth, tipo_cuenta: "personal", rol: "personal", estado_verificacion: "verificado", metodo_pago_registrado: true }
    });
    ids.outsider = outRow[0].id;

    ids.jwt = { admin: adminJwt, titular: await signIn(email("titular")), out: await signIn(email("out")), cond: {} };
    for (const t of tags) ids.jwt.cond[t] = await signIn(email(`cond-${t}`));

    // Empresa crea operación (Torre para la empresa)
    const op = await api("/rest/v1/operaciones", {
      method: "POST", token: adminJwt,
      body: { folio: `OP-E2E15-${SUF}`, empresa_id: ids.empresa, nombre: "Golden E2E", tipo: "flota", estado: "en_curso" }
    });
    ids.operacion = op[0].id;
  });

  after(async () => {
    // Limpieza en orden inverso (cascadas cubren pagos/fotos/tracking/asignaciones)
    for (const t of TRASLADOS) {
      await fetch(`${URL}/rest/v1/traslados?id=eq.${t}`, { method: "DELETE", headers: HEADERS_SVC });
    }
    if (ids.operacion) await fetch(`${URL}/rest/v1/operaciones?id=eq.${ids.operacion}`, { method: "DELETE", headers: HEADERS_SVC });
  });

  it("titular crea 5 traslados con vehículo nuevo", async () => {
    const base = {
      contacto_entrega_nombre: "A", contacto_entrega_telefono: "+520000000000",
      contacto_recepcion_nombre: "B", contacto_recepcion_telefono: "+520000000001",
      origen_lat: 19.0, origen_lng: -99.0, origen_direccion: "origen", origen_ciudad: "CDMX",
      destino_lat: 19.5, destino_lng: -99.5, destino_direccion: "destino", destino_ciudad: "CDMX",
      presupuesto_usuario: 1000, tipo_pago: "anticipado", modalidad_programacion: "lo_antes_posible",
      distancia_km: 18.42, tiempo_estimado_horas: 0.73
    };
    const tags = ["a", "b", "c", "d", "e"];
    for (let i = 0; i < 5; i++) {
      const r = await rpc("usuario_crea_traslado", {
        p_vehiculo_id: null,
        p_vehiculo: {
          tipo: "sedan", transmision: "manual", marca: "Nissan", modelo: "Versa", condicion: "nueva",
          anio: 2022, color: "gris", placas: `E2E${SUF}${i}`, vin: `VINE2E${SUF}${i}`,
          estado_general_declarado: "Bien", tiene_tarjeta_circulacion: true, tiene_verificacion: true,
          tiene_placas: true, puede_circular_rodando: true
        },
        p_traslado: base,
        p_clave_idempotencia: crypto.randomUUID(),
        p_paradas: []
      }, ids.jwt.titular);
      assert.ok(r.id, `traslado ${tags[i]} creado`);
      const [creado] = await api(`/rest/v1/traslados?id=eq.${r.id}&select=estado`, { token: ids.jwt.titular });
      assert.equal(creado.estado, "cotizacion_generada");
      TRASLADOS.push(r.id);
    }
    assert.equal(TRASLADOS.length, 5);
    // Vincular a la operación (Torre)
    for (const t of TRASLADOS) {
      await api(`/rest/v1/traslados?id=eq.${t}`, {
        method: "PATCH", token: ids.jwt.admin, body: { operation_id: ids.operacion }
      });
    }
    const vinculados = await api(
      `/rest/v1/traslados?operation_id=eq.${ids.operacion}&select=id`, { token: ids.jwt.admin }
    );
    assert.equal(vinculados.length, 5);
  });

  it("aceptación, pago anticipado, confirmación Torre y asignación", async () => {
    for (const t of TRASLADOS) await rpc("usuario_acepta_cotizacion", { p_traslado_id: t }, ids.jwt.titular);
    // Anticipado se cobra antes de la evidencia (gate del conductor)
    for (const t of TRASLADOS) {
      const [ct] = await api(`/rest/v1/traslados?id=eq.${t}&select=precio_cotizado`, { token: ids.jwt.admin });
      await api("/rest/v1/pagos", {
        method: "POST", token: ids.jwt.admin,
        body: { traslado_id: t, monto: ct.precio_cotizado, momento: "anticipado", estado: "completado", metodo: "tarjeta" }
      });
    }
    for (const t of TRASLADOS) {
      await rpc("admin_cambiar_estado_traslado", { p_traslado_id: t, p_nuevo_estado: "servicio_confirmado" }, ids.jwt.admin);
      await rpc("admin_cambiar_estado_traslado", { p_traslado_id: t, p_nuevo_estado: "pendiente_de_conductor" }, ids.jwt.admin);
    }
    // T1: oferta + aceptación del conductor; T2-T5: asignación Torre
    const oferta = await rpc("ofrecer_asignacion", {
      p_traslado_id: TRASLADOS[0], p_conductor_id: ids.conductores.a, p_motivo: "Golden"
    }, ids.jwt.admin);
    await rpc("aceptar_asignacion", { p_asignacion_id: oferta }, ids.jwt.cond.a);
    const tags = ["b", "c", "d", "e"];
    for (let i = 1; i < 5; i++) {
      await rpc("admin_asigna_conductor", { p_traslado_id: TRASLADOS[i], p_conductor_id: ids.conductores[tags[i - 1]] }, ids.jwt.admin);
    }
    for (const t of TRASLADOS) {
      const [row] = await api(`/rest/v1/traslados?id=eq.${t}&select=estado`, { token: ids.jwt.admin });
      assert.equal(row.estado, "conductor_asignado");
    }
  });

  it("recolección, evidencia, tracking y puesta en curso (flota)", async () => {
    const tags = ["a", "b", "c", "d", "e"];
    const angulos = ["frente", "lado_piloto", "lado_copiloto", "trasera", "tablero"];
    for (let i = 0; i < 5; i++) {
      const jwt = ids.jwt.cond[tags[i]];
      for (const ev of ["conductor_en_camino", "llegada_origen", "iniciar_verificacion", "iniciar_evidencia_inicial"]) {
        await rpc("conductor_avanza_traslado", { p_traslado_id: TRASLADOS[i], p_evento: ev }, jwt);
      }
      // Fotos iniciales sincronizadas (el propio conductor)
      for (const a of angulos) {
        await api("/rest/v1/evidencia_fotos", {
          method: "POST", token: jwt,
          body: { traslado_id: TRASLADOS[i], tipo: "inicial", angulo: a, url: `https://cdn.test/e2e-${a}.jpg`, sincronizada: true }
        });
      }
      await rpc("conductor_avanza_traslado", { p_traslado_id: TRASLADOS[i], p_evento: "evidencia_inicial_completada" }, jwt);
      await rpc("conductor_avanza_traslado", { p_traslado_id: TRASLADOS[i], p_evento: "vehiculo_recibido" }, jwt);
      await rpc("conductor_avanza_traslado", { p_traslado_id: TRASLADOS[i], p_evento: "iniciar_traslado" }, jwt);
      await rpc("registrar_heartbeat_tracking", {
        p_traslado_id: TRASLADOS[i], p_lat: 19.43, p_lng: -99.13,
        p_precision_m: 10, p_velocidad_mps: 8, p_bateria_pct: 80, p_online: true, p_plataforma: "android"
      }, jwt);
    }
    const curso = await api(
      `/rest/v1/traslados?operation_id=eq.${ids.operacion}&estado=eq.traslado_en_curso&select=id`,
      { token: ids.jwt.admin }
    );
    assert.equal(curso.length, 5);
  });

  it("entrega, pago y cierre del héroe; operación completada", async () => {
    const t1 = TRASLADOS[0];
    const jwt = ids.jwt.cond.a;
    await rpc("conductor_avanza_traslado", { p_traslado_id: t1, p_evento: "llegada_destino" }, jwt);
    await rpc("conductor_avanza_traslado", { p_traslado_id: t1, p_evento: "iniciar_evidencia_final" }, jwt);
    for (const a of ["frente", "lado_piloto", "lado_copiloto", "trasera", "tablero"]) {
      await api("/rest/v1/evidencia_fotos", {
        method: "POST", token: jwt,
        body: { traslado_id: t1, tipo: "final", angulo: a, url: `https://cdn.test/e2e-fin-${a}.jpg`, sincronizada: true }
      });
    }
    await rpc("conductor_avanza_traslado", { p_traslado_id: t1, p_evento: "evidencia_final_completada" }, jwt);
    await rpc("conductor_avanza_traslado", { p_traslado_id: t1, p_evento: "confirmar_entrega" }, jwt);
    // El pago anticipado ya quedó registrado; el conductor cierra sin tocar pagos
    const [t] = await api(`/rest/v1/traslados?id=eq.${t1}&select=precio_cotizado`, { token: ids.jwt.admin });
    const [pg] = await api(`/rest/v1/pagos?traslado_id=eq.${t1}&select=monto,estado`, { token: ids.jwt.admin });
    assert.equal(pg.estado, "completado");
    assert.ok(Number(pg.monto) > 0 && Number(t.precio_cotizado) > 0);
    // Cliente confirma: el conductor cierra (sin tocar pagos)
    await rpc("conductor_avanza_traslado", { p_traslado_id: t1, p_evento: "cerrar_viaje" }, jwt);
    const [cerrado] = await api(`/rest/v1/traslados?id=eq.${t1}&select=estado`, { token: ids.jwt.admin });
    assert.equal(cerrado.estado, "servicio_cerrado");

    // Sin breach SLA, finanzas y métricas consistentes, operación cerrada
    const evalRes = await rpc("sla_evaluar_traslados", { p_limite: 500 }, ids.jwt.admin);
    assert.ok(evalRes.evaluados >= 5);
    const fin = await rpc("admin_finanzas_operacion", { p_operacion_id: ids.operacion }, ids.jwt.admin);
    assert.equal(fin.traslados, 5);
    assert.ok(fin.facturado > 0);
    await api(`/rest/v1/operaciones?id=eq.${ids.operacion}`, {
      method: "PATCH", token: ids.jwt.admin, body: { estado: "cerrada" }
    });
    const [op] = await api(`/rest/v1/operaciones?id=eq.${ids.operacion}&select=estado`, { token: ids.jwt.admin });
    assert.equal(op.estado, "cerrada");
  });

  it("casos negativos: doble cobro, transición inválida y aislamiento", async () => {
    // Doble cobro con mismo PaymentIntent
    const [pago] = await api(
      `/rest/v1/pagos?traslado_id=eq.${TRASLADOS[0]}&select=stripe_payment_intent_id,monto`,
      { token: ids.jwt.admin }
    );
    assert.ok(pago);
    await api("/rest/v1/pagos", {
      method: "POST", token: ids.jwt.admin,
      body: { traslado_id: TRASLADOS[0], monto: pago.monto, momento: "anticipado", estado: "completado", metodo: "tarjeta", stripe_payment_intent_id: `pi_e2e15_${SUF}` }
    });
    await assert.rejects(
      api("/rest/v1/pagos", {
        method: "POST", token: ids.jwt.admin,
        body: { traslado_id: TRASLADOS[0], monto: pago.monto, momento: "anticipado", estado: "completado", metodo: "tarjeta", stripe_payment_intent_id: `pi_e2e15_${SUF}` }
      }),
      /409|400|23505/
    );
    // Transición inválida desde cerrado
    await assert.rejects(
      rpc("admin_cambiar_estado_traslado", { p_traslado_id: TRASLADOS[0], p_nuevo_estado: "traslado_en_curso" }, ids.jwt.admin),
      /TRANSICION_INVALIDA|400/
    );
    // Outsider no ve la flota
    const ajenos = await api(
      `/rest/v1/traslados?operation_id=eq.${ids.operacion}&select=id`, { token: ids.jwt.out }
    );
    assert.equal(ajenos.length, 0);
  });
});
