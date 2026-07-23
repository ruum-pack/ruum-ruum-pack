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
  breadcrumb?: Array<{ label: string; href?: string }>;
  estadoConexion?: "conectado" | "datos_en_vivo" | "demo" | "sin_conexion" | "actualizando" | "reconectando" | "desactualizado";
  ultimaActualizacion?: string | Date | null;
  tipoDatos?: "administrativos" | "gps" | "mixto";
  seccionesDesactualizadas?: string[];
  accionesSecundarias?: ReactNode;
  contadorResultados?: number;
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
          <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-text-secondary">{subtitulo}</p>
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </div>
      {children && <div className="admin-hero__footer">{children}</div>}
    </section>
  );
}

function textoConexion(estado: NonNullable<AdminPageHeaderProps["estadoConexion"]>) {
  if (estado === "conectado" || estado === "datos_en_vivo") return "Datos en vivo";
  if (estado === "actualizando") return "Actualizando";
  if (estado === "reconectando") return "Reconectando";
  if (estado === "desactualizado") return "Datos posiblemente desactualizados";
  if (estado === "demo") return "Modo demo";
  return "Sin conexión";
}

function claseConexion(estado: NonNullable<AdminPageHeaderProps["estadoConexion"]>) {
  if (estado === "conectado" || estado === "datos_en_vivo") return "border-status-success/30 bg-status-success-soft text-status-success";
  if (estado === "actualizando" || estado === "reconectando") return "border-status-info/30 bg-status-info-soft text-status-info";
  if (estado === "demo") return "border-status-warning/35 bg-status-warning-soft text-status-warning";
  if (estado === "desactualizado") return "border-status-warning/35 bg-status-warning-soft text-status-warning";
  return "border-status-error/30 bg-status-error-soft text-status-error";
}

function textoTipoDatos(tipo: NonNullable<AdminPageHeaderProps["tipoDatos"]>) {
  if (tipo === "gps") return "Datos GPS";
  if (tipo === "mixto") return "Datos administrativos y GPS";
  return "Datos administrativos";
}

function formatoActualizacion(valor: string | Date) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(fecha);
}

function formatoActualizacionRelativa(valor: string | Date) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? "Actualización sin fecha válida" : "Última actualización";
}

export function AdminPageHeader({
  etiqueta,
  titulo,
  descripcion,
  accion,
  breadcrumb,
  estadoConexion,
  ultimaActualizacion,
  tipoDatos,
  seccionesDesactualizadas = [],
  accionesSecundarias,
  contadorResultados
}: AdminPageHeaderProps) {
  return (
    <header className="admin-page-header">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="mb-2 font-body text-admin-secundario text-text-tertiary" aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5">
              {breadcrumb.map((item, indice) => (
                <li key={`${item.label}-${indice}`} className="flex items-center gap-1.5">
                  {indice > 0 && <span aria-hidden="true">/</span>}
                  {item.href ? <a href={item.href} className="hover:text-ink">{item.label}</a> : <span aria-current={indice === breadcrumb.length - 1 ? "page" : undefined}>{item.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {etiqueta && <p className="font-mono-ruum text-xs font-medium uppercase tracking-[0.16em] text-signal">{etiqueta}</p>}
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-2xl font-body text-sm leading-6 text-text-secondary">{descripcion}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {estadoConexion && (
            <span className={`rounded-full border px-3 py-1 font-body text-admin-secundario font-semibold ${claseConexion(estadoConexion)}`}>
              {textoConexion(estadoConexion)}
            </span>
          )}
          {ultimaActualizacion && (
            <time dateTime={(ultimaActualizacion instanceof Date ? ultimaActualizacion : new Date(ultimaActualizacion)).toISOString()} className="font-body text-admin-secundario text-text-tertiary">
              {formatoActualizacionRelativa(ultimaActualizacion)} · {formatoActualizacion(ultimaActualizacion)}
            </time>
          )}
          {tipoDatos && (
            <span className="font-body text-admin-secundario text-text-tertiary">{textoTipoDatos(tipoDatos)}</span>
          )}
          {typeof contadorResultados === "number" && (
            <span className="font-body text-admin-secundario text-text-tertiary">{contadorResultados.toLocaleString("es-MX")} resultados</span>
          )}
        </div>
        {seccionesDesactualizadas.length > 0 && (
          <p className="mt-2 font-body text-admin-secundario text-status-warning">
            Pueden estar desactualizadas: {seccionesDesactualizadas.join(", ")}.
          </p>
        )}
      </div>
      {(accion || accionesSecundarias) && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {accionesSecundarias}
          {accion}
        </div>
      )}
    </header>
  );
}

export function AdminPanel({ children, className = "" }: AdminPanelProps) {
  return <section className={unir("admin-panel", className)}>{children}</section>;
}

type AdminFiltroActivoProps = {
  etiqueta: string;
  onLimpiar: () => void;
  limpiarLabel?: string;
  className?: string;
};

/** Banner cuando la vista entra o queda acotada por un filtro (p. ej. `?filtro=` del menú). */
export function AdminFiltroActivo({
  etiqueta,
  onLimpiar,
  limpiarLabel = "Ver todos",
  className = ""
}: AdminFiltroActivoProps) {
  return (
    <div
      className={unir(
        "mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-info/25 bg-status-info-soft px-4 py-3",
        className
      )}
      role="status"
    >
      <p className="font-body text-sm font-semibold text-status-info">Filtro activo: {etiqueta}</p>
      <button
        type="button"
        onClick={onLimpiar}
        className="font-body text-sm font-semibold text-status-info hover:underline"
      >
        {limpiarLabel}
      </button>
    </div>
  );
}

/** Quita `filtro` (u otras claves) de la URL sin recargar la página. */
export function limpiarParamsFiltroUrl(claves: string[] = ["filtro", "accion"]) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let cambio = false;
  for (const clave of claves) {
    if (url.searchParams.has(clave)) {
      url.searchParams.delete(clave);
      cambio = true;
    }
  }
  if (cambio) {
    const siguiente = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", siguiente);
  }
}
