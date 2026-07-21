import { redirect } from "next/navigation";
import { crearClienteServidor } from "../../lib/supabase-server";

type Solicitud={id:string;tipo:string;recurso:string;accion:string;estado:string;creada_en:string;expira_en:string;solicitada_por:string;payload:unknown};
export default async function PaginaAprobaciones(){
 const cliente=await crearClienteServidor(); const permiso=await (cliente.rpc as any)("admin_tiene_permiso",{p_permiso:"aprobaciones:aprobar"});
 if(!permiso.data) redirect("/sin-permiso");
 const {data,error}=await (cliente.from as any)("solicitudes_aprobacion_admin").select("id,tipo,recurso,accion,estado,creada_en,expira_en,solicitada_por,payload").order("creada_en",{ascending:false}).limit(100);
 if(error) throw error; const solicitudes=(data??[]) as Solicitud[];
 return <main className="mx-auto max-w-6xl px-6 py-8"><h1 className="font-display text-2xl font-semibold">Aprobaciones duales</h1><p className="mt-1 text-sm text-text-secondary">Finanzas y sanciones requieren solicitante y aprobador distintos.</p>
 <div className="mt-6 grid gap-4">{solicitudes.length===0?<p className="rounded-xl border p-5">No hay solicitudes.</p>:solicitudes.map(s=><article key={s.id} className="rounded-xl border border-ink/10 p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{s.tipo}: {s.accion}</h2><span>{s.estado}</span></div><p className="mt-2 text-sm">Recurso: {s.recurso}</p><p className="text-sm text-text-secondary">Creada {new Date(s.creada_en).toLocaleString("es-MX")} · expira {new Date(s.expira_en).toLocaleString("es-MX")}</p></article>)}</div></main>;
}
