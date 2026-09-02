"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Tema = "light" | "dark";
const STORAGE_KEYS = ["ruum-tema", "ruum-theme"];

interface TemaContexto {
  tema: Tema;
  alternar: () => void;
  fijar: (t: Tema) => void;
}

const TemaCtx = createContext<TemaContexto>({
  tema: "dark",
  alternar: () => {},
  fijar: () => {}
});

function obtenerTemaAlmacenado(): Tema | null {
  if (typeof window === "undefined") return null;
  for (const key of STORAGE_KEYS) {
    try {
      const val = localStorage.getItem(key);
      if (val === "light" || val === "dark") return val;
    } catch {
      // Ignorar restricciones de almacenamiento (p. ej. iframe o modo privado extremo)
    }
  }
  return null;
}

function guardarTema(t: Tema) {
  if (typeof window === "undefined") return;
  for (const key of STORAGE_KEYS) {
    try {
      localStorage.setItem(key, t);
    } catch {
      // ignore
    }
  }
}

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>("dark");

  useEffect(() => {
    const guardado = obtenerTemaAlmacenado();
    const mediaQuery = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
    const sistema: Tema = mediaQuery?.matches ? "light" : "dark";
    const inicial = guardado ?? sistema;
    setTema(inicial);

    try {
      document.documentElement.setAttribute("data-theme", inicial);
    } catch {
      // ignore
    }

    function alCambiarSistema(e: MediaQueryListEvent) {
      const tieneGuardado = obtenerTemaAlmacenado();
      if (!tieneGuardado) {
        const nuevoTema: Tema = e.matches ? "light" : "dark";
        setTema(nuevoTema);
        try {
          document.documentElement.setAttribute("data-theme", nuevoTema);
        } catch {
          // ignore
        }
      }
    }

    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", alCambiarSistema);
      return () => mediaQuery.removeEventListener("change", alCambiarSistema);
    }
  }, []);

  const fijar = useCallback((t: Tema) => {
    setTema(t);
    try {
      document.documentElement.setAttribute("data-theme", t);
    } catch {
      // ignore
    }
    guardarTema(t);
  }, []);

  const alternar = useCallback(() => {
    fijar(tema === "dark" ? "light" : "dark");
  }, [tema, fijar]);

  return <TemaCtx.Provider value={{ tema, alternar, fijar }}>{children}</TemaCtx.Provider>;
}

export function useTema() {
  return useContext(TemaCtx);
}

export function BotonTema() {
  const { tema, alternar } = useTema();
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={`Cambiar a tema ${tema === "dark" ? "claro" : "oscuro"}`}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 font-body text-xs font-semibold text-text-primary hover:border-border-strong"
    >
      <span aria-hidden>{tema === "dark" ? "☀️" : "🌙"}</span>
      {tema === "dark" ? "Tema claro" : "Tema oscuro"}
    </button>
  );
}
