"use client";

import Link from "next/link";
import { Button } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";

type DatosBancarios = Database["public"]["Tables"]["datos_bancarios_conductor"]["Row"];

export function TripsHeader({ datosBancarios }: { datosBancarios?: DatosBancarios | null }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-5">
      <div>
        <Link href="/panel" className="font-body text-xs text-text-tertiary hover:underline">
          ← Volver al Panel
        </Link>
        <h1 className="mt-1 font-display text-3xl font-bold text-text-primary">Catálogo y Gestión de Traslados</h1>
        <p className="mt-1 font-body text-sm text-text-tertiary">
          Acepta nuevas oportunidades cercanas, gestiona tus traslados activos y consulta tu historial operativo.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {datosBancarios && (
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-surface-elevated px-3 py-2 font-body text-xs text-text-tertiary">
            <span>🏦 Cuenta de Depósito:</span>
            <strong className="text-text-primary font-semibold">{datosBancarios.banco} ({datosBancarios.clabe.slice(-4)})</strong>
          </span>
        )}
        <Link href="/cuenta/datos-bancarios">
          <Button variant="secondary" className="text-xs">
            💳 Datos Bancarios
          </Button>
        </Link>
      </div>
    </header>
  );
}
