import Link from "next/link";

export function TripsHeader() {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Link href="/panel" className="font-body text-sm text-text-secondary underline-offset-4 hover:underline">
          Panel
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold">Traslados</h1>
        <p className="mt-2 font-body text-sm text-text-secondary">
          Centro operativo para aceptar viajes, consultar procesos activos y planear tu semana.
        </p>
      </div>
    </header>
  );
}
