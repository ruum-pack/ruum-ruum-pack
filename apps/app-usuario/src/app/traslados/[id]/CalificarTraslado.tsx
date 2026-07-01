"use client";

import { useState, useTransition } from "react";
import { Button } from "@ruum/ui";
import { MENSAJES_CLAVE_UX } from "@ruum/shared/constants";
import { crearCalificacion } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";

export function CalificarTraslado({
  trasladoId,
  conductorId,
  mostrar
}: {
  trasladoId: string;
  conductorId: string | null;
  mostrar: boolean;
}) {
  const [estrellas, setEstrellas] = useState(5);
  const [comentario, setComentario] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [pendiente, startTransition] = useTransition();

  if (!mostrar || !conductorId || enviado) return null;

  function enviar() {
    setMensaje(null);
    startTransition(async () => {
      try {
        if (!tieneSupabaseConfigurado()) {
          setMensaje("Supabase no está configurado. No se puede registrar la calificación.");
          return;
        }
        const cliente = crearClienteNavegador();
        await crearCalificacion(cliente, trasladoId, conductorId!, estrellas, comentario);
        setEnviado(true);
        setMensaje("Calificación registrada. Gracias por ayudarnos a mantener la calidad.");
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo registrar la calificación.");
      }
    });
  }

  return (
    <div className="mt-6 rounded-lg border border-signal/20 bg-signal-soft/35 px-4 py-4">
      <p className="font-body text-sm font-semibold">{MENSAJES_CLAVE_UX.calificacion}</p>
      <div className="mt-3 flex gap-1" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map((valor) => (
          <button
            key={valor}
            type="button"
            onClick={() => setEstrellas(valor)}
            className={valor <= estrellas ? "text-2xl leading-none text-signal" : "text-2xl leading-none text-ink/25"}
            aria-label={`${valor} estrellas`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comentario}
        onChange={(evento) => setComentario(evento.target.value)}
        className="mt-3 min-h-24 w-full rounded-lg border border-ink/50 bg-mist px-3 py-2 font-body text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route"
        placeholder="Comentario opcional"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={enviar} disabled={pendiente}>
          {pendiente ? "Enviando..." : "Enviar calificación"}
        </Button>
        {mensaje && <span className="font-body text-sm text-ink/60">{mensaje}</span>}
      </div>
    </div>
  );
}
