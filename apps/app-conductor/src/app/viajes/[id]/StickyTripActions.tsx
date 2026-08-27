"use client";

import { useState } from "react";
import { createNavigationOptions, type NavigationTarget, type NavigationOption } from "../../../lib/navigation-launcher";

function abrirNavegacion(option: NavigationOption) {
  if (!option.nativeHref || typeof window === "undefined") return;
  window.location.href = option.nativeHref;
  window.setTimeout(() => {
    if (document.visibilityState === "visible") window.open(option.webHref, "_blank", "noopener,noreferrer");
  }, 900);
}

export function StickyTripActions({
  trasladoId,
  navigationTarget,
  phone,
  onQuickMessage
}: {
  trasladoId: string;
  navigationTarget: NavigationTarget;
  phone?: string | null;
  onQuickMessage?: (msg: string) => void;
}) {
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const navOptions = createNavigationOptions(navigationTarget);
  const primaryNav = navOptions[0];

  const mensajesRapidos = ["Estoy en camino", "Llegué al punto", "Hay tráfico, llego en 10 min"];

  return (
    <>
      <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] inset-x-0 z-30 border-t border-border/20 bg-surface/95 backdrop-blur-md shadow-2xl" role="toolbar" aria-label="Acciones rápidas del traslado">
        <div className="mx-auto max-w-md px-3 py-3 flex items-center gap-2">
          {/* Navegar — primario signal */}
          {primaryNav && (
            <a
              href={primaryNav.href}
              target={primaryNav.nativeHref ? undefined : "_blank"}
              rel="noreferrer"
              onClick={(e) => {
                if (!primaryNav.nativeHref) return;
                e.preventDefault();
                abrirNavegacion(primaryNav);
                if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
              }}
              className="flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl bg-signal px-3 py-2.5 font-display text-xs font-black tracking-wide text-slate-950 shadow-md hover:bg-signal/90 active:scale-[0.98] transition-all"
            >
              <span aria-hidden>🧭</span> Navegar
            </a>
          )}
          {/* Llamar — secundario */}
          <a
            href={phone ? `tel:${phone}` : `tel:`}
            onClick={() => {
              if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
            }}
            className={`flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 font-display text-xs font-bold transition-all active:scale-[0.98] ${phone ? "border-route-action bg-route-soft text-route-action hover:bg-route-soft/80" : "border-border bg-surface-elevated text-text-tertiary"}`}
          >
            <span aria-hidden>📞</span> Llamar
          </a>
          {/* Chat rápido — abre sheet */}
          <button
            type="button"
            onClick={() => setSheetAbierto(true)}
            aria-label="Mensaje rápido"
            className="min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-border bg-surface-elevated text-text-primary hover:bg-surface active:scale-[0.98] transition-all px-3"
          >
            <span aria-hidden>💬</span>
            <span className="ml-1 font-display text-xs font-bold hidden sm:inline">Chat</span>
          </button>
        </div>
        <div className="mx-auto max-w-md px-3 pb-1 flex justify-center">
          <span className="font-body text-[10px] font-semibold text-text-tertiary">Navegar · Llamar · Mensaje en 1 toque — pensado para conducir</span>
        </div>
      </div>

      {/* Bottom sheet mensajes rápidos */}
      {sheetAbierto && (
        <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Mensajes rápidos">
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSheetAbierto(false)} aria-label="Cerrar" />
          <div className="relative w-full max-w-md bg-surface-elevated rounded-t-2xl border-t border-border p-4 flex flex-col gap-3 animate-slideUp shadow-2xl">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-border/40" aria-hidden />
            <h3 className="font-display text-sm font-black text-text-primary">Mensaje rápido</h3>
            <p className="font-body text-xs text-text-secondary">Envía sin escribir, se registra en el traslado {trasladoId.slice(0, 8).toUpperCase()}.</p>
            <div className="grid gap-2">
              {mensajesRapidos.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    onQuickMessage?.(m);
                    setSheetAbierto(false);
                    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
                  }}
                  className="min-h-11 rounded-xl border border-route-action/30 bg-route-soft px-4 py-3 text-left font-body text-sm font-bold text-route-action hover:bg-route-soft/70"
                >
                  {m}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setSheetAbierto(false)} className="w-full min-h-11 rounded-xl bg-surface border border-border font-display text-sm font-bold text-text-primary">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
