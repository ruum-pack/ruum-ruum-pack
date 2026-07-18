import Image from "next/image";
import type { ReactNode } from "react";

type AdminHeroProps = {
  titulo: string;
  subtitulo: string;
  imagen?: string;
  accion?: ReactNode;
  children?: ReactNode;
};

type AdminPageHeaderProps = {
  etiqueta?: string;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
};

type AdminPanelProps = {
  children: ReactNode;
  className?: string;
};

function unir(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AdminHero({ titulo, subtitulo, imagen = "/imagenes/torre-control-flota.webp", accion, children }: AdminHeroProps) {
  return (
    <section className="admin-hero">
      <Image
        src={imagen}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="(min-width: 1024px) 960px, 100vw"
        className="scale-105 object-cover object-[60%_35%]"
      />
      <div className="admin-hero__overlay" />
      <div className="admin-hero__content">
        <div className="min-w-0">
          <p className="font-mono-ruum text-xs font-medium uppercase tracking-[0.18em] text-signal">Torre de Control</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">{titulo}</h1>
          <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-ink/70">{subtitulo}</p>
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </div>
      {children && <div className="admin-hero__footer">{children}</div>}
    </section>
  );
}

export function AdminPageHeader({ etiqueta, titulo, descripcion, accion }: AdminPageHeaderProps) {
  return (
    <header className="admin-page-header">
      <div className="min-w-0">
        {etiqueta && <p className="font-mono-ruum text-xs font-medium uppercase tracking-[0.16em] text-signal">{etiqueta}</p>}
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-2xl font-body text-sm leading-6 text-ink/60">{descripcion}</p>}
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </header>
  );
}

export function AdminPanel({ children, className = "" }: AdminPanelProps) {
  return <section className={unir("admin-panel", className)}>{children}</section>;
}
