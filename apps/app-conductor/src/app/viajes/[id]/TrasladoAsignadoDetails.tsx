"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO, TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";
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

export function TrasladoAsignadoDetails({
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
  const origenColonia = extraerColonia(pasaporte.origen_direccion);

  const destinoCiudad = pasaporte.destino_ciudad || "Ciudad Destino";
  const destinoColonia = extraerColonia(pasaporte.destino_direccion);

  const navigationTargetLat = pasaporte.origen_lat;
  const navigationTargetLng = pasaporte.origen_lng;

  const autoNombre = nombreVehiculo(pasaporte);
  const placas = pasaporte.vehiculo_placas || "POR ASIGNAR";
  const color = pasaporte.vehiculo_color || "No especificado";
  const vin = pasaporte.vehiculo_vin || "POR CONFIRMAR";
  const tipoVehiculo = pasaporte.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo] : null;

  const contactoNombre = pasaporte.contacto_entrega_nombre || "Contacto en origen";
  const contactoTelefono = pasaporte.contacto_entrega_telefono || "";
  const telefonoLimpio = contactoTelefono.replace(/[^0-9]/g, "");

  const gananciaNeta = pasaporte.ganancia_conductor || 0;
  const distanciaTotal = pasaporte.distancia_km ? `${pasaporte.distancia_km.toFixed(1)} km` : "Por confirmar";
  const tiempoEstimado = pasaporte.tiempo_estimado_horas
    ? `${Math.round(pasaporte.tiempo_estimado_horas * 60)} min`
    : "Por confirmar";

  const horaProgramada = useMemo(() => {
    const fechaOrigen = (pasaporte as { fecha_hora_programada?: string | null }).fecha_hora_programada ?? pasaporte.creado_en;
    if (!fechaOrigen) return null;
    try {
      const fecha = new Date(fechaOrigen);
      return fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return null;
    }
  }, [pasaporte]);

  const navOptions = useMemo(
    () =>
      createNavigationOptions({
        lat: navigationTargetLat,
        lng: navigationTargetLng,
        address: origenDireccion
      }),
    [navigationTargetLat, navigationTargetLng, origenDireccion]
  );

  async function handleIniciarCamino() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      await avanzarEstadoTraslado(cliente, trasladoId, "conductor_asignado");
      router.refresh();
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos iniciar el traslado. Intenta de nuevo."));
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

      {/* ESTADO ACTUAL BADGE */}
      <div className="mt-4 bg-surface-elevated border border-border/20 rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-signal/15 border border-signal/30 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-signal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-text-tertiary font-bold tracking-widest uppercase mb-0.5">
              ESTADO ACTUAL
            </span>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-black uppercase tracking-wide text-text-primary">
                ASIGNADO
              </span>
              <span className="h-2 w-2 rounded-full bg-signal animate-pulse" />
            </div>
          </div>
        </div>

        {horaProgramada && (
          <div className="flex flex-col items-end text-right">
            <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">CITA</span>
            <span className="font-display text-sm font-black text-route-action">{horaProgramada} hrs</span>
          </div>
        )}
      </div>

      {/* TU PRÓXIMA ACCIÓN */}
      <div className="mt-5 flex flex-col">
        <span className="text-[10px] font-bold text-signal uppercase tracking-widest">
          TU PRÓXIMA ACCIÓN
        </span>
        <h2 className="font-display text-2xl font-black leading-tight mt-1 text-text-primary">
          Prepárate para salir
        </h2>
        <span className="font-body text-sm text-text-secondary mt-1 leading-relaxed">
          Revisa la información del vehículo y el contacto. Cuando estés listo, inicia tu camino al punto de recolección.
        </span>
      </div>

      {/* 1. FICHA RESUMEN DEL VEHÍCULO */}
      <div className="mt-5 bg-surface-elevated rounded-3xl border border-border/20 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">
            VEHÍCULO A TRASLADAR
          </span>
          {tipoVehiculo && (
            <span className="bg-route-action/10 text-route-action border border-route-action/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              {tipoVehiculo}
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <h3 className="font-display text-lg font-black text-text-primary leading-snug">
              {autoNombre}
            </h3>
            <span className="text-xs text-text-secondary mt-0.5">Color: {color}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-text-tertiary uppercase font-bold">PLACAS</span>
            <span className="font-display font-black text-base text-text-primary bg-surface px-2.5 py-1 rounded-lg border border-border/20 mt-0.5 tracking-wider">
              {placas}
            </span>
          </div>
        </div>

        {/* Resumen económico y distancia */}
        <div className="mt-4 pt-3 border-t border-border/15 grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col bg-surface p-2 rounded-xl border border-border/10">
            <span className="text-[9px] text-text-tertiary uppercase font-bold">TARIFA NETA</span>
            <span className="font-display text-sm font-black text-signal mt-0.5">
              ${gananciaNeta.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col bg-surface p-2 rounded-xl border border-border/10">
            <span className="text-[9px] text-text-tertiary uppercase font-bold">DISTANCIA</span>
            <span className="font-display text-sm font-black text-text-primary mt-0.5">{distanciaTotal}</span>
          </div>
          <div className="flex flex-col bg-surface p-2 rounded-xl border border-border/10">
            <span className="text-[9px] text-text-tertiary uppercase font-bold">TRAYECTO</span>
            <span className="font-display text-sm font-black text-text-primary mt-0.5">{tiempoEstimado}</span>
          </div>
        </div>
      </div>

      {/* 2. PUNTO DE RECOLECCIÓN Y MAPA */}
      <div className="mt-4 bg-surface-elevated rounded-3xl border border-border/20 p-4 shadow-sm relative">
        <span className="text-[10px] text-signal font-bold uppercase tracking-widest mb-2.5 block">
          PUNTO DE RECOLECCIÓN
        </span>

        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-signal/15 text-signal flex items-center justify-center shrink-0 font-bold mt-0.5">
            📍
          </div>
          <div className="flex flex-col flex-1">
            <span className="font-display text-base font-black text-text-primary">
              {origenCiudad} {origenColonia && <span className="font-normal text-text-secondary text-xs">({origenColonia})</span>}
            </span>
            <span className="font-body text-xs text-text-secondary leading-relaxed mt-0.5">
              {origenDireccion}
            </span>
          </div>
        </div>

        {/* 3. CONTACTO EN ORIGEN */}
        {contactoNombre && (
          <div className="mt-3 pt-3 border-t border-border/15 flex items-center justify-between bg-surface rounded-xl p-3 border border-border/20">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-route-action/10 text-route-action flex items-center justify-center font-bold text-sm">
                {contactoNombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xs text-text-primary">{contactoNombre}</span>
                <span className="text-[11px] text-text-secondary">Entrega la unidad</span>
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
          <div className="mt-4 rounded-xl overflow-hidden h-[110px] bg-surface relative pointer-events-none opacity-85 border border-border/10">
            <MapaRutaConduccion
              origen={{ lat: navigationTargetLat, lng: navigationTargetLng }}
              destino={{ lat: navigationTargetLat, lng: navigationTargetLng }}
            />
          </div>
        )}

        {/* ACCESOS DIRECTOS DE NAVEGACIÓN (Google Maps / Waze) */}
        <div className="mt-3 pt-3 border-t border-border/15">
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

        {/* CTA PRINCIPAL */}
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleIniciarCamino}
            disabled={procesando}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-signal hover:bg-signal/85 px-4 py-4 font-display text-xs font-black tracking-widest text-slate-950 uppercase shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {procesando ? (
              TEXTOS_CARGANDO.actualizando
            ) : (
              <>
                ESTOY EN CAMINO AL ORIGEN
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ml-1">
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
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

      {/* Secondary Bottom Navigation Bar (Detalles del traslado, Gastos, Incidencia) */}
      <div className="mt-auto pt-5 -mx-4 -mb-6">
        <SecondaryTripNavBar trasladoId={trasladoId} pasaporte={pasaporte} />
      </div>
    </div>
  );
}
