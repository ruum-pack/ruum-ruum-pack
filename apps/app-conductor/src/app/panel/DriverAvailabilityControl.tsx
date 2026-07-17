"use client";

import { useEffect, useRef, useState } from "react";

export type DriverAvailability = "disponible" | "no_disponible" | "en_viaje";

type AvailabilityOption = Exclude<DriverAvailability, "en_viaje">;

interface DriverAvailabilityControlProps {
  value: DriverAvailability;
  saving: boolean;
  onChange: (value: AvailabilityOption) => void;
}

const ESTADOS: Record<DriverAvailability, { label: string; description: string; impact: string }> = {
  disponible: {
    label: "Disponible",
    description: "Podrás recibir nuevas oportunidades.",
    impact: "Aparecerás para viajes compatibles con tu perfil operativo."
  },
  no_disponible: {
    label: "No disponible",
    description: "No recibirás nuevas oportunidades.",
    impact: "Tus viajes activos o próximos no cambian; solo pausas nuevas ofertas."
  },
  en_viaje: {
    label: "En viaje",
    description: "Tu estado se actualizará al finalizar.",
    impact: "Mientras operas un traslado, no puedes cambiar manualmente tu disponibilidad."
  }
};

const OPCIONES: AvailabilityOption[] = ["disponible", "no_disponible"];

const ESTILO: Record<DriverAvailability, string> = {
  disponible: "border-success bg-control-soft text-success",
  no_disponible: "border-border bg-surface-elevated text-text-secondary",
  en_viaje: "border-route-action bg-route-soft text-route-action"
};

export function DriverAvailabilityControl({ value, saving, onChange }: DriverAvailabilityControlProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const wasSaving = useRef(false);
  const disabled = value === "en_viaje" || saving;
  const estado = ESTADOS[value];

  useEffect(() => {
    const acabaDeGuardar = wasSaving.current && !saving;
    wasSaving.current = saving;

    if (acabaDeGuardar) {
      wasSaving.current = false;
      setFeedback(`Cambio guardado: ${ESTADOS[value].label}.`);
      const id = window.setTimeout(() => setFeedback(null), 3200);
      return () => window.clearTimeout(id);
    }
  }, [saving, value]);

  return (
    <section aria-labelledby="driver-availability-title" className="grid gap-4">
      <div>
        <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Disponibilidad operativa</p>
        <h2 id="driver-availability-title" className="mt-2 font-display text-2xl font-semibold">
          {estado.label}
        </h2>
        <p className="mt-2 font-body text-base font-semibold text-text-primary">{estado.description}</p>
        <p className="mt-1 font-body text-sm leading-6 text-text-secondary">{estado.impact}</p>
      </div>

      <div className={["rounded-2xl border px-4 py-4", ESTILO[value]].join(" ")} aria-live="polite">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-body text-lg font-bold">Estado actual: {estado.label}</span>
          <span className="font-body text-sm font-semibold">
            {saving ? "Guardando..." : feedback ?? "Actualizado"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Cambiar disponibilidad">
        {OPCIONES.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled || active}
              onClick={() => onChange(option)}
              className={[
                "min-h-28 rounded-2xl border px-4 py-4 text-left transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action",
                active ? "border-route-action bg-route-soft shadow-[inset_0_0_0_2px_var(--ruum-focus-ring)]" : "border-border bg-surface hover:border-route-action",
                disabled || active ? "disabled:cursor-not-allowed disabled:border-border disabled:text-disabled" : ""
              ].join(" ")}
            >
              <span className="block font-display text-xl font-semibold text-text-primary">{ESTADOS[option].label}</span>
              <span className="mt-2 block font-body text-sm leading-6 text-text-secondary">{ESTADOS[option].description}</span>
              <span className="mt-3 block font-body text-xs font-semibold text-route-action">
                {active ? "Seleccionado" : "Cambiar a este estado"}
              </span>
            </button>
          );
        })}
      </div>

      {value === "en_viaje" && (
        <p className="rounded-xl border border-route-action bg-route-soft px-4 py-3 font-body text-sm font-semibold text-route-action">
          Cambio bloqueado: estás operando un viaje activo.
        </p>
      )}
    </section>
  );
}
