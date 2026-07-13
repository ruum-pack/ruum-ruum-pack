"use client";

import { useEffect, useState } from "react";
import { Aviso, PassportCard } from "@ruum/ui";
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
    obtenerMetricasRegistroConductor(crearClienteNavegador(),desde,hasta)
      .then((datos)=>{if (activo) setMetricas(datos);})
      .catch((err)=>{if (activo) setError(traducirErrorOperativo(err,"No pudimos cargar las métricas de registro."));})
      .finally(()=>{if (activo) setCargando(false);});
    return()=>{activo=false;};
  },[desde,hasta]);

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
    ["Solicitudes enviadas",String(metricas.solicitudesEnviadas)],
    ["Errores de OTP",String(metricas.erroresOtp)],
    ["Errores de RPC",String(metricas.erroresRpc)],
    ["Fallos de documentos",String(metricas.fallosDocumentos)],
    ["Registro promedio",duracion(metricas.tiempoPromedioRegistroSegundos)],
    ["Revisión promedio",duracion(metricas.tiempoPromedioRevisionSegundos)]
  ]:[];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Métricas de registro</h1>
          <p className="mt-1 font-body text-sm text-ink/55">Abandono, errores, tiempos y rechazo documental del alta de conductores.</p>
        </div>
        <div className="flex gap-3 font-body text-sm">
          <label className="grid gap-1 text-ink/60">Desde
            <input type="date" value={desde} max={hasta||undefined} onChange={(e)=>cambiarDesde(e.target.value)} className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink" />
          </label>
          <label className="grid gap-1 text-ink/60">Hasta
            <input type="date" value={hasta} min={desde||undefined} onChange={(e)=>cambiarHasta(e.target.value)} className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink" />
          </label>
        </div>
      </div>

      {error&&<div className="mt-5"><Aviso tono="peligro">{error}</Aviso></div>}
      {cargando&&<p className="mt-5 font-body text-sm text-ink/50">Actualizando indicadores…</p>}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6" aria-label="Resumen del periodo">
        {tarjetas.map(([etiqueta,valor])=>(
          <PassportCard key={etiqueta}>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">{etiqueta}</p>
            <p className="mt-2 font-display text-2xl font-semibold">{valor}</p>
          </PassportCard>
        ))}
      </section>

      {metricas&&(
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <PassportCard>
            <h2 className="font-display text-xl font-semibold">Abandono por paso</h2>
            <p className="mt-1 font-body text-xs text-ink/50">Expedientes sin actividad durante al menos 24 horas.</p>
            <div className="mt-4 grid gap-2">
              {metricas.abandonoPorPaso.length===0&&<p className="font-body text-sm text-ink/50">Sin abandonos en el periodo.</p>}
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
            <p className="mt-1 font-body text-xs text-ink/50">Decisiones de rechazo, agrupadas por tipo documental.</p>
            <div className="mt-4 grid gap-2">
              {metricas.documentosRechazadosPorTipo.length===0&&<p className="font-body text-sm text-ink/50">Sin rechazos en el periodo.</p>}
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
    </main>
  );
}
