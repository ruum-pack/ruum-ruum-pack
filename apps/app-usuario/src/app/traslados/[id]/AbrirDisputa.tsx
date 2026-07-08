"use client";

import { useState, useTransition } from "react";
import { Button } from "@ruum/ui";
import { abrirDisputa } from "@ruum/api/services";
import { ETIQUETA_TIPO_DISPUTA, MENSAJES_CLAVE_UX, TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";

type TipoDisputa = Database["public"]["Enums"]["tipo_disputa"];

const TIPOS: TipoDisputa[] = [
  "cobro_incorrecto",
  "cancelacion_fuera_de_politica",
  "dano_no_reconocido",
  "no_presentacion",
  "calificacion_injusta"
];

export function AbrirDisputa({
  trasladoId,
  disponible
}: {
  trasladoId: string;
  disponible: boolean;
}) {
  const [tipo, setTipo] = useState<TipoDisputa>("cobro_incorrecto");
  const [descripcion, setDescripcion] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);
  const [pendiente, startTransition] = useTransition();

  if (!disponible || enviada) return null;

  function enviar() {
    setMensaje(null);
    startTransition(async () => {
      try {
        if (!tieneSupabaseConfigurado()) {
          setMensaje("Supabase no está configurado. No se puede abrir la disputa.");
          return;
        }
        const cliente = crearClienteNavegador();
        await abrirDisputa(cliente, trasladoId, tipo, descripcion);
        setEnviada(true);
        setMensaje("Disputa abierta. El equipo de operación la revisará dentro del SLA.");
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo abrir la disputa.");
      }
    });
  }

  return (
    <div className="mt-5 rounded-lg border border-warn/25 bg-warn-soft/35 px-4 py-4">
      <p className="font-body text-sm font-semibold">Abrir disputa</p>
      <p className="mt-1 font-body text-sm text-ink/65">{MENSAJES_CLAVE_UX.disputa}</p>
      <div className="mt-3 grid gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-body text-xs font-medium text-ink/70">Motivo de la disputa</span>
          <select
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value as TipoDisputa)}
            className="rounded-lg border border-ink/50 bg-mist px-3 py-2 font-body text-sm"
            aria-label="Motivo de la disputa"
          >
            {TIPOS.map((valor) => (
              <option key={valor} value={valor}>
                {ETIQUETA_TIPO_DISPUTA[valor]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-body text-xs font-medium text-ink/70">
            Descripción <span className="text-ink/40 text-[11px]">(mín. 20 caracteres)</span>
          </span>
          <textarea
            value={descripcion}
            onChange={(evento) => setDescripcion(evento.target.value)}
            className="min-h-24 rounded-lg border border-ink/50 bg-mist px-3 py-2 font-body text-sm"
            placeholder="Describe qué debe revisar Ruum Ruum"
            maxLength={2000}
            aria-label="Descripción de la disputa"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="secundario" onClick={enviar} disabled={pendiente}>
          {pendiente ? TEXTOS_CARGANDO.enviando : "Enviar disputa"}
        </Button>
        <div role="status" aria-live="polite" aria-atomic="true" className="min-h-[20px]">
        {mensaje && <span className="font-body text-sm text-ink/60">{mensaje}</span>}
      </div>
      </div>
    </div>
  );
}
