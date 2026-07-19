"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso, PassportCard } from "@ruum/ui";
import { AdminPanel } from "./admin-ui";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import {
  obtenerMetricasDashboard,
  listarIncidenciasAdmin,
  listarConductoresAdmin,
  obtenerAlertasEmergenciaAdmin,
  type MetricasDashboard
} from "@ruum/api/services";
import { METRICAS_DEMO, INCIDENCIAS_DEMO, CONDUCTORES_DEMO } from "../lib/datos-demo";
import type { Database } from "@ruum/shared/types";

type IncidenciaRow = Database["public"]["Tables"]["incidencias"]["Row"];
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type AuditoriaRow = Database["public"]["Tables"]["registro_auditoria"]["Row"];

const ETIQUETA_METRICA: Record<keyof MetricasDashboard, string> = {
  viajesActivos: "Traslados activos",
  pendientesAsignacion: "Pendientes de asignación",
  cerradosHoy: "Cerrados hoy",
  conductoresActivos: "Conductores activos",
  incidenciasAbiertas: "Incidencias abiertas"
};

export default function PaginaDashboard() {
  const [metricas, setMetricas] = useState<MetricasDashboard | null>(null);
  const [incidencias, setIncidencias] = useState<IncidenciaRow[]>([]);
  const [emergencias, setEmergencias] = useState<AuditoriaRow[]>([]);
  const [conductoresDocVencido, setConductoresDocVencido] = useState<ConductorRow[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<Date | null>(null);
  const [ahora, setAhora] = useState<Date | null>(null);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setMetricas(METRICAS_DEMO);
        setIncidencias(INCIDENCIAS_DEMO);
        setEmergencias([]);
        setConductoresDocVencido(CONDUCTORES_DEMO.filter((c) => !c.documentos_vigentes));
        setEsDemo(true);
        setUltimaSincronizacion(new Date());
        setCargando(false);
        return;
      }

      try {
        const cliente = crearClienteNavegador();
        const [m, inc, conds, emergenciasPrioritarias] = await Promise.all([
          obtenerMetricasDashboard(cliente),
          listarIncidenciasAdmin(cliente),
          listarConductoresAdmin(cliente),
          obtenerAlertasEmergenciaAdmin(cliente)
        ]);
        setMetricas(m);
        setIncidencias(inc.filter((i) => !i.resuelta));
        setEmergencias(emergenciasPrioritarias);
        setConductoresDocVencido(conds.filter((c) => !c.documentos_vigentes));
        setEsDemo(false);
        setUltimaSincronizacion(new Date());
      } catch {
        if (puedeUsarDatosDemo()) {
          setMetricas(METRICAS_DEMO);
          setIncidencias(INCIDENCIAS_DEMO);
          setEmergencias([]);
          setConductoresDocVencido(CONDUCTORES_DEMO.filter((c) => !c.documentos_vigentes));
          setEsDemo(true);
          setUltimaSincronizacion(new Date());
        } else {
          setMetricas(null);
          setIncidencias([]);
          setEmergencias([]);
          setConductoresDocVencido([]);
          setEsDemo(false);
        }
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  useEffect(() => {
    setAhora(new Date());
    const intervalo = window.setInterval(() => setAhora(new Date()), 30000);
    return () => window.clearInterval(intervalo);
  }, []);

  const estadoOperacion = useMemo(() => {
    if (cargando) return "Sincronizando";
    if (emergencias.length > 0) return "Emergencia activa";
    if (incidencias.length > 0 || conductoresDocVencido.length > 0) return "Atención requerida";
    return "Operación estable";
  }, [cargando, conductoresDocVencido.length, emergencias.length, incidencias.length]);

  const turno = useMemo(() => {
    const hora = ahora?.getHours() ?? new Date().getHours();
    if (hora >= 6 && hora < 14) return "Matutino";
    if (hora >= 14 && hora < 22) return "Vespertino";
    return "Nocturno";
  }, [ahora]);

  return (
    <main className="admin-page-shell">
      <section className="rounded-card border border-border-default bg-surface-primary/90 px-4 py-4 shadow-[var(--ruum-shadow-1)] sm:px-5" aria-label="Cabecera operativa">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono-ruum text-admin-secundario uppercase tracking-[0.16em] text-signal">Centro de control</p>
            <h1 className="mt-1 font-display text-xl font-semibold text-ink">Dashboard operativo</h1>
            <p className="mt-1 font-body text-sm text-text-secondary">Seguimiento de traslados, alertas y decisiones críticas.</p>
          </div>
          <Link
            href="/viajes"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-signal px-4 py-2.5 font-body text-admin-boton font-semibold text-ink shadow-sm transition-colors hover:bg-signal/90"
          >
            Revisar traslados
          </Link>
        </div>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <DatoCabecera etiqueta="Estado" valor={estadoOperacion} destacado={estadoOperacion !== "Operación estable"} />
          <DatoCabecera etiqueta="Fecha y hora" valor={ahora ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(ahora) : "Calculando"} />
          <DatoCabecera etiqueta="Última sincronización" valor={ultimaSincronizacion ? new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(ultimaSincronizacion) : "Pendiente"} />
          <DatoCabecera etiqueta="Conexión" valor={esDemo ? "Modo demo" : "Datos reales"} destacado={esDemo} />
          <DatoCabecera etiqueta="Turno" valor={turno} />
          <DatoCabecera etiqueta="Operadores activos" valor={esDemo ? "Demo" : "1 sesión"} />
        </dl>
      </section>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no la operación real.</Aviso>
        </div>
      )}

      {cargando ? (
        /* Ítem 11 — skeleton estructurado reemplaza "Cargando…" */
        <div className="mt-8" aria-label="Cargando datos del dashboard" aria-busy="true">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-card border border-ink/10 p-5">
                <div className="h-3 w-28 animate-pulse rounded bg-ink/8" />
                <div className="mt-3 h-8 w-16 animate-pulse rounded bg-ink/10" />
              </div>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-card border border-ink/10 p-5 space-y-3">
              <div className="h-4 w-32 animate-pulse rounded bg-ink/8" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-ink/6" />
              ))}
            </div>
            <div className="rounded-card border border-ink/10 p-5 space-y-3">
              <div className="h-4 w-28 animate-pulse rounded bg-ink/8" />
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-card bg-ink/6" />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {metricas &&
              (Object.keys(ETIQUETA_METRICA) as (keyof MetricasDashboard)[]).map((clave) => (
                <PassportCard key={clave} acento>
                  <p className="font-body text-xs font-medium uppercase tracking-wide text-text-tertiary">{ETIQUETA_METRICA[clave]}</p>
                  <p className="mt-2 font-display text-3xl font-bold text-ink">{metricas[clave]}</p>
                </PassportCard>
              ))}
          </section>

          {emergencias.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-base font-semibold text-status-error">Emergencias prioritarias</h2>
              <div className="mt-3 space-y-2">
                {emergencias.map((evento) => (
                  <Link key={evento.id} href={evento.traslado_id ? `/viajes/${evento.traslado_id}` : "/viajes"} className="block">
                    <div className="rounded-lg border border-status-error/25 bg-status-error-soft px-4 py-3">
                      <p className="font-body text-sm font-semibold text-status-error">Emergencia / 911 activada por conductor</p>
                      <p className="mt-1 font-body text-xs text-text-secondary">
                        Traslado {evento.traslado_id?.slice(0, 8).toUpperCase() ?? "sin folio"} · {new Date(evento.timestamp).toLocaleString("es-MX")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <AdminPanel className="p-5 sm:p-6">
              <h2 className="font-display text-base font-semibold">Alertas operativas</h2>
              <div className="mt-3 space-y-2">
                {incidencias.length === 0 && conductoresDocVencido.length === 0 && (
                  <p className="font-body text-sm text-text-tertiary">Sin alertas por ahora.</p>
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
            </AdminPanel>

            <AdminPanel className="p-5 sm:p-6">
              <h2 className="font-display text-base font-semibold">Accesos rápidos</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Link href="/viajes">
                  <PassportCard className="transition-shadow hover:shadow-md hover:border-signal/40">
                    <p className="font-body text-sm font-medium">Ver traslados</p>
                  </PassportCard>
                </Link>
                <Link href="/conductores">
                  <PassportCard className="transition-shadow hover:shadow-md hover:border-signal/40">
                    <p className="font-body text-sm font-medium">Ver conductores</p>
                  </PassportCard>
                </Link>
                <Link href="/usuarios">
                  <PassportCard className="transition-shadow hover:shadow-md hover:border-signal/40">
                    <p className="font-body text-sm font-medium">Ver usuarios</p>
                  </PassportCard>
                </Link>
                <Link href="/vehiculos">
                  <PassportCard className="transition-shadow hover:shadow-md hover:border-signal/40">
                    <p className="font-body text-sm font-medium">Ver vehículos</p>
                  </PassportCard>
                </Link>
                <Link href="/incidencias">
                  <PassportCard className="transition-shadow hover:shadow-md hover:border-signal/40">
                    <p className="font-body text-sm font-medium">Ver incidencias</p>
                  </PassportCard>
                </Link>
                <Link href="/disputas">
                  <PassportCard className="transition-shadow hover:shadow-md hover:border-signal/40">
                    <p className="font-body text-sm font-medium">Ver disputas</p>
                  </PassportCard>
                </Link>
                <Link href="/reclamos-seguro">
                  <PassportCard className="transition-shadow hover:shadow-md hover:border-signal/40">
                    <p className="font-body text-sm font-medium">Ver reclamos</p>
                  </PassportCard>
                </Link>
              </div>
            </AdminPanel>
          </section>
        </>
      )}
    </main>
  );
}

function DatoCabecera({ etiqueta, valor, destacado = false }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${destacado ? "border-status-warning/35 bg-status-warning-soft" : "border-ink/10 bg-surface-secondary"}`}>
      <dt className="font-body text-admin-secundario text-text-tertiary">{etiqueta}</dt>
      <dd className={`mt-1 font-body text-sm font-semibold ${destacado ? "text-status-warning" : "text-ink"}`}>{valor}</dd>
    </div>
  );
}
