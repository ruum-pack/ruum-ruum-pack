"use client";

import { useState } from "react";
import { Button, Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

export function BotonResetPassword({ email }: { email: string }) {
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function enviarReset() {
    if (!email) { setError("No encontramos tu correo. Actualiza tu perfil primero."); return; }
    setEstado("enviando");
    setError(null);

    try {
      if (!tieneSupabaseConfigurado()) throw new Error("Supabase no está configurado.");
      const cliente = crearClienteNavegador();
      const { error: errorAuth } = await cliente.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/nueva-password`,
      });
      if (errorAuth) throw errorAuth;
      setEstado("enviado");
    } catch (err) {
      setEstado("error");
      setError(err instanceof Error ? err.message : "No pudimos enviar el correo. Intenta de nuevo.");
    }
  }

  return (
    <div className="grid gap-3">
      {estado === "enviado" ? (
        <div role="status" aria-live="polite" aria-atomic="true">
          <Aviso tono="info">
            Correo enviado a <strong>{email}</strong>. Revisa tu bandeja, incluyendo spam. El enlace expira en 60 minutos.
          </Aviso>
        </div>
      ) : (
        <>
          <Button
            variant="secundario"
            onClick={enviarReset}
            disabled={estado === "enviando"}
          >
            {estado === "enviando" ? TEXTOS_CARGANDO.enviando : "Enviar correo de cambio"}
          </Button>
          {estado === "error" && error && (
            <div role="status" aria-live="polite" aria-atomic="true">
              <Aviso tono="peligro">{error}</Aviso>
            </div>
          )}
        </>
      )}
    </div>
  );
}
