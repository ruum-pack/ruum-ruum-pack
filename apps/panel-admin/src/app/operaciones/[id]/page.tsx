"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@ruum/ui";
import type { EstadoOperacion, EstadoTraslado, Operacion, ResumenOperacional } from "@ruum/shared/types";
import {
  addTransferToOperation,
  getOperation,
  listarTrasladosDeOperacion,
  obtenerResumenOperacional,
  removeTransferFromOperation,
  updateOperation,
  type TrasladoDeOperacion
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { AdminPageHeader } from "../../admin-ui";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "../../admin-components";
import { TRANSICIONES_OPERACION } from "@ruum/shared/types";
import { estaViajando } from "@ruum/shared/states";

export default function PaginaDetalleOperacion() {
  const { id } = useParams<{ id: string }>();
  const [operacion, setOperacion] = useState<Operacion | null>(null);
  const [resumen, setResumen] = useState<ResumenOperacional | null>(null);
  const [traslados, setTraslados] = useState<TrasladoDeOperacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [trasladoId, setTrasladoId] = useState("");
  const [nuevoEstado, setNuevoEstado] = useState<EstadoOperacion>("planificada");

  const cargar = useCallback(async () => {
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const [op, res, trs] = await Promise.all([
        getOperation(cliente, id),
        obtenerResumenOperacional(cliente, id),
        listarTrasladosDeOperacion(cliente, id)
      ]);
      if (!op) throw new Error("Operación no encontrada.");
      setOperacion(op);
      setResumen(res);
      setTraslados(trs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la operación.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  function agregarTraslado() {
    if (trasladoId.trim() === "") return;
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await addTransferToOperation(cliente, trasladoId.trim(), id);
        setMensaje("Traslado agregado a la operación.");
        setTrasladoId("");
        await cargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo agregar el traslado.");
      }
    });
  }

  function quitarTraslado(traslado: string) {
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await removeTransferFromOperation(cliente, traslado);
        setMensaje("Traslado desvinculado (sigue existiendo como histórico).");
        await cargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo desvincular.");
      }
    });
  }

  function cambiarEstado() {
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await updateOperation(cliente, id, { estado: nuevoEstado });
        setMensaje(`Estado cambiado a ${nuevoEstado}.`);
        await cargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cambiar el estado.");
      }
    });
  }

  if (cargando) return <AdminLoadingState label="Cargando operación…" />;
  if (error && !operacion)
    return <AdminErrorState description={error} action={<Button onClick={() => void cargar()}>Reintentar</Button>} />;
  if (!operacion) return <AdminEmptyState title="Sin operación" description="La operación no existe." />;

  const transiciones = TRANSICIONES_OPERACION[operacion.estado] ?? [];
  const conIncidencia = traslados.filter((t) => t.tiene_incidencia_abierta);

  return (
    <div>
      <AdminPageHeader
        titulo={`${operacion.folio} — ${operacion.nombre}`}
        descripcion={`Tipo ${operacion.tipo} · Estado ${operacion.estado} · Prioridad ${operacion.prioridad}`}
        accion={<Link href="/operaciones">Volver</Link>}
      />
      <p>
        <Link href={`/operaciones/${id}/finanzas`}>Ver finanzas</Link>
      </p>

      {mensaje ? <p role="status">{mensaje}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {resumen ? (
        <section aria-label="Progreso">
          <p>Total traslados: {resumen.total_traslados}</p>
          <p>Con conductor: {resumen.con_conductor} · Sin conductor: {resumen.sin_conductor}</p>
          <p>Con incidencia abierta: {resumen.con_incidencia_abierta}</p>
          <p>Avance: {resumen.avance_pct}%</p>
          <progress value={resumen.avance_pct} max={100} aria-label="Avance de la operación" />
          <ul>
            {Object.entries(resumen.por_estado).map(([estado, n]) => (
              <li key={estado}>{estado}: {n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Cambiar estado">
        <label>
          Nuevo estado
          <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value as EstadoOperacion)}>
            {transiciones.length === 0 ? <option value={operacion.estado}>sin transiciones</option> : null}
            {transiciones.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </label>
        <Button onClick={cambiarEstado} disabled={pendiente || transiciones.length === 0}>
          Cambiar estado
        </Button>
      </section>

      <section aria-label="Agregar traslado">
        <label>
          Traslado ID (UUID)
          <input value={trasladoId} onChange={(e) => setTrasladoId(e.target.value)} placeholder="uuid del traslado" />
        </label>
        <Button onClick={agregarTraslado} disabled={pendiente || trasladoId.trim() === ""}>
          Agregar a la operación
        </Button>
      </section>

      <section aria-label="Traslados asociados">
        <h2>Traslados asociados ({traslados.length})</h2>
        {traslados.length === 0 ? (
          <p>Sin traslados. Agrega por UUID o crea traslados y vincúlalos.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Traslado</th>
                <th>Estado</th>
                <th>Viaje</th>
                <th>Conductor</th>
                <th>Incidencia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {traslados.map((t) => (
                <tr key={t.id}>
                  <td><Link href={`/viajes/${t.id}`}>{t.id.slice(0, 8)}…</Link></td>
                  <td>{t.estado}</td>
                  <td>{estaViajando(t.estado as EstadoTraslado) ? "● en viaje" : "—"}</td>
                  <td>{t.conductor_id ? t.conductor_id.slice(0, 8) + "…" : "sin asignar"}</td>
                  <td>{t.tiene_incidencia_abierta ? "abierta" : "—"}</td>
                  <td>
                    <Button onClick={() => quitarTraslado(t.id)} disabled={pendiente}>
                      Desvincular
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Incidencias">
        <h2>Incidencias ({conIncidencia.length})</h2>
        {conIncidencia.length === 0 ? (
          <p>Sin incidencias abiertas en esta operación.</p>
        ) : (
          <ul>
            {conIncidencia.map((t) => (
              <li key={t.id}>
                <Link href={`/viajes/${t.id}`}>{t.id}</Link> — {t.estado}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
