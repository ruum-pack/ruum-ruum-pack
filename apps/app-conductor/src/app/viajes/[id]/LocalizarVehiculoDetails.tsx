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
import { EmergencyPanel } from "./EmergencyPanel";

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
  const marca = pasaporte.vehiculo_marca || (pasaporte.vehiculo_modelo ? pasaporte.vehiculo_modelo.split(" ")[0] : "No especificada");
  const modelo = pasaporte.vehiculo_modelo || "No especificado";
  const anio = pasaporte.vehiculo_anio ? String(pasaporte.vehiculo_anio) : "No especificado";
  const color = pasaporte.vehiculo_color || "No especificado";

  const contactoNombre = pasaporte.contacto_entrega_nombre || "Contacto en origen";
  const contactoTelefono = pasaporte.contacto_entrega_telefono || "";
  const telefonoLimpio = contactoTelefono.replace(/[^0-9]/g, "");

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
    if (esEvidenciaCompletada) return "El registro inicial está completo con evidencia. Conduce de manera segura hacia el destino.";
    if (estadoActual === "evidencia_inicial_en_proceso") return "Completa las fotos y checklist requeridos para la trazabilidad del vehículo.";
    return "Localiza la unidad e inicia la inspección física y fotográfica.";
  };

  const getBotonLabel = () => {
    if (esEvidenciaCompletada) return "INICIAR TRAYECTO AL DESTINO →";
    if (estadoActual === "evidencia_inicial_en_proceso") return "CONTINUAR INSPECCIÓN";
    return "INICIAR INSPECCIÓN Y EVIDENCIA";
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
        <div className="w-12 h-12 rounded-full bg-signal/15 border border-signal/30 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-signal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            <span className="font-display text-lg font-black uppercase tracking-wide text-text-primary">
              {esEvidenciaCompletada ? "RECEPCIÓN LISTA" : "EN EL ORIGEN"}
            </span>
            <span className="h-2 w-2 rounded-full bg-signal animate-pulse mt-0.5" />
          </div>
        </div>
      </div>

      {/* TU PRÓXIMA ACCIÓN */}
      <div className="mt-6 flex flex-col">
        <span className="text-[10px] font-bold text-route-action uppercase tracking-widest">TU PRÓXIMA ACCIÓN</span>
        <h2 className="font-display text-2xl font-black leading-tight mt-1 text-text-primary">
          {getTituloAccion()}
        </h2>
        <span className="font-body text-sm text-text-secondary mt-1 leading-relaxed">
          {getSubtituloAccion()}
        </span>
      </div>

      {/* ORIGEN CONTACTO */}
      <div className="mt-6 bg-surface-elevated rounded-3xl border border-border/20 p-5 shadow-lg relative">
        <span className="text-[10px] text-route-action font-bold uppercase tracking-widest mb-3 block">
          CONTACTO DE RECOLECCIÓN
        </span>

        <div className="flex items-center justify-between bg-surface rounded-xl p-3 border border-border/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-route-action/10 text-route-action flex items-center justify-center font-bold text-lg">
              {contactoNombre.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-text-primary">{contactoNombre}</span>
              <span className="text-xs text-text-secondary">
                {contactoTelefono || "Teléfono no registrado"}
              </span>
            </div>
          </div>
          {telefonoLimpio && (
            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/${telefonoLimpio}`}
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 active:scale-95 transition-transform"
                aria-label={`Enviar WhatsApp a ${contactoNombre}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </a>
              <a
                href={`tel:+${telefonoLimpio}`}
                className="w-10 h-10 rounded-full bg-route-action/10 text-route-action flex items-center justify-center border border-route-action/20 active:scale-95 transition-transform"
                aria-label={`Llamar a ${contactoNombre}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* VEHÍCULO A LOCALIZAR */}
        <div className="mt-5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-tertiary font-extrabold uppercase tracking-widest">
              VEHÍCULO A LOCALIZAR
            </span>
            <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">
              {marca} {modelo}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* 1. Placas */}
            <div className="flex flex-col bg-surface border border-border/20 rounded-xl p-3 shadow-2xs">
              <span className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider">PLACAS</span>
              <span className="font-mono font-black text-base mt-0.5 text-text-primary">{placas}</span>
            </div>

            {/* 2. VIN */}
            <div className="flex flex-col bg-surface border border-border/20 rounded-xl p-3 shadow-2xs">
              <span className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider">NÚMERO VIN</span>
              <span className="font-mono font-bold text-xs mt-1 uppercase truncate text-text-primary" title={vin}>{vin}</span>
            </div>

            {/* 3. Marca */}
            <div className="flex flex-col bg-surface border border-border/20 rounded-xl p-3 shadow-2xs">
              <span className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider">MARCA</span>
              <span className="font-semibold text-xs mt-0.5 text-text-primary">{marca}</span>
            </div>

            {/* 4. Modelo */}
            <div className="flex flex-col bg-surface border border-border/20 rounded-xl p-3 shadow-2xs">
              <span className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider">MODELO</span>
              <span className="font-semibold text-xs mt-0.5 text-text-primary truncate" title={modelo}>{modelo}</span>
            </div>

            {/* 5. Año */}
            <div className="flex flex-col bg-surface border border-border/20 rounded-xl p-3 shadow-2xs">
              <span className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider">AÑO</span>
              <span className="font-semibold text-xs mt-0.5 text-text-primary tabular-nums">{anio}</span>
            </div>

            {/* 6. Color */}
            <div className="flex flex-col bg-surface border border-border/20 rounded-xl p-3 shadow-2xs">
              <span className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider">COLOR</span>
              <span className="font-semibold text-xs mt-0.5 text-text-primary capitalize">{color}</span>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleAccionPrincipal}
            disabled={procesando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-signal hover:bg-signal/85 text-slate-950 px-4 py-4 font-display text-xs font-black tracking-widest uppercase shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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

      <EmergencyPanel trasladoId={trasladoId} />

      {/* Secondary Bottom Navigation Bar */}
      <div className="mt-auto pt-4 -mx-4 -mb-6">
        <SecondaryTripNavBar trasladoId={trasladoId} pasaporte={pasaporte} />
      </div>
    </div>
  );
}
