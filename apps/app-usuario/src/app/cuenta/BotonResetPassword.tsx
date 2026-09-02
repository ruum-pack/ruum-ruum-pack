"use client";

import { useState } from "react";
import { Button, Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { traducirErrorAuth } from "@ruum/shared/utils";
import { solicitarRestablecimientoPasswordUsuario } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

export function BotonResetPassword() {
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [emailEnviado, setEmailEnviado] = useState<string>("");

  async function enviarReset() {
    setEstado("enviando");
    setError(null);

    try {
      if (!tieneSupabaseConfigurado()) throw new Error("Supabase no está configurado.");
      const cliente = crearClienteNavegador();

      // La recuperación desde cuenta obtiene el email estrictamente de auth.getUser().user.email
      const { email } = await solicitarRestablecimientoPasswordUsuario(
        cliente,
        `${window.location.origin}/auth/callback?type=recovery&next=/nueva-password`
      );

      setEmailEnviado(email);
      setEstado("enviado");
    } catch (err) {
      setEstado("error");
      setError(traducirErrorAuth(err, "No pudimos enviar el correo de recuperación. Intenta de nuevo."));
    }
  }

  return (
    <div className="grid gap-3">
      {estado === "enviado" ? (
        <div role="status" aria-live="polite" aria-atomic="true">
          <Aviso tono="info">
            Correo enviado a <strong>{emailEnviado}</strong>. Revisa tu bandeja de entrada, incluyendo spam. El enlace expira en 60 minutos.
          </Aviso>
        </div>
      ) : (
        <>
          <Button
            variant="secondary"
            onClick={enviarReset}
            disabled={estado === "enviando"}
          >
            {estado === "enviando" ? TEXTOS_CARGANDO.enviando : "Enviar correo de cambio"}
          </Button>
          {estado === "error" && error && (
            <div role="status" aria-live="polite" aria-atomic="true">
              <Aviso tono="danger">{error}</Aviso>
            </div>
          )}
        </>
      )}
    </div>
  );
}
