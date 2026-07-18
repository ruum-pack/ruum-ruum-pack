"use client";

import { useEffect, useRef, useState } from "react";

export type DriverAvailability = "disponible" | "no_disponible" | "en_viaje";

type AvailabilityOption = Exclude<DriverAvailability, "en_viaje">;

interface DriverAvailabilityControlProps {
  value: DriverAvailability;
  saving: boolean;
  onChange: (value: AvailabilityOption) => void;
}

const ESTADOS: Record<DriverAvailability, { label: string }> = {
  disponible: {
    label: "Disponible"
  },
  no_disponible: {
    label: "No disponible"
  },
  en_viaje: {
    label: "En viaje"
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
      setFeedback("Disponibilidad activada.");
      const id = window.setTimeout(() => setFeedback(null), 3200);
      return () => window.clearTimeout(id);
    }
  }, [saving, value]);

  return (
    <section
      aria-labelledby="driver-availability-title"
      className={[
        "relative rounded-2xl border px-4 py-3 transition-colors",
        disponible ? "border-success/38 bg-success/10" : "border-border/22 bg-surface"
      ].join(" ")}
    >
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className="conductor-toast-bottom fixed right-4 z-50 max-w-[calc(100vw-2rem)] rounded-xl border border-success/35 bg-success/14 px-4 py-3 font-body text-sm font-semibold text-text-primary shadow-[0_18px_48px_rgba(0,0,0,0.42)] sm:right-6 sm:max-w-sm"
        >
          {feedback}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={[
              "size-3 rounded-full ring-4",
              disponible ? "bg-success ring-success/18" : "bg-text-tertiary ring-text-tertiary/14"
            ].join(" ")}
            aria-hidden
          />
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Disponibilidad operativa</p>
            <h2 id="driver-availability-title" className="font-display text-base font-semibold text-text-primary">
              {saving ? "Actualizando..." : estado.label}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 rounded-xl border border-border bg-surface p-1 sm:w-72" aria-label="Cambiar disponibilidad">
          {OPCIONES.map((option) => {
            const active = value === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                disabled={disabled || active}
                onClick={() => onChange(option)}
                className={[
                  "min-h-10 rounded-lg px-3 py-2 text-center font-body text-sm font-semibold transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action",
                  active ? "bg-route-action text-[#14213D] shadow-sm" : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
                  disabled || active ? "disabled:cursor-not-allowed disabled:opacity-80" : ""
                ].join(" ")}
              >
                {ESTADOS[option].label}
              </button>
            );
          })}
        </div>
      </div>

      {value === "en_viaje" && (
        <p className="mt-3 rounded-xl border border-route-action bg-route-soft px-4 py-3 font-body text-sm font-semibold text-route-action">
          Cambio bloqueado: estás operando un traslado activo.
        </p>
      )}
    </section>
  );
}
