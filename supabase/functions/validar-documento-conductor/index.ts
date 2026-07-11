/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { createClient } from "npm:@supabase/supabase-js@2";
import { TAMANO_MAXIMO, validarDocumento } from "./validacion.ts";
import { leerFormularioLimitado } from "../_shared/multipart-limitado.ts";

const BUCKET="documentos-conductor";
const TIPOS=new Set(["licencia_frente","licencia_reverso","identificacion_oficial","documento_operativo"]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};

function codigoSeguro(error:unknown) {
  if(!error||typeof error!=="object") return "desconocido";
  const valor=error as {code?:unknown;status?:unknown;name?:unknown};
  if(typeof valor.code==="string"&&/^[A-Za-z0-9_-]{1,40}$/.test(valor.code)) return valor.code;
  if(typeof valor.status==="number") return `http_${valor.status}`;
  if(typeof valor.name==="string"&&/^[A-Za-z0-9_-]{1,40}$/.test(valor.name)) return valor.name;
  return "desconocido";
}

function json(body:Record<string,unknown>,status=200) {
  return new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json"}});
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
  if(req.method!=="POST") return json({error:"Método no permitido"},405);
  const authorization=req.headers.get("Authorization");
  if(!authorization) return json({error:"Inicia sesión para subir documentos."},401);
  const url=Deno.env.get("SUPABASE_URL")??"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")??"";
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
  if(!url||!anon||!serviceKey) return json({error:"El servicio documental no está configurado."},500);

  const usuario=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
  const servicio=createClient(url,serviceKey);
  const {data:sesion,error:errorSesion}=await usuario.auth.getUser();
  if(errorSesion||!sesion.user) return json({error:"La sesión no es válida."},401);

  let form:FormData;
  try { form=await leerFormularioLimitado(req,TAMANO_MAXIMO); }
  catch(error) { return json({error:error instanceof Error?error.message:"Formulario inválido."},413); }
  const objetivo=String(form.get("objetivo_id")??"");
  const tipo=String(form.get("tipo")??"");
  const anteriorSolicitado=String(form.get("documento_anterior_id")??"")||null;
  const archivo=form.get("archivo");
  if(!UUID.test(objetivo)||!TIPOS.has(tipo)||!(archivo instanceof File)) return json({error:"Faltan objetivo_id, tipo o archivo válidos."},400);
  if(anteriorSolicitado&&!UUID.test(anteriorSolicitado)) return json({error:"documento_anterior_id no es válido."},400);

  const [resultadoConductor,resultadoSolicitud]=await Promise.all([
    usuario.from("conductores").select("id").eq("id",objetivo).eq("auth_user_id",sesion.user.id).maybeSingle(),
    usuario.from("solicitudes_conductor").select("id").eq("id",objetivo).eq("auth_user_id",sesion.user.id).maybeSingle()
  ]);
  if(resultadoConductor.error||resultadoSolicitud.error) {
    console.error("Error validando propiedad documental",{
      conductor:codigoSeguro(resultadoConductor.error),solicitud:codigoSeguro(resultadoSolicitud.error)
    });
    return json({error:"No fue posible validar la propiedad del expediente."},500);
  }
  const conductor=resultadoConductor.data;
  const solicitud=resultadoSolicitud.data;
  if(!conductor&&!solicitud) return json({error:"No puedes subir archivos en un expediente ajeno."},403);

  let validado;
  try { validado=validarDocumento(new Uint8Array(await archivo.arrayBuffer()),archivo.name); }
  catch(error) { return json({error:error instanceof Error?error.message:"Archivo inválido."},422); }

  let documentoAnteriorId=anteriorSolicitado;
  if(!documentoAnteriorId) {
    let consulta=usuario.from("documentos_conductor").select("id,estado")
      .eq(conductor?"conductor_id":"solicitud_id",objetivo).eq("tipo",tipo).eq("es_actual",true).maybeSingle();
    const {data:actual,error:errorActual}=await consulta;
    if(errorActual) return json({error:"No fue posible comprobar la versión documental vigente."},500);
    if(actual?.estado==="rechazado"||actual?.estado==="vencido") documentoAnteriorId=actual.id;
    else if(actual) return json({error:"Ya existe una versión vigente; sólo puede reemplazarse cuando fue rechazada o venció."},409);
  }

  if(documentoAnteriorId) {
    const {data:anterior}=await usuario.from("documentos_conductor").select("id,tipo,estado,es_actual,conductor_id,solicitud_id")
      .eq("id",documentoAnteriorId).maybeSingle();
    if(!anterior||anterior.tipo!==tipo||!["rechazado","vencido"].includes(anterior.estado)||!anterior.es_actual
      ||(anterior.conductor_id??anterior.solicitud_id)!==objetivo) {
      return json({error:"La versión indicada no puede reemplazarse."},409);
    }
  }

  const nombreObjeto=`${crypto.randomUUID()}-${validado.nombreSeguro}`.slice(0,180);
  const ruta=`${sesion.user.id}/${objetivo}/${tipo}/${nombreObjeto}`;
  const contenidoHash=new ArrayBuffer(validado.bytes.byteLength);
  new Uint8Array(contenidoHash).set(validado.bytes);
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",contenidoHash));
  const sha256=Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");
  const {error:errorSello}=await servicio.from("documentos_storage_validados").insert({
    ruta,auth_user_id:sesion.user.id,objetivo_id:objetivo,tipo,sha256
  });
  if(errorSello) {
    console.error("Error creando sello documental",{codigo:codigoSeguro(errorSello)});
    return json({error:"No fue posible autorizar la carga validada."},500);
  }
  const {error:errorUpload}=await usuario.storage.from(BUCKET).upload(ruta,validado.bytes,{
    upsert:false,contentType:validado.mime,cacheControl:"3600"
  });
  if(errorUpload) {
    await servicio.from("documentos_storage_validados").delete().eq("ruta",ruta);
    return json({error:`No fue posible almacenar el documento: ${errorUpload.message}`},500);
  }

  const llamada=documentoAnteriorId
    ? usuario.rpc("reemplazar_documento_conductor",{p_documento_anterior_id:documentoAnteriorId,p_nombre_archivo:validado.nombreSeguro,p_ruta:ruta})
    : usuario.rpc("registrar_documento_conductor",{p_objetivo_id:objetivo,p_tipo:tipo,p_nombre_archivo:validado.nombreSeguro,p_ruta:ruta});
  const {data:documentoId,error:errorRpc}=await llamada;
  if(errorRpc) {
    await servicio.storage.from(BUCKET).remove([ruta]);
    await servicio.from("documentos_storage_validados").delete().eq("ruta",ruta);
    return json({error:errorRpc.message},409);
  }
  return json({
    documento_id:documentoId,ruta,mime:validado.mime,ancho:validado.ancho,alto:validado.alto,
    exif_eliminado:validado.exifEliminado
  },201);
});
