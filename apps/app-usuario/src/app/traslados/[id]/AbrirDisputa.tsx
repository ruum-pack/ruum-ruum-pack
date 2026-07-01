"use client";

import { useState, useTransition } from "react";
import { Button } from "@ruum/ui";
import { abrirDisputa } from "@ruum/api/services";
import { ETIQUETA_TIPO_DISPUTA } from "@ruum/shared/constants";
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
  disponible,
  esDemo
}: {
  trasladoId: string;
  disponible: boolean;
  esDemo: boolean;
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
        if (esDemo || !tieneSupabaseConfigurado()) {
          setEnviada(true);
          setMensaje("Disputa registrada en modo demo.");
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
      <div className="mt-3 grid gap-3">
        <select
          value={tipo}
          onChange={(evento) => setTipo(evento.target.value as TipoDisputa)}
          className="rounded-lg border border-ink/15 bg-mist px-3 py-2 font-body text-sm"
        >
          {TIPOS.map((valor) => (
            <option key={valor} value={valor}>
              {ETIQUETA_TIPO_DISPUTA[valor]}
            </option>
          ))}
        </select>
        <textarea
          value={descripcion}
          onChange={(evento) => setDescripcion(evento.target.value)}
          className="min-h-24 rounded-lg border border-ink/15 bg-mist px-3 py-2 font-body text-sm"
          placeholder="Describe qué debe revisar Ruum Ruum"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="secundario" onClick={enviar} disabled={pendiente}>
          {pendiente ? "Enviando..." : "Enviar disputa"}
        </Button>
        {mensaje && <span className="font-body text-sm text-ink/60">{mensaje}</span>}
      </div>
    </div>
  );
}
