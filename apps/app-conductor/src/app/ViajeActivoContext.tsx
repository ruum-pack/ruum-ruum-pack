"use client";
import { createContext, useContext, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useActiveTripSubscription } from "./useActiveTripSubscription";
import { useDriverLocationTracking } from "./useDriverLocationTracking";
import { type RegistroViajeActivoInput, type ViajeActivo, viajeEsOperacionActiva, viajePermiteEmergencia } from "./active-trip-state";

type ViajeActivoContextValue = {
  viajeActivo: ViajeActivo | null;
  registrarViajeActivo: (viaje: RegistroViajeActivoInput | null) => void;
};

const ViajeActivoContext = createContext<ViajeActivoContextValue | null>(null);

export { viajeEsOperacionActiva, viajePermiteEmergencia };

export function ViajeActivoProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { viajeActivo, registrarViajeActivo } = useActiveTripSubscription(pathname);
  useDriverLocationTracking(viajeActivo);

  const value = useMemo(
    () => ({
      viajeActivo,
      registrarViajeActivo
    }),
    [registrarViajeActivo, viajeActivo]
  );

  return (
    <ViajeActivoContext.Provider value={value}>
      {children}
    </ViajeActivoContext.Provider>
  );
}

export function useViajeActivo() {
  const contexto = useContext(ViajeActivoContext);
  if (!contexto) {
    throw new Error("useViajeActivo debe usarse dentro de ViajeActivoProvider.");
  }
  return contexto;
}

export function RegistroViajeActivo({ viaje }: { viaje: RegistroViajeActivoInput | null }) {
  const { registrarViajeActivo } = useViajeActivo();

  useEffect(() => {
    registrarViajeActivo(viaje && viajeEsOperacionActiva(viaje.estado) ? viaje : null);
    return () => registrarViajeActivo(null);
  }, [registrarViajeActivo, viaje]);

  return null;
}
