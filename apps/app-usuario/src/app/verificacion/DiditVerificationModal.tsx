"use client";

import { useEffect, useRef, useCallback } from "react";
import { Aviso } from "@ruum/ui";
import { esOrigenDiditValido, interpretarMensajeDidit } from "../../lib/didit";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previoFocoRef = useRef<HTMLElement | null>(null);
  const cerrarBtnRef = useRef<HTMLButtonElement>(null);

  // R4: ESC + cancel nativo del <dialog> debe cerrar siempre, incluso cargando
  const handleCancel = useCallback(
    (e: Event) => {
      e.preventDefault();
      onCerrar();
    },
    [onCerrar]
  );

  // R4: showModal() + focus trap + restauración de foco + scroll lock
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      previoFocoRef.current = document.activeElement as HTMLElement | null;

      // showModal() da backdrop nativo, focus trap y aria-modal; open sin showModal no lo hace
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          // Fallback si ya está abierto o en entorno de test/jsdom sin showModal
          dialog.setAttribute("open", "");
        }
      }

      // Foco inicial accesible: botón cerrar (siempre enabled, ver abajo)
      requestAnimationFrame(() => cerrarBtnRef.current?.focus());

      dialog.addEventListener("cancel", handleCancel);
      // Clic en backdrop (área fuera del .max-w-xl) cierra — UX esperado
      const handleBackdropClick = (e: MouseEvent) => {
        if (e.target === dialog) onCerrar();
      };
      dialog.addEventListener("click", handleBackdropClick);

      // R4: Focus trap manual (Tab / Shift+Tab cicla dentro del dialog)
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return;
        const focusables = dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
      dialog.addEventListener("keydown", handleKeyDown);

      return () => {
        dialog.removeEventListener("cancel", handleCancel);
        dialog.removeEventListener("click", handleBackdropClick);
        dialog.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      if (dialog.open) dialog.close();
      // Restaurar foco al elemento que abrió el modal
      previoFocoRef.current?.focus();
    }
  }, [isOpen, handleCancel, onCerrar]);

  // Limpieza al desmontar si quedó abierto
  useEffect(() => {
    return () => {
      const d = dialogRef.current;
      if (d?.open) {
        try {
          d.close();
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (event: MessageEvent) => {
      if (!esOrigenDiditValido(event.origin)) return;
      if (event.source && event.source !== iframeRef.current?.contentWindow) return;

      const mensaje = interpretarMensajeDidit(event.data);
      if (!mensaje) return;
      if (mensaje.tipo === "cancelado") onCerrar();
      else onFinalizar();
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isOpen, onCerrar, onFinalizar]);

  if (!isOpen) return null;

  const urlValida = esUrlDiditValida(url);

  const abrirEnNuevaVentana = () => {
    if (urlValida && url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="user-v2-scope user-v2-secondary-screen fixed inset-0 z-50 m-0 flex h-[100dvh] w-[100vw] max-h-none max-w-none items-center justify-center border-0 bg-black/75 px-4 py-6 backdrop-blur-xs sm:py-10 open:flex"
      aria-modal="true"
      aria-labelledby="titulo-didit-usuario"
      aria-describedby="didit-desc didit-permisos-nota"
    >
      <div className="user-v2-modal w-full max-w-xl overflow-hidden rounded-2xl border border-[#334155] bg-[#1E293B] shadow-2xl flex flex-col max-h-[92vh] text-white">
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between border-b border-[#334155] p-4 shrink-0 bg-[#0F172A]">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🪪</span>
            <h2 id="titulo-didit-usuario" className="font-display text-base sm:text-lg font-bold text-white">
              Verificación de identidad oficial
            </h2>
          </div>
          <button
            ref={cerrarBtnRef}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar verificación"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#334155] hover:text-white transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFC400] focus-visible:outline-offset-2"
          >
            ✕
          </button>
        </div>

        {/* R4: descripciones para aria-describedby + aviso previo de permisos sensible */}
        <p id="didit-desc" className="sr-only">
          Modal de verificación externa de identidad con Didit. Usa Tab y Shift+Tab para navegar entre controles y Esc para cerrar en cualquier momento.
        </p>
        <p id="didit-permisos-nota" className="sr-only">
          El siguiente iframe es de verify.didit.me y solicitará permiso de cámara, micrófono y ubicación para la prueba de vida. Puedes permitir o denegar desde el diálogo del navegador.
        </p>

        {/* Contenido según estado */}
        {cargando ? (
          <div className="p-10 text-center" role="status" aria-live="polite">
            <div
              className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#FFC400]/15 text-2xl font-bold text-[#FFC400] animate-spin"
              aria-hidden
            >
              ⟳
            </div>
            <p className="mt-4 font-display text-base font-semibold text-white">
              Procesando verificación de identidad…
            </p>
            <p className="mt-1 font-body text-xs text-[#94A3B8]">
              Conectando con el servicio seguro y encriptado de Didit. Puedes cerrar con Esc en cualquier momento.
            </p>
          </div>
        ) : error ? (
          <div className="p-6">
            <Aviso tono="danger">{error}</Aviso>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onCerrar}
                className="user-v2-modal-secondary w-full rounded-xl border border-[#475569] bg-transparent py-3 font-display text-sm font-semibold text-white hover:bg-[#334155] transition cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={onReintentar}
                disabled={cargando}
                className="user-v2-modal-primary w-full rounded-xl bg-[#FFC400] py-3 font-display text-sm font-bold text-[#151515] hover:bg-[#e0ac00] transition cursor-pointer"
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
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] leading-4 text-amber-200">
              Antes de continuar, Didit solicitará acceso a <strong>cámara</strong>, <strong>micrófono</strong> y <strong>ubicación</strong> para la prueba de vida. Solo se usan para esta verificación y puedes revocar el permiso desde el navegador.
            </div>
            <div className="relative h-[460px] sm:h-[520px] w-full bg-black/40">
              <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full border-0"
                title="Verificación de identidad Didit — iframe externo verify.didit.me"
                allow="camera; microphone; geolocation; fullscreen; accelerometer; gyroscope; display-capture; autoplay; encrypted-media"
                aria-describedby="didit-permisos-nota"
              />
            </div>
            <div className="p-4 bg-[#0F172A] border-t border-[#334155] flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-[#94A3B8] text-center sm:text-left">
                Tu cuenta se actualizará automáticamente al completar la prueba.
              </p>
              <button
                type="button"
                onClick={onFinalizar}
                disabled={cargando}
                className="user-v2-modal-primary w-full sm:w-auto rounded-xl bg-[#FFC400] px-5 py-2.5 font-display text-xs font-bold text-[#151515] hover:bg-[#e0ac00] transition cursor-pointer"
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
                className="user-v2-modal-secondary rounded-xl border border-[#475569] px-5 py-2.5 font-display text-sm font-semibold text-white hover:bg-[#334155] transition cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={onReintentar}
                className="user-v2-modal-primary rounded-xl bg-[#FFC400] px-5 py-2.5 font-display text-sm font-bold text-[#151515] hover:bg-[#e0ac00] transition cursor-pointer"
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
