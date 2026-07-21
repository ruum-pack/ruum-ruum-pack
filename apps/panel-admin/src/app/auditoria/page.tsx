import { redirect } from "next/navigation";
import { crearClienteServidor } from "../../lib/supabase-server";

type Evento = { id:string; creado_en:string; tipo:string; recurso:string; accion:string|null; motivo:string|null; rol:string|null; datos:unknown };
type Exportacion = { id:string; creada_en:string; recurso:string; formato:string; filas:number; estado:string; hash_sha256:string|null };

export default async function PaginaAuditoria() {
  const cliente = await crearClienteServidor();
  const permitido = await (cliente.rpc as any)("admin_tiene_permiso", { p_permiso: "auditoria:leer" });
  if (!permitido.data) redirect("/sin-permiso");
  const from = cliente.from as any;
  const [{data:eventos,error:eventosError},{data:exportaciones,error:exportError}] = await Promise.all([
    from("auditoria_admin_seguridad").select("id,creado_en,tipo,recurso,accion,motivo,rol,datos").order("creado_en",{ascending:false}).limit(200),
    from("exportaciones_admin").select("id,creada_en,recurso,formato,filas,estado,hash_sha256").order("creada_en",{ascending:false}).limit(50)
  ]);
  if (eventosError || exportError) throw eventosError ?? exportError;
  const filas = (eventos ?? []) as Evento[];
  const denegados = filas.filter((e)=>e.tipo.includes("denegado")).length;
  const mutaciones = filas.filter((e)=>e.tipo === "mutacion").length;
  return <main className="mx-auto max-w-7xl px-6 py-8">
    <h1 className="font-display text-2xl font-semibold">Auditoría administrativa</h1>
    <p className="mt-1 text-sm text-text-secondary">Accesos denegados, mutaciones, aprobaciones y exportaciones trazables.</p>
    <section className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Resumen de auditoría">
      <article className="rounded-xl border border-ink/10 p-4"><p className="text-sm text-text-secondary">Eventos recientes</p><strong className="text-2xl">{filas.length}</strong></article>
      <article className="rounded-xl border border-ink/10 p-4"><p className="text-sm text-text-secondary">Denegaciones</p><strong className="text-2xl">{denegados}</strong></article>
      <article className="rounded-xl border border-ink/10 p-4"><p className="text-sm text-text-secondary">Mutaciones</p><strong className="text-2xl">{mutaciones}</strong></article>
    </section>
    <section className="mt-8 overflow-x-auto"><h2 className="font-display text-xl font-semibold">Eventos</h2>
      <table className="mt-3 w-full text-left text-sm"><caption className="sr-only">Últimos eventos administrativos</caption><thead><tr className="border-b"><th scope="col">Fecha</th><th scope="col">Tipo</th><th scope="col">Recurso</th><th scope="col">Acción</th><th scope="col">Rol / motivo</th></tr></thead>
      <tbody>{filas.map((e)=><tr key={e.id} className="border-b border-ink/10"><td className="py-3 pr-4 whitespace-nowrap">{new Date(e.creado_en).toLocaleString("es-MX")}</td><td>{e.tipo}</td><td>{e.recurso}</td><td>{e.accion ?? "—"}</td><td>{e.rol ?? "—"}{e.motivo ? ` · ${e.motivo}`:""}</td></tr>)}</tbody></table>
    </section>
    <section className="mt-8 overflow-x-auto"><h2 className="font-display text-xl font-semibold">Exportaciones</h2>
      <table className="mt-3 w-full text-left text-sm"><caption className="sr-only">Exportaciones administrativas</caption><thead><tr className="border-b"><th>Fecha</th><th>Recurso</th><th>Formato</th><th>Filas</th><th>Estado</th><th>Huella</th></tr></thead><tbody>{((exportaciones??[]) as Exportacion[]).map(e=><tr key={e.id} className="border-b border-ink/10"><td className="py-3 pr-4">{new Date(e.creada_en).toLocaleString("es-MX")}</td><td>{e.recurso}</td><td>{e.formato}</td><td>{e.filas}</td><td>{e.estado}</td><td className="font-mono text-xs">{e.hash_sha256?.slice(0,16) ?? "—"}</td></tr>)}</tbody></table>
    </section>
  </main>;
}
