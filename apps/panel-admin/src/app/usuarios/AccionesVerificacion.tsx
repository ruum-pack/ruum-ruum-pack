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
  /* Ítem 10 — confirmación inline reemplaza acciones directas sin contexto */
  const [confirmando, setConfirmando] = useState<"aprobar" | "rechazar" | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  if (usuario.estado_verificacion === "verificado" || usuario.estado_verificacion === "rechazado") {
    return (
      <p className="mt-2 font-body text-xs text-ink/40">
        Estado final: {usuario.estado_verificacion === "verificado" ? "Verificado" : "Rechazado"}. Sin acciones pendientes.
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

  async function cambiarEstado(nuevoEstado: "en_revision" | "verificado" | "rechazado", motivo?: string) {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      await validarDocumentoUsuario(cliente, usuario.id, nuevoEstado, motivo);
      setConfirmando(null);
      setMotivoRechazo("");
      onActualizado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos actualizar el estado.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {error && (
        <div role="status" aria-live="polite" aria-atomic="true">
          <Aviso tono="danger">{error}</Aviso>
        </div>
      )}

      {/* Ver documento */}
      {usuario.doc_identidad_url ? (
        urlDocumento ? (
          <a
            href={urlDocumento}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-body text-sm text-route-dark underline-offset-2 hover:underline"
          >
            Abrir identificación (enlace válido 30 min)
          </a>
        ) : (
          <Button variant="quiet" onClick={verDocumento} disabled={procesando}>
            Ver identificación
          </Button>
        )
      ) : (
        <p className="font-body text-xs text-warn/80">El usuario aún no ha subido su documento de identidad.</p>
      )}

      {/* Confirmación inline de Aprobar */}
      {confirmando === "aprobar" ? (
        <div className="rounded-lg border border-ink/15 bg-mist p-3">
          <p className="font-body text-sm font-semibold text-ink">¿Aprobar esta cuenta?</p>
          <p className="mt-1 font-body text-xs text-ink/60">
            El usuario quedará habilitado para solicitar traslados inmediatamente.
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => cambiarEstado("verificado")} disabled={procesando}>
              {procesando ? "Aprobando…" : "Confirmar aprobación"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmando(null)} disabled={procesando}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : confirmando === "rechazar" ? (
        /* Confirmación inline de Rechazar con motivo */
        <div className="rounded-lg border border-danger/25 bg-danger-soft/40 p-3">
          <p className="font-body text-sm font-semibold text-danger">Rechazar documentación</p>
          <p className="mt-1 font-body text-xs text-ink/60">
            El usuario recibirá una notificación con el motivo. Puede subir documentación nueva.
          </p>
          <label className="mt-3 flex flex-col gap-1.5">
            <span className="font-body text-xs font-medium text-ink/70">
              Motivo del rechazo <span className="text-danger">*</span>
            </span>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Ej. La foto está borrosa o el documento no coincide con los datos del perfil."
              className="min-h-[72px] resize-none rounded-lg border border-danger/30 bg-mist px-3 py-2 font-body text-sm text-ink focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/20"
              maxLength={500}
              aria-label="Motivo del rechazo"
            />
            <span className="text-right font-body text-[11px] text-ink/40">{motivoRechazo.length}/500</span>
          </label>
          <div className="mt-3 flex gap-2">
            <Button
              variant="danger"
              onClick={() => cambiarEstado("rechazado", motivoRechazo)}
              disabled={procesando || motivoRechazo.trim().length < 10}
            >
              {procesando ? "Rechazando…" : "Confirmar rechazo"}
            </Button>
            <Button variant="secondary" onClick={() => { setConfirmando(null); setMotivoRechazo(""); }} disabled={procesando}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        /* Botones de acción principales */
        <div className="flex flex-wrap gap-2">
          {usuario.estado_verificacion === "pendiente" && (
            <Button variant="secondary" onClick={() => cambiarEstado("en_revision")} disabled={procesando}>
              Marcar en revisión
            </Button>
          )}
          <Button
            onClick={() => setConfirmando("aprobar")}
            disabled={procesando || !usuario.doc_identidad_url}
          >
            Aprobar cuenta
          </Button>
          <Button
            variant="danger"
            onClick={() => setConfirmando("rechazar")}
            disabled={procesando}
          >
            Rechazar
          </Button>
        </div>
      )}

      {!usuario.doc_identidad_url && (
        <p className="font-body text-xs text-ink/40">
          El botón &quot;Aprobar cuenta&quot; permanece deshabilitado hasta que el usuario suba su identificación.
        </p>
      )}
    </div>
  );
}
