"use client";

"use client";
import { useEffect, useRef, useState } from "react";
import { Chat, type MensajeChat, Button, Aviso } from "@ruum/ui";
import { MENSAJES_CLAVE_UX, TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { chatDisponible } from "@ruum/shared/rules";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { obtenerMensajes, enviarMensaje, suscribirseAMensajes, crearLlamadaEnmascarada } from "@ruum/api/services";

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
    if (!disponible) return;

    let cliente: ReturnType<typeof crearClienteNavegador>;
    try {
      cliente = crearClienteNavegador();
    } catch (err) {
      const timer = setTimeout(() => {
        setMensajes([]);
        setErrorChat(err instanceof Error ? err.message : "No pudimos inicializar el chat.");
      }, 0);
      return () => clearTimeout(timer);
    }
    clienteRef.current = cliente;
    setErrorChat(null);

    obtenerMensajes(cliente, trasladoId)
      .then(setMensajes)
      .catch((err) => {
        setMensajes([]);
        setErrorChat(err instanceof Error ? err.message : "No pudimos cargar el chat.");
      });

    const canal = suscribirseAMensajes(cliente, trasladoId, (nuevo) => {
      setMensajes((prev) => (prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]));
    });

    return () => {
      cliente.removeChannel(canal);
    };
  }, [trasladoId, disponible]);

  async function manejarEnvio(contenido: string) {
    if (!clienteRef.current) return;
    await enviarMensaje(clienteRef.current, trasladoId, contenido);
    // No hace falta actualizar el estado local aquí: la suscripción de
    // Realtime ya lo va a recibir, igual que le llegaría al usuario.
  }

  const [llamando, setLlamando] = useState(false);
  const [errorLlamada, setErrorLlamada] = useState<string | null>(null);

  async function manejarLlamada() {
    setLlamando(true);
    setErrorLlamada(null);

    try {
      const cliente = crearClienteNavegador();
      const numero = await crearLlamadaEnmascarada(cliente, trasladoId);
      window.location.href = `tel:${numero}`;
    } catch (err) {
      setErrorLlamada(err instanceof Error ? err.message : "No pudimos iniciar la llamada.");
    } finally {
      setLlamando(false);
    }
  }

  function confirmarAvisoVisto() {
    if (guardarAvisoVisto(trasladoId)) {
      setAvisoVisto(true);
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Chat con el usuario</p>
          {disponible && avisoVisto && (
            <div className="relative">
              <button
                type="button"
                aria-label="Ver aviso de comunicación"
                aria-expanded={popoverAvisoAbierto}
                onClick={() => setPopoverAvisoAbierto((abierto) => !abierto)}
                className="flex size-8 items-center justify-center rounded-full border border-route/20 bg-route-soft font-body text-sm font-semibold text-route-dark transition hover:border-route-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-dark"
              >
                ⓘ
              </button>
              {popoverAvisoAbierto && (
                <div
                  role="dialog"
                  aria-label="Aviso de comunicación"
                  className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-route/20 bg-mist p-3 font-body text-sm leading-5 text-route-dark shadow-[0_14px_40px_rgba(26,31,46,0.16)]"
                >
                  {MENSAJES_CLAVE_UX.comunicacion}
                </div>
              )}
            </div>
          )}
        </div>
        {disponible && (
          <Button variant="secundario" onClick={manejarLlamada} disabled={llamando}>
            {llamando ? TEXTOS_CARGANDO.conectando : "Llamar"}
          </Button>
        )}
      </div>
      {errorLlamada && (
        <div className="mb-2">
          <Aviso tono="peligro">{errorLlamada}</Aviso>
        </div>
      )}
      {errorChat && (
        <div className="mb-2">
          <Aviso tono="peligro">{errorChat}</Aviso>
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
                className="self-start rounded-lg border border-route/30 bg-mist px-3 py-2 font-body text-sm font-semibold text-route-dark transition hover:border-route-dark hover:bg-route-soft sm:self-auto"
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
  );
}