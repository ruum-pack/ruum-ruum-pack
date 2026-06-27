"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Aviso, PassportCard } from "@ruum/ui";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import { obtenerMetricasDashboard, listarIncidenciasAdmin, listarConductoresAdmin, type MetricasDashboard } from "@ruum/api/services";
import { METRICAS_DEMO, INCIDENCIAS_DEMO, CONDUCTORES_DEMO } from "../lib/datos-demo";
import type { Database } from "@ruum/shared/types";

type IncidenciaRow = Database["public"]["Tables"]["incidencias"]["Row"];
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];

const ETIQUETA_METRICA: Record<keyof MetricasDashboard, string> = {
  viajesActivos: "Viajes activos",
  pendientesAsignacion: "Pendientes de asignación",
  cerradosHoy: "Cerrados hoy",
  conductoresActivos: "Conductores activos",
  incidenciasAbiertas: "Incidencias abiertas"
};

export default function PaginaDashboard() {
  const [metricas, setMetricas] = useState<MetricasDashboard | null>(null);
  const [incidencias, setIncidencias] = useState<IncidenciaRow[]>([]);
  const [conductoresDocVencido, setConductoresDocVencido] = useState<ConductorRow[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setMetricas(METRICAS_DEMO);
        setIncidencias(INCIDENCIAS_DEMO);
        setConductoresDocVencido(CONDUCTORES_DEMO.filter((c) => !c.documentos_vigentes));
        setEsDemo(true);
        setCargando(false);
        return;
      }

      try {
        const cliente = crearClienteNavegador();
        const [m, inc, conds] = await Promise.all([
          obtenerMetricasDashboard(cliente),
          listarIncidenciasAdmin(cliente),
          listarConductoresAdmin(cliente)
        ]);
        setMetricas(m);
        setIncidencias(inc.filter((i) => !i.resuelta));
        setConductoresDocVencido(conds.filter((c) => !c.documentos_vigentes));
        setEsDemo(false);
      } catch {
        setMetricas(METRICAS_DEMO);
        setIncidencias(INCIDENCIAS_DEMO);
        setConductoresDocVencido(CONDUCTORES_DEMO.filter((c) => !c.documentos_vigentes));
        setEsDemo(true);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 font-body text-sm text-ink/55">Qué está pasando en la operación y qué necesita atención.</p>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no la operación real.</Aviso>
        </div>
      )}

      {cargando ? (
        <p className="mt-8 font-body text-sm text-ink/50">Cargando…</p>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-5 gap-4">
            {metricas &&
              (Object.keys(ETIQUETA_METRICA) as (keyof MetricasDashboard)[]).map((clave) => (
                <PassportCard key={clave}>
                  <p className="font-body text-xs uppercase tracking-wide text-ink/45">{ETIQUETA_METRICA[clave]}</p>
                  <p className="mt-2 font-display text-3xl font-semibold">{metricas[clave]}</p>
                </PassportCard>
              ))}
          </section>

          <section className="mt-8 grid grid-cols-2 gap-6">
            <div>
              <h2 className="font-display text-base font-semibold">Alertas operativas</h2>
              <div className="mt-3 space-y-2">
                {incidencias.length === 0 && conductoresDocVencido.length === 0 && (
                  <p className="font-body text-sm text-ink/45">Sin alertas por ahora.</p>
                )}
                {incidencias.map((i) => (
                  <Link key={i.id} href={`/viajes/${i.traslado_id}`} className="block">
                    <Aviso tono="atencion">Incidencia sin resolver: {i.descripcion}</Aviso>
                  </Link>
                ))}
                {conductoresDocVencido.map((c) => (
                  <Link key={c.id} href="/conductores" className="block">
                    <Aviso tono="atencion">{c.nombre}: documentos vencidos o incompletos</Aviso>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-display text-base font-semibold">Accesos rápidos</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Link href="/viajes">
                  <PassportCard className="hover:border-signal/40">
                    <p className="font-body text-sm font-medium">Ver viajes</p>
                  </PassportCard>
                </Link>
                <Link href="/conductores">
                  <PassportCard className="hover:border-signal/40">
                    <p className="font-body text-sm font-medium">Ver conductores</p>
                  </PassportCard>
                </Link>
                <Link href="/usuarios">
                  <PassportCard className="hover:border-signal/40">
                    <p className="font-body text-sm font-medium">Ver usuarios</p>
                  </PassportCard>
                </Link>
                <Link href="/incidencias">
                  <PassportCard className="hover:border-signal/40">
                    <p className="font-body text-sm font-medium">Ver incidencias</p>
                  </PassportCard>
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
