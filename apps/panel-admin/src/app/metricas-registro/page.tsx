"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import {
  obtenerMetricasRegistroConductor,
  type MetricasRegistroConductor
} from "@ruum/api/services";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

const NOMBRES_PASO=["Cuenta y datos personales","Domicilio","Licencia y documentos","Verificación y consentimientos","Revisión y envío"];
const NOMBRES_DOCUMENTO:Record<string,string>={
  licencia_frente:"Licencia (frente)",
  licencia_reverso:"Licencia (reverso)",
  identificacion_oficial:"Identificación oficial",
  documento_operativo:"Documento operativo"
};

function fechaLocal(fecha:Date) {
  const mes=String(fecha.getMonth()+1).padStart(2,"0");
  const dia=String(fecha.getDate()).padStart(2,"0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

const FIN_INICIAL=new Date();
const INICIO_INICIAL=new Date(FIN_INICIAL);
INICIO_INICIAL.setDate(INICIO_INICIAL.getDate()-29);
const PERIODO_INICIAL={desde:fechaLocal(INICIO_INICIAL),hasta:fechaLocal(FIN_INICIAL)};

function duracion(segundos:number|null) {
  if (segundos===null) return "Sin datos";
  if (segundos<60) return `${Math.round(segundos)} s`;
  if (segundos<3600) return `${Math.round(segundos/60)} min`;
  return `${(segundos/3600).toFixed(1)} h`;
}

export default function PaginaMetricasRegistro() {
  const [desde,setDesde]=useState(PERIODO_INICIAL.desde);
  const [hasta,setHasta]=useState(PERIODO_INICIAL.hasta);
  const [zona,setZona]=useState("");
  const [fuente,setFuente]=useState("");
  const [empresaId,setEmpresaId]=useState("");
  const [metricas,setMetricas]=useState<MetricasRegistroConductor|null>(null);
  const [cargando,setCargando]=useState(() => !tieneSupabaseConfigurado());
  const [error,setError]=useState<string|null>(() =>
    tieneSupabaseConfigurado() ? null : "Supabase no está configurado en este entorno."
  );

  useEffect(()=>{
    if (!tieneSupabaseConfigurado()) {
      return undefined;
    }

    let activo=true;
    obtenerMetricasRegistroConductor(crearClienteNavegador(),desde,hasta,{
      ...(zona.trim()?{zona:zona.trim()}:{}),
      ...(fuente.trim()?{fuente:fuente.trim()}:{}),
      ...(empresaId.trim()?{empresaId:empresaId.trim()}:{})
    })
      .then((datos)=>{if (activo) setMetricas(datos);})
      .catch((err)=>{if (activo) setError(traducirErrorOperativo(err,"No pudimos cargar las métricas de registro."));})
      .finally(()=>{if (activo) setCargando(false);});
    return()=>{activo=false;};
  },[desde,hasta,zona,fuente,empresaId]);

  function cambiarDesde(valor:string) {
    setCargando(true);
    setError(null);
    setDesde(valor);
  }

  function cambiarHasta(valor:string) {
    setCargando(true);
    setError(null);
    setHasta(valor);
  }

  const tarjetas=metricas?[
    ["Solicitudes iniciadas",String(metricas.solicitudesIniciadas),"solicitudes_iniciadas"],
    ["Solicitudes enviadas",String(metricas.solicitudesEnviadas)],
    ["Conversión a envío",`${metricas.conversionEnvioPct.toFixed(1)}%`,"conversion_envio_pct"],
    ["Errores de OTP",String(metricas.erroresOtp)],
    ["Errores de RPC",String(metricas.erroresRpc)],
    ["Fallos de documentos",String(metricas.fallosDocumentos)],
    ["Registro promedio",duracion(metricas.tiempoPromedioRegistroSegundos)],
    ["Revisión promedio",duracion(metricas.tiempoPromedioRevisionSegundos)]
  ]:[];

  const exportHref=`/api/exportaciones/metricas-registro?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}${zona.trim()?`&zona=${encodeURIComponent(zona.trim())}`:""}${fuente.trim()?`&fuente=${encodeURIComponent(fuente.trim())}`:""}${empresaId.trim()?`&empresaId=${encodeURIComponent(empresaId.trim())}`:""}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Métricas de registro</h1>
          <p className="mt-1 font-body text-sm text-text-secondary">Abandono, errores, tiempos y rechazo documental del alta de conductores.</p>
        </div>
        <div className="flex flex-wrap gap-3 font-body text-sm">
          <label className="grid gap-1 text-text-secondary">Desde
            <input type="date" value={desde} max={hasta||undefined} onChange={(e)=>cambiarDesde(e.target.value)} className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink" />
          </label>
          <label className="grid gap-1 text-text-secondary">Hasta
            <input type="date" value={hasta} min={desde||undefined} onChange={(e)=>cambiarHasta(e.target.value)} className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink" />
          </label>
          <label className="grid gap-1 text-text-secondary">Zona
            <input value={zona} onChange={(e)=>{setCargando(true);setError(null);setZona(e.target.value);}} placeholder="sin_zona" className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink" />
          </label>
          <label className="grid gap-1 text-text-secondary">Fuente
            <input value={fuente} onChange={(e)=>{setCargando(true);setError(null);setFuente(e.target.value);}} placeholder="v2_minimo" className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink" />
          </label>
          <label className="grid gap-1 text-text-secondary">Empresa
            <input value={empresaId} onChange={(e)=>{setCargando(true);setError(null);setEmpresaId(e.target.value);}} placeholder="UUID" className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink" />
          </label>
          {metricas&&(
            <Link href={exportHref} className="self-end">
              <Button icon="none" variant="secondary">Exportar CSV</Button>
            </Link>
          )}
        </div>
      </div>

      {error&&<div className="mt-5"><Aviso tono="danger">{error}</Aviso></div>}
      {cargando&&<p className="mt-5 font-body text-sm text-text-tertiary">Actualizando indicadores…</p>}

      {metricas?.alertas.length ? (
        <div className="mt-5 grid gap-2">
          {metricas.alertas.map((alerta)=>(
            <Aviso key={alerta.clave} tono={alerta.severidad==="critica"||alerta.severidad==="alta"?"danger":"atencion"}>
              {alerta.nombre}: {alerta.valor} contra meta {alerta.meta}.
            </Aviso>
          ))}
        </div>
      ):null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen del periodo">
        {tarjetas.map(([etiqueta,valor,clave])=>(
          <PassportCard key={etiqueta}>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">{etiqueta}</p>
            <p className="mt-2 font-display text-2xl font-semibold">{valor}</p>
            {metricas&&clave&&(
              <p className="mt-1 font-body text-xs text-text-tertiary">
                Periodo anterior: {formatoComparacion(metricas.comparacion.metricas[String(clave)])}
              </p>
            )}
          </PassportCard>
        ))}
      </section>

      {metricas&&(
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Abandono por paso</h2>
            <p className="mt-1 font-body text-xs text-text-tertiary">Expedientes sin actividad durante al menos 24 horas.</p>
            <div className="mt-4 grid gap-2">
              {metricas.abandonoPorPaso.length===0&&<p className="font-body text-sm text-text-tertiary">Sin abandonos en el periodo.</p>}
              {metricas.abandonoPorPaso.map((fila)=>(
                <div key={fila.paso} className="flex items-center justify-between rounded-lg border border-ink/10 px-4 py-3 font-body text-sm">
                  <span>Paso {fila.paso}: {NOMBRES_PASO[fila.paso-1]??"Sin identificar"}</span>
                  <strong>{fila.total}</strong>
                </div>
              ))}
            </div>
          </PassportCard>

          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Documentos rechazados</h2>
            <p className="mt-1 font-body text-xs text-text-tertiary">Decisiones de rechazo, agrupadas por tipo documental.</p>
            <div className="mt-4 grid gap-2">
              {metricas.documentosRechazadosPorTipo.length===0&&<p className="font-body text-sm text-text-tertiary">Sin rechazos en el periodo.</p>}
              {metricas.documentosRechazadosPorTipo.map((fila)=>(
                <div key={fila.tipo} className="flex items-center justify-between rounded-lg border border-ink/10 px-4 py-3 font-body text-sm">
                  <span>{NOMBRES_DOCUMENTO[fila.tipo]??fila.tipo}</span>
                  <strong>{fila.total}</strong>
                </div>
              ))}
            </div>
          </PassportCard>
        </section>
      )}

      {metricas&&(
        <>
          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <PassportCard>
              <h2 className="font-display text-lg font-semibold">Segmento por zona</h2>
              <ListaSegmentos filas={metricas.segmentos.zona} />
            </PassportCard>
            <PassportCard>
              <h2 className="font-display text-lg font-semibold">Segmento por fuente</h2>
              <ListaSegmentos filas={metricas.segmentos.fuente} />
            </PassportCard>
            <PassportCard>
              <h2 className="font-display text-lg font-semibold">Segmento por empresa</h2>
              <ListaSegmentos filas={metricas.segmentos.empresa} />
            </PassportCard>
          </section>

          <section className="mt-6">
            <PassportCard>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold">Detalle y fórmula oficial</h2>
                  <p className="mt-1 font-body text-xs text-text-tertiary">Cada cifra declara fórmula y consulta SQL de referencia.</p>
                </div>
                <div className="font-body text-xs text-text-tertiary">
                  Datos tardíos: {metricas.calidadDatos.eventosTardios} · duplicados: {metricas.calidadDatos.eventosDuplicados}
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left font-body text-sm">
                  <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-text-tertiary">
                    <tr><th className="py-2 pr-3">Métrica</th><th className="py-2 pr-3">Valor</th><th className="py-2 pr-3">Fórmula</th><th className="py-2 pr-3">Referencia</th><th className="py-2 pr-3">Meta</th></tr>
                  </thead>
                  <tbody>
                    {metricas.detalle.map((fila)=>(
                      <tr key={fila.clave} className="border-b border-ink/5 last:border-0">
                        <td className="py-3 pr-3 font-semibold text-ink">{fila.nombre}<p className="font-normal text-text-tertiary">{fila.explicacion}</p></td>
                        <td className="py-3 pr-3">{fila.valor??"Sin datos"}</td>
                        <td className="py-3 pr-3 font-mono-ruum text-xs">{fila.formula}</td>
                        <td className="py-3 pr-3">{fila.consultaReferencia}</td>
                        <td className="py-3 pr-3">{fila.meta===null?"Sin meta":`${fila.operadorMeta} ${fila.meta}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 font-body text-xs text-text-tertiary">{metricas.calidadDatos.nota}</p>
            </PassportCard>
          </section>
        </>
      )}
    </main>
  );
}

function formatoComparacion(valor:number|undefined) {
  return valor===undefined ? "Sin datos" : String(valor);
}

function ListaSegmentos({filas}:{filas:MetricasRegistroConductor["segmentos"]["zona"]}) {
  if (!filas.length) return <p className="mt-3 font-body text-sm text-text-tertiary">Sin datos para el periodo.</p>;
  return (
    <div className="mt-3 grid gap-2">
      {filas.slice(0,6).map((fila)=>(
        <div key={fila.segmento} className="rounded-lg border border-ink/10 px-3 py-2 font-body text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate">{fila.segmento}</span>
            <strong>{fila.iniciadas}</strong>
          </div>
          <p className="mt-1 text-xs text-text-tertiary">{fila.enviadas} enviadas · {fila.conversionEnvioPct.toFixed(1)}% conversión</p>
        </div>
      ))}
    </div>
  );
}
