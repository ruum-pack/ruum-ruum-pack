"use client";

import { useState } from "react";
import { Button } from "./Button";

export interface MensajeChat {
  id: string;
  remitente: "usuario" | "conductor";
  contenido: string;
  enviado_en: string;
}

export interface ChatProps {
  /** Quién ve esta pantalla — alinea sus propios mensajes a la derecha, igual que cualquier chat. */
  propio: "usuario" | "conductor";
  mensajes: MensajeChat[];
  onEnviar: (contenido: string) => void | Promise<void>;
  deshabilitado?: boolean;
  mensajeDeshabilitado?: string;
}

/**
 * PRD §4.12 — chat dentro de la app, nunca el número real de ninguna de las
 * dos partes. Puramente presentacional: la suscripción en tiempo real y el
 * guardado viven en packages/api/src/services/chat.ts, no aquí.
 */
export function Chat({ propio, mensajes, onEnviar, deshabilitado, mensajeDeshabilitado }: ChatProps) {
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(e: React.FormEvent) {
    e.preventDefault();
    if (!borrador.trim() || deshabilitado) return;
    setEnviando(true);
    await onEnviar(borrador.trim());
    setBorrador("");
    setEnviando(false);
  }

  return (
    <div className="flex flex-col rounded-card border border-ink/10 bg-mist">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: 360, minHeight: 180 }}>
        {mensajes.length === 0 ? (
          <p className="font-body text-sm text-ink/65">Todavía no hay mensajes.</p>
        ) : (
          mensajes.map((m) => {
            const esPropio = m.remitente === propio;
            return (
              <div key={m.id} className={`flex ${esPropio ? "justify-end" : "justify-start"}`}>
                <div
                  className={[
                    "max-w-[75%] rounded-xl px-3.5 py-2 font-body text-sm",
                    esPropio ? "bg-signal text-ink" : "bg-ink/[0.06] text-ink"
                  ].join(" ")}
                >
                  <p>{m.contenido}</p>
                  <p className="mt-1 text-[10px] text-ink">
                    {new Date(m.enviado_en).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={manejarEnvio} className="flex gap-2 border-t border-ink/10 p-3">
        <input
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          disabled={deshabilitado}
          placeholder={deshabilitado ? mensajeDeshabilitado ?? "Chat no disponible" : "Escribe un mensaje"}
          className="flex-1 rounded-lg border border-ink/50 bg-mist px-3 py-2 font-body text-sm disabled:opacity-50"
        />
        <Button type="submit" disabled={deshabilitado || enviando || !borrador.trim()}>
          Enviar
        </Button>
      </form>
    </div>
  );
}
