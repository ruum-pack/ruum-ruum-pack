import Link from "next/link";

export default function SinPermisoPage() {
  return (
    <main className="admin-page-shell">
      <section className="mx-auto max-w-lg rounded-card border border-border-default bg-surface-primary/90 px-6 py-10 text-center shadow-[var(--ruum-shadow-1)] sm:px-8">
        <p className="font-mono-ruum text-admin-secundario uppercase tracking-[0.16em] text-signal">
          Acceso restringido
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
          No tienes permiso para abrir esta sección
        </h1>
        <p className="mt-3 font-body text-sm leading-6 text-text-secondary">
          Tu sesión es válida, pero el rol administrativo asignado no incluye esta operación.
          Si necesitas acceso, contacta a un supervisor o a dirección.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-signal px-4 py-2.5 font-body text-admin-boton font-semibold text-ink shadow-sm transition-colors hover:bg-signal/90"
          >
            Volver al dashboard
          </Link>
          <Link
            href="/viajes"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/20 bg-surface-primary px-4 py-2.5 font-body text-admin-boton font-semibold text-text-secondary transition-colors hover:border-signal/50 hover:text-ink"
          >
            Ver traslados
          </Link>
        </div>
      </section>
    </main>
  );
}
