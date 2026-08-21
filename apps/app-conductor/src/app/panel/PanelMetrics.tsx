"use client";

import Link from "next/link";

interface PanelMetricsProps {
  gananciasHoy: number;
  trasladosHoy: number;
}

function Sparkline({ value }: { value: number }) {
  // 7 días simulados centrados en gananciasHoy; si es 0 muestra línea plana tenue
  const max = Math.max(1200, value * 1.3);
  const puntos = [0.2, 0.35, 0.3, 0.55, 0.45, 0.7, value / max].map((p) => Math.max(0.08, Math.min(0.92, p)));
  const w = 80;
  const h = 28;
  const step = w / (puntos.length - 1);
  const d = puntos.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - p * h}`).join(" ");
  const fillD = `${d} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
      <path d={fillD} fill="currentColor" className="text-signal/15" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-signal" />
    </svg>
  );
}

function ProgressRing({ value, max = 3 }: { value: number; max?: number }) {
  const pct = Math.min(1, value / max);
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <div className="relative size-11 shrink-0">
      <svg width={44} height={44} viewBox="0 0 44 44" className="-rotate-90" aria-hidden>
        <circle cx={22} cy={22} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-border/30" />
        <circle
          cx={22}
          cy={22}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={pct >= 1 ? "text-signal" : "text-route-action"}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-[11px] font-black tabular-nums text-text-primary">
        {value}/{max}
      </span>
    </div>
  );
}

export function PanelMetrics({ gananciasHoy, trasladosHoy }: PanelMetricsProps) {
  const bonoFalta = Math.max(0, 3 - trasladosHoy);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-surface-elevated border border-border/20 rounded-2xl px-4 py-3.5 flex flex-col justify-between shadow-xs min-h-[110px]">
        <div>
          <span className="text-text-tertiary text-[10px] font-extrabold tracking-widest uppercase leading-none">
            Ganancias del día
          </span>
          <div className="font-display text-xl font-black text-signal mt-1.5 leading-none tabular-nums">
            {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(gananciasHoy)}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-text-tertiary text-xs font-medium">
            {trasladosHoy === 0 ? "Sin cierres aún" : `${trasladosHoy} cerrado${trasladosHoy !== 1 ? "s" : ""}`}
          </span>
          <Sparkline value={gananciasHoy} />
        </div>
        <Link
          href="/ganancias"
          className="text-route-action hover:underline text-xs font-bold mt-2 inline-flex items-center min-h-11 rounded-lg px-1 -mx-1 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
          aria-label="Ver balance de ganancias"
        >
          Ver balance →
        </Link>
      </div>

      <div className="bg-surface-elevated border border-border/20 rounded-2xl px-4 py-3.5 flex flex-col justify-between shadow-xs min-h-[110px]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-text-tertiary text-[10px] font-extrabold tracking-widest uppercase leading-none">
              Traslados hoy
            </span>
            <div className="font-display text-xl font-black text-text-primary mt-1.5 leading-none tabular-nums">
              {trasladosHoy}
            </div>
            <span className="text-text-tertiary text-xs mt-1.5 block font-medium">
              {bonoFalta === 0 ? "¡Bono en camino!" : `Faltan ${bonoFalta} para bono`}
            </span>
          </div>
          <ProgressRing value={trasladosHoy} />
        </div>
        <Link
          href="/ganancias"
          className="text-route-action hover:underline text-xs font-bold mt-2 inline-flex items-center min-h-11 rounded-lg px-1 -mx-1 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
        >
          Ver detalle →
        </Link>
      </div>
    </div>
  );
}
