"use client";
import { useEffect } from "react";
import type { PasaporteRow } from "../lib/offline-active-trip-cache";
import { useViajeActivo } from "./ViajeActivoContext";
export function CacheViajeActivoOffline({ pasaporte }: { pasaporte: PasaporteRow }) {
  const { cachearPasaporteActivo } = useViajeActivo();
  useEffect(() => { void cachearPasaporteActivo(pasaporte); }, [cachearPasaporteActivo, pasaporte]);
  return null;
}
