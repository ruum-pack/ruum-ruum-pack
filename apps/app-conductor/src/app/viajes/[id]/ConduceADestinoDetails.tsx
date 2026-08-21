"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado, confirmarLlegadaDestino, obtenerPasaporteDigital } from "@ruum/api/services";
import { createNavigationOptions, type NavigationOption } from "../../../lib/navigation-launcher";
import { nombreVehiculo } from "../trips-utils";
import { MapaRutaConduccion } from "./MapaRutaConduccion";
import { SecondaryTripNavBar } from "./SecondaryTripNavBar";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

function extraerColonia(direccion: string | null): string {
  if (!direccion) return "";
  const partes = direccion.split(",").map((p) => p.trim());
  return partes[1] ?? partes[0] ?? "";
}

function abrirNavegacion(option: NavigationOption) {
  if (!option.nativeHref || typeof window === "undefined") return;

  window.location.href = option.nativeHref;
  window.setTimeout(() => {
    if (document.visibilityState === "visible") {
      window.open(option.webHref, "_blank", "noopener,noreferrer");
    }
  }, 900);
}

export function ConduceADestinoDetails({
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

  const destinoCiudad = pasaporte.destino_ciudad || "Ciudad Destino";
  const destinoDireccion = pasaporte.destino_direccion || "Dirección de entrega por confirmar";
  const destinoColonia = extraerColonia(pasaporte.destino_direccion);
  const distanciaTexto = pasaporte.distancia_km != null ? `${pasaporte.distancia_km.toFixed(1)} km` : "Por confirmar";
  const tiempoTexto = pasaporte.tiempo_estimado_horas != null ? `${Math.round(pasaporte.tiempo_estimado_horas * 60)} min` : "Por confirmar";

  const navigationTargetLat = pasaporte.destino_lat;
  const navigationTargetLng = pasaporte.destino_lng;

  const autoNombre = nombreVehiculo(pasaporte);
  const placas = pasaporte.vehiculo_placas || "POR CONFIRMAR";

  const contactoNombre = pasaporte.contacto_recepcion_nombre || "Contacto en destino";
  const contactoTelefono = pasaporte.contacto_recepcion_telefono || "";
  const telefonoLimpio = contactoTelefono.replace(/[^0-9]/g, "");

  const navOptions = useMemo(
    () =>
      createNavigationOptions({
        lat: navigationTargetLat,
        lng: navigationTargetLng,
        address: destinoDireccion
      }),
    [navigationTargetLat, navigationTargetLng, destinoDireccion]
  );

  async function handleLlegueDestino() {
    setProcesando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();

      const pasaporteFresco = await obtenerPasaporteDigital(cliente, trasladoId);
      const estadoDb = pasaporteFresco?.estado || pasaporte.estado;

      if (estadoDb === "evidencia_final_en_proceso") {
        router.push(`/viajes/${trasladoId}/evidencia`);
        return;
      }

      if (estadoDb === "traslado_en_curso") {
        await confirmarLlegadaDestino(cliente, trasladoId, { fueraGeocerca: false, distanciaM: 0 });
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      await avanzarEstadoTraslado(cliente, trasladoId, "llegada_a_destino");
      router.push(`/viajes/${trasladoId}/evidencia`);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos registrar tu llegada al destino. Intenta de nuevo."));
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
        <div className="w-12 h-12 rounded-full bg-route-action/15 border border-route-action/30 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-route-action" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-text-tertiary font-bold tracking-widest uppercase mb-0.5">ESTADO ACTUAL</span>
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-black uppercase tracking-wide text-text-primary">
              EN TRASLADO
            </span>
            <span className="h-2 w-2 rounded-full bg-route-action animate-pulse mt-0.5" />
          </div>
        </div>
      </div>

      {/* TU PRÓXIMA ACCIÓN */}
      <div className="mt-5 flex flex-col">
        <span className="text-[10px] font-bold text-route-action uppercase tracking-widest">TU PRÓXIMA ACCIÓN</span>
        <h2 className="font-display text-2xl font-black leading-tight mt-1 text-text-primary">
          Dirígete al destino
        </h2>
        <span className="font-body text-sm text-text-secondary mt-1 leading-relaxed">
          Conduce con precaución hacia el punto de entrega y registra tu llegada al estar en sitio.
        </span>
      </div>

      {/* VEHÍCULO EN CONDUCCIÓN */}
      <div className="mt-4 bg-surface-elevated rounded-2xl border border-border/20 p-3.5 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] text-text-tertiary uppercase font-bold">UNIDAD EN TRÁNSITO</span>
          <span className="font-display text-sm font-black text-text-primary mt-0.5">{autoNombre}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-text-tertiary uppercase font-bold">PLACAS</span>
          <span className="font-display text-xs font-black text-text-primary bg-surface px-2 py-0.5 rounded border border-border/20 mt-0.5">
            {placas}
          </span>
        </div>
      </div>

      {/* DESTINO */}
      <div className="mt-4 bg-surface-elevated rounded-3xl border border-border/20 p-5 shadow-lg relative">
        <span className="text-[10px] text-route-action font-bold uppercase tracking-widest mb-3 block">
          DESTINO FINAL
        </span>

        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-route-action/15 text-route-action flex items-center justify-center shrink-0 font-bold mt-0.5">
            📍
          </div>
          <div className="flex flex-col flex-1">
            <span className="font-display text-lg font-black text-text-primary">
              {destinoCiudad} {destinoColonia && <span className="font-normal text-text-secondary text-xs">({destinoColonia})</span>}
            </span>
            <span className="font-body text-xs text-text-secondary leading-relaxed mt-0.5">{destinoDireccion}</span>
          </div>
        </div>

        {/* CONTACTO DE RECEPCIÓN */}
        {contactoNombre && (
          <div className="mt-3 pt-3 border-t border-border/15 flex items-center justify-between bg-surface rounded-xl p-3 border border-border/20">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-route-action/10 text-route-action flex items-center justify-center font-bold text-sm">
                {contactoNombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xs text-text-primary">{contactoNombre}</span>
                <span className="text-[11px] text-text-secondary">Recibe la unidad</span>
              </div>
            </div>

            {telefonoLimpio && (
              <div className="flex items-center gap-2">
                <a
                  href={`https://wa.me/52${telefonoLimpio}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 active:scale-95 transition-transform"
                  aria-label={`Enviar WhatsApp a ${contactoNombre}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </a>
                <a
                  href={`tel:${telefonoLimpio}`}
                  className="w-9 h-9 rounded-full bg-route-action/10 text-route-action flex items-center justify-center border border-route-action/20 active:scale-95 transition-transform"
                  aria-label={`Llamar a ${contactoNombre}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        )}

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
            NAVEGAR AL DESTINO CON
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
            <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">DISTANCIA RESTANTE</span>
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
            onClick={handleLlegueDestino}
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
                HE LLEGADO AL DESTINO
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
      <div className="mt-auto pt-5 -mx-4 -mb-6">
        <SecondaryTripNavBar trasladoId={trasladoId} pasaporte={pasaporte} />
      </div>
    </div>
  );
}
