"use client";

import { useEffect, useState } from "react";
import { Aviso, Field } from "@ruum/ui";
import { VERSION_TERMINOS_VIGENTE } from "@ruum/shared/constants";
import { registrarConsentimientoUsuario } from "@ruum/api/services";
import { crearClienteNavegador } from "../lib/supabase-browser";

/**
 * PR-07: No fabricar aceptación de términos.
 * Este componente se muestra cuando el usuario existe pero no tiene evidencia
 * de consentimiento (version_terminos_aceptada = null). Requiere acción explícita
 * con versión concreta, timestamp real, canal y auditoría.
 */
export function ConsentimientoTerminosWall({
  onAceptado,
}: {
  onAceptado?: () => void;
}) {
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aceptar() {
    if (!acepta) {
      setError("Debes aceptar los términos para continuar.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const canal = /android/i.test(navigator.userAgent) ? "android" : /iPad|iPhone|iPod/i.test(navigator.userAgent) ? "ios" : "web";
      await registrarConsentimientoUsuario(cliente, {
        version: VERSION_TERMINOS_VIGENTE,
        canal,
        versionApp: "1.0.0",
      });
      onAceptado?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el consentimiento.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#4d5668] bg-[#0A1220] p-6 shadow-2xl">
        <h2 className="font-display text-lg font-bold text-white">Aceptación de Términos</h2>
        <p className="mt-2 font-body text-xs leading-5 text-[#B7C2D4]">
          Para continuar, debes aceptar expresamente los Términos y Condiciones y el Aviso de Privacidad
          vigentes (versión {VERSION_TERMINOS_VIGENTE}).
        </p>
        <p className="mt-1 font-body text-[11px] text-[#8E9CAE]">
          Se registrará versión concreta, fecha/hora real, canal ({typeof window !== "undefined" ? (/android/i.test(navigator.userAgent) ? "android" : /iPad|iPhone|iPod/i.test(navigator.userAgent) ? "ios" : "web") : "web"}) y evento auditado.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-[#4d5668] bg-[#1a2030] p-3.5">
          <input
            type="checkbox"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
            className="mt-0.5 accent-[#f5a623]"
          />
          <span className="font-body text-xs leading-5 text-[#d7dce5]">
            Acepto los <a href="/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-[#f5a623] underline">Términos y condiciones</a> y el{" "}
            <a href="/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-[#f5a623] underline">Aviso de privacidad</a> de Ruum Ruum.
          </span>
        </label>
        {error && (
          <div className="mt-3">
            <Aviso tono="danger">{error}</Aviso>
          </div>
        )}
        <button
          type="button"
          onClick={() => void aceptar()}
          disabled={enviando}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#FFC400] px-5 py-3 font-display text-sm font-extrabold text-[#151515] transition hover:bg-[#e0ac00] disabled:opacity-50"
        >
          {enviando ? "Registrando..." : "Aceptar y continuar"}
        </button>
        <p className="mt-2 text-center font-body text-[10px] text-[#8E9CAE]">Este consentimiento quedará auditado y no se rellenará como default.</p>
      </div>
    </div>
  );
}

/**
 * Hook para verificar si el usuario necesita aceptar términos.
 * Retorna true si version_terminos_aceptada es null.
 */
export function useRequiereConsentimiento(versionTerminos: number | null | undefined): boolean {
  return versionTerminos == null;
}
