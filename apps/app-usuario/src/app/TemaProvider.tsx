"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Tema = "light" | "dark";
const STORAGE_KEY = "ruum-tema";

interface TemaContexto {
  tema: Tema;
  alternar: () => void;
  fijar: (t: Tema) => void;
}

const TemaCtx = createContext<TemaContexto>({ tema: "dark", alternar: () => {}, fijar: () => {} });

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>("dark");

  useEffect(() => {
    const guardado = typeof window !== "undefined" ? (localStorage.getItem(STORAGE_KEY) as Tema | null) : null;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const sistema: Tema = mediaQuery.matches ? "light" : "dark";
    const inicial = guardado ?? sistema;
    setTema(inicial);
    document.documentElement.setAttribute("data-theme", inicial);

    function alCambiarSistema(e: MediaQueryListEvent) {
      const tieneGuardado = localStorage.getItem(STORAGE_KEY);
      if (!tieneGuardado) {
        const nuevoTema: Tema = e.matches ? "light" : "dark";
        setTema(nuevoTema);
        document.documentElement.setAttribute("data-theme", nuevoTema);
      }
    }

    mediaQuery.addEventListener("change", alCambiarSistema);
    return () => mediaQuery.removeEventListener("change", alCambiarSistema);
  }, []);

  const fijar = useCallback((t: Tema) => {
    setTema(t);
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem(STORAGE_KEY, t);
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
