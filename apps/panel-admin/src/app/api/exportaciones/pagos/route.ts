import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Json } from "@ruum/shared/types";
import { crearClienteServidor } from "../../../../lib/supabase-server";

const LIMITE_FILAS=10_000;
const DIAS_MAX=90;

function celda(valor:unknown){let s=String(valor??"").replace(/\r?\n/g," ");if(/^[=+\-@]/.test(s))s=`'${s}`;return `"${s.replace(/"/g,'""')}"`;}

function parseDateParam(val: string | null, def: Date): Date {
  if (!val) return def;
  const d = new Date(val);
  return isNaN(d.getTime()) ? def : d;
}

export async function GET(request:Request){
 const traceId=request.headers.get("x-request-id")??randomUUID(); const inicio=Date.now(); const cliente=await crearClienteServidor();

 const url=new URL(request.url);
 const desde=parseDateParam(url.searchParams.get("desde"), new Date(Date.now()-30*86400000));
 const hasta=parseDateParam(url.searchParams.get("hasta"), new Date());
 const hastaLimitado=new Date(Math.min(hasta.getTime(), desde.getTime()+DIAS_MAX*86400000));

 const filtros:{desde?:string;hasta?:string}={desde:desde.toISOString(),hasta:hastaLimitado.toISOString()};

 const {data: tienePagosExportar}=await cliente.rpc("admin_tiene_permiso",{p_permiso:"pagos:exportar"});
 const {data: tienePagosLeer}=await cliente.rpc("admin_tiene_permiso",{p_permiso:"pagos:leer"});
 const {data: tieneExportCrear}=await cliente.rpc("admin_tiene_permiso",{p_permiso:"exportaciones:crear"});

 if(!tienePagosExportar && !(tienePagosLeer && tieneExportCrear)){
   return NextResponse.json({error:"forbidden",traceId},{status:403,headers:{"x-request-id":traceId}});
 }

 const {data: registroId,error: registroError}=await cliente.rpc("admin_registrar_exportacion",{p_recurso:"pagos",p_filtros:filtros as unknown as Json,p_formato:"csv"});
 if(registroError)return NextResponse.json({error:"export_init_failed",traceId},{status:500,headers:{"x-request-id":traceId}});

 let csv="";
 try{
  let query=cliente.from("pagos").select("id,traslado_id,monto,estado,registrado_en");
  if(desde||hastaLimitado){
   query=query.gte("registrado_en",desde.toISOString()).lte("registrado_en",hastaLimitado.toISOString());
  }
  const {data,error}=await query.order("registrado_en",{ascending:false}).limit(LIMITE_FILAS);
  if(error)throw error; const filas=data??[]; csv=["id,traslado_id,monto,estado,registrado_en",...filas.map(f=>[f.id,f.traslado_id,f.monto,f.estado,f.registrado_en].map(celda).join(","))].join("\n");
  const hash=createHash("sha256").update(csv).digest("hex");
  const {error: completarError}=await cliente.rpc("admin_completar_exportacion",{p_id:registroId as string,p_filas:filas.length,p_hash:hash});
  if(completarError){console.error("[export] auditoría fallida, no se entrega CSV",completarError);return NextResponse.json({error:"export_audit_failed",traceId},{status:500,headers:{"x-request-id":traceId}});}
  return new NextResponse(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="pagos-${new Date().toISOString().slice(0,10)}.csv"`,"cache-control":"no-store","x-content-sha256":hash,"x-request-id":traceId,"server-timing":`app;dur=${Date.now()-inicio}`}});
 }catch(error){await cliente.rpc("admin_completar_exportacion",{p_id:registroId as string,p_filas:0,p_hash:"",p_error:"export_failed"});return NextResponse.json({error:"export_failed",traceId},{status:500,headers:{"x-request-id":traceId}});}
}
