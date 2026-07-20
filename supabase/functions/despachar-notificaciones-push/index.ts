import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID")!;
const FCM_CLIENT_EMAIL = Deno.env.get("FCM_CLIENT_EMAIL")!;
const FCM_PRIVATE_KEY = (Deno.env.get("FCM_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function base64url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
async function accessToken() {
  const now = Math.floor(Date.now()/1000);
  const header = base64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claim = base64url(JSON.stringify({iss:FCM_CLIENT_EMAIL,scope:"https://www.googleapis.com/auth/firebase.messaging",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600}));
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(FCM_PRIVATE_KEY), {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"}, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`));
  const assertion = `${header}.${claim}.${base64url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
  if (!response.ok) throw new Error(`oauth:${response.status}:${await response.text()}`);
  return (await response.json()).access_token as string;
}
function pemBytes(pem:string) { const b64=pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,""); return Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); }


function categoriaHabilitada(tipo: string, prefs: Record<string, unknown> | null) {
  if (["seguridad_critica", "cambio_urgente_traslado", "incidencia_actualizada", "mensaje_torre_control"].includes(tipo)) return true;
  const p = prefs ?? {};
  if (tipo === "nueva_oportunidad") return p.notificar_oportunidades !== false;
  if (["traslado_asignado", "proximo_traslado", "evidencia_pendiente"].includes(tipo)) return p.notificar_traslados_asignados !== false;
  if (["documento_por_vencer", "documento_rechazado"].includes(tipo)) return p.notificar_documentos !== false;
  if (["pago_programado", "pago_realizado"].includes(tipo)) return p.notificar_ganancias !== false;
  if (tipo === "promocion") return p.notificar_promociones === true;
  return p.notificar_cambios_operativos !== false;
}
function enHorarioSilencioso(tipo: string, prefs: Record<string, unknown> | null) {
  if (!prefs?.modo_no_molestar) return false;
  if (!["nueva_oportunidad", "promocion", "proximo_traslado"].includes(tipo)) return false;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hour: "2-digit", hour12: false }).format(new Date()));
  return hour >= 22 || hour < 7;
}

Deno.serve(async (request) => {
  if (request.headers.get("authorization") !== `Bearer ${SERVICE_ROLE_KEY}`) return new Response("Unauthorized",{status:401});
  const { data: pendientes, error } = await db.from("notificaciones_conductor").select("*").in("estado",["pendiente","fallida"]).order("creado_en").limit(50);
  if (error) return Response.json({error:error.message},{status:500});
  const token = await accessToken();
  let enviadas=0, fallidas=0;
  for (const n of pendientes ?? []) {
    const { data: conductor } = await db.from("conductores").select("id").eq("auth_user_id", n.usuario_id).maybeSingle();
    const { data: prefs } = conductor
      ? await db.from("preferencias_conductor").select("*").eq("conductor_id", conductor.id).maybeSingle()
      : { data: null };
    if (!categoriaHabilitada(n.tipo, prefs as Record<string, unknown> | null)) {
      await db.from("notificaciones_conductor").update({ estado: "cancelada" }).eq("id", n.id);
      continue;
    }
    if (enHorarioSilencioso(n.tipo, prefs as Record<string, unknown> | null)) continue;
    const { data: dispositivos } = await db.from("dispositivos_push").select("id,token_push").eq("usuario_id",n.usuario_id).eq("activo",true);
    if (!dispositivos?.length) { await db.from("notificaciones_conductor").update({estado:"fallida"}).eq("id",n.id); fallidas++; continue; }
    let ok=0;
    for (const d of dispositivos) {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`, {method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({message:{token:d.token_push,notification:{title:n.titulo,body:n.cuerpo},data:{...Object.fromEntries(Object.entries(n.datos ?? {}).map(([k,v])=>[k,String(v)])),notificacion_id:n.id,destino:n.destino,tipo:n.tipo},android:{priority:n.prioridad==="normal"?"NORMAL":"HIGH",notification:{channel_id:n.prioridad==="normal"?"ruum_general":"ruum_operativa",click_action:"FCM_PLUGIN_ACTIVITY"}}}})});
      const body=await response.json().catch(()=>({}));
      const invalido = response.status===404 || String(body?.error?.status).includes("NOT_FOUND") || String(body?.error?.details).includes("UNREGISTERED");
      await db.from("notificaciones_push_entregas").upsert({notificacion_id:n.id,dispositivo_id:d.id,estado:response.ok?"enviada":invalido?"token_invalido":"fallida",fcm_message_id:body.name??null,codigo_error:body?.error?.status??null,detalle_error:response.ok?null:JSON.stringify(body),enviada_en:response.ok?new Date().toISOString():null},{onConflict:"notificacion_id,dispositivo_id"});
      if (invalido) await db.from("dispositivos_push").update({activo:false}).eq("id",d.id);
      if (response.ok) ok++;
    }
    await db.from("notificaciones_conductor").update({estado:ok===dispositivos.length?"enviada":ok?"parcial":"fallida",enviada_en:ok?new Date().toISOString():null}).eq("id",n.id);
    ok ? enviadas++ : fallidas++;
  }
  return Response.json({procesadas:(pendientes??[]).length,enviadas,fallidas});
});
