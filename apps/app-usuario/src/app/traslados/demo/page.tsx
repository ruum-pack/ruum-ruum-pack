"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, PassportCard } from "@ruum/ui";

type EtapaDemo = "recoleccion" | "en_camino" | "entregado";

const ETAPAS: Record<EtapaDemo, {
  nombre: string;
  badge: string;
  progreso: number;
  eta: string;
  descripcion: string;
  fotosInicial: number;
  fotosFinal: number;
  danosNuevos: boolean;
}> = {
  recoleccion: {
    nombre: "Recolección y Evidencia Inicial",
    badge: "Fotografiando estado inicial",
    progreso: 25,
    eta: "Hoy 10:30 AM",
    descripcion: "El conductor certificado realiza el checklist de 8 puntos y toma fotografías del estado estético y mecánico antes de encender el vehículo.",
    fotosInicial: 8,
    fotosFinal: 0,
    danosNuevos: false
  },
  en_camino: {
    nombre: "En Camino a Destino",
    badge: "En camino · GPS activo",
    progreso: 65,
    eta: "Hoy 13:45 PM (ETA)",
    descripcion: "Monitoreo satelital constante de velocidad, ruta y paradas autorizadas. Cobertura de seguro activo.",
    fotosInicial: 8,
    fotosFinal: 0,
    danosNuevos: false
  },
  entregado: {
    nombre: "Entrega Exitosa y Verificación",
    badge: "Vehículo entregado ✓",
    progreso: 100,
    eta: "Completado a las 13:42 PM",
    descripcion: "Inspección final completada en punto de destino. Evidencia comparativa validada: Sin daños nuevos registrados.",
    fotosInicial: 8,
    fotosFinal: 8,
    danosNuevos: false
  }
};

