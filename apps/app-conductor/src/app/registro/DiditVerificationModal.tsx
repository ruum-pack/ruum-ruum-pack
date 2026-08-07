"use client";

import { Button, Aviso } from "@ruum/ui";
import { useEffect, useRef } from "react";

interface Props {
  isOpen: boolean;
  url: string | null;
  cargando: boolean;
  error: string | null;
  onCerrar: () => void;
  onReintentar: () => void;
  onFinalizar: () => void;
}

export function DiditVerificationModal({
  isOpen,
  url,
  cargando,
  error,
  onCerrar,
  onReintentar,
  onFinalizar
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "didit:complete" || event.data?.type === "didit:cancel") {
        onFinalizar();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isOpen, onFinalizar]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="titulo-didit">
      <div className="w-full max-w-xl bg-surface rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 id="titulo-didit" className="font-display text-lg font-semibold text-text-primary">
            Verificación de identidad
          </h2>
          <Button
            variant="quiet"
            onClick={onCerrar}
            disabled={cargando}
            aria-label="Cerrar verificación"
            className="p-2"
          >
            ✕
          </Button>
        </div>

        {cargando ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-route-soft font-display text-xl font-bold text-route-action" aria-hidden>⟳</div>
            <p className="mt-4 font-body text-sm text-text-secondary">Iniciando verificación de identidad…</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <Aviso tono="danger">{error}</Aviso>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button variant="secondary" onClick={onCerrar} className="sm:col-start-2">
                Volver al panel
              </Button>
              <Button onClick={onReintentar} disabled={cargando}>
                Reintentar verificación
              </Button>
            </div>
            <p className="mt-4 text-center font-body text-xs text-text-tertiary">
              También puedes completar la verificación más tarde desde tu panel de conductor.
            </p>
          </div>
        ) : url ? (
          <div className="relative h-[500px] sm:h-[600px]">
            <iframe
              ref={iframeRef}
              src={url}
              className="w-full h-full border-0"
              title="Verificación de identidad Didit"
              allow="camera; microphone"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface/95 to-transparent p-4 pointer-events-none">
              <p className="text-center font-body text-xs text-text-tertiary pointer-events-auto">
                Completa la verificación en la ventana segura de Didit. Se cerrará automáticamente al terminar.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Aviso tono="atencion">No se recibió la URL de verificación.</Aviso>
            <Button variant="secondary" onClick={onCerrar} className="mt-4">
              Volver al panel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}