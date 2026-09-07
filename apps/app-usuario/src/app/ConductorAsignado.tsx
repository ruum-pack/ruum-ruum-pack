"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Aviso } from "@ruum/ui";
import { crearLlamadaEnmascarada } from "@ruum/api/services";
import { chatDisponible } from "@ruum/shared/rules";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

interface ConductorAsignadoProps {
  trasladoId: string;
  estado: EstadoTraslado;
  nombre: string;
  fotoUrl: string | null;
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte.charAt(0).toUpperCase()).join("") || "CO";
}

function IconoChat() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H12l-4.5 3v-3A2.5 2.5 0 0 1 5 12.5v-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 8.5h7M8.5 11.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconoTelefono() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7.2 4.5 9.5 4a1.3 1.3 0 0 1 1.5.8l1.1 3a1.3 1.3 0 0 1-.4 1.4l-1.5 1.2a12.7 12.7 0 0 0 4.4 4.4l1.2-1.5a1.3 1.3 0 0 1 1.4-.4l3 1.1a1.3 1.3 0 0 1 .8 1.5l-.5 2.3a1.8 1.8 0 0 1-2 1.4A16.4 16.4 0 0 1 4.8 6.5a1.8 1.8 0 0 1 1.4-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ConductorAsignado({ trasladoId, estado, nombre, fotoUrl }: ConductorAsignadoProps) {
  const [llamando, setLlamando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disponible = chatDisponible(estado);

  async function manejarLlamada() {
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado. No se puede iniciar la llamada.");
      return;
    }

    setLlamando(true);
    setError(null);

    try {
      const numero = await crearLlamadaEnmascarada(crearClienteNavegador(), trasladoId);
      window.location.href = `tel:${numero}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos iniciar la llamada.");
    } finally {
      setLlamando(false);
    }
  }

  return (
    <section id="assignedDriverCommunication" aria-label="Conductor asignado" className="user-v2-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--user-color-brand-soft)] font-display text-sm font-extrabold text-[var(--user-color-brand-dark)]" aria-hidden={fotoUrl ? undefined : true}>
          {fotoUrl ? (
            <Image src={fotoUrl} alt={`Foto de ${nombre}`} width={56} height={56} className="size-14 object-cover" unoptimized />
          ) : (
            <span>{iniciales(nombre)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="user-v2-caption user-v2-muted">Conductor asignado</p>
          <h2 id="conductor-asignado" className="user-v2-card-title truncate">{nombre}</h2>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href={`/traslados/${trasladoId}#chat-conductor`}
          className="user-v2-secondary-button inline-flex min-h-11 items-center justify-center gap-2 px-3"
          aria-label={`Abrir chat con ${nombre}`}
        >
          <IconoChat />
          <span>Chat</span>
        </Link>
        <button
          type="button"
          onClick={manejarLlamada}
          disabled={!disponible || llamando}
          className="user-v2-secondary-button inline-flex min-h-11 items-center justify-center gap-2 px-3 disabled:cursor-not-allowed disabled:opacity-55"
          aria-label={`Llamar a ${nombre}`}
        >
          <IconoTelefono />
          <span>{llamando ? "Conectando…" : "Llamar"}</span>
        </button>
      </div>

      {error && <div className="mt-3"><Aviso tono="danger">{error}</Aviso></div>}
    </section>
  );
}
