"use client";

import Link from "next/link";
import { useState } from "react";

interface PanelOperationalHealthProps {
  gpsActivo: boolean | null;
  gpsUltimaSenal?: Date | null;
  estaOnline: boolean;
  documentoBloqueante: boolean;
  documentoPorVencer: boolean;
  conductorEstado?: string | null;
}

function formatoHace(date: Date | null | undefined) {
  if (!date) return null;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace segundos";
  if (mins === 1) return "hace 1 min";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `hace ${hrs} h`;
}

export function PanelOperationalHealth({
  gpsActivo,
  gpsUltimaSenal,
  estaOnline,
  documentoBloqueante,
  documentoPorVencer,
  conductorEstado
}: PanelOperationalHealthProps) {
  const [expandido, setExpandido] = useState(false);
  const getDocumentoColor = () => {
    if (documentoBloqueante) return "text-danger";
    if (documentoPorVencer) return "text-warning";
    return "text-emerald-600 dark:text-emerald-400";
  };

  const getDocumentoLabel = () => {
    if (documentoBloqueante) return "Pendientes";
    if (documentoPorVencer) return "Por vencer";
    return "Vigentes";
  };

  const vehiculoHabilitado = conductorEstado === "activo" || conductorEstado === "modo_prueba_supervisada";

  const items = [
    {
      href: "/cuenta/documentos",
      icon: documentoBloqueante ? "alert" : "check",
      label: "Documentos",
      value: getDocumentoLabel(),
      color: getDocumentoColor(),
      dot: documentoBloqueante ? "bg-danger" : documentoPorVencer ? "bg-warning" : "bg-emerald-500"
    },
    {
      href: "/cuenta/perfil",
      icon: "user",
      label: "Perfil",
      value: vehiculoHabilitado ? "Habilitado" : "En validación",
      color: vehiculoHabilitado ? "text-emerald-600 dark:text-emerald-400" : "text-warning",
      dot: vehiculoHabilitado ? "bg-emerald-500" : "bg-warning"
    },
    {
      href: "/cuenta",
      icon: "gps",
      label: "GPS",
      value:
        gpsActivo === true
          ? gpsUltimaSenal
            ? `Activo · ${formatoHace(gpsUltimaSenal)}`
            : "Activo"
          : gpsActivo === false
            ? "Inactivo"
            : "Verificando…",
      color: gpsActivo ? "text-emerald-600 dark:text-emerald-400" : gpsActivo === false ? "text-danger" : "text-text-disabled",
      dot: gpsActivo ? "bg-emerald-500" : gpsActivo === false ? "bg-danger" : "bg-text-disabled"
    },
    {
      href: null as string | null,
      icon: "wifi",
      label: "Conexión",
      value: estaOnline ? "Conectado" : "Sin conexión",
      color: estaOnline ? "text-emerald-600 dark:text-emerald-400" : "text-danger",
      dot: estaOnline ? "bg-emerald-500" : "bg-danger"
    }
  ];

  function Icon({ name, className }: { name: string; className: string }) {
    if (name === "check")
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    if (name === "alert")
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    if (name === "user")
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4 19c0-3.5 3.2-6 8-6s8 2.5 8 6" />
        </svg>
      );
    if (name === "gps")
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      );
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <section className="bg-surface-elevated rounded-2xl border border-border/20 text-left shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-expanded={expandido}
        aria-controls="salud-lista"
        className="w-full flex justify-between items-center p-5 pb-3 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
      >
        <span className="text-text-tertiary text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-2">
          Salud Operacional
          <span className={`size-1.5 rounded-full ${documentoBloqueante || !vehiculoHabilitado || gpsActivo === false ? "bg-warning" : "bg-signal"}`} aria-hidden />
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-route-action">
          {expandido ? "Ocultar" : "Ver detalle"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className={`transition-transform ${expandido ? "rotate-180" : ""}`} aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      <div id="salud-lista" className={`${expandido ? "block" : "hidden lg:block"} border-t border-border/10`}>
        <ul className="divide-y divide-border/10">
          {items.map((it) => {
            const Row = (
              <div className="flex items-center gap-3 px-4 py-3.5 min-h-[56px] hover:bg-surface transition-colors">
                <span className={`size-9 rounded-full bg-surface border border-border/30 flex items-center justify-center shrink-0 ${it.color}`}>
                  <Icon name={it.icon} className="size-5" />
                </span>
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="font-body text-[13px] font-bold leading-none text-text-primary">{it.label}</span>
                  <span className={`font-body text-[11px] font-semibold leading-none mt-1 flex items-center gap-1.5 ${it.color}`}>
                    <span className={`size-1.5 rounded-full ${it.dot}`} aria-hidden />
                    {it.value}
                  </span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-text-tertiary shrink-0" aria-hidden>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            );
            return (
              <li key={it.label}>
                {it.href ? (
                  <Link
                    href={it.href}
                    className="block focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action rounded-xl mx-1"
                    aria-label={`${it.label}: ${it.value}`}
                  >
                    {Row}
                  </Link>
                ) : (
                  <output className="mx-1 rounded-xl block" aria-label={`${it.label}: ${it.value}`}>
                    {Row}
                  </output>
                )}
              </li>
            );
          })}
        </ul>
        <div className="px-4 pb-3 pt-1 lg:hidden">
          <Link href="/cuenta" className="inline-flex min-h-11 items-center text-xs font-bold text-route-action hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action rounded">
            Ir a mi cuenta →
          </Link>
        </div>
      </div>
      {!expandido && (
        <div className="px-5 pb-4 pt-1 lg:hidden">
          <p className="font-body text-xs text-text-secondary">
            {documentoBloqueante ? "Documentos pendientes de revisión" : gpsActivo === false ? "GPS inactivo — verifica permisos" : "Todo listo para operar"}
          </p>
        </div>
      )}
    </section>
  );
}
