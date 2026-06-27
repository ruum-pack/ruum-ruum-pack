"use client";

import { useEffect, useState } from "react";
import { Aviso, Button } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { listarConductoresAdmin, cambiarEstadoConductorAdmin } from "@ruum/api/services";
import { CONDUCTORES_DEMO } from "../../lib/datos-demo";

type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];

const ETIQUETA_ESTADO: Record<ConductorRow["estado"], string> = {
  activo: "Activo",
  suspendido_7d: "Suspendido (7 días)",
  suspendido_14d: "Suspendido (14 días)",
  suspendido_30d: "Suspendido (30 días)",
  suspendido_indefinido: "Suspendido indefinido",
  bloqueado_permanente: "Bloqueado permanente",
  modo_prueba_supervisada: "Modo de prueba supervisada",
  pendiente_verificacion: "Pendiente de validación"
};

export default function PaginaConductoresAdmin() {
  const [conductores, setConductores] = useState<ConductorRow[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  async function cargar() {
    if (!tieneSupabaseConfigurado()) {
      setConductores(CONDUCTORES_DEMO);
      setEsDemo(true);
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      setConductores(await listarConductoresAdmin(cliente));
      setEsDemo(false);
    } catch {
      setConductores(CONDUCTORES_DEMO);
      setEsDemo(true);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  // PRD §17.6 — "suspender/reactivar". Suspensión administrativa directa es
  // indefinida (no la escalada progresiva de no_presentaciones_6m, que es
  // automática — ver rules/no-presentacion.ts); Admin puede usarla para
  // cualquier motivo operativo que no encaje en esa escalada.
  async function alternarSuspension(c: ConductorRow) {
    setProcesando(c.id);
    const nuevoEstado = c.estado === "activo" ? "suspendido_indefinido" : "activo";

    if (esDemo) {
      await new Promise((r) => setTimeout(r, 300));
      setConductores((prev) => prev.map((x) => (x.id === c.id ? { ...x, estado: nuevoEstado } : x)));
      setProcesando(null);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      await cambiarEstadoConductorAdmin(cliente, c.id, nuevoEstado);
      await cargar();
    } finally {
      setProcesando(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="font-display text-2xl font-semibold">Conductores</h1>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no conductores reales.</Aviso>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-card border border-ink/10 bg-paper">
        <table className="w-full font-body text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/45">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Nivel</th>
              <th className="px-4 py-3">Calificación</th>
              <th className="px-4 py-3">Traslados</th>
              <th className="px-4 py-3">Documentos</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-ink/50">
                  Cargando…
                </td>
              </tr>
            ) : (
              conductores.map((c) => (
                <tr key={c.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 font-medium">{c.nombre}</td>
                  <td className="px-4 py-3 capitalize">{c.nivel_operativo_vigente}</td>
                  <td className="px-4 py-3 font-mono-ruum">{c.calificacion_promedio || "—"}</td>
                  <td className="px-4 py-3 font-mono-ruum">{c.traslados_completados}</td>
                  <td className="px-4 py-3">
                    {c.documentos_vigentes ? (
                      <span className="text-ok">Vigentes</span>
                    ) : (
                      <span className="text-danger">Vencidos</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{ETIQUETA_ESTADO[c.estado]}</td>
                  <td className="px-4 py-3 text-right">
                    {(c.estado === "activo" || c.estado === "suspendido_indefinido") && (
                      <Button variant="secundario" onClick={() => alternarSuspension(c)} disabled={procesando === c.id}>
                        {c.estado === "activo" ? "Suspender" : "Reactivar"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
