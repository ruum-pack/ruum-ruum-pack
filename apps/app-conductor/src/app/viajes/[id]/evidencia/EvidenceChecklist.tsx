"use client";
import { useEvidenceWizard } from "./EvidenceContext";

export function EvidenceChecklist() {
  const { requisitos: items, pasoActivo: activeIndex, statusFor, setPasoActivo: onSelect } = useEvidenceWizard();

  return (
    <nav aria-label="Checklist de evidencia" className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {items.map((item, index) => {
        const status = statusFor(item);
        const active = activeIndex === index;
        return (
          <button
            key={item.angulo}
            type="button"
            onClick={() => onSelect(index)}
            className={[
              "min-h-14 rounded-xl border px-2 py-2 text-left transition",
              active ? "border-route-action bg-surface-elevated shadow-[inset_0_0_0_1px_rgba(77,163,255,0.32)]" : "border-border/22 bg-surface",
              status === "listo" ? "text-success" : status === "omitido" ? "text-text-tertiary" : "text-text-primary"
            ].join(" ")}
          >
            <span className="block font-body text-xs font-semibold">{index + 1}</span>
            <span className="mt-1 block truncate font-body text-xs font-semibold">{item.titulo}</span>
          </button>
        );
      })}
    </nav>
  );
}
