"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@ruum/ui";
import type { Asignacion } from "@ruum/shared/types";
import { listarHistorialAsignaciones } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AdminPageHeader } from "../admin-ui";
import { AdminEmptyState, AdminErrorState } from "../admin-components";

function fechaCorta(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-MX");
}

function idCorto(id: string | null | undefined) {
  return id ? `${id.slice(0, 8)}…` : "—";
}

export default function PaginaAsignaciones() {
  const [trasladoId, setTrasladoId] = useState("");
  const [filas, setFilas] = useState<Asignacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function buscar() {
    if (trasladoId.trim() === "") return;
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      return;
    }
    startTransition(async () => {
      try {
        const historial = await listarHistorialAsignaciones(crearClienteNavegador(), trasladoId.trim());
        setFilas(historial);
      } catch (e) {
        setFilas(null);
        setError(e instanceof Error ? e.message : "No se pudo cargar el historial.");
      }
    });
  }

  const rechazos = (filas ?? []).filter((f) => f.estado === "rechazada");

  return (
    <div>
      <AdminPageHeader
        titulo="Asignaciones"
        descripcion="Quién fue asignado, cuándo, por qué, quién rechazó y quién reemplazó a quién."
      />

      {error ? <AdminErrorState description={error} action={<Button onClick={buscar}>Reintentar</Button>} /> : null}

      <section aria-label="Buscar traslado">
        <label>
          Traslado ID (UUID)
          <input value={trasladoId} onChange={(e) => setTrasladoId(e.target.value)} placeholder="uuid del traslado" />
        </label>
        <Button onClick={buscar} disabled={pendiente || trasladoId.trim() === ""}>
          {pendiente ? "Buscando…" : "Ver historial"}
        </Button>
      </section>

      {filas === null ? (
        <AdminEmptyState title="Sin búsqueda" description="Ingresa el UUID de un traslado para ver su cadena de asignación." />
      ) : filas.length === 0 ? (
        <AdminEmptyState title="Sin asignaciones" description="Este traslado aún no tiene movimientos de asignación." />
      ) : (
        <>
          <section aria-label="Resumen">
            <p>
              Vigente: {filas.find((f) => ["pendiente", "ofrecida", "aceptada", "activa"].includes(f.estado))?.conductor_id.slice(0, 8) ?? "ninguno"}
              {" · "}Rechazos: {rechazos.length}
            </p>
          </section>
          <section aria-label="Historial de asignación">
            <table>
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Quién (conductor)</th>
                  <th>Estado</th>
                  <th>Por qué (motivo)</th>
                  <th>Origen</th>
                  <th>Puntaje</th>
                  <th>Reemplaza a</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td>{fechaCorta(f.creado_en)}</td>
                    <td>{idCorto(f.conductor_id)}</td>
                    <td>{f.estado}</td>
                    <td>{f.motivo ?? "—"}</td>
                    <td>{f.origen}{f.origen === "competencia" ? " CONCER" : ""}</td>
                    <td>{f.puntaje ?? "—"}</td>
                    <td>{idCorto((f.metadata?.["reemplaza_a"] as string | undefined) ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p>
            <Link href={trasladoId.trim() !== "" ? `/viajes/${trasladoId.trim()}` : "/viajes"}>Ver traslado</Link>
          </p>
        </>
      )}
    </div>
  );
}
