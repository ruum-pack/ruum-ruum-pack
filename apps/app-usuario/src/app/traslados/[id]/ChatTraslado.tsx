"use client";

import { useEffect, useRef } from "react";
import { Chat, Button, Aviso } from "@ruum/ui";
import { MENSAJES_CLAVE_UX, TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { chatDisponible } from "@ruum/shared/rules";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { obtenerMensajes, enviarMensaje, suscribirseAMensajes, crearLlamadaEnmascarada } from "@ruum/api/services";
import { useTrasladoRealtime } from "../../../state/AppStateProvider";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export function ChatTraslado({ trasladoId, estado }: { trasladoId: string; estado: EstadoTraslado }) {
  const clienteRef = useRef<ReturnType<typeof crearClienteNavegador> | null>(null);
  const { mensajes, errorChat, llamando, errorLlamada, inicializar, actualizar, cargarMensajes, agregarMensaje } = useTrasladoRealtime(trasladoId);

  const disponible = chatDisponible(estado);

  useEffect(() => {
    inicializar();
    if (!disponible) {
      actualizar({ errorChat: null });
      return;
    }

    if (!tieneSupabaseConfigurado()) {
      actualizar({ errorChat: "Supabase no está configurado. El chat no está disponible." });
      return;
    }

    const cliente = crearClienteNavegador();
    clienteRef.current = cliente;
    actualizar({ errorChat: null });
    let cancelado = false;

    obtenerMensajes(cliente, trasladoId)
      .then((cargados) => {
        if (!cancelado) cargarMensajes(cargados);
      })
      .catch(() => {
        if (!cancelado) {
          cargarMensajes([]);
          actualizar({ errorChat: "No pudimos cargar los mensajes del traslado." });
        }
      });

    const canal = suscribirseAMensajes(cliente, trasladoId, (nuevo) => {
      if (!cancelado) agregarMensaje(nuevo);
    });

    return () => {
      cancelado = true;
      cliente.removeChannel(canal);
    };
  }, [actualizar, agregarMensaje, cargarMensajes, disponible, inicializar, trasladoId]);

  async function manejarEnvio(contenido: string) {
    if (!tieneSupabaseConfigurado()) {
      actualizar({ errorChat: "Supabase no está configurado. No se puede enviar el mensaje." });
      return;
    }
    if (!clienteRef.current) return;
    await enviarMensaje(clienteRef.current, trasladoId, contenido);
  }

  async function manejarLlamada() {
    actualizar({ llamando: true, errorLlamada: null });

    if (!tieneSupabaseConfigurado()) {
      actualizar({ errorLlamada: "Supabase no está configurado. No se puede iniciar la llamada.", llamando: false });
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      const numero = await crearLlamadaEnmascarada(cliente, trasladoId);
      window.location.href = `tel:${numero}`;
    } catch (err) {
      actualizar({ errorLlamada: err instanceof Error ? err.message : "No pudimos iniciar la llamada." });
    } finally {
      actualizar({ llamando: false });
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-body text-xs uppercase tracking-wide text-ink/45">Chat con el conductor</p>
        {disponible && (
          <Button variant="secondary" onClick={manejarLlamada} disabled={llamando}>
            {llamando ? TEXTOS_CARGANDO.conectando : "Llamar"}
          </Button>
        )}
      </div>
      {errorLlamada && (
        <div className="mb-2">
          <Aviso tono="danger">{errorLlamada}</Aviso>
        </div>
      )}
      {errorChat && (
        <div className="mb-2">
          <Aviso tono="danger">{errorChat}</Aviso>
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
