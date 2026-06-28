"use client";

import { useEffect, useRef, useState } from "react";
import { Chat, type MensajeChat } from "@ruum/ui";
import { chatDisponible } from "@ruum/shared/rules";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { obtenerMensajes, enviarMensaje, suscribirseAMensajes } from "@ruum/api/services";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

const MENSAJES_DEMO: MensajeChat[] = [
  { id: "demo-1", remitente: "usuario", contenido: "Hola, ¿cómo va el traslado?", enviado_en: new Date(Date.now() - 1000 * 60 * 8).toISOString() },
  { id: "demo-2", remitente: "conductor", contenido: "Todo bien, voy en camino al punto de recolección.", enviado_en: new Date(Date.now() - 1000 * 60 * 6).toISOString() }
];

export function ChatTraslado({ trasladoId, estado }: { trasladoId: string; estado: EstadoTraslado }) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const clienteRef = useRef<ReturnType<typeof crearClienteNavegador> | null>(null);

  const disponible = chatDisponible(estado);

  useEffect(() => {
    if (!disponible) return;

    if (!tieneSupabaseConfigurado() || trasladoId === "demo-0001") {
      setMensajes(MENSAJES_DEMO);
      setEsDemo(true);
      return;
    }

    const cliente = crearClienteNavegador();
    clienteRef.current = cliente;
    setEsDemo(false);

    obtenerMensajes(cliente, trasladoId)
      .then(setMensajes)
      .catch(() => {
        setMensajes(MENSAJES_DEMO);
        setEsDemo(true);
      });

    const canal = suscribirseAMensajes(cliente, trasladoId, (nuevo) => {
      setMensajes((prev) => (prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]));
    });

    return () => {
      cliente.removeChannel(canal);
    };
  }, [trasladoId, disponible]);

  async function manejarEnvio(contenido: string) {
    if (esDemo) {
      setMensajes((prev) => [
        ...prev,
        { id: `demo-${Date.now()}`, remitente: "usuario", contenido, enviado_en: new Date().toISOString() }
      ]);
      return;
    }
    if (!clienteRef.current) return;
    await enviarMensaje(clienteRef.current, trasladoId, "usuario", contenido);
  }

  return (
    <div className="mt-6">
      <p className="mb-2 font-body text-xs uppercase tracking-wide text-ink/45">Chat con el conductor</p>
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
