"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "./Button";

export interface MensajeChat {
  id: string;
  remitente: "usuario" | "conductor";
  contenido: string;
  enviado_en: string;
  pendiente?: boolean;
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
  const listaRef = useRef<HTMLDivElement>(null);
  const ultimoIdRef = useRef<string | null>(null);

  // C-06: auto-scroll al último mensaje y anuncio aria-live
  useEffect(() => {
    if (mensajes.length === 0) return;
    const ultimo = mensajes[mensajes.length - 1];
    if (!ultimo || ultimo.id === ultimoIdRef.current) return;
    ultimoIdRef.current = ultimo.id;
    // scroll suave al fondo sin robar foco del input
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes]);

  async function manejarEnvio(e: React.FormEvent) {
    e.preventDefault();
    if (!borrador.trim() || deshabilitado) return;
    const texto = borrador.trim();
    setBorrador("");
    setEnviando(true);
    try {
      await onEnviar(texto);
    } finally {
      setEnviando(false);
      // devolver foco al input para continuar conversando
      (document.querySelector('input[placeholder="Escribe un mensaje"]') as HTMLInputElement | null)?.focus();
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-1">
      <div
        ref={listaRef}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-relevant="additions"
        aria-label="Mensajes del chat"
        className="flex-1 space-y-3 overflow-y-auto p-4"
        style={{ maxHeight: 360, minHeight: 180 }}
      >
        {mensajes.length === 0 ? (
          <p className="font-body text-sm text-text-secondary">Todavía no hay mensajes.</p>
        ) : (
          mensajes.map((m) => {
            const esPropio = m.remitente === propio;
            const pendiente = Boolean((m as { pendiente?: boolean }).pendiente);
            return (
              <div key={m.id} className={`flex ${esPropio ? "justify-end" : "justify-start"}`}>
                <div
                  className={[
                    "max-w-[75%] rounded-xl px-3.5 py-2.5 font-body text-sm leading-5 shadow-[0_1px_1px_rgba(26,31,46,0.06)]",
                    esPropio ? "bg-signal text-text-primary" : "bg-surface-elevated text-text-primary",
                    pendiente ? "opacity-60" : "",
                  ].join(" ")}
                  aria-label={pendiente ? "Mensaje enviando" : undefined}
                >
                  <p>{m.contenido}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                    <span>{new Date(m.enviado_en).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
                    {pendiente && <span aria-hidden="true"> · enviando…</span>}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* live region oculta para anunciar nuevos mensajes a lectores */}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {mensajes.length > 0 ? `Mensaje de ${mensajes[mensajes.length - 1]?.remitente === propio ? "tú" : "conductor"}: ${mensajes[mensajes.length - 1]?.contenido.slice(0, 80)}` : ""}
      </span>

      <form onSubmit={manejarEnvio} className="flex gap-2 border-t border-border bg-surface-elevated p-3">
        <input
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          disabled={deshabilitado}
          aria-disabled={deshabilitado}
          aria-describedby={deshabilitado ? "chat-deshabilitado-ayuda" : undefined}
          placeholder={deshabilitado ? mensajeDeshabilitado ?? "Chat no disponible" : "Escribe un mensaje"}
          className="min-h-11 flex-1 rounded-[10px] border border-border-strong bg-surface px-3 py-2 font-body text-base transition focus:border-route-action focus:outline-none focus:ring-[3px] focus:ring-route-action/20 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-disabled"
        />
        <Button type="submit" disabled={deshabilitado || enviando || !borrador.trim()} aria-label="Enviar mensaje">
          {enviando ? "Enviando…" : "Enviar"}
        </Button>
      </form>
      {deshabilitado && mensajeDeshabilitado && (
        <p id="chat-deshabilitado-ayuda" className="sr-only" role="status" aria-live="polite">
          {mensajeDeshabilitado}
        </p>
      )}
    </div>
  );
}
