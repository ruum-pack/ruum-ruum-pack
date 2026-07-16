"use client";

import { useId, useState, type ReactNode } from "react";

type TabId = "trazabilidad" | "evidencias" | "detalles";

interface PasaporteTabsProps {
  trazabilidad: ReactNode;
  evidencias: ReactNode;
  detalles: ReactNode;
}

const TABS: { id: TabId; etiqueta: string }[] = [
  { id: "trazabilidad", etiqueta: "Trazabilidad" },
  { id: "evidencias", etiqueta: "Evidencias" },
  { id: "detalles", etiqueta: "Detalles" }
];

export function PasaporteTabs({ trazabilidad, evidencias, detalles }: PasaporteTabsProps) {
  const [activa, setActiva] = useState<TabId>("trazabilidad");
  const baseId = useId();
  const paneles: Record<TabId, ReactNode> = { trazabilidad, evidencias, detalles };

  return (
    <section className="mt-6" aria-label="Secciones del Pasaporte Digital">
      <div className="sticky top-0 z-20 -mx-4 bg-mist-dim/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <div className="grid grid-cols-3 rounded-[var(--ruum-radius-field)] border border-ink/15 bg-mist p-1 shadow-1" role="tablist">
          {TABS.map((tab) => {
            const seleccionada = activa === tab.id;
            return (
              <button
                key={tab.id}
                id={`${baseId}-${tab.id}-tab`}
                type="button"
                role="tab"
                aria-selected={seleccionada}
                aria-controls={`${baseId}-${tab.id}-panel`}
                onClick={() => setActiva(tab.id)}
                className={[
                  "min-h-11 rounded-[calc(var(--ruum-radius-field)-2px)] px-2 font-body text-xs font-semibold transition sm:text-sm",
                  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-dark",
                  seleccionada ? "bg-ink text-mist shadow-1" : "text-ink/65 hover:bg-ink/[0.04] hover:text-ink"
                ].join(" ")}
              >
                {tab.etiqueta}
              </button>
            );
          })}
        </div>
      </div>

      {TABS.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-${tab.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-${tab.id}-tab`}
          hidden={activa !== tab.id}
          className="mt-5"
        >
          {paneles[tab.id]}
        </div>
      ))}
    </section>
  );
}
