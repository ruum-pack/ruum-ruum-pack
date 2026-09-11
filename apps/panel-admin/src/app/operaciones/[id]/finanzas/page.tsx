"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@ruum/ui";
import { getOperation } from "@ruum/api/services";
import { obtenerFinanzasOperacion, type FinanzasOperacion } from "@ruum/api/billing";
import type { Operacion } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../../lib/supabase-browser";
import { AdminPageHeader } from "../../../admin-ui";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "../../../admin-components";

function formatoMxn(n: number): string {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
}

export default function PaginaFinanzasOperacion() {
  const { id } = useParams<{ id: string }>();
  const [operacion, setOperacion] = useState<Operacion | null>(null);
  const [finanzas, setFinanzas] = useState<FinanzasOperacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado en este entorno.");
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const [op, fin] = await Promise.all([getOperation(cliente, id), obtenerFinanzasOperacion(cliente, id)]);
      if (!op) throw new Error("Operación no encontrada.");
      setOperacion(op);
      setFinanzas(fin);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las finanzas.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  if (cargando) return <AdminLoadingState label="Cargando finanzas…" />;
  if (error && !finanzas)
    return <AdminErrorState description={error} action={<Button onClick={() => void cargar()}>Reintentar</Button>} />;
  if (!operacion || !finanzas)
    return <AdminEmptyState title="Sin finanzas" description="La operación no existe o no tiene datos." />;

  const margenPct =
    finanzas.facturado > 0 ? Math.round((finanzas.margen_contribucion / finanzas.facturado) * 1000) / 10 : 0;

  return (
    <div>
      <AdminPageHeader
        titulo={`Finanzas — ${operacion.folio}`}
        descripcion={`${operacion.nombre} · ${finanzas.traslados} traslados`}
        accion={<Link href={`/operaciones/${id}`}>Volver a la operación</Link>}
      />

      {error ? <p role="alert">{error}</p> : null}

      <section aria-label="Agregados">
        <p>Facturado: {formatoMxn(finanzas.facturado)}</p>
        <p>Costo conductor: {formatoMxn(finanzas.costo_conductor)}</p>
        <p>Gastos directos: {formatoMxn(finanzas.gastos_directos)}</p>
        <p>Comisiones: {formatoMxn(finanzas.comisiones)}</p>
        <p>
          Margen de contribución: {formatoMxn(finanzas.margen_contribucion)} ({margenPct}%)
        </p>
      </section>

      <section aria-label="Traslados sin pago">
        <h2>Sin pago ({finanzas.traslados_sin_pago.length})</h2>
        {finanzas.traslados_sin_pago.length === 0 ? (
          <p>Todos los traslados cerrados tienen pago registrado.</p>
        ) : (
          <ul>
            {finanzas.traslados_sin_pago.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
