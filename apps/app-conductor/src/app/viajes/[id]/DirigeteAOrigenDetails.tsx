"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";
import { createNavigationOptions, type NavigationOption } from "../../../lib/navigation-launcher";
import { formatearDuracion } from "../trips-utils";
import { MapaRutaConduccion } from "./MapaRutaConduccion";
import { SecondaryTripNavBar } from "./SecondaryTripNavBar";
import { EmergencyPanel } from "./EmergencyPanel";
import { StickyTripActions } from "./StickyTripActions";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

function abrirNavegacion(option: NavigationOption) {
  if (!option.nativeHref || typeof window === "undefined") return;

  window.location.href = option.nativeHref;
  window.setTimeout(() => {
    if (document.visibilityState === "visible") {
      window.open(option.webHref, "_blank", "noopener,noreferrer");
    }
  }, 900);
}

export function DirigeteAOrigenDetails({
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

  const origenCiudad = pasaporte.origen_ciudad || "Ciudad Origen";
  const origenDireccion = pasaporte.origen_direccion || "Dirección de origen por confirmar";

  const distanciaTexto = pasaporte.distancia_km != null ? `${pasaporte.distancia_km.toFixed(1)} km` : "Por confirmar";
  const tiempoTexto = formatearDuracion(pasaporte.tiempo_estimado_horas);

  const navigationTargetLat = pasaporte.origen_lat;
  const navigationTargetLng = pasaporte.origen_lng;

  const navOptions = useMemo(
    () =>
      createNavigationOptions({
        lat: navigationTargetLat,
        lng: navigationTargetLng,
        address: origenDireccion
      }),
    [navigationTargetLat, navigationTargetLng, origenDireccion]
  );

  async function handleLlegueOrigen() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      await avanzarEstadoTraslado(cliente, trasladoId, "conductor_en_camino_al_origen");
      router.refresh();
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos registrar tu llegada al origen."));
      setProcesando(false);
    }
  }

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
      <div className="mt-4 bg-surface-elevated border border-border/20 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-signal/15 border border-signal/30 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-signal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
            <circle cx="7" cy="17" r="2" />
            <path d="M9 17h6" />
            <circle cx="17" cy="17" r="2" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-text-tertiary font-bold tracking-widest uppercase mb-0.5">ESTADO ACTUAL</span>
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-black uppercase tracking-wide text-text-primary">
              EN CAMINO AL ORIGEN
            </span>
            <span className="h-2 w-2 rounded-full bg-signal animate-pulse mt-0.5" />
          </div>
        </div>
      </div>

      {/* TU PRÓXIMA ACCIÓN */}
      <div className="mt-5 flex flex-col">
        <span className="text-[10px] font-bold text-route-action uppercase tracking-widest">TU PRÓXIMA ACCIÓN</span>
        <h2 className="font-display text-2xl font-black leading-tight mt-1 text-text-primary">
          Dirígete al origen
        </h2>
        <span className="font-body text-sm text-text-secondary mt-1 leading-relaxed">
          Navega con tu app favorita hacia el punto de recolección y registra tu llegada al estar en sitio.
        </span>
      </div>

      {/* ORIGEN */}
      <div className="mt-5 bg-surface-elevated rounded-3xl border border-border/20 p-5 shadow-lg relative">
        <span className="text-[10px] text-route-action font-bold uppercase tracking-widest mb-3 block">
          PUNTO DE RECOLECCIÓN
        </span>

        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-route-action/15 text-route-action flex items-center justify-center shrink-0 font-bold mt-0.5">
            📍
          </div>
          <div className="flex flex-col flex-1">
            <span className="font-display text-lg font-black text-text-primary">{origenCiudad}</span>
            <span className="font-body text-xs text-text-secondary leading-relaxed mt-0.5">{origenDireccion}</span>
          </div>
        </div>

        {/* MAP PREVIEW */}
        {navigationTargetLat !== null && navigationTargetLng !== null && (
          <div className="mt-4 rounded-xl overflow-hidden h-[110px] bg-surface relative pointer-events-none border border-border/10">
            <MapaRutaConduccion
              origen={{ lat: navigationTargetLat, lng: navigationTargetLng }}
              destino={{ lat: navigationTargetLat, lng: navigationTargetLng }}
            />
          </div>
        )}

        {/* ACCESOS DIRECTOS DE NAVEGACIÓN */}
        <div className="mt-4 pt-3 border-t border-border/15">
          <span className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider block mb-2">
            NAVEGAR AL ORIGEN CON
          </span>
          <div className="grid grid-cols-2 gap-2">
            {navOptions.map((option) => (
              <a
                key={option.id}
                href={option.href}
                target={option.nativeHref ? undefined : "_blank"}
                rel="noreferrer"
                onClick={(event) => {
                  if (!option.nativeHref) return;
                  event.preventDefault();
                  abrirNavegacion(option);
                }}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-route-action/30 bg-surface hover:bg-surface-elevated px-3 py-2 text-center font-display text-xs font-bold text-route-action transition shadow-xs active:scale-[0.98]"
              >
                <span>🗺️</span>
                <span>{option.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* STATS */}
        <div className="mt-4 pt-3 border-t border-border/15 grid grid-cols-2 gap-3 text-center">
          <div className="bg-surface rounded-xl p-2.5 border border-border/10">
            <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">DISTANCIA AL ORIGEN</span>
            <span className="font-display text-base font-black text-text-primary block mt-0.5">{distanciaTexto}</span>
          </div>
          <div className="bg-surface rounded-xl p-2.5 border border-border/10">
            <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">TIEMPO ESTIMADO</span>
            <span className="font-display text-base font-black text-text-primary block mt-0.5">{tiempoTexto}</span>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleLlegueOrigen}
            disabled={procesando}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-signal hover:bg-signal/85 text-slate-950 px-4 py-4 font-display text-xs font-black tracking-widest uppercase shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {procesando ? (
              TEXTOS_CARGANDO.actualizando
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                HE LLEGADO AL ORIGEN
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

      {/* Q7 — Acciones rápidas sticky (Navegar / Llamar / Chat) */}
      <StickyTripActions
        trasladoId={trasladoId}
        navigationTarget={{ lat: navigationTargetLat, lng: navigationTargetLng, address: origenDireccion }}
        phone={null}
      />

      {/* Spacer para sticky bar + nav */}
      <div className="h-[88px]" aria-hidden />

      {/* Secondary Bottom Navigation Bar */}
      <div className="mt-auto pt-2 -mx-4 -mb-6">
        <SecondaryTripNavBar trasladoId={trasladoId} pasaporte={pasaporte} />
      </div>
    </div>
  );
}
