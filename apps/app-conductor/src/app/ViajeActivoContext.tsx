"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useActiveTripSubscription } from "./useActiveTripSubscription";
import { useDriverLocationTracking } from "./useDriverLocationTracking";
import { type RegistroViajeActivoInput, type ViajeActivo, viajeEsOperacionActiva, viajePermiteEmergencia } from "./active-trip-state";
import type { PasaporteRow, OfflineActiveTripCache } from "../lib/offline-active-trip-cache";
import { crearCacheViajeActivoDesdePasaporte, guardarCacheViajeActivo, leerCacheViajeActivo, limpiarCacheViajeActivo } from "../lib/offline-active-trip-cache";

type ViajeActivoContextValue = {
  viajeActivo: ViajeActivo | null;
  viajeActivoSinActualizar: boolean;
  registrarViajeActivo: (viaje: RegistroViajeActivoInput | null) => void;
  cacheViajeActivo: OfflineActiveTripCache | null;
  cachearPasaporteActivo: (pasaporte: PasaporteRow) => Promise<void>;
  limpiarViajeActivoGlobal: () => Promise<void>;
};

const ViajeActivoContext = createContext<ViajeActivoContextValue | null>(null);

export { viajeEsOperacionActiva, viajePermiteEmergencia };

export function ViajeActivoProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { viajeActivo, viajeActivoSinActualizar, registrarViajeActivo } = useActiveTripSubscription(pathname);
  const [cacheViajeActivo, setCacheViajeActivo] = useState<OfflineActiveTripCache | null>(null);
  useDriverLocationTracking(viajeActivo);

  useEffect(() => { void leerCacheViajeActivo().then(setCacheViajeActivo); }, []);

  const cachearPasaporteActivo = useCallback(async (pasaporte: PasaporteRow) => {
    const cache = crearCacheViajeActivoDesdePasaporte(pasaporte);
    if (!cache) return;
    await guardarCacheViajeActivo(cache);
    setCacheViajeActivo(cache);
  }, []);

  const limpiarViajeActivoGlobal = useCallback(async () => {
    registrarViajeActivo(null);
    setCacheViajeActivo(null);
    await limpiarCacheViajeActivo();
  }, [registrarViajeActivo]);

  const value = useMemo(
    () => ({
      viajeActivo,
      viajeActivoSinActualizar,
      registrarViajeActivo,
      cacheViajeActivo,
      cachearPasaporteActivo,
      limpiarViajeActivoGlobal
    }),
    [cacheViajeActivo, cachearPasaporteActivo, limpiarViajeActivoGlobal, registrarViajeActivo, viajeActivo, viajeActivoSinActualizar]
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
