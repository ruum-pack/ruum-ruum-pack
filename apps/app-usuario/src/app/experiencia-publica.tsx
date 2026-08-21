import type { ReactNode } from "react";
import { LogoMarca, type LogoVariante } from "@ruum/ui";

const fondoPublico = "bg-[#151515]";
const fondoPublicoTransparente = "bg-[#151515]/95";
const bordePublico = "border-[#5F6368]/40";
const campoPublico = "bg-[#1f2633]";
const textoSecundarioPublico = "text-[var(--ruum-dark-text-secondary)]";
const textoFuncionalPublico = "text-[var(--ruum-dark-text-tertiary)]";
const acentoPublico = "bg-[#FFC400]";
const focoPublico = "focus:border-[#1E88E5] focus:ring-[#1E88E5]/25";
const focoAcentoPublico = "focus-visible:ring-[#FFC400]/70 focus-visible:ring-offset-[#151515]";

export function PantallaPublica({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main className={`ruum-auth-shell min-h-screen ${fondoPublico} px-5 text-white sm:px-6 ${className}`}>
      <div className={`relative mx-auto min-h-screen w-full max-w-[390px] overflow-hidden ${fondoPublicoTransparente} shadow-[0_24px_64px_rgba(0,0,0,0.4)]`}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(21,21,21,0.85), rgba(21,21,21,0.98)), url('/imagenes/seguridad-traslado.png')",
            backgroundPosition: "42% 46%",
            backgroundSize: "cover"
          }}
        />
        <div className="relative z-10">{children}</div>
      </div>
    </main>
  );
}

export function LogoRuum({
  variante = "vertical",
  className = ""
}: {
  variante?: LogoVariante;
  className?: string;
}) {
  return (
    <LogoMarca
      variante={variante}
      tema="oscuro"
      className={className}
      mostrarDescriptor
      mostrarRespaldo
    />
  );
}

export function RutaAuto() {
  return (
    <svg viewBox="0 0 260 210" className="h-full w-full" role="img" aria-label="Ruta de traslado">
      <defs>
        <filter id="brillo-ruta" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="auto-amarillo" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFE082" />
          <stop offset="100%" stopColor="#FFC400" />
        </linearGradient>
      </defs>
      <path
        d="M28 166 C72 162 88 129 83 101 C77 64 112 39 151 61 C186 81 208 28 236 31"
        fill="none"
        stroke="#FFC400"
        strokeDasharray="6 7"
        strokeLinecap="round"
        strokeWidth="2.4"
        filter="url(#brillo-ruta)"
      />
      <circle cx="28" cy="166" r="5" fill="#151515" stroke="#FFC400" strokeWidth="2.5" />
      <circle cx="236" cy="31" r="5" fill="#151515" stroke="#FFC400" strokeWidth="2.5" />
      <g transform="translate(84 86)">
        <rect x="0" y="13" width="33" height="21" rx="5" fill="url(#auto-amarillo)" filter="url(#brillo-ruta)" />
        <path d="M6 13 12 4h18l8 9Z" fill="#FFE082" />
        <circle cx="8" cy="37" r="4" fill="#151515" stroke="#FFC400" strokeWidth="2" />
        <circle cx="28" cy="37" r="4" fill="#151515" stroke="#FFC400" strokeWidth="2" />
      </g>
    </svg>
  );
}

export function IconoLinea({ tipo }: { tipo: "escudo" | "maletin" | "pin" | "candado" | "documento" }) {
  const comun = "fill-none stroke-current";
  return (
    <span className="flex size-11 items-center justify-center rounded-full border border-[#FFC400]/55 bg-[#FFC400]/10 text-[#FFC400] shadow-[0_0_22px_rgba(255,196,0,0.14)]">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        {tipo === "escudo" && (
          <path className={comun} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 4 18 6v5c0 4-2.5 6.8-6 8-3.5-1.2-6-4-6-8V6l6-2Zm-2 8 1.5 1.5L15 10" />
        )}
        {tipo === "maletin" && (
          <path className={comun} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M8 8V6.5A2.5 2.5 0 0 1 10.5 4h3A2.5 2.5 0 0 1 16 6.5V8m-9 0h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm5 4v2" />
        )}
        {tipo === "pin" && (
          <path className={comun} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-5.1 6-10a6 6 0 0 0-12 0c0 4.9 6 10 6 10Zm0-7.5a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z" />
        )}
        {tipo === "candado" && (
          <path className={comun} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Zm4 4v2" />
        )}
        {tipo === "documento" && (
          <path className={comun} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l4 4v14H7V3Zm7 0v5h4M10 13h5m-5 4h5" />
        )}
      </svg>
    </span>
  );
}

export const campoOscuro =
  `w-full rounded-lg border ${bordePublico} ${campoPublico} px-3.5 py-2.5 font-body text-sm text-white outline-none transition placeholder:text-[var(--ruum-dark-text-tertiary)] ${focoPublico}`;

export const etiquetaOscura = `font-body text-xs font-medium ${textoSecundarioPublico}`;
export const botonAzul =
  `inline-flex min-h-11 w-full items-center justify-center rounded-lg ${acentoPublico} px-5 py-3 font-display text-sm font-bold text-[#151515] shadow-[0_10px_28px_rgba(255,196,0,0.22)] outline-none transition hover:bg-[#e0ac00] focus-visible:ring-2 ${focoAcentoPublico} focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45`;
export const botonContorno =
  `inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#5F6368] bg-transparent px-5 py-3 font-display text-sm font-bold text-white outline-none transition hover:border-[#FFC400] hover:bg-[#FFC400]/10 focus-visible:ring-2 ${focoAcentoPublico} focus-visible:ring-offset-2`;

export function CampoOscuro({
  etiqueta,
  ayuda,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: ReactNode }) {
  const inputId = id ?? `campo-${etiqueta.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const ayudaId = ayuda ? `${inputId}-ayuda` : undefined;
  const ariaDescribedBy = [props["aria-describedby"], ayudaId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={etiquetaOscura}>{etiqueta}</label>
      <input {...props} id={inputId} aria-describedby={ariaDescribedBy} data-ruum-label={etiqueta} className={`${campoOscuro} ${props.className ?? ""}`} />
      {ayuda ? <span id={ayudaId} className={`font-body text-xs leading-5 ${textoFuncionalPublico}`}>{ayuda}</span> : null}
    </div>
  );
}
