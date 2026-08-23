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
      const data = event.data;
      if (!data) return;
      if (
        data === "didit:complete" ||
        data === "didit:cancel" ||
        data?.type === "didit:complete" ||
        data?.type === "didit:cancel" ||
        data?.type === "didit:verification:complete" ||
        data?.status === "complete" ||
        data?.status === "approved" ||
        data?.status === "declined" ||
        data?.event === "verification.completed"
      ) {
        onFinalizar();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isOpen, onFinalizar]);

  if (!isOpen) return null;

  const abrirEnNuevaVentana = () => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <dialog open className="fixed inset-0 z-50 m-0 flex h-[100dvh] w-[100vw] max-h-none max-w-none items-center justify-center border-0 bg-black/60 px-4 py-6 backdrop-blur-xs sm:py-10" aria-modal="true" aria-labelledby="titulo-didit">
      <div className="w-full max-w-xl bg-surface rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-border p-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🪪</span>
            <h2 id="titulo-didit" className="font-display text-base sm:text-lg font-semibold text-text-primary">
              Verificación de identidad (Didit)
            </h2>
          </div>
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
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-route-soft font-display text-xl font-bold text-route-action animate-spin" aria-hidden>⟳</div>
            <p className="mt-4 font-body text-sm font-semibold text-text-primary">Iniciando verificación de identidad…</p>
            <p className="mt-1 font-body text-xs text-text-secondary">Conectando con el servicio seguro de Didit.</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <Aviso tono="danger">{error}</Aviso>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button variant="secondary" onClick={onCerrar}>
                Cerrar
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
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between gap-2 bg-surface-elevated px-4 py-2 border-b border-border text-xs">
              <span className="text-text-secondary truncate">Prueba de vida y validación biométrica</span>
              <button
                type="button"
                onClick={abrirEnNuevaVentana}
                className="shrink-0 font-display font-bold text-route-action hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                Abrir en nueva ventana ↗
              </button>
            </div>
            <div className="relative h-[440px] sm:h-[520px] w-full bg-black/5">
              <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full border-0"
                title="Verificación de identidad Didit"
                allow="camera; microphone; geolocation; fullscreen; accelerometer; gyroscope; display-capture; autoplay"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation allow-top-navigation-by-user-activation"
              />
            </div>
            <div className="p-3 bg-surface border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs text-text-tertiary text-center sm:text-left">
                Se detectará automáticamente al concluir en Didit.
              </p>
              <Button
                variant="secondary"
                onClick={onFinalizar}
                className="w-full sm:w-auto text-xs py-2 px-4 min-h-10"
              >
                Ya completé la verificación
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Aviso tono="atencion">No se recibió la URL de verificación.</Aviso>
            <div className="mt-4 flex justify-center gap-3">
              <Button variant="secondary" onClick={onCerrar}>
                Cerrar
              </Button>
              <Button onClick={onReintentar}>
                Reintentar
              </Button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}