"use client";

import { useEffect, useRef, useState } from "react";

export type DriverAvailability = "disponible" | "no_disponible" | "en_viaje";

type AvailabilityOption = Exclude<DriverAvailability, "en_viaje">;

interface DriverAvailabilityControlProps {
  value: DriverAvailability;
  saving: boolean;
  onChange: (value: AvailabilityOption) => void;
}

const ESTADOS: Record<DriverAvailability, { label: string; icono: string }> = {
  disponible: {
    label: "Disponible",
    icono: "🟢"
  },
  no_disponible: {
    label: "No disponible",
    icono: "⚪"
  },
  en_viaje: {
    label: "En viaje activo",
    icono: "🚘"
  }
};

const OPCIONES: AvailabilityOption[] = ["disponible", "no_disponible"];

export function DriverAvailabilityControl({ value, saving, onChange }: DriverAvailabilityControlProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const wasSaving = useRef(false);
  const disabled = value === "en_viaje" || saving;
  const estado = ESTADOS[value];
  const disponible = value === "disponible";

  useEffect(() => {
    const acabaDeGuardar = wasSaving.current && !saving;
    wasSaving.current = saving;

    if (acabaDeGuardar && value === "disponible") {
      wasSaving.current = false;
      setFeedback("Disponibilidad activada. Estás listo para recibir viajes.");
      const id = window.setTimeout(() => setFeedback(null), 3200);
      return () => window.clearTimeout(id);
    }
  }, [saving, value]);

  return (
    <section
      aria-labelledby="driver-availability-title"
      className={[
        "relative rounded-2xl border px-5 py-4 transition-all duration-200 shadow-xs",
        disponible
          ? "border-emerald-500/40 bg-emerald-500/10 shadow-emerald-500/5"
          : "border-border/60 bg-surface-elevated/40"
      ].join(" ")}
    >
      {feedback && (
        <output
          aria-live="polite"
          className="conductor-toast-bottom fixed right-4 z-50 max-w-[calc(100vw-2rem)] rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-3 font-body text-sm font-bold text-emerald-400 shadow-2xl sm:right-6 sm:max-w-sm"
        >
          ✨ {feedback}
        </output>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span
              className={[
                "size-3.5 rounded-full transition-all duration-200",
                disponible ? "bg-emerald-500 shadow-md shadow-emerald-500/50" : "bg-text-tertiary"
              ].join(" ")}
              aria-hidden
            />
            {disponible && (
              <span className="absolute size-5 animate-ping rounded-full bg-emerald-500/40" aria-hidden />
            )}
          </div>
          <div>
            <p className="font-body text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
              Disponibilidad Operativa
            </p>
            <h2 id="driver-availability-title" className="font-display text-base font-bold text-text-primary flex items-center gap-1.5 mt-0.5">
              <span>{estado.icono}</span>
              <span>{saving ? "Actualizando estado..." : estado.label}</span>
            </h2>
          </div>
        </div>

        {/* Toggle con Contraste Radical entre Activo (Verde brillante) e Inactivo (Neutro sin fondo) */}
        <div className="grid grid-cols-2 rounded-xl border border-border bg-surface p-1 sm:w-80" aria-label="Cambiar disponibilidad">
          {OPCIONES.map((option) => {
            const active = value === option;
            const isDisponibleOption = option === "disponible";

            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                disabled={disabled || active}
                onClick={() => onChange(option)}
                className={[
                  "min-h-10 rounded-lg px-3 py-2 text-center font-display text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action",
                  active
                    ? isDisponibleOption
                      ? "bg-emerald-500 text-slate-950 font-extrabold shadow-sm scale-[1.02]"
                      : "bg-surface-elevated text-text-primary border border-border shadow-xs"
                    : "text-text-tertiary hover:bg-surface-elevated hover:text-text-primary opacity-70",
                  disabled || active ? "disabled:cursor-not-allowed" : ""
                ].join(" ")}
              >
                <span>{ESTADOS[option].icono}</span>
                <span>{ESTADOS[option].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {value === "en_viaje" && (
        <p className="mt-3 rounded-xl border border-route-action/40 bg-route-soft px-4 py-2.5 font-body text-xs font-bold text-route-action flex items-center gap-2">
          <span>🔒</span>
          <span>Cambio bloqueado: te encuentras realizando un traslado activo.</span>
        </p>
      )}
    </section>
  );
}
