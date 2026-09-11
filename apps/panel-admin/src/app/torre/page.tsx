"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@ruum/ui";
import { ESTADOS_OPERATIVOS, estaViajando } from "@ruum/shared/states";
import type { EstadoTraslado } from "@ruum/shared/types";
import {
  listarAtencionPrioritaria,
  obtenerFiltrosTorre,
  obtenerKpisTorre,
  obtenerTimelineTraslado,
  type EventoTimeline,
  type FiltrosDisponibles,
  type FiltrosTorre,
  type ItemAtencion,
  type KpisTorre
} from "@ruum/api/operations";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AdminPageHeader } from "../admin-ui";
import { AdminDrawer, AdminEmptyState, AdminErrorState, AdminLoadingState } from "../admin-components";

const FILTROS_VACIOS: FiltrosTorre = { empresaId: null, operacionId: null, ciudad: null, operativo: null };
const VACIOS: FiltrosDisponibles = { empresas: [], operaciones: [], ciudades: [] };

function TarjetaKpi({ etiqueta, valor, href }: { etiqueta: string; valor: number; href: string }) {
  return (
    <Link
      href={href}
      style={{ border: "1px solid var(--ruum-borde, #e5e5e5)", borderRadius: 12, padding: 16, textDecoration: "none" }}
    >
      <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>{etiqueta}</p>
      <p style={{ fontSize: 32, fontWeight: 700, margin: "4px 0 0" }}>{valor}</p>
    </Link>
  );
}

