"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Aviso } from "@ruum/ui";

type PeriodoReporte = "hoy" | "semana" | "mes" | "personalizado";
type ModoReporte = "operacion" | "finanzas";
type EstadoMetrica = "neutral" | "ok" | "atencion" | "critico" | "desconectado";
type ExportacionRealizada = {
  recurso: string;
  fecha: string;
  rango: string;
  hash: string;
  traceId: string;
};

const FILTROS_PERIODO: Array<{ id: PeriodoReporte; etiqueta: string }> = [
  { id: "hoy", etiqueta: "Hoy" },
  { id: "semana", etiqueta: "Semana" },
  { id: "mes", etiqueta: "Mes" },
  { id: "personalizado", etiqueta: "Personalizado" }
];

const FILTROS_ZONA = ["Todas", "Centro", "Norte", "Poniente", "Foránea"];
const FILTROS_SERVICIO = ["Todos", "Ligero A", "Ligero B", "Plataforma", "Empresarial"];

const RESUMEN_EJECUTIVO = [
  {
    titulo: "Traslados esta semana",
    valor: "Sin datos aún",
    definicion: "Total de traslados creados en el periodo global seleccionado.",
    detalle: "Cuando el motor esté activo podrás filtrar por zona, tipo de servicio y periodo.",
    estado: "desconectado" as EstadoMetrica,
    href: "/viajes"
  },
  {
    titulo: "Incidencias abiertas",
    valor: "Sin datos aún",
    definicion: "Incidencias sin resolución operativa al corte del reporte.",
    detalle: "Abrirá el detalle de incidencias filtradas por estado abierto.",
    estado: "desconectado" as EstadoMetrica,
    href: "/incidencias"
  },
  {
    titulo: "Pendiente de cobro",
    valor: "Sin datos aún",
    definicion: "Monto estimado de pagos de usuarios pendientes por liquidar.",
    detalle: "Se mostrará en MXN con separadores de miles cuando exista información financiera real.",
    estado: "desconectado" as EstadoMetrica,
    href: "/pagos?filtro=pendientes"
  }
];

const GRUPOS_REPORTE = [
  {
    categoria: "Operación",
    pregunta: "¿Qué está pasando en la operación hoy?",
    columnas: [
      { titulo: "Traslados por día / semana / zona", valor: "En conexión...", estado: "desconectado" as EstadoMetrica, formato: "Serie temporal" },
      { titulo: "Tiempo promedio de asignación", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "min:s" },
      { titulo: "Tiempo promedio de traslado", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "h min" },
      { titulo: "Cancelaciones", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "Eventos" },
      { titulo: "Incidencias", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "Abiertas / cerradas" }
    ]
  },
  {
    categoria: "Finanzas",
    pregunta: "¿Qué falta cobrar, pagar o revisar?",
    columnas: [
      { titulo: "Ingresos por periodo", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "MXN" },
      { titulo: "Pagos a conductores", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "MXN" },
      { titulo: "Gastos autorizados", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "MXN" },
      { titulo: "Margen estimado", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "%" },
      { titulo: "Traslados pendientes de cobro", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "MXN" },
      { titulo: "Pagos pendientes", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "Conteo / monto" }
    ]
  },
  {
    categoria: "Conductores",
    pregunta: "¿Cómo está respondiendo la red de conductores?",
    columnas: [
      { titulo: "Traslados realizados", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "Conteo" },
      { titulo: "Calificación", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "Promedio" },
      { titulo: "Incidencias por conductor", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "Eventos" },
      { titulo: "Disponibilidad", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "%" },
      { titulo: "Ganancias", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "MXN" },
      { titulo: "Documentos vencidos", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "Conteo" }
    ]
  },
  {
    categoria: "Cuentas empresariales",
    pregunta: "¿Qué clientes corporativos requieren seguimiento?",
    columnas: [
      { titulo: "Traslados solicitados", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "Conteo" },
      { titulo: "Frecuencia de uso", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "Semanal / mensual" },
      { titulo: "Tipo de servicio", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "Distribución" },
      { titulo: "Facturación", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "MXN" },
      { titulo: "Incidencias", valor: "Sin datos aún", estado: "desconectado" as EstadoMetrica, formato: "Eventos" }
    ]
  }
];

