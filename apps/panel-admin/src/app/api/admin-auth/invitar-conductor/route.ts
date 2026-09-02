import { NextResponse } from "next/server";
import { crearClienteServidor } from "../../../../lib/supabase-server";
import { crearClienteServiceRole } from "../../../../lib/supabase-service-role";
import { normalizarError, registrarEvento } from "@ruum/api/services";

const LOGIN_CONDUCTOR_URL = process.env.NEXT_PUBLIC_APP_CONDUCTOR_URL ?? "https://conductor.ruumruum.mx/login";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM ?? "Ruum Ruum <onboarding@ruumruum.mx>";

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function textoONull(valor: unknown) {
  const limpio = texto(valor);
  return limpio ? limpio : null;
}

function correo(valor: unknown) {
  return texto(valor).toLowerCase();
}

function booleano(valor: unknown) {
  return valor === true;
}

function generarPasswordTemporal() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const base = Buffer.from(bytes).toString("base64url").slice(0, 18);
  return `${base}A7!`;
}

async function enviarCorreoPasswordTemporal(parametros: {
  email: string;
  nombre: string;
  passwordTemporal: string;
}) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY no esta configurado para enviar la contraseña temporal.");
  }

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: parametros.email,
      subject: "Tu acceso temporal a Ruum Ruum Conductor",
      text: [
        `Hola ${parametros.nombre},`,
        "",
        "Creamos tu cuenta operativa de Ruum Ruum Conductor.",
        "",
        `Correo: ${parametros.email}`,
        `Contraseña temporal: ${parametros.passwordTemporal}`,
        `Acceso: ${LOGIN_CONDUCTOR_URL}`,
        "",
        "Por seguridad, entra con esta contraseña temporal y cámbiala desde tu cuenta lo antes posible.",
        "",
        "Si no esperabas este correo, contacta al equipo operativo de Ruum Ruum."
      ].join("\n")
    })
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => ({})) as { message?: string; error?: string };
    throw new Error(detalle.message ?? detalle.error ?? "No se pudo enviar el correo de acceso temporal.");
  }
}

export async function POST(request: Request) {
  try {
    const cliente = await crearClienteServidor();
    const serviceRole = crearClienteServiceRole();
    const body = await request.json() as Record<string, unknown>;
    const email = correo(body.correo);

    const { data: tienePermiso, error: errorPermiso } = await cliente.rpc("admin_tiene_permiso", { p_permiso: "conductores:validar" });
    if (errorPermiso) throw errorPermiso;
    if (!tienePermiso) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "CORREO_INVALIDO" }, { status: 400 });
    }

    const nombre = texto(body.nombre);
    const apellidos = texto(body.apellidos);
    const nombreCompleto = [nombre, apellidos].filter(Boolean).join(" ");
    const telefono = texto(body.telefono);
    const curp = texto(body.curp).toUpperCase();
    const licenciaNumero = texto(body.licencia_numero);
    const autorizaVerificacion = booleano(body.autoriza_verificacion_antecedentes);
    const declaraSinSuspensiones = booleano(body.declara_sin_suspensiones);
    if (!nombre || !apellidos || !telefono || !curp || !licenciaNumero || !autorizaVerificacion || !declaraSinSuspensiones) {
      return NextResponse.json({ error: "DATOS_CONDUCTOR_INCOMPLETOS" }, { status: 400 });
    }

    const passwordTemporal = generarPasswordTemporal();
    const { data: cuenta, error: errorCuenta } = await serviceRole.auth.admin.createUser({
      email,
      password: passwordTemporal,
      email_confirm: true,
      user_metadata: {
        tipo_registro: "conductor",
        version_registro: 2,
        tipo_cuenta: "conductor",
        nombre: nombreCompleto,
        telefono
      }
    });
    if (errorCuenta) throw errorCuenta;
    if (!cuenta.user?.id) throw new Error("Auth no devolvio el usuario creado.");

    // PR-07: No fabricar consentimiento sin acto explícito del conductor.
    // La invitación crea el perfil pero el consentimiento debe registrarse
    // vía acción explícita del conductor (versión concreta, timestamp real, canal).
    // Se deja version_terminos_aceptada y terminos_aceptados_en en NULL hasta
    // que el conductor acepte términos en su primer acceso.
    const { data: conductor, error: errorConductor } = await serviceRole
      .from("conductores")
      .insert({
        auth_user_id: cuenta.user.id,
        estado: "activo",
        nombre: nombreCompleto,
        telefono,
        curp,
        licencia_numero: licenciaNumero,
        licencia_tipo: texto(body.licencia_tipo),
        licencia_vigencia: texto(body.licencia_vigencia),
        codigo_postal: textoONull(body.codigo_postal),
        estado_residencia: textoONull(body.estado_residencia),
        ciudad_municipio: textoONull(body.ciudad_municipio),
        colonia: textoONull(body.colonia),
        calle: textoONull(body.calle),
        numero: textoONull(body.numero),
        referencias: textoONull(body.referencias),
        contacto_emergencia_nombre: texto(body.contacto_emergencia_nombre),
        contacto_emergencia_telefono: texto(body.contacto_emergencia_telefono),
        autoriza_verificacion_antecedentes: autorizaVerificacion,
        declara_sin_suspensiones: declaraSinSuspensiones,
        version_terminos_aceptada: null,
        terminos_aceptados_en: null,
        marca_terminos: null
      })
      .select("*")
      .single();
    if (errorConductor) {
      await serviceRole.auth.admin.deleteUser(cuenta.user.id);
      if (errorConductor.code === "23505") {
        return NextResponse.json({ error: "CONDUCTOR_DUPLICADO" }, { status: 409 });
      }
      throw errorConductor;
    }

    try {
      await enviarCorreoPasswordTemporal({ email, nombre: nombreCompleto, passwordTemporal });
    } catch (errorCorreo) {
      await serviceRole.from("conductores").delete().eq("id", conductor.id);
      await serviceRole.auth.admin.deleteUser(cuenta.user.id);
      throw errorCorreo;
    }

    await registrarEvento(cliente, "creacion_conductor" as never, "admin", conductor.id, {
      accion: "password_temporal_enviado",
      auth_user_id: "[REDACTED]"
    });

    return NextResponse.json({ conductor, authUserId: cuenta.user.id }, { status: 201 });
  } catch (e) {
    const normalizado = normalizarError(e);
    return NextResponse.json({ error: normalizado.codigo, mensaje: normalizado.message }, { status: 500 });
  }
}
