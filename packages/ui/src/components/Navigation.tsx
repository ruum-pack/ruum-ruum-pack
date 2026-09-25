import type { ReactNode } from "react";

/** BottomNav — 4 items (Inicio, Traslados, Ayuda, Cuenta). Activo teal-deep + indicador superior. */
export interface NavItem {
  id: string;
  etiqueta: string;
  href: string;
  activo?: boolean;
  icono: ReactNode;
}

function IconoBase({ children }: { children: ReactNode }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden className="size-6">
      {children}
    </svg>
  );
}

export const ICONOS_NAV = {
  inicio: (
    <IconoBase><path d="M3 10.5 12 3l9 7.5V21H3ZM9 21v-6h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></IconoBase>
  ),
  traslados: (
    <IconoBase><path d="M5 17h14M7 17l1.5-5h7L17 17M7 17a2 2 0 1 0 0 .01M17 17a2 2 0 1 0 0 .01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></IconoBase>
  ),
  ayuda: (
    <IconoBase><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></IconoBase>
  ),
  cuenta: (
    <IconoBase><path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></IconoBase>
  ),
};

export function BottomNav({ items, className = "" }: { items: NavItem[]; className?: string }) {
  return (
    <nav aria-label="Navegación principal" className={`grid grid-cols-4 border-t border-[var(--ruum-border)] bg-white ${className}`}>
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          aria-current={item.activo ? "page" : undefined}
          className={`relative flex min-h-[var(--ruum-touch)] flex-col items-center justify-center gap-1 py-2 font-body text-xs font-semibold ${
            item.activo ? "text-[var(--ruum-teal-deep)]" : "text-[var(--ruum-muted)]"
          } focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--ruum-focus)]`}
        >
          {item.activo ? (
            <span aria-hidden className="absolute inset-x-8 top-0 h-[3px] rounded-b-full bg-[var(--ruum-teal-deep)]" />
          ) : null}
          {item.icono}
          {item.etiqueta}
        </a>
      ))}
    </nav>
  );
}

/** Tabs — píldoras con conteo. Activa: fondo teal-deep texto blanco. Sin wrap. */
export interface TabItem {
  id: string;
  etiqueta: string;
  conteo?: number;
  activo?: boolean;
}

export function Tabs({ tabs, onSeleccion, className = "" }: { tabs: TabItem[]; onSeleccion?: (id: string) => void; className?: string }) {
  return (
    <div role="tablist" aria-label="Filtros" className={`flex gap-2 overflow-x-auto pb-1 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.activo}
          onClick={() => onSeleccion?.(t.id)}
          className={`flex min-h-[var(--ruum-touch)] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 font-body text-sm font-semibold focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--ruum-focus)] ${
            t.activo
              ? "bg-[var(--ruum-teal-deep)] text-white"
              : "border border-[var(--ruum-border-input)] bg-white text-[var(--ruum-navy)]"
          }`}
        >
          {t.etiqueta}
          {typeof t.conteo === "number" ? (
            <span className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${t.activo ? "bg-white/20 text-white" : "bg-[var(--ruum-neutral-bg)] text-[var(--ruum-muted)]"}`}>
              {t.conteo}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** Sidebar — navegación lateral por función con contadores. */
export interface SidebarGrupo {
  titulo: string;
  items: { id: string; etiqueta: string; href: string; activo?: boolean; contador?: number }[];
}

export function Sidebar({ grupos, className = "" }: { grupos: SidebarGrupo[]; className?: string }) {
  return (
    <nav aria-label="Navegación lateral" className={`flex flex-col gap-5 ${className}`}>
      {grupos.map((g) => (
        <div key={g.titulo}>
          <p className="mb-1.5 px-3 font-body text-xs font-semibold uppercase tracking-wider text-[var(--ruum-muted)]">{g.titulo}</p>
          <ul className="space-y-1">
            {g.items.map((it) => (
              <li key={it.id}>
                <a
                  href={it.href}
                  aria-current={it.activo ? "page" : undefined}
                  className={`flex min-h-[var(--ruum-touch)] items-center justify-between rounded-[12px] px-3 py-2 font-body text-sm font-medium focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--ruum-focus)] ${
                    it.activo ? "bg-[var(--ruum-action-bg)] font-semibold text-[var(--ruum-navy)]" : "text-[var(--ruum-muted)] hover:bg-[var(--ruum-neutral-bg)]"
                  }`}
                >
                  <span>{it.etiqueta}</span>
                  {typeof it.contador === "number" && it.contador > 0 ? (
                    <span className="rounded-full bg-[var(--ruum-teal-deep)] px-2 py-0.5 text-xs font-bold tabular-nums text-white">{it.contador}</span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Avatar — circle/rounded, símbolo 50–60%, con estado opcional. */
export function Avatar({
  nombre,
  src,
  forma = "circle",
  conEstado,
  tamano = 40,
  className = "",
}: {
  nombre: string;
  src?: string;
  forma?: "circle" | "rounded";
  conEstado?: "activo" | "inactivo";
  tamano?: number;
  className?: string;
}) {
  const iniciales = nombre.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} role="img" aria-label={`Avatar de ${nombre}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={tamano} height={tamano} style={{ width: tamano, height: tamano }} className={`object-cover ${forma === "circle" ? "rounded-full" : "rounded-[24%]"}`} />
      ) : (
        <span
          aria-hidden
          style={{ width: tamano, height: tamano }}
          className={`flex items-center justify-center bg-[var(--ruum-navy)] font-body text-sm font-bold text-white ${forma === "circle" ? "rounded-full" : "rounded-[24%]"}`}
        >
          {iniciales}
        </span>
      )}
      {conEstado ? (
        <span
          aria-hidden
          className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-white ${conEstado === "activo" ? "bg-[var(--ruum-success)]" : "bg-[var(--ruum-muted)]"}`}
        />
      ) : null}
    </span>
  );
}
