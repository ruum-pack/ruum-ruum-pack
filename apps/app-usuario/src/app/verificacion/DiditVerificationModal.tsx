"use client";

import { useEffect, useRef } from "react";
import { Aviso } from "@ruum/ui";

interface Props {
  isOpen: boolean;
  url: string | null;
  cargando: boolean;
  error: string | null;
  onCerrar: () => void;
  onReintentar: () => void;
  onFinalizar: () => void;
}

function esUrlDiditValida(url: string | null | undefined): url is string {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("https://")) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      parsed.hostname === "verify.didit.me" ||
      parsed.hostname.endsWith(".didit.me") ||
      parsed.hostname === "didit.me"
    );
  } catch {
    return false;
  }
}

export function DiditVerificationModal({
  isOpen,
  url,
  cargando,
  error,
  onCerrar,
  onReintentar,
  onFinalizar,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (event: MessageEvent) => {
      let data = event.data;
      if (!data) return;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          // Mantener como string si no es JSON
        }
      }
      if (
        data === "didit:complete" ||
        data === "didit:cancel" ||
        data?.type === "didit:complete" ||
        data?.type === "didit:cancel" ||
        data?.type === "didit:verification:complete" ||
        data?.type === "didit:verification:completed" ||
        data?.status === "complete" ||
        data?.status === "completed" ||
        data?.status === "approved" ||
        data?.status === "declined" ||
        data?.event === "verification.completed" ||
        data?.event === "didit:completed" ||
        data?.message === "didit:complete"
      ) {
        onFinalizar();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isOpen, onFinalizar]);

  if (!isOpen) return null;

  const urlValida = esUrlDiditValida(url);

  const abrirEnNuevaVentana = () => {
    if (urlValida && url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-[100dvh] w-[100vw] max-h-none max-w-none items-center justify-center border-0 bg-black/75 px-4 py-6 backdrop-blur-xs sm:py-10"
      aria-modal="true"
      aria-labelledby="titulo-didit-usuario"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#334155] bg-[#1E293B] shadow-2xl flex flex-col max-h-[92vh] text-white">
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between border-b border-[#334155] p-4 shrink-0 bg-[#0F172A]">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🪪</span>
            <h2 id="titulo-didit-usuario" className="font-display text-base sm:text-lg font-bold text-white">
              Verificación de identidad oficial
            </h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={cargando}
            aria-label="Cerrar verificación"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#334155] hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Contenido según estado */}
        {cargando ? (
          <div className="p-10 text-center">
            <div
              className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#FFC400]/15 text-2xl font-bold text-[#FFC400] animate-spin"
              aria-hidden
            >
              ⟳
            </div>
            <p className="mt-4 font-display text-base font-semibold text-white">
              Iniciando verificación de identidad…
            </p>
            <p className="mt-1 font-body text-xs text-[#94A3B8]">
              Conectando con el servicio seguro y encriptado de Didit.
            </p>
          </div>
        ) : error ? (
          <div className="p-6">
            <Aviso tono="danger">{error}</Aviso>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onCerrar}
                className="w-full rounded-xl border border-[#475569] bg-transparent py-3 font-display text-sm font-semibold text-white hover:bg-[#334155] transition cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={onReintentar}
                disabled={cargando}
                className="w-full rounded-xl bg-[#FFC400] py-3 font-display text-sm font-bold text-[#151515] hover:bg-[#e0ac00] transition cursor-pointer"
              >
                Reintentar verificación
              </button>
            </div>
          </div>
        ) : urlValida && url ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between gap-2 bg-[#0F172A] px-4 py-2 border-b border-[#334155] text-xs">
              <span className="text-[#94A3B8] truncate">
                Prueba biométrica y validación oficial en tiempo real
              </span>
              <button
                type="button"
                onClick={abrirEnNuevaVentana}
                className="shrink-0 font-display font-bold text-[#FFC400] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                Abrir en nueva ventana ↗
              </button>
            </div>
            <div className="relative h-[460px] sm:h-[520px] w-full bg-black/40">
              <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full border-0"
                title="Verificación de identidad Didit"
                allow="camera; microphone; geolocation; fullscreen; accelerometer; gyroscope; display-capture; autoplay"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation allow-top-navigation-by-user-activation"
              />
            </div>
            <div className="p-4 bg-[#0F172A] border-t border-[#334155] flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-[#94A3B8] text-center sm:text-left">
                Tu cuenta se actualizará automáticamente al completar la prueba.
              </p>
              <button
                type="button"
                onClick={onFinalizar}
                className="w-full sm:w-auto rounded-xl bg-[#FFC400] px-5 py-2.5 font-display text-xs font-bold text-[#151515] hover:bg-[#e0ac00] transition cursor-pointer"
              >
                Ya completé la verificación
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Aviso tono="atencion">No se recibió una URL válida de verificación de Didit.</Aviso>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={onCerrar}
                className="rounded-xl border border-[#475569] px-5 py-2.5 font-display text-sm font-semibold text-white hover:bg-[#334155] transition cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={onReintentar}
                className="rounded-xl bg-[#FFC400] px-5 py-2.5 font-display text-sm font-bold text-[#151515] hover:bg-[#e0ac00] transition cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
