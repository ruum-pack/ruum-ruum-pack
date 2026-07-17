import Link from "next/link";

export function CuentaHeader({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <header className="flex flex-col gap-2">
      <nav aria-label="Breadcrumb" className="font-body text-sm text-text-secondary">
        <Link href="/panel" className="underline-offset-4 hover:underline">Panel</Link>
        <span className="mx-2">/</span>
        <Link href="/cuenta" className="underline-offset-4 hover:underline">Cuenta</Link>
      </nav>
      <h1 className="font-display text-3xl font-semibold">{titulo}</h1>
      <p className="font-body text-sm leading-6 text-text-secondary">{descripcion}</p>
    </header>
  );
}

