"use client";

"use client";
import { useEffect, useRef } from "react";
import { Button } from "@ruum/ui";

interface ConfirmarDisponibilidadProps {
  abierto: boolean;
  persistiendo: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}

export function ConfirmarDisponibilidad({
  abierto,
  persistiendo,
  onCancelar,
  onConfirmar
}: ConfirmarDisponibilidadProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (abierto && !dialog.open) {
      dialog.showModal();
    }
    if (!abierto && dialog.open) {
      dialog.close();
    }
  }, [abierto]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirmar-disponibilidad-titulo"
      className="w-[min(92vw,420px)] rounded-2xl border border-ink/10 bg-mist p-0 text-ink shadow-[0_24px_80px_rgba(26,31,46,0.28)] backdrop:bg-ink/45"
      onCancel={(evento) => {
        evento.preventDefault();
        if (!persistiendo) onCancelar();
      }}
    >
      <div className="p-5">
        <h2 id="confirmar-disponibilidad-titulo" className="font-display text-xl font-semibold">
          ¿Pasas a no disponible?
        </h2>
        <p className="mt-3 font-body text-sm leading-6 text-ink/65">
          Dejarás de recibir viajes nuevos hasta que reactives tu disponibilidad.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secundario" onClick={onCancelar} disabled={persistiendo}>
            Cancelar
          </Button>
          <Button type="button" variant="primario" onClick={onConfirmar} loading={persistiendo}>
            Confirmar
          </Button>
        </div>
      </div>
    </dialog>
  );
}
