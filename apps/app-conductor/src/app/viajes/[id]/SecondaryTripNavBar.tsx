"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ReportarIncidencia } from "./ReportarIncidencia";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import type { Database } from "@ruum/shared/types";
import { Aviso } from "@ruum/ui";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type GastoTipo = "gasolina" | "casetas" | "lavado" | "estacionamiento" | "otros";

interface GastoRegistro {
  id: string;
  tipo: GastoTipo;
  monto: number;
  notas: string | null;
  comprobante_url: string | null;
  created_at: string;
}

export function SecondaryTripNavBar({
  trasladoId,
  pasaporte
}: {
  trasladoId: string;
  pasaporte: PasaporteRow;
}) {
  const [tabActiva, setTabActiva] = useState<"detalles" | "detalles_modal" | "gastos" | "incidencia">("detalles");
  
  // States for Gastos Modal
  const [tipoGasto, setTipoGasto] = useState<GastoTipo>("gasolina");
  const [monto, setMonto] = useState<string>("");
  const [notas, setNotas] = useState<string>("");
  const [gastosList, setGastosList] = useState<GastoRegistro[]>([]);
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [errorGasto, setErrorGasto] = useState<string | null>(null);
  const [exitoGasto, setExitoGasto] = useState<string | null>(null);

  // Fetch registered expenses on load
  useEffect(() => {
    async function cargarGastos() {
      try {
        const cliente = crearClienteNavegador();
        const { data } = await (cliente as any)
          .from("gastos_traslado")
          .select("*")
          .eq("traslado_id", trasladoId)
          .order("created_at", { ascending: false });

        if (data) {
          setGastosList(
            (data as any[]).map((g) => ({
              id: String(g.id),
              tipo: g.tipo as GastoTipo,
              monto: Number(g.monto || 0),
              notas: g.notas || g.descripcion || null,
              comprobante_url: g.comprobante_url || null,
              created_at: g.created_at || g.registrado_en || new Date().toISOString()
            }))
          );
        }
      } catch {
        // Fallback smooth
      }
    }
    if (trasladoId) {
      cargarGastos();
    }
  }, [trasladoId]);

  async function handleAgregarGasto(e: React.FormEvent) {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      setErrorGasto("Ingresa un monto válido mayor a $0.00");
      return;
    }

    setGuardandoGasto(true);
    setErrorGasto(null);
    setExitoGasto(null);

    try {
      const cliente = crearClienteNavegador();
      const { data, error: err } = await (cliente as any)
        .from("gastos_traslado")
        .insert({
          traslado_id: trasladoId,
          tipo: tipoGasto,
          monto: montoNum,
          notas: notas.trim() || null
        })
        .select("*")
        .single();

      if (err) throw err;

      if (data) {
        const nuevoGasto: GastoRegistro = {
          id: String(data.id),
          tipo: data.tipo as GastoTipo,
          monto: Number(data.monto || montoNum),
          notas: data.notas || data.descripcion || notas.trim() || null,
          comprobante_url: data.comprobante_url || null,
          created_at: data.created_at || new Date().toISOString()
        };
        setGastosList((prev) => [nuevoGasto, ...prev]);
        setMonto("");
        setNotas("");
        setExitoGasto("Gasto registrado correctamente.");
      }
    } catch {
      setErrorGasto("No se pudo registrar el gasto. Intenta nuevamente.");
    } finally {
      setGuardandoGasto(false);
    }
  }

  const totalGastos = gastosList.reduce((sum, g) => sum + (g.monto || 0), 0);

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Modal / Overlay: GASTOS DEL TRASLADO */}
      {/* ------------------------------------------------------------------ */}
      {tabActiva === "gastos" && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg mx-auto bg-surface-elevated border-t border-border/20 rounded-t-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto flex flex-col gap-4 text-left select-none animate-slideUp">
            
            {/* Header del Modal Gastos */}
            <div className="flex items-center justify-between border-b border-border/15 pb-3">
              <div className="flex items-center gap-2 text-route-action">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="font-display text-base font-black text-text-primary uppercase tracking-wider">
                  Gastos del Traslado
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTabActiva("detalles")}
                className="p-1.5 text-text-tertiary hover:text-text-primary rounded-full hover:bg-surface cursor-pointer"
                aria-label="Cerrar gastos"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Formulario para agregar gasto */}
            <form onSubmit={handleAgregarGasto} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="tipo-gasto" className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                    Tipo de gasto
                  </label>
                  <select
                    id="tipo-gasto"
                    value={tipoGasto}
                    onChange={(e) => setTipoGasto(e.target.value as GastoTipo)}
                    className="bg-surface border border-border/30 rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-route-action"
                  >
                    <option value="gasolina">⛽ Gasolina</option>
                    <option value="casetas">🛣️ Casetas / Peaje</option>
                    <option value="estacionamiento">🅿️ Estacionamiento</option>
                    <option value="lavado">🧼 Lavado</option>
                    <option value="otros">📝 Otros</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="monto-gasto" className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                    Monto (MXN)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-text-tertiary">$</span>
                    <input
                      id="monto-gasto"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      className="w-full bg-surface border border-border/30 rounded-xl pl-7 pr-3 py-2.5 text-xs font-mono font-bold text-text-primary focus:outline-none focus:border-route-action"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="notas-gasto" className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                  Notas / Especificaciones (opcional)
                </label>
                <input
                  id="notas-gasto"
                  type="text"
                  placeholder="Ej. Casetas autopista México-Toluca"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="bg-surface border border-border/30 rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-route-action"
                />
              </div>

              {errorGasto && <Aviso tono="danger">{errorGasto}</Aviso>}
              {exitoGasto && <Aviso tono="info">{exitoGasto}</Aviso>}

              <button
                type="submit"
                disabled={guardandoGasto}
                className="w-full py-3 rounded-xl bg-signal hover:bg-signal/85 text-slate-950 font-display text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md disabled:opacity-50 mt-1"
              >
                {guardandoGasto ? "Registrando..." : "+ Registrar Gasto"}
              </button>
            </form>

            {/* Listado de Gastos Registrados */}
            <div className="flex flex-col gap-2 border-t border-border/15 pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-display font-bold text-text-tertiary uppercase tracking-wider text-[10px]">
                  Gastos Registrados ({gastosList.length})
                </span>
                <span className="font-display font-black text-signal text-sm tabular-nums">
                  Total: ${totalGastos.toFixed(2)} MXN
                </span>
              </div>

              {gastosList.length === 0 ? (
                <p className="text-xs text-text-tertiary italic text-center py-4">
                  No has registrado gastos en este traslado aún.
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {gastosList.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between bg-surface border border-border/20 rounded-xl p-2.5 text-xs"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-text-primary capitalize">
                          {g.tipo === "gasolina" ? "⛽ Gasolina" : g.tipo === "casetas" ? "🛣️ Casetas" : g.tipo === "estacionamiento" ? "🅿️ Estacionamiento" : g.tipo === "lavado" ? "🧼 Lavado" : "📝 Otros"}
                        </span>
                        {g.notas && (
                          <span className="text-[10px] text-text-tertiary mt-0.5">{g.notas}</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-text-primary">
                        ${g.monto.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setTabActiva("detalles")}
              className="w-full py-2.5 rounded-xl bg-surface hover:bg-surface-elevated text-text-secondary font-display text-xs font-bold uppercase tracking-wider transition-all cursor-pointer mt-2 border border-border/20"
            >
              Volver a Detalles del Traslado
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal / Overlay: REPORTAR INCIDENCIA */}
      {/* ------------------------------------------------------------------ */}
      {tabActiva === "incidencia" && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg mx-auto bg-surface-elevated border-t border-border/20 rounded-t-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col gap-4 text-left select-none animate-slideUp">
            
            {/* Header del Modal Incidencia */}
            <div className="flex items-center justify-between border-b border-border/15 pb-3">
              <div className="flex items-center gap-2 text-warning">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="font-display text-base font-black text-text-primary uppercase tracking-wider">
                  Reportar Incidencia
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTabActiva("detalles")}
                className="p-1.5 text-text-tertiary hover:text-text-primary rounded-full hover:bg-surface cursor-pointer"
                aria-label="Cerrar incidencia"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Componente de reporte de Incidencia */}
            <ReportarIncidencia trasladoId={trasladoId} />

            <button
              type="button"
              onClick={() => setTabActiva("detalles")}
              className="w-full py-2.5 rounded-xl bg-surface hover:bg-surface-elevated text-text-secondary font-display text-xs font-bold uppercase tracking-wider transition-all cursor-pointer mt-2 border border-border/20"
            >
              Volver a Detalles del Traslado
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* BARRA DE NAVEGACIÓN SECUNDARIA INFERIOR (Fija en el fondo) */}
      {/* ------------------------------------------------------------------ */}
      <nav aria-label="Navegación secundaria del traslado" className="fixed bottom-0 inset-x-0 z-50 bg-surface/95 border-t border-border/20 backdrop-blur-lg px-3 py-2 select-none shadow-lg">
        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
          
          {/* Pestaña 1: Detalles del traslado */}
          <Link
            href={`/viajes/${trasladoId}/detalles`}
            className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-xl transition-all duration-200 cursor-pointer text-text-secondary hover:text-text-primary hover:bg-surface-elevated/60"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-display text-[10px] uppercase tracking-wider truncate max-w-full">
              Detalles
            </span>
          </Link>

          {/* Pestaña 2: Gastos */}
          <button
            type="button"
            onClick={() => setTabActiva("gastos")}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-xl transition-all duration-200 cursor-pointer ${
              tabActiva === "gastos"
                ? "bg-route-action/15 text-route-action border border-route-action/30 font-extrabold shadow-xs"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated/60"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-display text-[10px] uppercase tracking-wider truncate max-w-full">
              Gastos {gastosList.length > 0 && `(${gastosList.length})`}
            </span>
          </button>

          {/* Pestaña 3: Incidencia */}
          <button
            type="button"
            onClick={() => setTabActiva("incidencia")}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-xl transition-all duration-200 cursor-pointer ${
              tabActiva === "incidencia"
                ? "bg-warning/15 text-warning border border-warning/30 font-extrabold shadow-xs"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated/60"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-display text-[10px] uppercase tracking-wider truncate max-w-full">
              Incidencia
            </span>
          </button>

        </div>
      </nav>
    </>
  );
}
