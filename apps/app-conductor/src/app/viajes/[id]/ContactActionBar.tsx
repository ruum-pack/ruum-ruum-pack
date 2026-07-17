"use client";

import { useState } from "react";
import { Aviso, Button } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { crearLlamadaEnmascarada, enviarMensaje } from "@ruum/api/services";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { CONTACTOS_SOPORTE_CONDUCTOR } from "../../../lib/contactos-soporte";

export type ContactRole = "origen" | "destino" | "soporte";

export interface ContactActionBarProps {
  trasladoId: string;
  role: ContactRole;
  name?: string | null;
  phone?: string | null;
}

const QUICK_MESSAGES = ["Ya llegué.", "Estoy a cinco minutos.", "No encuentro el acceso.", "No localizo el vehículo."];

const ROLE_LABEL: Record<ContactRole, string> = {
  origen: "Contacto de entrega",
  destino: "Contacto de recepción",
  soporte: "Soporte Ruum"
};

function supportPhoneLabel() {
  return CONTACTOS_SOPORTE_CONDUCTOR.soporte.telefono.etiqueta.replace(/^Llamar a\s*/i, "");
}

function supportWhatsAppUrl(text: string) {
  const separator = CONTACTOS_SOPORTE_CONDUCTOR.soporte.whatsapp.href.includes("?") ? "&" : "?";
  return `${CONTACTOS_SOPORTE_CONDUCTOR.soporte.whatsapp.href}${separator}text=${encodeURIComponent(text)}`;
}

export function ContactActionBar({ trasladoId, role, name, phone }: ContactActionBarProps) {
  const [busy, setBusy] = useState<"call" | string | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const isSupport = role === "soporte";
  const displayName = isSupport ? "Equipo de soporte" : name ?? "Contacto por confirmar";
  const displayPhone = isSupport ? supportPhoneLabel() : phone;

  async function callContact() {
    setBusy("call");
    setMessage(null);
    try {
      if (isSupport) {
        window.location.href = CONTACTOS_SOPORTE_CONDUCTOR.soporte.telefono.href;
        return;
      }

      const cliente = crearClienteNavegador();
      const numero = await crearLlamadaEnmascarada(cliente, trasladoId);
      window.location.href = `tel:${numero}`;
    } catch (err) {
      setMessage({ tone: "danger", text: err instanceof Error ? err.message : "No pudimos iniciar la llamada." });
    } finally {
      setBusy(null);
    }
  }

  async function sendQuickMessage(text: string) {
    setBusy(text);
    setMessage(null);
    try {
      if (isSupport) {
        window.location.href = supportWhatsAppUrl(text);
        return;
      }

      const cliente = crearClienteNavegador();
      await enviarMensaje(cliente, trasladoId, text);
      setMessage({ tone: "info", text: "Mensaje enviado." });
    } catch (err) {
      setMessage({ tone: "danger", text: err instanceof Error ? err.message : "No pudimos enviar el mensaje." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="contacto" className="mt-4 rounded-xl border border-route-action bg-surface-elevated px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-body text-sm font-semibold text-text-tertiary">{ROLE_LABEL[role]}</p>
          <p className="mt-1 break-words font-display text-lg font-semibold">{displayName}</p>
          {displayPhone && <p className="mt-1 break-words font-body text-sm text-text-secondary">{displayPhone}</p>}
        </div>
        <Button variant="secondary" className="w-full sm:w-auto" onClick={callContact} disabled={busy !== null || (!isSupport && !phone)}>
          {busy === "call" ? TEXTOS_CARGANDO.conectando : "Llamar"}
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {QUICK_MESSAGES.map((quickMessage) => (
          <button
            key={quickMessage}
            type="button"
            onClick={() => void sendQuickMessage(quickMessage)}
            disabled={busy !== null}
            className="min-h-11 rounded-lg border border-border bg-surface px-3 py-2 text-left font-body text-sm font-semibold text-secondary transition hover:border-route-action hover:bg-route-soft disabled:cursor-wait disabled:text-disabled"
          >
            {busy === quickMessage ? TEXTOS_CARGANDO.enviando : quickMessage}
          </button>
        ))}
      </div>

      {message && (
        <div className="mt-3">
          <Aviso tono={message.tone}>{message.text}</Aviso>
        </div>
      )}
    </section>
  );
}