export default function PaginaTorre() {
  const [kpis, setKpis] = useState<KpisTorre | null>(null);
  const [items, setItems] = useState<ItemAtencion[]>([]);
  const [disponibles, setDisponibles] = useState<FiltrosDisponibles>(VACIOS);
  const [filtros, setFiltros] = useState<FiltrosTorre>(FILTROS_VACIOS);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [seleccionado, setSeleccionado] = useState<ItemAtencion | null>(null);
  const [timeline, setTimeline] = useState<EventoTimeline[] | null>(null);

  const cargar = useCallback(async (f: FiltrosTorre) => {
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const [k, lista, disp] = await Promise.all([
        obtenerKpisTorre(cliente, f),
        listarAtencionPrioritaria(cliente, f),
        obtenerFiltrosTorre(cliente)
      ]);
      setKpis(k);
      setItems(lista);
      setDisponibles(disp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la Torre.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(FILTROS_VACIOS), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  function aplicarFiltros() {
    setCargando(true);
    startTransition(async () => {
      await cargar(filtros);
    });
  }

  function abrirDetalle(item: ItemAtencion) {
    setSeleccionado(item);
    setTimeline(null);
    setMensaje(null);
    startTransition(async () => {
      try {
        setTimeline(await obtenerTimelineTraslado(crearClienteNavegador(), item.trasladoId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar el timeline.");
      }
    });
  }

  function copiarId() {
    if (!seleccionado) return;
    const id = seleccionado.trasladoId;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(id).then(
        () => setMensaje("ID copiado."),
        () => setMensaje(id)
      );
    } else {
      setMensaje(id);
    }
  }

  if (cargando && !kpis) return <AdminLoadingState label="Cargando Torre de Control…" />;
  if (error && !kpis) {
    return <AdminErrorState description={error} action={<Button onClick={() => void cargar(filtros)}>Reintentar</Button>} />;
  }

  return (
    <div>
      <AdminPageHeader
        titulo="Torre de Control"
        descripcion="Qué ocurre, qué va retrasado y qué necesita intervención — en una pantalla."
        accion={<Button onClick={aplicarFiltros} disabled={pendiente}>{pendiente ? "Actualizando…" : "Actualizar"}</Button>}
      />

      {mensaje ? <p role="status">{mensaje}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      <section aria-label="Filtros" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <label>
          Empresa
          <select value={filtros.empresaId ?? ""} onChange={(e) => setFiltros((f) => ({ ...f, empresaId: e.target.value || null }))}>
            <option value="">Todas</option>
            {disponibles.empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          Operación
          <select value={filtros.operacionId ?? ""} onChange={(e) => setFiltros((f) => ({ ...f, operacionId: e.target.value || null }))}>
            <option value="">Todas</option>
            {disponibles.operaciones.map((o) => (
              <option key={o.id} value={o.id}>{o.folio} — {o.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          Región
          <select value={filtros.ciudad ?? ""} onChange={(e) => setFiltros((f) => ({ ...f, ciudad: e.target.value || null }))}>
            <option value="">Todas</option>
            {disponibles.ciudades.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Estado operativo
          <select value={filtros.operativo ?? ""} onChange={(e) => setFiltros((f) => ({ ...f, operativo: e.target.value || null }))}>
            <option value="">Todos</option>
            {ESTADOS_OPERATIVOS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </label>
        <Button onClick={() => { setFiltros(FILTROS_VACIOS); setCargando(true); void cargar(FILTROS_VACIOS); }} disabled={pendiente}>
          Limpiar
        </Button>
      </section>

      {kpis ? (
        <section aria-label="Indicadores" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginBottom: 24 }}>
          <TarjetaKpi etiqueta="Operaciones activas" valor={kpis.operacionesActivas} href="/operaciones" />
          <TarjetaKpi etiqueta="Traslados activos" valor={kpis.trasladosActivos} href="/viajes?filtro=activos" />
          <TarjetaKpi etiqueta="Sin conductor" valor={kpis.sinConductor} href="/viajes?filtro=sin_asignacion" />
          <TarjetaKpi etiqueta="Asignaciones rechazadas" valor={kpis.asignacionesRechazadas} href="/asignaciones" />
          <TarjetaKpi etiqueta="Conductores sin señal" valor={kpis.conductoresSinSenal} href="/mapa" />
          <TarjetaKpi etiqueta="Traslados retrasados" valor={kpis.trasladosRetrasados} href="/viajes" />
          <TarjetaKpi etiqueta="SLA en riesgo" valor={kpis.slaEnRiesgo} href="/alertas-sla" />
          <TarjetaKpi etiqueta="SLA vencido" valor={kpis.slaVencido} href="/alertas-sla" />
          <TarjetaKpi etiqueta="Incidencias abiertas" valor={kpis.incidenciasAbiertas} href="/incidencias" />
          <TarjetaKpi etiqueta="Entregas próximas" valor={kpis.entregasProximas} href="/viajes?filtro=inician_60" />
          <TarjetaKpi etiqueta="Evidencias pendientes" valor={kpis.evidenciasPendientes} href="/viajes" />
        </section>
      ) : null}

      <section aria-label="Atención prioritaria">
        <h2>Atención prioritaria ({items.length})</h2>
        {items.length === 0 ? (
          <AdminEmptyState title="Sin focos rojos" description="Ningún traslado requiere intervención con estos filtros." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Prioridad</th>
                <th>Traslado</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th>Viaje</th>
                <th>Ciudad</th>
                <th>Horas</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.trasladoId}>
                  <td>{item.prioridad}</td>
                  <td><Link href={`/viajes/${item.trasladoId}`}>{item.trasladoId.slice(0, 8)}…</Link></td>
                  <td>{item.motivo}</td>
                  <td>{item.estado}</td>
                  <td>{estaViajando(item.estado as EstadoTraslado) ? "● en viaje" : "—"}</td>
                  <td>{item.ciudadOrigen ?? "—"}</td>
                  <td>{item.horasEnEstado}</td>
                  <td>
                    <Button onClick={() => abrirDetalle(item)} disabled={pendiente}>
                      Abrir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AdminDrawer
        open={Boolean(seleccionado)}
        title={seleccionado ? `Traslado ${seleccionado.trasladoId.slice(0, 8)}…` : "Detalle"}
        description={seleccionado?.motivo}
        onOpenChange={(open) => { if (!open) { setSeleccionado(null); setTimeline(null); } }}
        footer={seleccionado && (
          <>
            <Link href={`/viajes/${seleccionado.trasladoId}`}>Abrir viaje</Link>
            {" · "}
            {seleccionado.operacionId ? <Link href={`/operaciones/${seleccionado.operacionId}`}>Ver operación</Link> : null}
            {" · "}
            <Link href="/incidencias">Incidencias</Link>
            {" · "}
            <Button onClick={copiarId}>Copiar ID</Button>
          </>
        )}
      >
        {seleccionado && (
          <div>
            <dl>
              <dt>Estado legacy</dt><dd>{seleccionado.estado}</dd>
              <dt>Estado operativo</dt><dd>{seleccionado.operativo || "—"}</dd>
              <dt>Conductor</dt><dd>{seleccionado.conductorId ? `${seleccionado.conductorId.slice(0, 8)}…` : "sin asignar"}</dd>
              <dt>Operación</dt><dd>{seleccionado.operacionFolio ?? "—"}</dd>
            </dl>
            <h3>Timeline</h3>
            {timeline === null ? (
              <p>Cargando timeline…</p>
            ) : timeline.length === 0 ? (
              <p>Sin movimientos registrados.</p>
            ) : (
              <ul>
                {timeline.map((evento, indice) => (
                  <li key={`${evento.fecha}-${indice}`}>
                    <strong>{evento.titulo}</strong>
                    {evento.detalle ? ` — ${evento.detalle}` : null}
                    <br />
                    <small>{new Date(evento.fecha).toLocaleString("es-MX")} · {evento.tipo}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </AdminDrawer>
    </div>
  );
}