const EXPORTACIONES = [
  {
    recurso: "Pagos",
    descripcion: "Cobros de usuarios, estado de liquidación y folios relacionados.",
    href: "/api/exportaciones/pagos",
    disponible: true
  },
  {
    recurso: "Traslados",
    descripcion: "Folio, estado operativo, ruta, tiempos y responsable.",
    href: "/viajes",
    disponible: false
  },
  {
    recurso: "Conductores",
    descripcion: "Disponibilidad, documentación y desempeño operativo.",
    href: "/conductores",
    disponible: false
  },
  {
    recurso: "Empresas",
    descripcion: "Cuentas corporativas, facturación y uso del servicio.",
    href: "/empresas",
    disponible: false
  }
];

export default function ReportesCliente() {
  const [periodo, setPeriodo] = useState<PeriodoReporte>("semana");
  const [modo, setModo] = useState<ModoReporte>("operacion");
  const [zona, setZona] = useState("Todas");
  const [servicio, setServicio] = useState("Todos");
  const [exportando, setExportando] = useState<string | null>(null);
  const [exportacion, setExportacion] = useState<ExportacionRealizada | null>(null);
  const [errorExportacion, setErrorExportacion] = useState<string | null>(null);

  const gruposVisibles = useMemo(() => {
    if (modo === "finanzas") return GRUPOS_REPORTE.filter((grupo) => grupo.categoria === "Finanzas" || grupo.categoria === "Cuentas empresariales");
    return GRUPOS_REPORTE.filter((grupo) => grupo.categoria !== "Finanzas");
  }, [modo]);

  const rango = etiquetaRango(periodo);

  async function exportarPagos() {
    setExportando("Pagos");
    setErrorExportacion(null);
    try {
      const respuesta = await fetch("/api/exportaciones/pagos", { cache: "no-store" });
      if (!respuesta.ok) throw new Error("La exportación no pudo completarse.");
      const csv = await respuesta.text();
      const hash = respuesta.headers.get("x-content-sha256") ?? "No informado";
      const traceId = respuesta.headers.get("x-request-id") ?? "Sin trace";
      descargarArchivo(csv, nombreArchivoPagos(), "text/csv;charset=utf-8");
      setExportacion({
        recurso: "Pagos",
        fecha: new Date().toISOString(),
        rango,
        hash,
        traceId
      });
    } catch (error) {
      setErrorExportacion(error instanceof Error ? error.message : "No pudimos exportar el reporte.");
    } finally {
      setExportando(null);
    }
  }

  return (
    <main className="admin-page-shell">
      <header className="rounded-card border border-border-default bg-surface-primary p-5 shadow-[var(--ruum-shadow-1)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono-ruum text-admin-secundario uppercase tracking-[0.16em] text-signal">Torre de Control</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Reportes</h1>
            <p className="mt-2 max-w-3xl font-body text-sm leading-6 text-text-secondary">
              Indicadores ejecutivos para operación, finanzas, conductores y cuentas empresariales.
            </p>
          </div>
          <div className="rounded-lg border border-status-info/30 bg-status-info-soft px-4 py-3">
            <p className="font-body text-sm font-semibold text-status-info">Versión MVP</p>
            <p className="mt-1 max-w-md font-body text-xs leading-5 text-text-secondary">
              Esta vista está en versión MVP. Las tarjetas atenuadas indican reportes aún no conectados al motor de datos real.
            </p>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-20 mt-4 rounded-card border border-border-default bg-surface-primary/95 p-3 shadow-[var(--ruum-shadow-1)] backdrop-blur" aria-label="Filtros globales de reportes">
        <div className="flex flex-wrap items-center gap-3">
          <FiltroSegmentado label="Periodo" items={FILTROS_PERIODO} value={periodo} onChange={setPeriodo} />
          <FiltroSegmentado
            label="Modo"
            items={[{ id: "operacion", etiqueta: "Modo operación" }, { id: "finanzas", etiqueta: "Modo finanzas" }]}
            value={modo}
            onChange={setModo}
          />
          <FiltroSelect label="Zona" value={zona} options={FILTROS_ZONA} onChange={setZona} />
          <FiltroSelect label="Tipo de servicio" value={servicio} options={FILTROS_SERVICIO} onChange={setServicio} />
        </div>
      </nav>

      <section className="mt-4 grid gap-3 lg:grid-cols-3" aria-label="Resumen ejecutivo de reportes">
        {RESUMEN_EJECUTIVO.map((metrica) => (
          <KpiEjecutivo key={metrica.titulo} metrica={metrica} />
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(24rem,0.8fr)]">
        <PanelGraficaPlaceholder periodo={rango} zona={zona} servicio={servicio} />
        <PanelTablaPlaceholder />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2" aria-label="Bloques de indicadores por categoría">
        {gruposVisibles.map((grupo) => (
          <GrupoReportes key={grupo.categoria} grupo={grupo} />
        ))}
      </section>

      <section className="mt-5 rounded-card border border-border-default bg-surface-primary p-5 shadow-[var(--ruum-shadow-1)]" aria-label="Exportaciones seguras">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Exportación y seguridad</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-ink">Reportes descargables</h2>
            <p className="mt-1 max-w-3xl font-body text-sm leading-6 text-text-secondary">
              Exportación segura: limita filas, neutraliza fórmulas CSV y registra una huella SHA-256 para trazabilidad.
            </p>
          </div>
          {errorExportacion && <Aviso tono="danger">{errorExportacion}</Aviso>}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {EXPORTACIONES.map((item) => (
            <article key={item.recurso} className={`rounded-card border p-4 ${item.disponible ? "border-border-default bg-surface-secondary" : "border-border-default bg-surface-secondary opacity-70"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-ink">{item.recurso}</h3>
                  <p className="mt-1 font-body text-xs leading-5 text-text-secondary">{item.descripcion}</p>
                </div>
                <span className="rounded-full border border-border-default bg-surface-primary px-2 py-1 font-body text-[0.68rem] font-semibold uppercase tracking-wide text-text-tertiary">
                  CSV
                </span>
              </div>
              {item.disponible ? (
                <button
                  type="button"
                  onClick={exportarPagos}
                  disabled={exportando === item.recurso}
                  title="Exportación segura: limita filas, neutraliza fórmulas y registra SHA-256."
                  className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-signal bg-signal px-4 py-2 font-body text-sm font-semibold text-ink shadow-sm hover:bg-signal/90 disabled:cursor-wait disabled:opacity-70"
                >
                  {exportando === item.recurso ? "Exportando..." : "Exportar pagos CSV"}
                </button>
              ) : (
                <Link href={item.href} className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border-default px-4 py-2 font-body text-sm font-semibold text-text-secondary hover:border-signal/40 hover:text-ink">
                  Preparar fuente
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>

      {exportacion && <ModalExportacion exportacion={exportacion} onClose={() => setExportacion(null)} />}
    </main>
  );
}

function FiltroSegmentado<T extends string>({ label, items, value, onChange }: {
  label: string;
  items: Array<{ id: T; etiqueta: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</span>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`inline-flex min-h-10 items-center rounded-full border px-3 py-1.5 font-body text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-focus-default/30 ${value === item.id ? "border-signal bg-signal text-ink" : "border-border-default bg-surface-secondary text-text-secondary hover:border-signal/40 hover:text-ink"}`}
        >
          {item.etiqueta}
        </button>
      ))}
    </div>
  );
}

function FiltroSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 font-body text-sm text-text-secondary">
      <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded-lg border border-border-default bg-surface-secondary px-3 py-2 font-body text-sm text-ink focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function KpiEjecutivo({ metrica }: { metrica: typeof RESUMEN_EJECUTIVO[number] }) {
  return (
    <Link href={metrica.href} className="rounded-card border border-border-default bg-surface-primary p-4 shadow-[var(--ruum-shadow-1)] transition-colors hover:border-signal/40 focus:outline-none focus:ring-2 focus:ring-focus-default/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">{metrica.titulo}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink">{metrica.valor}</p>
        </div>
        <Ayuda texto={metrica.definicion} />
      </div>
      <EstadoMetrica estado={metrica.estado} />
      <p className="mt-3 font-body text-xs leading-5 text-text-secondary">{metrica.detalle}</p>
      <span className="mt-4 inline-flex min-h-9 items-center rounded-lg border border-status-info/35 px-3 py-1.5 font-body text-xs font-semibold text-status-info">
        Ver detalle
      </span>
    </Link>
  );
}

function GrupoReportes({ grupo }: { grupo: typeof GRUPOS_REPORTE[number] }) {
  return (
    <section className="rounded-card border border-border-default bg-surface-primary p-5 shadow-[var(--ruum-shadow-1)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">{grupo.categoria}</h2>
          <p className="mt-1 font-body text-sm text-text-secondary">{grupo.pregunta}</p>
        </div>
        <span className="rounded-full border border-border-default bg-surface-secondary px-3 py-1 font-body text-xs font-semibold text-text-tertiary">MVP</span>
      </div>
      <div className="mt-4 grid gap-2">
        {grupo.columnas.map((metrica) => (
          <article key={metrica.titulo} className="rounded-lg border border-border-default bg-surface-secondary px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-body text-sm font-semibold text-ink">{metrica.titulo}</p>
                <p className="mt-1 font-body text-xs text-text-tertiary">Formato esperado: {metrica.formato}</p>
              </div>
              <div className="text-right">
                <p className="font-body text-sm font-semibold text-text-secondary">{metrica.valor}</p>
                <EstadoMetrica estado={metrica.estado} compacto />
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-4 rounded-lg border border-status-info/25 bg-status-info-soft px-3 py-2 font-body text-xs leading-5 text-text-secondary">
        Podrás filtrar por zona, tipo de servicio y periodo cuando el motor de reportes esté activo.
      </p>
    </section>
  );
}

function PanelGraficaPlaceholder({ periodo, zona, servicio }: { periodo: string; zona: string; servicio: string }) {
  return (
    <section className="rounded-card border border-border-default bg-surface-primary p-5 shadow-[var(--ruum-shadow-1)]" aria-label="Gráfica de traslados">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Traslados por día, semana y zona</h2>
          <p className="mt-1 font-body text-sm text-text-secondary">Vista preparada para serie temporal y comparación operativa.</p>
        </div>
        <span className="rounded-full border border-border-default bg-surface-secondary px-3 py-1 font-body text-xs font-semibold text-text-tertiary">{periodo}</span>
      </div>
      <div className="mt-5 grid min-h-56 place-items-center rounded-lg border border-dashed border-border-default bg-surface-secondary p-6 text-center">
        <div>
          <p className="font-display text-lg font-semibold text-ink">En conexión...</p>
          <p className="mt-2 max-w-md font-body text-sm leading-6 text-text-secondary">
            La gráfica usará los filtros globales: zona {zona}, servicio {servicio}. No se muestran datos de ejemplo para evitar decisiones con información no real.
          </p>
        </div>
      </div>
    </section>
  );
}

function PanelTablaPlaceholder() {
  return (
    <section className="rounded-card border border-border-default bg-surface-primary p-5 shadow-[var(--ruum-shadow-1)]" aria-label="Tabla de detalle de reportes">
      <h2 className="font-display text-xl font-semibold text-ink">Detalle filtrado</h2>
      <p className="mt-1 font-body text-sm text-text-secondary">Los indicadores clave abrirán aquí o en su módulo operativo con filtros aplicados.</p>
      <div className="mt-4 overflow-hidden rounded-lg border border-border-default">
        <table className="w-full text-left font-body text-sm">
          <thead className="bg-surface-secondary text-text-tertiary">
            <tr>
              <th className="px-3 py-2 font-semibold">Métrica</th>
              <th className="px-3 py-2 font-semibold">Estado</th>
              <th className="px-3 py-2 font-semibold">Acción</th>
            </tr>
          </thead>
          <tbody>
            {["Incidencias abiertas", "Traslados pendientes de cobro", "Documentos vencidos"].map((fila) => (
              <tr key={fila} className="border-t border-border-default">
                <td className="px-3 py-3 text-ink">{fila}</td>
                <td className="px-3 py-3 text-text-secondary">Sin datos aún</td>
                <td className="px-3 py-3 text-status-info">Preparado para detalle</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EstadoMetrica({ estado, compacto = false }: { estado: EstadoMetrica; compacto?: boolean }) {
  const clase = estado === "ok"
    ? "border-status-success/30 bg-status-success-soft text-status-success"
    : estado === "atencion"
      ? "border-status-warning/35 bg-status-warning-soft text-status-warning"
      : estado === "critico"
        ? "border-status-error/30 bg-status-error-soft text-status-error"
        : estado === "desconectado"
          ? "border-border-default bg-surface-primary text-text-tertiary"
          : "border-border-default bg-surface-secondary text-text-secondary";
  const etiqueta = estado === "desconectado" ? "Motor no conectado" : estado === "ok" ? "En rango" : estado === "atencion" ? "Advertencia" : estado === "critico" ? "Problema" : "Neutral";
  return (
    <span className={`mt-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-body ${compacto ? "text-[0.68rem]" : "text-xs"} font-semibold ${clase}`}>
      <span className="inline-block size-1.5 rounded-full bg-current" aria-hidden="true" />
      {etiqueta}
    </span>
  );
}

function Ayuda({ texto }: { texto: string }) {
  return (
    <span className="group relative inline-flex">
      <span className="inline-flex size-7 items-center justify-center rounded-full border border-border-default bg-surface-secondary font-body text-xs font-semibold text-text-secondary">?</span>
      <span role="tooltip" className="pointer-events-none absolute right-0 top-9 z-30 hidden w-64 rounded-lg border border-border-default bg-surface-primary p-3 font-body text-xs leading-5 text-text-secondary shadow-[var(--ruum-shadow-3)] group-hover:block group-focus-within:block">
        {texto}
      </span>
    </span>
  );
}

function ModalExportacion({ exportacion, onClose }: { exportacion: ExportacionRealizada; onClose: () => void }) {
  async function copiarHash() {
    await navigator.clipboard?.writeText(exportacion.hash);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 px-4 py-6" role="presentation" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="exportacion-titulo" className="w-full max-w-lg rounded-card border border-border-default bg-surface-primary p-5 shadow-[var(--ruum-shadow-4)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Exportación completada</p>
            <h2 id="exportacion-titulo" className="mt-1 font-display text-xl font-semibold text-ink">{exportacion.recurso} CSV</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-lg border border-border-default text-text-secondary hover:text-ink" aria-label="Cerrar modal">
            ×
          </button>
        </div>
        <dl className="mt-4 grid gap-3 rounded-lg border border-border-default bg-surface-secondary p-4">
          <DatoModal etiqueta="Fecha / hora" valor={new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(exportacion.fecha))} />
          <DatoModal etiqueta="Rango de datos" valor={exportacion.rango} />
          <DatoModal etiqueta="Trace ID" valor={exportacion.traceId} />
          <div>
            <dt className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Huella SHA-256</dt>
            <dd className="mt-1 break-all font-mono-ruum text-xs text-ink">{exportacion.hash}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => void copiarHash()} className="rounded-lg border border-status-info/35 px-4 py-2 font-body text-sm font-semibold text-status-info hover:bg-status-info-soft">
            Copiar SHA-256
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-signal bg-signal px-4 py-2 font-body text-sm font-semibold text-ink hover:bg-signal/90">
            Entendido
          </button>
        </div>
      </section>
    </div>
  );
}

function DatoModal({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">{etiqueta}</dt>
      <dd className="mt-1 font-body text-sm font-semibold text-ink">{valor}</dd>
    </div>
  );
}

function etiquetaRango(periodo: PeriodoReporte) {
  if (periodo === "hoy") return "Hoy";
  if (periodo === "semana") return "Semana actual";
  if (periodo === "mes") return "Mes actual";
  return "Rango personalizado";
}

function nombreArchivoPagos() {
  return `pagos-${new Date().toISOString().slice(0, 10)}.csv`;
}

function descargarArchivo(contenido: string, nombre: string, tipo: string) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
