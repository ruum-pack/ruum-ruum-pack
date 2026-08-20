"use client";

import Link from "next/link";

interface PanelMetricsProps {
  gananciasHoy: number;
  trasladosHoy: number;
}

export function PanelMetrics({ gananciasHoy, trasladosHoy }: PanelMetricsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-6">
      <div className="bg-surface-elevated border border-border/20 rounded-2xl px-4 py-3.5 flex flex-col justify-between shadow-xs">
        <div>
          <span className="text-text-tertiary text-[9px] font-extrabold tracking-widest uppercase leading-none">
            Ganancias del día
          </span>
          <div className="font-display text-xl font-black text-signal mt-1.5 leading-none tabular-nums">
            {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(gananciasHoy)}
          </div>
        </div>
        <span className="text-text-tertiary text-[10px] mt-2 font-medium">
          {trasladosHoy === 0 ? "Sin traslados cerrados" : `${trasladosHoy} cerrado${trasladosHoy !== 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="bg-surface-elevated border border-border/20 rounded-2xl px-4 py-3.5 flex flex-col justify-between shadow-xs">
        <div>
          <span className="text-text-tertiary text-[9px] font-extrabold tracking-widest uppercase leading-none">
            Traslados hoy
          </span>
          <div className="font-display text-xl font-black text-text-primary mt-1.5 leading-none tabular-nums">
            {trasladosHoy}
          </div>
        </div>
        <Link
          href="/ganancias"
          className="text-route-action hover:underline text-[11px] font-bold mt-2 inline-flex items-center min-h-[30px]"
        >
          Ver balance →
        </Link>
      </div>
    </div>
  );
}
