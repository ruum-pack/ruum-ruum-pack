import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { crearClienteServidor } from "../../../../lib/supabase-server";

const LIMITE_FILAS=10_000;
function celda(valor:unknown){let s=String(valor??"").replace(/\r?\n/g," ");if(/^[=+\-@]/.test(s))s=`'${s}`;return `"${s.replace(/"/g,'""')}"`;}
export async function GET(request:Request){
 const traceId=request.headers.get("x-request-id")??randomUUID(); const inicio=Date.now(); const cliente=await crearClienteServidor();
 const permitido=await (cliente.rpc as any)("admin_tiene_permiso",{p_permiso:"exportaciones:crear"});
 if(!permitido.data)return NextResponse.json({error:"FORBIDDEN",traceId},{status:403});
 const registro=await (cliente.rpc as any)("admin_registrar_exportacion",{p_recurso:"pagos",p_filtros:{},p_formato:"csv"});
 if(registro.error)return NextResponse.json({error:"EXPORT_INIT_FAILED",traceId},{status:500});
 try{
  const {data,error}=await cliente.from("pagos").select("id,traslado_id,monto,estado,creado_en").order("creado_en",{ascending:false}).limit(LIMITE_FILAS);
  if(error)throw error; const filas=data??[]; const csv=["id,traslado_id,monto,estado,creado_en",...filas.map(f=>[f.id,f.traslado_id,f.monto,f.estado,f.creado_en].map(celda).join(","))].join("\n");
  const hash=createHash("sha256").update(csv).digest("hex"); await (cliente.rpc as any)("admin_completar_exportacion",{p_id:registro.data,p_filas:filas.length,p_hash:hash,p_error:null});
  return new NextResponse(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="pagos-${new Date().toISOString().slice(0,10)}.csv"`,"cache-control":"no-store","x-content-sha256":hash,"x-request-id":traceId,"server-timing":`app;dur=${Date.now()-inicio}`}});
 }catch(error){await (cliente.rpc as any)("admin_completar_exportacion",{p_id:registro.data,p_filas:0,p_hash:"",p_error:"EXPORT_FAILED"});return NextResponse.json({error:"EXPORT_FAILED",traceId},{status:500});}
}
