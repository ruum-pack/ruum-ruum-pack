"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@ruum/ui";
import type { EstadoOperacion, Operacion, PrioridadOperativa, TipoOperacion } from "@ruum/shared/types";
import {
  createOperation,
  listOperations
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AdminPageHeader } from "../admin-ui";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "../admin-components";

const TIPOS: TipoOperacion[] = ["corporativa", "flota", "evento", "masiva", "interna"];
const PRIORIDADES: PrioridadOperativa[] = ["baja", "media", "alta", "critica"];
const ESTADOS: (EstadoOperacion | "todas")[] = ["todas", "borrador", "planificada", "en_curso", "pausada", "cerrada", "cancelada"];

export default function PaginaOperaciones() {
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const [filtroEstado, setFiltroEstado] = useState<EstadoOperacion | "todas">("todas");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [formNombre, setFormNombre] = useState("");
  const [formEmpresaId, setFormEmpresaId] = useState("");
  const [formTipo, setFormTipo] = useState<TipoOperacion>("corporativa");
  const [formPrioridad, setFormPrioridad] = useState<PrioridadOperativa>("media");

  const cargar = useCallback(async () => {
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const filas = await listOperations(cliente, { limite: 100 });
      setOperaciones(filas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las operaciones.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const filtradas = operaciones.filter((op) => {
    if (filtroEstado !== "todas" && op.estado !== filtroEstado) return false;
    if (busqueda.trim() !== "") {
      const q = busqueda.toLowerCase();
      if (!op.nombre.toLowerCase().includes(q) && !op.folio.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function crear() {
    if (formNombre.trim().length < 3) return;
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await createOperation(cliente, {
          nombre: formNombre.trim(),
          empresa_id: formEmpresaId.trim() === "" ? null : formEmpresaId.trim(),
          tipo: formTipo,
          prioridad: formPrioridad
        });
        setMensaje("Operación creada.");
        setMostrarCrear(false);
        setFormNombre("");
        setFormEmpresaId("");
        await cargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo crear la operación.");
      }
    });
  }

  if (cargando) return <AdminLoadingState label="Cargando operaciones…" />;
  if (error && operaciones.length === 0)
    return <AdminErrorState description={error} action={<Button onClick={() => void cargar()}>Reintentar</Button>} />;

  return (
    <div>
      <AdminPageHeader
        titulo="Operaciones"
        descripcion="Operación → N traslados. Los traslados históricos sin operación siguen funcionando igual."
        accion={
          <Button onClick={() => setMostrarCrear((v) => !v)} disabled={pendiente}>
            {mostrarCrear ? "Cerrar" : "Nueva operación"}
          </Button>
        }
      />

      {mensaje ? <p role="status">{mensaje}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {mostrarCrear ? (
        <section aria-label="Crear operación">
          <label>
            Nombre
            <input value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Operación XYZ — 20 vehículos" />
          </label>
          <label>
            Empresa (UUID, opcional)
            <input value={formEmpresaId} onChange={(e) => setFormEmpresaId(e.target.value)} placeholder="empresa_id o vacío" />
          </label>
          <label>
            Tipo
            <select value={formTipo} onChange={(e) => setFormTipo(e.target.value as TipoOperacion)}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Prioridad
            <select value={formPrioridad} onChange={(e) => setFormPrioridad(e.target.value as PrioridadOperativa)}>
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <Button onClick={crear} disabled={pendiente || formNombre.trim().length < 3}>
            {pendiente ? "Creando…" : "Crear"}
          </Button>
        </section>
      ) : null}

      <section aria-label="Filtros">
        <label>
          Estado
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as EstadoOperacion | "todas")}>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </label>
        <label>
          Buscar
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="folio o nombre" />
        </label>
      </section>

      {filtradas.length === 0 ? (
        <AdminEmptyState title="Sin operaciones" description="Crea la primera operación para agrupar traslados." />
      ) : (
        <table>
          <thead>
            <tr>
              <th>Folio</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((op) => (
              <tr key={op.id}>
                <td>{op.folio}</td>
                <td>{op.nombre}</td>
                <td>{op.tipo}</td>
                <td>{op.estado}</td>
                <td>{op.prioridad}</td>
                <td>
                  <Link href={`/operaciones/${op.id}`}>Ver</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
