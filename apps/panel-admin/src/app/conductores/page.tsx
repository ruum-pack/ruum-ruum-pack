"use client";

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ETIQUETA_NIVEL_CONCER } from "@ruum/shared/constants";
import { Aviso, Button } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import {
  listarConductoresAdmin,
  cambiarEstadoConductorAdmin,
  registrarNoPresentacionConductor,
  registrarCancelacionConductor
} from "@ruum/api/services";
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
  const [aviso, setAviso] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

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
      if (puedeUsarDatosDemo()) {
        setConductores(CONDUCTORES_DEMO);
        setEsDemo(true);
      } else {
        setConductores([]);
        setEsDemo(false);
      }
    } finally {
      setCargando(false);
    }
  }

useEffect(() => {
  const timer = setTimeout(() => { void cargar(); }, 0);
  return () => clearTimeout(timer);
}, []);


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

  async function aplicarNoPresentacion(c: ConductorRow) {
    setProcesando(c.id);
    setAviso(null);
    if (esDemo) {
      await new Promise((r) => setTimeout(r, 300));
      setAviso("No presentación registrada en modo demo.");
      setProcesando(null);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const resultado = await registrarNoPresentacionConductor(cliente, c.id);
      setAviso(resultado.mensaje);
      await cargar();
    } finally {
      setProcesando(null);
    }
  }

  async function aplicarCancelacion(c: ConductorRow, conJustificacion: boolean) {
    setProcesando(c.id);
    setAviso(null);
    if (esDemo) {
      await new Promise((r) => setTimeout(r, 300));
      setAviso(conJustificacion ? "Cancelación justificada registrada en modo demo." : "Cancelación sin justificación registrada en modo demo.");
      setProcesando(null);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const resultado = await registrarCancelacionConductor(cliente, c.id, conJustificacion);
      setAviso(resultado?.mensaje ?? "Cancelación justificada registrada sin consecuencia.");
      await cargar();
    } finally {
      setProcesando(null);
    }
  }

  const conductoresFiltrados = busqueda.trim()
    ? conductores.filter((c) =>
        c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())
      )
    : conductores;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 sm:px-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold">Conductores</h1>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no conductores reales.</Aviso>
        </div>
      )}
      {aviso && (
        <div className="mt-4" role="status" aria-live="polite" aria-atomic="true">
          <Aviso tono="info">{aviso}</Aviso>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <label className="sr-only" htmlFor="buscar-conductores">Buscar conductores</label>
        <input
          id="buscar-conductores"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          className="flex-1 rounded-lg border border-ink/20 bg-mist px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/40 focus:border-route-dark focus:outline-none focus:ring-2 focus:ring-route-dark/20"
        />
        {busqueda && (
          <button onClick={() => setBusqueda("")} className="font-body text-sm text-ink/50 hover:text-ink" aria-label="Limpiar búsqueda">
            Limpiar
          </button>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-card border border-ink/10 bg-mist">
        <table className="w-full font-body text-sm">
        <caption className="sr-only">Lista de conductores certificados</caption>
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
            ) : conductoresFiltrados.length === 0 ? (
              <tr>
               <td colSpan={7} className="px-4 py-6 text-center text-ink/50">
               Sin resultados para &quot;{busqueda}&quot;.
              </td>
              </tr>
            ) : (
              conductoresFiltrados.map((c) => (
                <tr key={c.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/conductores/${c.id}`} className="text-route-dark underline-offset-2 hover:underline">
                      {c.nombre}
                    </Link>
                    {c.estado === "pendiente_verificacion" && (
                      <span className="ml-2 rounded-full border border-warn/35 bg-warn-soft px-2 py-0.5 font-body text-[10px] font-medium text-warn">
                        Pendiente de revisión
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{ETIQUETA_NIVEL_CONCER[c.nivel_operativo_vigente]}</td>
                  <td className="px-4 py-3 font-mono-ruum">{c.calificacion_promedio || "—"}</td>
                  <td className="px-4 py-3 font-mono-ruum">{c.traslados_completados}</td>
                  <td className="px-4 py-3">
                    {c.documentos_vigentes ? (
                      <span className="text-control">Vigentes</span>
                    ) : (
                      <span className="text-danger">Vencidos</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{ETIQUETA_ESTADO[c.estado]}</td>
                  <td className="px-4 py-3">
                    {(c.estado === "activo" || c.estado === "suspendido_indefinido") && (
                      <Button variant="secundario" onClick={() => alternarSuspension(c)} disabled={procesando === c.id}>
                        {c.estado === "activo" ? "Suspender" : "Reactivar"}
                      </Button>
                    )}
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <Button variant="fantasma" onClick={() => aplicarNoPresentacion(c)} disabled={procesando === c.id}>
                        No presentación
                      </Button>
                      <Button variant="fantasma" onClick={() => aplicarCancelacion(c, false)} disabled={procesando === c.id}>
                        Canceló sin justificación
                      </Button>
                      <Button variant="fantasma" onClick={() => aplicarCancelacion(c, true)} disabled={procesando === c.id}>
                        Canceló justificado
                      </Button>
                    </div>
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
