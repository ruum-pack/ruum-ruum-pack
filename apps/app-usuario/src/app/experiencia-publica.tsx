import type { ReactNode } from "react";

export function PantallaPublica({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main className={`ruum-auth-shell min-h-screen bg-[#1a1f2e] px-5 text-white sm:px-6 ${className}`}>
      <div className="relative mx-auto min-h-screen w-full max-w-[390px] overflow-hidden bg-[#1a1f2e]/95 shadow-[0_24px_64px_rgba(26,31,46,0.34)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(26,31,46,0.82), rgba(26,31,46,0.98)), url('/imagenes/seguridad-traslado.png')",
            backgroundPosition: "42% 46%",
            backgroundSize: "cover"
          }}
        />
        <div className="relative z-10">{children}</div>
      </div>
    </main>
  );
}

export function LogoRuum({ className = "" }: { className?: string }) {
  return (
    <div className={`leading-none ${className}`} aria-label="Ruum Ruum by Moviliax">
      <div className="font-display text-[28px] font-extrabold tracking-[-0.01em] text-white">ruum</div>
      <div className="-mt-2 font-display text-[28px] font-extrabold tracking-[-0.01em] text-[#f5a623]">ruum</div>
      <div className="mt-1 font-mono-ruum text-[7px] font-medium uppercase tracking-[0.28em] text-white/35">
        by Moviliax
      </div>
    </div>
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
        <linearGradient id="auto-azul" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#82c6ff" />
          <stop offset="100%" stopColor="#1e88e5" />
        </linearGradient>
      </defs>
      <path
        d="M28 166 C72 162 88 129 83 101 C77 64 112 39 151 61 C186 81 208 28 236 31"
        fill="none"
        stroke="#1e88e5"
        strokeDasharray="6 7"
        strokeLinecap="round"
        strokeWidth="2.4"
        filter="url(#brillo-ruta)"
      />
      <circle cx="28" cy="166" r="5" fill="#1a1f2e" stroke="#1e88e5" strokeWidth="2.5" />
      <circle cx="236" cy="31" r="5" fill="#1a1f2e" stroke="#1e88e5" strokeWidth="2.5" />
      <g transform="translate(84 86)">
        <rect x="0" y="13" width="33" height="21" rx="5" fill="url(#auto-azul)" filter="url(#brillo-ruta)" />
        <path d="M6 13 12 4h18l8 9Z" fill="#74b9f2" />
        <circle cx="8" cy="37" r="4" fill="#1a1f2e" stroke="#1e88e5" strokeWidth="2" />
        <circle cx="28" cy="37" r="4" fill="#1a1f2e" stroke="#1e88e5" strokeWidth="2" />
      </g>
    </svg>
  );
}

export function IconoLinea({ tipo }: { tipo: "escudo" | "maletin" | "pin" | "candado" | "documento" }) {
  const comun = "fill-none stroke-current";
  return (
    <span className="flex size-11 items-center justify-center rounded-full border border-[#f5a623]/55 bg-[#f5a623]/10 text-[#f5a623] shadow-[0_0_22px_rgba(245,166,35,0.14)]">
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
  "w-full rounded-lg border border-[#4d5668] bg-[#151a25] px-3.5 py-2.5 font-body text-sm text-white outline-none transition placeholder:text-white/40 focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/25";

export const etiquetaOscura = "font-body text-xs font-medium text-[#d4d9e2]";
export const botonAzul =
  "inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#f5a623] px-5 py-3 font-display text-sm font-bold text-[#1a1f2e] shadow-[0_10px_28px_rgba(245,166,35,0.24)] outline-none transition hover:bg-[#d88f16] focus-visible:ring-2 focus-visible:ring-[#f5a623]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1f2e] disabled:cursor-not-allowed disabled:opacity-45";
export const botonContorno =
  "inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[#687287] bg-transparent px-5 py-3 font-display text-sm font-bold text-white outline-none transition hover:border-[#f5a623] hover:bg-[#f5a623]/10 focus-visible:ring-2 focus-visible:ring-[#f5a623]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1f2e]";

export function CampoOscuro({
  etiqueta,
  ayuda,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={etiquetaOscura}>{etiqueta}</span>
      <input {...props} className={`${campoOscuro} ${props.className ?? ""}`} />
      {ayuda ? <span className="font-body text-[11px] leading-4 text-white/42">{ayuda}</span> : null}
    </label>
  );
}
