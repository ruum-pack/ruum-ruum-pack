"use client";

import Link from "next/link";

interface PanelOperationalHealthProps {
  gpsActivo: boolean | null;
  estaOnline: boolean;
  documentoBloqueante: boolean;
  documentoPorVencer: boolean;
  conductorEstado?: string | null;
}

export function PanelOperationalHealth({
  gpsActivo,
  estaOnline,
  documentoBloqueante,
  documentoPorVencer,
  conductorEstado
}: PanelOperationalHealthProps) {
  const getDocumentoColor = () => {
    if (documentoBloqueante) return "text-danger";
    if (documentoPorVencer) return "text-warning";
    return "text-signal";
  };

  const getDocumentoLabel = () => {
    if (documentoBloqueante) return "Pendientes";
    if (documentoPorVencer) return "Por vencer";
    return "Vigentes";
  };

  const vehiculoHabilitado = conductorEstado === "activo" || conductorEstado === "modo_prueba_supervisada";

  return (
    <section className="mt-6 bg-surface-elevated rounded-2xl p-5 border border-border/20 text-left shadow-xs">
      <div className="flex justify-between items-center pb-3 border-b border-border/15">
        <span className="text-text-tertiary text-[10px] font-extrabold tracking-wider uppercase">
          Salud Operacional
        </span>
        <Link
          href="/cuenta"
          className="text-xs font-bold text-route-action hover:underline inline-flex items-center gap-1 min-h-11 py-2 px-3 rounded-lg hover:bg-surface focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
        >
          <span>Ver detalle</span>
          <span className="text-[10px]" aria-hidden>&gt;</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4 mt-4">
        {/* GPS */}
        <div className="flex items-center gap-2.5">
          <svg
            className={`w-4 h-4 shrink-0 ${
              gpsActivo ? "text-signal" : gpsActivo === false ? "text-danger" : "text-text-disabled"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <path d="M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" strokeWidth="2" />
          </svg>
          <div className="flex flex-col leading-none">
            <span className="text-xs font-bold text-text-primary">GPS</span>
            <span
              className={`text-[10px] mt-1 font-semibold ${
                gpsActivo ? "text-signal" : gpsActivo === false ? "text-danger" : "text-text-secondary"
              }`}
            >
              {gpsActivo ? "Activo" : gpsActivo === false ? "Inactivo" : "Verificando…"}
            </span>
          </div>
        </div>

        {/* Conectividad */}
        <div className="flex items-center gap-2.5">
          <svg
            className={`w-4 h-4 shrink-0 ${estaOnline ? "text-signal" : "text-danger"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <circle cx="12" cy="20" r="1" fill="currentColor" />
          </svg>
          <div className="flex flex-col leading-none">
            <span className="text-xs font-bold text-text-primary">Conexión</span>
            <span className={`text-[10px] mt-1 font-semibold ${estaOnline ? "text-signal" : "text-danger"}`}>
              {estaOnline ? "Conectado" : "Sin conexión"}
            </span>
          </div>
        </div>

        {/* Documentos */}
        <div className="flex items-center gap-2.5">
          <svg
            className={`w-4 h-4 shrink-0 ${getDocumentoColor()}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {!documentoBloqueante ? (
              <polyline points="20 6 9 17 4 12" strokeWidth="3" />
            ) : (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            )}
          </svg>
          <div className="flex flex-col leading-none">
            <span className="text-xs font-bold text-text-primary">Documentos</span>
            <span className={`text-[10px] mt-1 font-semibold ${getDocumentoColor()}`}>
              {getDocumentoLabel()}
            </span>
          </div>
        </div>

        {/* Perfil Operativo */}
        <div className="flex items-center gap-2.5">
          <svg
            className={`w-4 h-4 shrink-0 ${vehiculoHabilitado ? "text-signal" : "text-warning"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div className="flex flex-col leading-none">
            <span className="text-xs font-bold text-text-primary">Perfil</span>
            <span
              className={`text-[10px] mt-1 font-semibold ${
                vehiculoHabilitado ? "text-signal" : "text-warning"
              }`}
            >
              {vehiculoHabilitado ? "Habilitado" : "En validación"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
