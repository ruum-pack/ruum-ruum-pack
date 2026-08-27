"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";

type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type Traslado = Pick<Database["public"]["Tables"]["traslados"]["Row"], "id" | "origen_direccion" | "origen_ciudad" | "destino_direccion" | "destino_ciudad">;
type PestañaViajes = "activos" | "programados" | "finalizados" | "cancelados";
interface ViajeLista { pasaporte: Pasaporte; traslado: Traslado | null; }

const ETIQUETAS_PESTANA: Record<PestañaViajes, { label: string; desc: string }> = {
  activos: { label: "En curso", desc: "Vehículo recibido, en traslado o llegando" },
  programados: { label: "Por iniciar", desc: "Solicitud creada, en revisión o buscando conductor" },
  finalizados: { label: "Historial", desc: "Viajes finalizados con evidencia" },
  cancelados: { label: "Cancelados", desc: "Cancelados o fallidos" },
};

const ESTATUS_USUARIO: Record<string, string> = {
  usuario_pendiente_verificacion: "Solicitud recibida",
  usuario_verificado: "Solicitud recibida",
  solicitud_creada: "Solicitud recibida",
  documentacion_pendiente: "En preparación",
  documentacion_en_revision: "En preparación",
  documentacion_validada: "En preparación",
  cotizacion_generada: "En preparación",
  cotizacion_aceptada: "Pago pendiente",
  servicio_confirmado: "En preparación",
  pendiente_de_conductor: "Buscando conductor",
  conductor_asignado: "Conductor asignado",
  conductor_en_camino_al_origen: "Conductor en camino",
  conductor_en_punto_de_recoleccion: "Recolección en proceso",
  verificacion_vehiculo_en_proceso: "Recolección en proceso",
  evidencia_inicial_en_proceso: "Recolección en proceso",
  evidencia_inicial_completada: "Evidencia inicial lista",
  vehiculo_recibido: "Vehículo recibido",
  traslado_en_curso: "En camino",
  incidencia_reportada: "Incidente reportado",
  llegada_a_destino: "Llegando a destino",
  evidencia_final_en_proceso: "Entrega en proceso",
  evidencia_final_completada: "Evidencia final lista",
  entrega_confirmada: "Entregado",
  pago_pendiente: "Pago pendiente",
  pago_completado: "Pago confirmado",
  servicio_cerrado: "Viaje finalizado",
  servicio_cancelado: "Cancelado",
  traslado_fallido: "Traslado fallido",
  dano_no_reportado_en_revision: "En revisión por incidente",
  reclamo_abierto: "Reclamo abierto",
  reclamo_resuelto: "Viaje finalizado",
  cierre_operativo_con_incidencia_abierta: "Cerrado con incidente",
  disputa_abierta: "Disputa abierta",
  disputa_resuelta: "Viaje finalizado"
};

function fechaHora(fecha: string | null | undefined) {
  if (!fecha) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(fecha));
}
function moneda(valor: number | null | undefined) { return `$${Number(valor ?? 0).toLocaleString("es-MX")}`; }
function vehiculo(p: Pasaporte) { const partes = [p.vehiculo_marca, p.vehiculo_modelo, p.vehiculo_anio].filter(Boolean); return partes.length>0? partes.join(" "): "Vehículo"; }

function IconoVehiculoTipo({ tipo, className="size-5" }: { tipo?: string | null; className?: string }) {
  if (tipo==="suv") return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 14h18v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3z"/><path d="M5 14l2.5-6h9l3.5 6"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M2 10h20"/></svg>;
  if (tipo==="pick_up") return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 14h20v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3z"/><path d="M5 14l2-5h6v5"/><circle cx="7" cy="17.5" r="2.5"/><circle cx="17" cy="17.5" r="2.5"/></svg>;
  if (tipo==="van") return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 7v4"/><path d="M14 7v4"/><circle cx="7" cy="17.5" r="2.5"/><circle cx="17" cy="17.5" r="2.5"/></svg>;
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 14h18v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3z"/><path d="M5 14l2-5h10l2 5"/><circle cx="7" cy="17.5" r="2.5"/><circle cx="17" cy="17.5" r="2.5"/></svg>;
}
function IconoChevron({className="size-5"}:{className?:string}){ return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>; }

