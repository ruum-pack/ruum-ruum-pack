"use client";

import type { InspeccionEvidencia } from "./evidence-requirements";

export interface EvidenceReferenceProps {
  evidenciaInicial: InspeccionEvidencia | null;
  estaCargando: boolean;
}

/**
 * Componente que muestra los valores de evidencia inicial como referencia
 * al capturar la evidencia final
 */
export function EvidenceReference({ evidenciaInicial, estaCargando }: EvidenceReferenceProps) {
  if (estaCargando) {
    return (
      <div className="rounded-xl border border-border bg-surface-elevated p-4" aria-busy="true">
        <p className="font-body text-sm text-text-secondary">Cargando referencia inicial...</p>
      </div>
    );
  }

  if (!evidenciaInicial) {
    return null;
  }

  const { kilometraje, llavesRecibidas, combustible } = evidenciaInicial;

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4" aria-label="Valores iniciales de referencia">
      <h3 className="font-body text-sm font-semibold text-text-primary">Valores iniciales (referencia)</h3>
      <p className="mt-1 font-body text-xs text-text-secondary">
        Compara estos valores al capturar la evidencia final
      </p>

      <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-body text-sm text-text-secondary">Kilometraje:</span>
          <span className="font-body text-sm font-semibold text-text-primary">
            {kilometraje || "-"} km
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="font-body text-sm text-text-secondary">Llaves:</span>
          <span className="font-body text-sm font-semibold text-text-primary">
            {llavesRecibidas || "-"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="font-body text-sm text-text-secondary">Combustible:</span>
          <span className="font-body text-sm font-semibold text-text-primary">
            {combustible || "-"}
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs text-text-tertiary">
        * Verifica que estos valores coincidan con el estado actual del vehículo
      </p>
    </div>
  );
}
