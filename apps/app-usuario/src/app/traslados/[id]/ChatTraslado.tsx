"use client";

"use client";
import { useEffect, useRef, useState } from "react";
import { Chat, type MensajeChat, Button, Aviso } from "@ruum/ui";
import { MENSAJES_CLAVE_UX, TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { chatDisponible } from "@ruum/shared/rules";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { obtenerMensajes, enviarMensaje, suscribirseAMensajes, crearLlamadaEnmascarada } from "@ruum/api/services";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export function ChatTraslado({ trasladoId, estado }: { trasladoId: string; estado: EstadoTraslado }) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const clienteRef = useRef<ReturnType<typeof crearClienteNavegador> | null>(null);
  const [errorChat, setErrorChat] = useState<string | null>(null);

  const disponible = chatDisponible(estado);

  useEffect(() => {
    if (!disponible) return;

    if (!tieneSupabaseConfigurado()) {
      const timer = setTimeout(() => setErrorChat("Supabase no está configurado. El chat no está disponible."), 0);
      return () => clearTimeout(timer);
    }

    const cliente = crearClienteNavegador();
    clienteRef.current = cliente;
    const limpiarError = setTimeout(() => setErrorChat(null), 0);

    obtenerMensajes(cliente, trasladoId)
      .then(setMensajes)
      .catch(() => {
        setMensajes([]);
        setErrorChat("No pudimos cargar los mensajes del traslado.");
      });

    const canal = suscribirseAMensajes(cliente, trasladoId, (nuevo) => {
      setMensajes((prev) => (prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]));
    });

    return () => {
      clearTimeout(limpiarError);
      cliente.removeChannel(canal);
    };
  }, [trasladoId, disponible]);

  async function manejarEnvio(contenido: string) {
    if (!tieneSupabaseConfigurado()) {
      setErrorChat("Supabase no está configurado. No se puede enviar el mensaje.");
      return;
    }
    if (!clienteRef.current) return;
    await enviarMensaje(clienteRef.current, trasladoId, contenido);
  }

  const [llamando, setLlamando] = useState(false);
  const [errorLlamada, setErrorLlamada] = useState<string | null>(null);

  async function manejarLlamada() {
    setLlamando(true);
    setErrorLlamada(null);

    if (!tieneSupabaseConfigurado()) {
      setErrorLlamada("Supabase no está configurado. No se puede iniciar la llamada.");
      setLlamando(false);
      return;
    }

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

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-body text-xs uppercase tracking-wide text-ink/45">Chat con el conductor</p>
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
      {disponible && (
        <div className="mb-2">
          <Aviso tono="info">{MENSAJES_CLAVE_UX.comunicacion}</Aviso>
        </div>
      )}
      <Chat
        propio="usuario"
        mensajes={mensajes}
        onEnviar={manejarEnvio}
        deshabilitado={!disponible}
        mensajeDeshabilitado="El chat se cerró junto con el traslado"
      />
    </div>
  );
}