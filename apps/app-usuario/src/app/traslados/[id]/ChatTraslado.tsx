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
  const mensajesRef = useRef(mensajes);
  useEffect(() => { mensajesRef.current = mensajes; }, [mensajes]);

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

    const canal = suscribirseAMensajes(
      cliente,
      trasladoId,
      (nuevo) => {
        if (!cancelado) agregarMensaje(nuevo);
      },
      {
        onError: (err) => {
          if (!cancelado) {
            actualizar({ errorChat: "Se interrumpió la conexión en tiempo real del chat." });
            console.warn("[ChatTraslado] error en suscripción realtime", err);
          }
        }
      }
    );

    return () => {
      cancelado = true;
      try {
        void cliente.removeChannel(canal);
      } catch {
        // Ignorar fallos de cleanup si ya estaba cerrado
      }
    };
  }, [actualizar, agregarMensaje, cargarMensajes, disponible, inicializar, trasladoId]);

  // C-06: dedupe optimista cuando llega el real por Realtime (mismo contenido en ventana 10s)
  useEffect(() => {
    const pendientes = mensajes.filter((m) => (m as { pendiente?: boolean }).pendiente);
    if (pendientes.length === 0) return;
    const noPendientes = mensajes.filter((m) => !(m as { pendiente?: boolean }).pendiente);
    for (const p of pendientes) {
      const duplicado = noPendientes.find(
        (r) => r.contenido === p.contenido && Math.abs(Date.parse(r.enviado_en) - Date.parse(p.enviado_en)) < 10000
      );
      if (duplicado) {
        actualizar({ mensajes: mensajes.filter((m) => m.id !== p.id) });
        break;
      }
    }
  }, [mensajes, actualizar]);

  async function manejarEnvio(contenido: string) {
    if (!tieneSupabaseConfigurado()) {
      actualizar({ errorChat: "Supabase no está configurado. No se puede enviar el mensaje." });
      return;
    }
    if (!clienteRef.current) return;
    const texto = contenido.trim();
    if (!texto) return;
    // C-06: optimistic UI — mostrar mensaje inmediato antes de Realtime
    const idTemp = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const mensajeOptimista = {
      id: idTemp,
      remitente: "usuario" as const,
      contenido: texto,
      enviado_en: new Date().toISOString(),
      pendiente: true,
    };
    agregarMensaje(mensajeOptimista);
    actualizar({ errorChat: null });
    try {
      await enviarMensaje(clienteRef.current, trasladoId, texto);
      // Éxito: quitar opacidad pendiente en ~800ms si Realtime no dedupeó aún
      setTimeout(() => {
        const actual = mensajesRef.current;
        const idx = actual.findIndex((m) => m.id === idTemp);
        if (idx >= 0) {
          const sinPendiente = actual.map((m) => (m.id === idTemp ? { ...m, pendiente: false } : m));
          actualizar({ mensajes: sinPendiente });
          // Limpieza final si ya llegó el real duplicado (el efecto dedupe lo quitará)
          setTimeout(() => {
            const cur = mensajesRef.current;
            if (cur.some((m) => m.id === idTemp)) {
              actualizar({ mensajes: cur.filter((m) => m.id !== idTemp) });
            }
          }, 2500);
        }
      }, 800);
    } catch (err) {
      actualizar({
        mensajes: mensajesRef.current.filter((m) => m.id !== idTemp),
        errorChat: err instanceof Error ? err.message : "No pudimos enviar el mensaje. Intenta de nuevo.",
      });
    }
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
