"use client";

import { useState, useTransition } from "react";
import { Button } from "@ruum/ui";
import { abrirDisputa } from "@ruum/api/services";
import { ETIQUETA_TIPO_DISPUTA, GLOSARIO_OPERATIVO, MENSAJES_CLAVE_UX, TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";

type TipoDisputa = Database["public"]["Enums"]["tipo_disputa"];

const TIPOS: TipoDisputa[] = [
  "cobro_incorrecto",
  "cancelacion_fuera_de_politica",
  "dano_no_reconocido",
  "no_presentacion",
  "calificacion_injusta"
];

export function AbrirDisputaConductor({
  trasladoId,
  disponible
}: {
  trasladoId: string;
  disponible: boolean;
}) {
  const [tipo, setTipo] = useState<TipoDisputa>("calificacion_injusta");
  const [descripcion, setDescripcion] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);
  const [pendiente, startTransition] = useTransition();

  if (!disponible || enviada) return null;

  function enviar() {
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await abrirDisputa(cliente, trasladoId, tipo, descripcion);
        setEnviada(true);
        setMensaje("Revisión solicitada a operación.");
      } catch (error) {
        setMensaje(traducirErrorOperativo(error, "No se pudo solicitar la revisión."));
      }
    });
  }

  return (
    <div className="mt-5 rounded-lg border border-warning bg-warn-soft px-4 py-4">
      <p className="font-body text-sm font-semibold">{GLOSARIO_OPERATIVO.disputa}</p>
      <p className="mt-1 font-body text-sm text-text-secondary">{MENSAJES_CLAVE_UX.disputa}</p>
      <div className="mt-3 grid gap-3">
        <select
          value={tipo}
          onChange={(evento) => setTipo(evento.target.value as TipoDisputa)}
          className="rounded-lg border border-border-strong bg-surface px-3 py-2 font-body text-base"
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
          className="min-h-24 rounded-lg border border-border-strong bg-surface px-3 py-2 font-body text-base"
          placeholder="Describe qué debe revisar operación"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="secondary" onClick={enviar} disabled={pendiente}>
          {pendiente ? TEXTOS_CARGANDO.enviando : "Solicitar revisión"}
        </Button>
        <div role="status" aria-live="polite" aria-atomic="true" className="min-h-[20px]">
          {mensaje && <span className="font-body text-sm text-text-secondary">{mensaje}</span>}
        </div>
      </div>
    </div>
  );
}
