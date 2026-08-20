"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";
import { SecondaryTripNavBar } from "./SecondaryTripNavBar";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export function LocalizarVehiculoDetails({
  pasaporte,
  volver
}: {
  pasaporte: PasaporteRow;
  volver: string;
}) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trasladoId = pasaporte.traslado_id!;
  const estadoActual = (pasaporte.estado || "conductor_en_punto_de_recoleccion") as EstadoTraslado;

  const placas = pasaporte.vehiculo_placas || "POR CONFIRMAR";
  const vin = pasaporte.vehiculo_vin || "POR CONFIRMAR";
  const contactoNombre = pasaporte.contacto_entrega_nombre || "Contacto Origen";
  const contactoTelefono = pasaporte.contacto_entrega_telefono || "0000000000";

  const esEvidenciaCompletada =
    estadoActual === "evidencia_inicial_completada" || estadoActual === "vehiculo_recibido";

  async function handleAccionPrincipal() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();

      if (estadoActual === "conductor_en_punto_de_recoleccion") {
        const siguiente = (await avanzarEstadoTraslado(cliente, trasladoId, "conductor_en_punto_de_recoleccion")) as EstadoTraslado;
        await new Promise((resolve) => setTimeout(resolve, 300));
        await avanzarEstadoTraslado(cliente, trasladoId, siguiente);
        router.push(`/viajes/${trasladoId}/evidencia`);
        return;
      }

      if (estadoActual === "verificacion_vehiculo_en_proceso") {
        await avanzarEstadoTraslado(cliente, trasladoId, "verificacion_vehiculo_en_proceso");
        router.push(`/viajes/${trasladoId}/evidencia`);
        return;
      }

      if (estadoActual === "evidencia_inicial_en_proceso") {
        router.push(`/viajes/${trasladoId}/evidencia`);
        return;
      }

      if (estadoActual === "evidencia_inicial_completada") {
        await avanzarEstadoTraslado(cliente, trasladoId, "evidencia_inicial_completada");
        await new Promise((resolve) => setTimeout(resolve, 300));
        await avanzarEstadoTraslado(cliente, trasladoId, "vehiculo_recibido");
        router.refresh();
        return;
      }

      if (estadoActual === "vehiculo_recibido") {
        await avanzarEstadoTraslado(cliente, trasladoId, "vehiculo_recibido");
        router.refresh();
        return;
      }

      router.push(`/viajes/${trasladoId}/evidencia`);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos avanzar el traslado. Intenta de nuevo."));
      setProcesando(false);
    }
  }

  const getTituloAccion = () => {
    if (esEvidenciaCompletada) return "Inicia el trayecto";
    if (estadoActual === "evidencia_inicial_en_proceso") return "Continúa la inspección";
    return "Recibe el vehículo";
  };

  const getSubtituloAccion = () => {
    if (esEvidenciaCompletada) return "El registro inicial está completo. Conduce de manera segura hacia el destino.";
    if (estadoActual === "evidencia_inicial_en_proceso") return "Completa las fotos y checklist pendientes del vehículo.";
    return "Localiza la unidad e inicia la inspección física.";
  };

  const getBotonLabel = () => {
    if (esEvidenciaCompletada) return "INICIAR TRAYECTO AL DESTINO →";
    if (estadoActual === "evidencia_inicial_en_proceso") return "CONTINUAR INSPECCIÓN";
    return "INICIAR INSPECCIÓN";
  };

  return (
    <div className="mx-auto w-full max-w-md bg-surface min-h-[calc(100vh-100px)] flex flex-col text-text-primary pb-6 px-4">
      {/* HEADER */}
      <header className="flex items-center justify-between py-4 border-b border-border/15">
        <Link
          href={volver}
          className="p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors rounded-full hover:bg-surface-elevated"
          aria-label="Volver a la lista de viajes"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Link>
        <span className="font-display text-xs font-black uppercase tracking-widest text-text-primary">
          TRASLADO ACTIVO
        </span>
        <div className="w-10" />
      </header>

      {/* ESTADO ACTUAL */}
      <div className="mt-5 bg-surface-elevated border border-border/20 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-text-tertiary font-bold tracking-widest uppercase mb-0.5">ESTADO ACTUAL</span>
          <div className="flex items-center gap-1.5">
            <span className="font-display text-lg font-black uppercase tracking-wide">
              {esEvidenciaCompletada ? "RECEPCIÓN LISTA" : "EN EL ORIGEN"}
            </span>
            <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse mt-0.5" />
          </div>
        </div>
      </div>

      {/* TU PRÓXIMA ACCIÓN */}
      <div className="mt-6 flex flex-col">
        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">TU PRÓXIMA ACCIÓN</span>
        <h2 className="font-display text-2xl font-black leading-tight mt-1">
          {getTituloAccion()}
        </h2>
        <span className="font-body text-sm text-text-secondary mt-1 leading-relaxed">
          {getSubtituloAccion()}
        </span>
      </div>

      {/* ORIGEN CONTACTO */}
      <div className="mt-6 bg-surface-elevated rounded-3xl border border-border/20 p-5 shadow-lg relative">
        <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-3 block">
          CONTACTO DE RECOLECCIÓN
        </span>

        <div className="flex items-center justify-between bg-surface rounded-xl p-3 border border-border/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-route-action/10 text-route-action flex items-center justify-center font-bold text-lg">
              {contactoNombre.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-text-primary">{contactoNombre}</span>
              <span className="text-xs text-text-secondary">{contactoTelefono}</span>
            </div>
          </div>
          <a
            href={`tel:${contactoTelefono.replace(/\s+/g, "")}`}
            className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 active:scale-95 transition-transform"
            aria-label={`Llamar a ${contactoNombre}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </a>
        </div>

        {/* VEHÍCULO A BUSCAR */}
        <div className="mt-5 flex flex-col gap-2">
          <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">
            VEHÍCULO A LOCALIZAR
          </span>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-surface border border-border/20 rounded-xl p-3 flex flex-col">
              <span className="text-[9px] text-text-tertiary uppercase font-bold">PLACAS</span>
              <span className="font-display font-black text-lg mt-0.5 text-text-primary">{placas}</span>
            </div>
            <div className="flex-1 bg-surface border border-border/20 rounded-xl p-3 flex flex-col">
              <span className="text-[9px] text-text-tertiary uppercase font-bold">VIN</span>
              <span className="font-display font-black text-sm mt-1 uppercase truncate text-text-primary">{vin}</span>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleAccionPrincipal}
            disabled={procesando}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 font-display text-xs font-black tracking-widest uppercase shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
              esEvidenciaCompletada
                ? "bg-signal hover:bg-signal/85 text-slate-950"
                : "bg-purple-600 hover:bg-purple-500 text-white"
            }`}
          >
            {procesando ? (
              TEXTOS_CARGANDO.actualizando
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M9 15L11 17L15 13" />
                </svg>
                {getBotonLabel()}
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Aviso tono="danger">{error}</Aviso>
        </div>
      )}

      {/* Secondary Bottom Navigation Bar */}
      <div className="mt-auto pt-4 -mx-4 -mb-6">
        <SecondaryTripNavBar trasladoId={trasladoId} pasaporte={pasaporte} />
      </div>
    </div>
  );
}
