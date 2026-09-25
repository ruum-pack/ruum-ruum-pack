"use client";

import { useEffect } from "react";
import { SafetyButton, useStreetMode } from "@ruum/ui";
import { useViajeActivo } from "./ViajeActivoContext";

/**
 * Modo calle V1.0 (cap. 23): se activa con traslado activo.
 * Botones ≥56px, texto ≥17px, botón de seguridad persistente ≤1 toque.
 */
export function ModoCalleActivador() {
  const { viajeActivo } = useViajeActivo();
  const activo = Boolean(viajeActivo);
  useStreetMode(activo);

  useEffect(() => {
    document.documentElement.dataset.street = activo ? "true" : "false";
    return () => {
      document.documentElement.dataset.street = "false";
    };
  }, [activo]);

  if (!activo) return null;
  return <SafetyButton />;
}
