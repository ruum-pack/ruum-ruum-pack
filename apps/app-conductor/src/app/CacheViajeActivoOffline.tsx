"use client";

import { useEffect } from "react";
import type { PasaporteRow } from "../lib/offline-active-trip-cache";
import { crearCacheViajeActivoDesdePasaporte, guardarCacheViajeActivo } from "../lib/offline-active-trip-cache";

export function CacheViajeActivoOffline({ pasaporte }: { pasaporte: PasaporteRow }) {
  useEffect(() => {
    const cache = crearCacheViajeActivoDesdePasaporte(pasaporte);
    if (cache) void guardarCacheViajeActivo(cache);
  }, [pasaporte]);

  return null;
}

