import Link from "next/link";

export default function PaginaNoEncontradaAdmin() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-20 text-center">
      <p className="font-mono-ruum text-xs font-medium uppercase tracking-widest text-text-tertiary">
        404
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold leading-tight">
        Página no encontrada
      </h1>
      <p className="mt-3 max-w-sm font-body text-sm leading-6 text-text-secondary">
        La sección que buscas no existe o fue movida. Verifica el enlace o vuelve al dashboard.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-signal px-5 py-2.5 font-display text-sm font-bold text-ink transition hover:bg-signal/90"
        >
          Ir al dashboard
        </Link>
        <Link
          href="/viajes"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/20 bg-surface-primary px-5 py-2.5 font-body text-sm font-medium text-ink transition hover:border-ink/40"
        >
          Ver traslados
        </Link>
      </div>
    </div>
  );
}
