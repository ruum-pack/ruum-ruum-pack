"use client";

import { useState } from "react";
import { Button, Aviso } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { validarDocumentoUsuario } from "@ruum/api/services";
import { crearClienteNavegador } from "../../lib/supabase-browser";

type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];

interface Props {
  usuario: UsuarioRow;
  onActualizado: () => void;
}

export function AccionesVerificacion({ usuario, onActualizado }: Props) {
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlDocumento, setUrlDocumento] = useState<string | null>(null);

  if (usuario.estado_verificacion === "verificado" || usuario.estado_verificacion === "rechazado") {
    return (
      <p className="mt-2 font-body text-xs text-ink/40">
        Estado final: {usuario.estado_verificacion}. Sin acciones pendientes.
      </p>
    );
  }

  async function verDocumento() {
    if (!usuario.doc_identidad_url) return;
    setProcesando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();
      const { data, error: errUrl } = await cliente.storage
        .from("documentos-identidad")
        .createSignedUrl(usuario.doc_identidad_url, 60 * 30);
      if (errUrl) throw errUrl;
      setUrlDocumento(data.signedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos obtener el documento.");
    } finally {
      setProcesando(false);
    }
  }

  async function cambiarEstado(nuevoEstado: "en_revision" | "verificado" | "rechazado") {
    setProcesando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();
      await validarDocumentoUsuario(cliente, usuario.id, nuevoEstado);
      onActualizado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos actualizar el estado.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {error && <Aviso tono="peligro">{error}</Aviso>}

      {usuario.doc_identidad_url ? (
        urlDocumento ? (
          <a
            href={urlDocumento}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-body text-sm text-route underline-offset-2 hover:underline"
          >
            Abrir identificación (enlace válido 30 min)
          </a>
        ) : (
          <Button variant="fantasma" onClick={verDocumento} disabled={procesando}>
            Ver identificación
          </Button>
        )
      ) : (
        <p className="font-body text-xs text-warn/80">El usuario aún no ha subido su documento de identidad.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {usuario.estado_verificacion === "pendiente" && (
          <Button variant="secundario" onClick={() => cambiarEstado("en_revision")} disabled={procesando}>
            Marcar en revisión
          </Button>
        )}
        <Button onClick={() => cambiarEstado("verificado")} disabled={procesando || !usuario.doc_identidad_url}>
          Aprobar cuenta
        </Button>
        <Button variant="peligro" onClick={() => cambiarEstado("rechazado")} disabled={procesando}>
          Rechazar
        </Button>
      </div>

      {!usuario.doc_identidad_url && (
        <p className="font-body text-xs text-ink/40">
          El botón "Aprobar cuenta" permanece deshabilitado hasta que el usuario suba su identificación.
        </p>
      )}
    </div>
  );
}
