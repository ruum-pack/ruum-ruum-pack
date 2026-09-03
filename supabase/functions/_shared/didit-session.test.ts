import {
  construirPayloadSesionDidit,
  detalleRespuestaDidit,
  esFotoPerfilDiditValida,
  esUrlHospedadaDiditValida,
  obtenerRetratoDidit,
  urlSesionDidit,
} from "./didit-session.ts";

const supabaseUrl = "https://rgvzrzjfyzdedowgokjl.supabase.co";
const authUserId = "11111111-1111-4111-8111-111111111111";
const fotoUrl =
  `${supabaseUrl}/storage/v1/object/public/fotos-perfil/${authUserId}/perfil.jpg?v=1`;

Deno.test("usa el endpoint v3 oficial para crear sesiones Didit", () => {
  if (urlSesionDidit() !== "https://verification.didit.me/v3/session/") {
    throw new Error("El endpoint de creación de sesiones Didit es incorrecto.");
  }
});

Deno.test("construye el payload JSON v3 con headers compatibles con Didit", () => {
  const payload = construirPayloadSesionDidit({
    workflowId: "22222222-2222-4222-8222-222222222222",
    vendorData: "usuario:11111111-1111-4111-8111-111111111111",
    callbackUrl: "https://usuario.example.com/verificacion",
    portraitImage: "AQID",
  });

  if (payload.workflow_id !== "22222222-2222-4222-8222-222222222222") {
    throw new Error("workflow_id no fue serializado correctamente.");
  }
  if (payload.vendor_data !== "usuario:11111111-1111-4111-8111-111111111111") {
    throw new Error("vendor_data no fue serializado correctamente.");
  }
  if (payload.callback_method !== "both" || payload.language !== "es") {
    throw new Error(
      "callback_method/language no fueron serializados correctamente.",
    );
  }
  if (payload.portrait_image !== "AQID") {
    throw new Error("portrait_image no fue serializado correctamente.");
  }
});

Deno.test("sólo descarga la foto de perfil del mismo usuario y la convierte a base64", async () => {
  let llamadas = 0;
  const fetchFake: typeof fetch = async (input, init) => {
    llamadas += 1;
    if (input !== fotoUrl || init?.redirect !== "error") {
      throw new Error("La URL o las opciones del fetch no son seguras.");
    }
    return new Response(Uint8Array.from([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    });
  };

  const retrato = await obtenerRetratoDidit(
    fotoUrl,
    supabaseUrl,
    authUserId,
    fetchFake,
  );
  if (retrato !== "AQID" || llamadas !== 1) {
    throw new Error("La foto de perfil no se convirtió a base64.");
  }

  const urlAjena =
    `${supabaseUrl}/storage/v1/object/public/fotos-perfil/33333333-3333-4333-8333-333333333333/perfil.jpg`;
  const ajena = await obtenerRetratoDidit(
    urlAjena,
    supabaseUrl,
    authUserId,
    fetchFake,
  );
  if (ajena !== null || llamadas !== 1) {
    throw new Error(
      "Se intentó descargar una foto que no pertenece al usuario.",
    );
  }
});

Deno.test("interpreta los errores JSON de Didit sin perder el detalle", () => {
  if (
    detalleRespuestaDidit('{"detail":"portrait_image is required"}') !==
      "portrait_image is required"
  ) {
    throw new Error("No se extrajo detail del error de Didit.");
  }
  if (!esFotoPerfilDiditValida(fotoUrl, supabaseUrl, authUserId)) {
    throw new Error("La foto válida fue rechazada.");
  }
  if (
    esFotoPerfilDiditValida(
      "https://evil.example/perfil.jpg",
      supabaseUrl,
      authUserId,
    )
  ) {
    throw new Error("Se aceptó una foto externa.");
  }
  if (!esUrlHospedadaDiditValida("https://verify.didit.me/session/token")) {
    throw new Error("La URL hospedada válida de Didit fue rechazada.");
  }
  if (esUrlHospedadaDiditValida("https://evil.example/session/token")) {
    throw new Error("Se aceptó una URL de verificación externa.");
  }
});