export default function PaginaDemoPasaporte() {
  const [etapa, setEtapa] = useState<EtapaDemo>("en_camino");
  const [fotoSeleccionada, setFotoSeleccionada] = useState<"frente" | "piloto" | "copiloto" | "tablero">("frente");
  const [posicionSlider, setPosicionSlider] = useState(50);

  const info = ETAPAS[etapa];

  return (
    <main className="min-h-screen bg-canvas text-text-primary px-4 py-8 max-w-4xl mx-auto space-y-6">
      {/* Barra superior de regreso */}
      <div className="flex items-center justify-between">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2 font-body text-sm font-semibold text-text-secondary hover:text-text-primary"
        >
          ← Volver al onboarding
        </Link>
        <span className="rounded-full border border-signal/40 bg-signal/15 px-3 py-1 font-mono-ruum text-xs font-bold text-slate-950 dark:text-signal">
          DEMO INTERACTIVA
        </span>
      </div>

      {/* Header explicativo */}
      <div className="space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-text-primary">
          Así funciona tu Pasaporte Digital
        </h1>
        <p className="font-body text-sm text-text-secondary max-w-2xl leading-relaxed">
          Cada traslado en Ruum Ruum genera un Pasaporte Digital en tiempo real: trazabilidad de ruta, identidad verificada del conductor, inspección fotográfica 360° y certificación de entrega sin daños.
        </p>
      </div>

      {/* Selector interactivo de etapas */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-sm space-y-4">
        <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">
          Explora cómo avanza tu viaje paso a paso
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["recoleccion", "en_camino", "entregado"] as const).map((k) => {
            const activo = etapa === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setEtapa(k)}
                className={[
                  "rounded-xl border p-3 text-left transition-all",
                  activo
                    ? "border-signal bg-signal/10 ring-2 ring-signal/30"
                    : "border-border bg-surface-elevated hover:bg-surface"
                ].join(" ")}
              >
                <span className="block font-mono-ruum text-[10px] font-bold uppercase text-text-tertiary">
                  {k === "recoleccion" ? "Paso 1" : k === "en_camino" ? "Paso 2" : "Paso 3"}
                </span>
                <span className="mt-1 block font-display text-xs sm:text-sm font-bold text-text-primary">
                  {k === "recoleccion" ? "Recolección" : k === "en_camino" ? "En camino" : "Entregado"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tarjeta de estado simulado */}
        <div className="rounded-xl border border-border/80 bg-surface-elevated p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-body text-xs font-bold text-text-primary">{info.badge}</span>
            </div>
            <span className="font-mono-ruum text-xs font-semibold text-signal">{info.eta}</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full bg-signal transition-all duration-500"
              style={{ width: `${info.progreso}%` }}
            />
          </div>

          <p className="font-body text-xs text-text-secondary leading-relaxed">
            {info.descripcion}
          </p>
        </div>
      </section>

      {/* Datos del vehículo y conductor */}
      <div className="grid gap-4 sm:grid-cols-2">
        <PassportCard>
          <div className="space-y-3">
            <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">Vehículo en custodia</p>
            <div>
              <h3 className="font-display text-lg font-bold text-text-primary">BMW Serie 3 2023 · Sedán</h3>
              <p className="font-mono-ruum text-xs text-text-secondary">VIN: 3MW5R1J08P8A92810 · Placas: NZA-882-C</p>
            </div>
            <div className="flex flex-wrap gap-1.5 font-body text-xs">
              <span className="rounded-md border border-border bg-surface-elevated px-2 py-1">Automática</span>
              <span className="rounded-md border border-border bg-surface-elevated px-2 py-1">Seminuevo</span>
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700 dark:text-emerald-400">Verificación vigente ✓</span>
            </div>
          </div>
        </PassportCard>

        <PassportCard>
          <div className="space-y-3">
            <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">Conductor asignado</p>
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-signal text-slate-950 font-display font-extrabold text-base">
                CR
              </div>
              <div>
                <p className="font-body text-sm font-bold text-text-primary">Carlos Ramírez V.</p>
                <p className="font-body text-xs text-text-secondary">4.96 ★ · 1,420 traslados sin incidentes</p>
                <p className="font-mono-ruum text-[11px] text-emerald-600 dark:text-emerald-400">Certificación Ruum Nivel Oro ✓</p>
              </div>
            </div>
          </div>
        </PassportCard>
      </div>

      {/* Evidencia fotográfica interactiva */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-text-primary">
              Inspección y Evidencia Comparativa
            </h2>
            <p className="font-body text-xs text-text-secondary">
              Compara el estado del vehículo al inicio contra la entrega final con el slider.
            </p>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 font-body text-xs font-bold text-emerald-700 dark:text-emerald-400">
            ✓ Sin daños nuevos detectados
          </span>
        </div>

        {/* Selector de ángulo */}
        <div className="flex gap-2 border-b border-border pb-3">
          {(["frente", "piloto", "copiloto", "tablero"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setFotoSeleccionada(a)}
              className={[
                "rounded-lg px-3 py-1.5 font-body text-xs font-bold capitalize transition-colors",
                fotoSeleccionada === a
                  ? "bg-signal text-slate-950"
                  : "bg-surface-elevated text-text-secondary hover:text-text-primary"
              ].join(" ")}
            >
              {a}
            </button>
          ))}
        </div>

        {/* Simulación de Before / After con slider */}
        <div className="relative h-64 sm:h-80 w-full overflow-hidden rounded-xl border border-border bg-slate-900 select-none">
          {/* Lado derecho (Después) */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-tr from-slate-900 to-slate-800 text-white">
            <div className="text-center space-y-2">
              <span className="font-mono-ruum text-4xl">📸</span>
              <p className="font-display text-base font-bold">Entrega Final ({fotoSeleccionada.toUpperCase()})</p>
              <p className="font-body text-xs text-slate-400">Limpieza y estado impecable registrado</p>
            </div>
            <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 font-mono-ruum text-[10px] text-white">
              DESPUÉS
            </span>
          </div>

          {/* Lado izquierdo (Antes) recortado por slider */}
          <div
            className="absolute inset-0 overflow-hidden flex items-center justify-center bg-gradient-to-tr from-slate-950 to-slate-900 text-white border-r-2 border-signal"
            style={{ width: `${posicionSlider}%` }}
          >
            <div className="text-center space-y-2 min-w-[320px]">
              <span className="font-mono-ruum text-4xl">🚗</span>
              <p className="font-display text-base font-bold">Recepción Inicial ({fotoSeleccionada.toUpperCase()})</p>
              <p className="font-body text-xs text-slate-400">Verificado en origen sin anomalías</p>
            </div>
            <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 font-mono-ruum text-[10px] text-signal">
              ANTES
            </span>
          </div>

          {/* Control deslizante nativo */}
          <input
            type="range"
            min="0"
            max="100"
            value={posicionSlider}
            onChange={(e) => setPosicionSlider(Number(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-ew-resize"
            aria-label="Deslizar para comparar foto de inicio y entrega"
          />
        </div>

        <p className="text-center font-body text-xs text-text-tertiary">
          ← Arrastra hacia los lados para comparar el estado inicial con el de entrega →
        </p>
      </section>

      {/* CTA Final para crear un traslado real */}
      <div className="rounded-2xl border border-signal/40 bg-gradient-to-br from-signal/15 to-transparent p-6 text-center space-y-4">
        <h2 className="font-display text-xl font-bold text-text-primary">
          ¿Listo para solicitar tu traslado?
        </h2>
        <p className="font-body text-xs text-text-secondary max-w-md mx-auto">
          Obtén tu cotización en 3 simples pasos con conductores certificados y seguro en tránsito incluido.
        </p>
        <Link
          href="/traslados/nuevo"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-signal px-6 py-3 font-display text-sm font-bold text-slate-950 shadow-md shadow-signal/20 transition hover:bg-signal/90 hover:scale-[1.02]"
        >
          Comenzar mi traslado →
        </Link>
      </div>
    </main>
  );
}
