import Link from "next/link";
import { NavegacionUsuario } from "./NavegacionUsuario";

export default function PaginaNoEncontrada() {
  return (
    <main className="app-page">
      <NavegacionUsuario />
      <div className="app-container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <p className="font-mono-ruum text-xs font-medium uppercase tracking-widest text-ink/35">
          404
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight">
          Esta página no existe
        </h1>
        <p className="mt-3 max-w-sm font-body text-sm leading-6 text-ink/60">
          Revisa que el enlace sea correcto. Si llegaste aquí desde un correo o
          notificación, puede que el contenido ya no esté disponible.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-signal px-5 py-2.5 font-display text-sm font-bold text-ink transition hover:bg-signal/90"
          >
            Ir al inicio
          </Link>
          <Link
            href="/mis-viajes"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/20 bg-mist px-5 py-2.5 font-body text-sm font-medium text-ink transition hover:border-ink/40"
          >
            Mis viajes
          </Link>
        </div>
      </div>
    </main>
  );
}
