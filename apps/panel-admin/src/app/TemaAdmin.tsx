"use client";

import { useEffect, useState } from "react";

type TemaAdmin = "light" | "dark";

function temaActual(): TemaAdmin {
  try {
    const stored = localStorage.getItem("ruum-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Continuar con el atributo aplicado por el inicializador.
  }
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function SelectorTemaAdmin() {
  const [tema, setTema] = useState<TemaAdmin>(() => (
    typeof window === "undefined" ? "light" : temaActual()
  ));

  useEffect(() => {
    setTema(temaActual());
  }, []);

  function alternarTema() {
    const siguiente: TemaAdmin = tema === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = siguiente;
    try {
      localStorage.setItem("ruum-theme", siguiente);
    } catch {
      // El tema también funciona si el almacenamiento está bloqueado.
    }
    setTema(siguiente);
  }

  return (
    <button
      type="button"
      onClick={alternarTema}
      className="admin-theme-toggle"
      suppressHydrationWarning
      aria-label={`Cambiar a tema ${tema === "dark" ? "claro" : "oscuro"}`}
      title={`Cambiar a tema ${tema === "dark" ? "claro" : "oscuro"}`}
    >
      <span aria-hidden="true">{tema === "dark" ? "☀" : "☾"}</span>
      <span>{tema === "dark" ? "Claro" : "Oscuro"}</span>
    </button>
  );
}
