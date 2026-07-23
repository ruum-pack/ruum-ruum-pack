import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Json } from "@ruum/shared/types";
import { obtenerMetricasRegistroConductor } from "@ruum/api/services";
import { crearClienteServidor } from "../../../../lib/supabase-server";

const DIAS_MAX=90;

function celda(valor:unknown){let s=String(valor??"").replace(/\r?\n/g," ");if(/^[=+\-@]/.test(s))s=`'${s}`;return `"${s.replace(/"/g,'""')}"`;}

function fechaParam(valor:string|null, respaldo:Date) {
  if (!valor) return respaldo.toISOString().slice(0,10);
  const fecha=new Date(valor);
  return Number.isNaN(fecha.getTime()) ? respaldo.toISOString().slice(0,10) : fecha.toISOString().slice(0,10);
}

export async function GET(request:Request) {
  const traceId=request.headers.get("x-request-id")??randomUUID();
  const inicio=Date.now();
  const cliente=await crearClienteServidor();
  const url=new URL(request.url);
  const desde=fechaParam(url.searchParams.get("desde"),new Date(Date.now()-30*86400000));
  const hastaSolicitado=fechaParam(url.searchParams.get("hasta"),new Date());
  const desdeDate=new Date(desde);
  const hastaDate=new Date(hastaSolicitado);
  const hasta=new Date(Math.min(hastaDate.getTime(),desdeDate.getTime()+DIAS_MAX*86400000)).toISOString().slice(0,10);
  const zona=url.searchParams.get("zona")?.trim()||undefined;
  const fuente=url.searchParams.get("fuente")?.trim()||undefined;
  const empresaId=url.searchParams.get("empresaId")?.trim()||undefined;
  const filtros={desde,hasta,zona,fuente,empresaId};

  const {data:tieneConductores}=await cliente.rpc("admin_tiene_permiso",{p_permiso:"conductores:leer"});
  const {data:tieneExportar}=await cliente.rpc("admin_tiene_permiso",{p_permiso:"exportaciones:crear"});
  if(!tieneConductores||!tieneExportar){
    return NextResponse.json({error:"forbidden",traceId},{status:403,headers:{"x-request-id":traceId}});
  }

  const {data:registroId,error:registroError}=await cliente.rpc("admin_registrar_exportacion",{
    p_recurso:"metricas_registro_conductor",
    p_filtros:filtros as unknown as Json,
    p_formato:"csv"
  });
  if(registroError)return NextResponse.json({error:"export_init_failed",traceId},{status:500,headers:{"x-request-id":traceId}});

  try{
    const metricas=await obtenerMetricasRegistroConductor(cliente,desde,hasta,{zona,fuente,empresaId});
    const filas=[
      ["seccion","clave","nombre","segmento","valor","formula","referencia","meta","alerta"],
      ...metricas.detalle.map((fila)=>["detalle",fila.clave,fila.nombre,"",fila.valor??"",fila.formula,fila.consultaReferencia,fila.meta??"",fila.alerta]),
      ...(["zona","fuente","empresa"] as const).flatMap((dimension)=>metricas.segmentos[dimension].map((fila)=>[
        `segmento_${dimension}`,dimension,"",fila.segmento,fila.iniciadas,"iniciadas/enviadas/conversion","eventos_registro_conductor","",`${fila.enviadas} enviadas; ${fila.conversionEnvioPct}%`
      ])),
      ["calidad","eventos_tardios","Eventos tardíos","",metricas.calidadDatos.eventosTardios,"recibido_en > creado_en + 6h","eventos_registro_conductor","",""],
      ["calidad","eventos_duplicados","Eventos duplicados","",metricas.calidadDatos.eventosDuplicados,"sesion/evento/paso/codigo por minuto","eventos_registro_conductor","",""]
    ];
    const csv=filas.map((fila)=>fila.map(celda).join(",")).join("\n");
    const hash=createHash("sha256").update(csv).digest("hex");
    const {error:completarError}=await cliente.rpc("admin_completar_exportacion",{p_id:registroId as string,p_filas:filas.length-1,p_hash:hash});
    if(completarError)return NextResponse.json({error:"export_audit_failed",traceId},{status:500,headers:{"x-request-id":traceId}});
    return new NextResponse(csv,{headers:{
      "content-type":"text/csv; charset=utf-8",
      "content-disposition":`attachment; filename="metricas-registro-${desde}-${hasta}.csv"`,
      "cache-control":"no-store",
      "x-content-sha256":hash,
      "x-request-id":traceId,
      "server-timing":`app;dur=${Date.now()-inicio}`
    }});
  }catch(error){
    await cliente.rpc("admin_completar_exportacion",{p_id:registroId as string,p_filas:0,p_hash:"",p_error:"export_failed"});
    return NextResponse.json({error:"export_failed",traceId},{status:500,headers:{"x-request-id":traceId}});
  }
}
