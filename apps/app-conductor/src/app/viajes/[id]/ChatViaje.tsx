"use client";

import { useEffect, useRef, useState } from "react";
import { Chat, type MensajeChat, Aviso } from "@ruum/ui";
import { MENSAJES_CLAVE_UX } from "@ruum/shared/constants";
import { chatDisponible } from "@ruum/shared/rules";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { obtenerMensajes, enviarMensaje, suscribirseAMensajes } from "@ruum/api/services";
import { MENSAJES_RAPIDOS_CONTACTO } from "./quick-messages";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

function claveAvisoChat(trasladoId: string) {
  return `ruum_chat_aviso_${trasladoId}`;
}

function leerAvisoVisto(trasladoId: string) {
  try {
    return window.localStorage.getItem(claveAvisoChat(trasladoId)) === "1";
  } catch {
    return false;
  }
}

function guardarAvisoVisto(trasladoId: string) {
  try {
    window.localStorage.setItem(claveAvisoChat(trasladoId), "1");
    return true;
  } catch {
    return false;
  }
}

export function ChatViaje({ trasladoId, estado }: { trasladoId: string; estado: EstadoTraslado }) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [avisoVisto, setAvisoVisto] = useState(() => leerAvisoVisto(trasladoId));
  const [popoverAvisoAbierto, setPopoverAvisoAbierto] = useState(false);
  const [chatAbierto, setChatAbierto] = useState(false);
  const [enviandoRapido, setEnviandoRapido] = useState<string | null>(null);
  const [errorChat, setErrorChat] = useState<string | null>(null);
  const clienteRef = useRef<ReturnType<typeof crearClienteNavegador> | null>(null);

  const disponible = chatDisponible(estado);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAvisoVisto(leerAvisoVisto(trasladoId));
      setPopoverAvisoAbierto(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [trasladoId]);

  useEffect(() => {
    if (!disponible || !chatAbierto) return;

    let cliente: ReturnType<typeof crearClienteNavegador>;
    try {
      cliente = crearClienteNavegador();
    } catch (err) {
      const timer = setTimeout(() => {
        setMensajes([]);
        setErrorChat(traducirErrorOperativo(err, "No pudimos inicializar el chat."));
      }, 0);
      return () => clearTimeout(timer);
    }
    clienteRef.current = cliente;
    setErrorChat(null);

    obtenerMensajes(cliente, trasladoId)
      .then(setMensajes)
      .catch((err) => {
        setMensajes([]);
        setErrorChat(traducirErrorOperativo(err, "No pudimos cargar el chat."));
      });

    const canal = suscribirseAMensajes(cliente, trasladoId, (nuevo) => {
      setMensajes((prev) => (prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]));
    });

    return () => {
      cliente.removeChannel(canal);
    };
  }, [trasladoId, disponible, chatAbierto]);

  function obtenerClienteChat() {
    if (clienteRef.current) return clienteRef.current;
    const cliente = crearClienteNavegador();
    clienteRef.current = cliente;
    return cliente;
  }

  async function manejarEnvio(contenido: string) {
    const cliente = obtenerClienteChat();
    await enviarMensaje(cliente, trasladoId, contenido);
    // No hace falta actualizar el estado local aquí: la suscripción de
    // Realtime ya lo va a recibir, igual que le llegaría al usuario.
  }

  async function enviarMensajeRapido(contenido: string) {
    setEnviandoRapido(contenido);
    setErrorChat(null);
    try {
      await manejarEnvio(contenido);
    } catch (err) {
      setErrorChat(traducirErrorOperativo(err, "No pudimos enviar el mensaje."));
    } finally {
      setEnviandoRapido(null);
    }
  }

  function confirmarAvisoVisto() {
    if (guardarAvisoVisto(trasladoId)) {
      setAvisoVisto(true);
    }
  }

  return (
    <section id="chat-contacto" className="mt-6 rounded-lg border border-border bg-surface">
      {disponible && (
        <div className="px-4 py-4">
          <p className="font-body text-sm font-semibold text-text-tertiary">Mensajes rápidos</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MENSAJES_RAPIDOS_CONTACTO.map((mensajeRapido) => (
              <button
                key={mensajeRapido}
                type="button"
                onClick={() => void enviarMensajeRapido(mensajeRapido)}
                disabled={enviandoRapido !== null}
                className="min-h-11 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-left font-body text-sm font-semibold text-text-secondary transition hover:border-route-action hover:bg-route-soft hover:text-route-action disabled:cursor-not-allowed disabled:text-disabled"
              >
                {enviandoRapido === mensajeRapido ? "Enviando..." : mensajeRapido}
              </button>
            ))}
          </div>
        </div>
      )}
      <details
        className={["group overflow-hidden", disponible ? "border-t border-border" : ""].join(" ")}
        open={chatAbierto}
        onToggle={(evento) => setChatAbierto(evento.currentTarget.open)}
      >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-signal-soft/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action [&::-webkit-details-marker]:hidden">
        <div>
          <p className="font-body text-sm font-semibold text-text-tertiary">Chat del viaje</p>
          <p className="mt-1 font-body text-sm font-semibold text-text-primary">
            {disponible ? "Abrir conversación completa" : "Conversación cerrada"}
          </p>
        </div>
        <span className="font-display text-lg leading-none text-text-tertiary transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <div className="border-t border-border px-4 pb-4 pt-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {disponible && avisoVisto && (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Ver aviso de comunicación"
                  aria-expanded={popoverAvisoAbierto}
                  onClick={() => setPopoverAvisoAbierto((abierto) => !abierto)}
                  className="flex size-11 items-center justify-center rounded-full border border-route-action bg-route-soft font-body text-sm font-semibold text-route-action transition hover:border-route-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action"
                >
                  i
                </button>
                {popoverAvisoAbierto && (
                  <dialog
                    aria-label="Aviso de comunicación"
                    className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-route-action bg-surface p-3 font-body text-sm leading-5 text-route-action shadow-3"
                  >
                    {MENSAJES_CLAVE_UX.comunicacion}
                  </dialog>
                )}
              </div>
            )}
          </div>
        </div>
        {errorChat && (
          <div className="mb-2">
            <Aviso tono="danger">{errorChat}</Aviso>
          </div>
        )}
        {disponible && !avisoVisto && (
          <div className="mb-2">
            <Aviso tono="info">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{MENSAJES_CLAVE_UX.comunicacion}</span>
                <button
                  type="button"
                  onClick={confirmarAvisoVisto}
                  className="min-h-11 self-start rounded-lg border border-route-action bg-surface px-3 py-2 font-body text-sm font-semibold text-route-action transition hover:border-route-action hover:bg-route-soft sm:self-auto"
                >
                  Entendido
                </button>
              </div>
            </Aviso>
          </div>
        )}
        <Chat
          propio="conductor"
          mensajes={mensajes}
          onEnviar={manejarEnvio}
          deshabilitado={!disponible}
          mensajeDeshabilitado="El chat se cerró junto con el traslado"
        />
      </div>
      </details>
    </section>
  );
}