function ViajeCard({ viaje }: { viaje: ViajeLista }) {
  const { pasaporte, traslado } = viaje;
  if (!pasaporte.traslado_id) return null;
  const estadoVisible = pasaporte.estado ? (ESTATUS_USUARIO[pasaporte.estado] ?? pasaporte.estado) : "Estado por confirmar";
  return (
    <Link href={`/traslados/${pasaporte.traslado_id}`} className="app-card app-card-interactive group block rounded-xl bg-surface px-4 py-4 text-text-primary no-underline border border-border shadow-sm focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action hover:border-route-action" aria-label={`Ver Pasaporte Digital del viaje ${pasaporte.traslado_id.slice(0,8).toUpperCase()}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-elevated border border-border text-text-secondary group-hover:border-signal/40 group-hover:text-signal transition-colors mt-0.5"><IconoVehiculoTipo tipo={pasaporte.vehiculo_tipo} className="size-5" /></div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-route-action/30 bg-route-action/10 px-2.5 py-1 font-body text-xs font-semibold text-route-action">{estadoVisible}</span>
              {pasaporte.tiene_incidencia_abierta && <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 font-body text-xs font-semibold text-warning">Incidencia abierta</span>}
            </div>
            <h2 className="mt-2 font-display text-base sm:text-lg font-bold text-text-primary group-hover:text-route-action transition-colors break-words">{vehiculo(pasaporte)}{pasaporte.vehiculo_tipo && <span className="ml-2 font-body text-xs font-normal text-text-tertiary">· {ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo as never] ?? pasaporte.vehiculo_tipo}</span>}</h2>
            <p className="mt-0.5 font-body text-xs text-text-secondary">Folio <span className="font-mono-ruum font-semibold text-text-primary">{pasaporte.traslado_id.slice(0,8).toUpperCase()}</span> · {fechaHora(pasaporte.creado_en)}</p>
          </div>
        </div>
        <div className="flex size-12 shrink-0 items-center justify-center self-end rounded-xl border border-border bg-surface-elevated text-text-secondary transition-all group-hover:border-signal/40 group-hover:text-signal lg:self-start min-w-[48px] min-h-[48px]" aria-hidden="true"><IconoChevron className="size-5" /></div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t border-border/40 pt-3">
        <div className="min-w-0"><dt className="font-body text-xs uppercase tracking-wide text-text-tertiary font-medium">Origen</dt><dd className="mt-0.5 font-body text-sm font-semibold text-text-primary break-words">{traslado ? `${traslado.origen_ciudad} · ${traslado.origen_direccion}` : "Pendiente"}</dd></div>
        <div className="min-w-0"><dt className="font-body text-xs uppercase tracking-wide text-text-tertiary font-medium">Destino</dt><dd className="mt-0.5 font-body text-sm font-semibold text-text-primary break-words">{traslado ? `${traslado.destino_ciudad} · ${traslado.destino_direccion}` : "Pendiente"}</dd></div>
        <div><dt className="font-body text-xs uppercase tracking-wide text-text-tertiary font-medium">Conductor asignado</dt><dd className="mt-0.5 font-body text-sm font-semibold text-text-primary">{pasaporte.conductor_nombre ?? "Por asignar"}</dd></div>
        <div><dt className="font-body text-xs uppercase tracking-wide text-text-tertiary font-medium">Tarifa</dt><dd className="mt-0.5 font-mono-ruum text-sm font-bold text-signal">{moneda(pasaporte.precio_final ?? pasaporte.precio_cotizado)}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2 font-body text-xs text-text-secondary">
        {pasaporte.tipo_pago==="anticipado" && pasaporte.estado==="cotizacion_aceptada" && <span className="rounded-full bg-signal px-3 py-1 font-bold text-slate-950">Continuar con el pago</span>}
        <span className="rounded-full bg-surface-elevated border border-border/40 px-2.5 py-1">Evidencia inicial: {pasaporte.evidencia_inicial_fotos_sincronizadas ?? 0} fotos</span>
        <span className="rounded-full bg-surface-elevated border border-border/40 px-2.5 py-1">Evidencia final: {pasaporte.evidencia_final_fotos_sincronizadas ?? 0} fotos</span>
      </div>
    </Link>
  );
}

const EMPTY_STATE: Record<PestañaViajes, { titulo:string; cuerpo:string; cta?:string; ctaHref?:string }> = {
  activos: { titulo: "Sin traslados en curso", cuerpo: "Solicita un traslado para verlo aquí con su estatus y Pasaporte Digital en tiempo real.", cta:"Solicitar traslado", ctaHref:"/traslados/nuevo" },
  programados: { titulo: "Sin traslados por iniciar", cuerpo: "Cuando agendes un traslado con fecha futura, aparecerá aquí. Ahora puedes ver el progreso en ‘En curso’.", cta:"Programar traslado", ctaHref:"/traslados/nuevo" },
  finalizados: { titulo: "Sin historial", cuerpo: "Tus traslados completados aparecerán aquí con evidencia inicial, final y resumen del viaje." },
  cancelados: { titulo: "Sin traslados cancelados", cuerpo: "No has cancelado ningún traslado." },
};
function EmptyStatePestana({ pestana }: { pestana: PestañaViajes }) {
  const estado = EMPTY_STATE[pestana];
  return <div className="rounded-xl border border-dashed border-border bg-surface/30 px-6 py-10 text-center"><p className="font-display text-sm font-bold text-text-primary">{estado.titulo}</p><p className="mx-auto mt-2 max-w-xs font-body text-xs leading-5 text-text-secondary">{estado.cuerpo}</p>{estado.cta && estado.ctaHref && <Link href={estado.ctaHref} className="mt-4 inline-flex items-center gap-1 font-body text-sm font-semibold text-route-action underline-offset-4 hover:underline">{estado.cta} →</Link>}</div>;
}

function pestañaDeViaje(p: Pasaporte): PestañaViajes {
  if (!p.estado) return "activos";
  if (p.estado==="servicio_cancelado"||p.estado==="traslado_fallido") return "cancelados";
  if (["servicio_cerrado","reclamo_resuelto","disputa_resuelta"].includes(p.estado)) return "finalizados";
  if (["solicitud_creada","documentacion_pendiente","documentacion_en_revision","documentacion_validada","cotizacion_generada","servicio_confirmado","pendiente_de_conductor"].includes(p.estado)) return "programados";
  return "activos";
}

export function MisViajesCliente({ viajes, pestanaInicial }: { viajes: ViajeLista[]; pestanaInicial: PestañaViajes }) {
  const [pestana, setPestana] = useState<PestañaViajes>(pestanaInicial);
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<"reciente"|"antiguo">("reciente");

  const filtrados = useMemo(() => {
    let lista = viajes.filter(v=> pestañaDeViaje(v.pasaporte)===pestana);
    if (busqueda.trim()){
      const q = busqueda.trim().toLowerCase();
      lista = lista.filter(v=>{
        const folio = v.pasaporte.traslado_id?.toLowerCase() ?? "";
        const veh = vehiculo(v.pasaporte).toLowerCase();
        const origen = `${v.traslado?.origen_ciudad ?? ""} ${v.traslado?.origen_direccion ?? ""}`.toLowerCase();
        const destino = `${v.traslado?.destino_ciudad ?? ""} ${v.traslado?.destino_direccion ?? ""}`.toLowerCase();
        const cond = (v.pasaporte.conductor_nombre ?? "").toLowerCase();
        const placas = (v.pasaporte.vehiculo_placas ?? "").toLowerCase();
        return folio.includes(q) || veh.includes(q) || origen.includes(q) || destino.includes(q) || cond.includes(q) || placas.includes(q);
      });
    }
    lista = [...lista].sort((a,b)=>{
      const fa = a.pasaporte.creado_en ? new Date(a.pasaporte.creado_en).getTime() : 0;
      const fb = b.pasaporte.creado_en ? new Date(b.pasaporte.creado_en).getTime() : 0;
      return orden==="reciente" ? fb-fa : fa-fb;
    });
    return lista;
  }, [viajes, pestana, busqueda, orden]);

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1.5">
          <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Buscar</span>
          <div className="relative">
            <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Folio, placa, vehículo, ciudad o conductor" className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 pr-9 font-body text-sm text-text-primary placeholder:text-text-tertiary focus:border-route-action focus:outline-none focus:ring-2 focus:ring-route-action/20" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary">⌕</span>
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Orden</span>
          <select value={orden} onChange={e=>setOrden(e.target.value as never)} className="rounded-xl border border-border bg-surface px-3.5 py-2.5 font-body text-sm text-text-primary focus:border-route-action focus:outline-none focus:ring-2 focus:ring-route-action/20">
            <option value="reciente">Más reciente primero</option>
            <option value="antiguo">Más antiguo primero</option>
          </select>
        </label>
      </div>

      <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Filtros de viajes">
        {(Object.keys(ETIQUETAS_PESTANA) as PestañaViajes[]).map((id)=>{
          const activa = id===pestana;
          const total = viajes.filter(v=> pestañaDeViaje(v.pasaporte)===id).length;
          const meta = ETIQUETAS_PESTANA[id];
          return (
            <button key={id} type="button" onClick={()=>setPestana(id)} aria-pressed={activa} title={meta.desc} className={["rounded-xl border px-3.5 py-2.5 font-body text-xs sm:text-sm transition-all flex items-center justify-between text-left", activa? "border-signal bg-signal/15 text-signal font-bold shadow-xs" : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary"].join(" ")}>
              <span className="font-semibold leading-tight">{meta.label}<span className="block text-[10px] font-normal leading-none opacity-70 sm:hidden">{meta.desc.split("·")[0]}</span></span>
              <span className="font-mono-ruum text-xs px-1.5 py-0.5 rounded-full bg-surface-elevated text-text-secondary">{total}</span>
            </button>
          );
        })}
      </nav>
      <p className="mt-2 font-body text-xs text-text-tertiary" aria-live="polite">{filtrados.length} resultados en “{ETIQUETAS_PESTANA[pestana].label}”{busqueda? ` para “${busqueda}”`:""}</p>
      <div className="mt-6 grid gap-4">
        {filtrados.length>0 ? filtrados.map((viaje, i)=> <ViajeCard key={viaje.pasaporte.traslado_id ?? `viaje-${i}`} viaje={viaje} />) : <EmptyStatePestana pestana={pestana} />}
      </div>
    </>
  );
}
