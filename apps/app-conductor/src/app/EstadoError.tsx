import Link from "next/link";
import { Button, type ButtonVariant } from "@ruum/ui";

interface AccionError {
  etiqueta: string;
  href?: string;
  onClick?: () => void;
  variant?: ButtonVariant;
}

interface EstadoErrorProps {
  codigo?: string;
  titulo: string;
  descripcion: string;
  acciones: AccionError[];
  detalle?: string;
}

export function EstadoError({ codigo, titulo, descripcion, acciones, detalle }: EstadoErrorProps) {
  return (
    <div className="conductor-page">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border border-danger-action bg-danger-soft text-danger-action">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
        </div>
        {codigo && <p className="mt-5 font-mono-ruum text-xs font-medium uppercase tracking-widest text-text-disabled">{codigo}</p>}
        <h1 className="mt-4 font-display text-2xl font-semibold leading-tight">{titulo}</h1>
        <p className="mt-3 font-body text-sm leading-6 text-text-secondary">{descripcion}</p>
        {detalle && <p className="mt-4 max-w-full break-words font-body text-sm text-danger-action">{detalle}</p>}
        <div className="mt-8 grid w-full gap-3">
          {acciones.map((accion) =>
            accion.href ? (
              <Link key={accion.etiqueta} href={accion.href} className="w-full">
                <Button variant={accion.variant ?? "primary"} className="w-full">
                  {accion.etiqueta}
                </Button>
              </Link>
            ) : (
              <Button key={accion.etiqueta} variant={accion.variant ?? "primary"} onClick={accion.onClick} className="w-full">
                {accion.etiqueta}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
