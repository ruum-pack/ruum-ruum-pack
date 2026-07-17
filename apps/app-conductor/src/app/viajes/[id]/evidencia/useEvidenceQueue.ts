"use client";

import { useCallback, useState } from "react";
import type { AnguloEvidencia, FotoEvidencia, TipoEvidencia } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { obtenerUbicacionActual } from "../../../../lib/ubicacion";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../../lib/supabase-browser";
import {
  contarColaEvidencia,
  encolarEvidencia,
  type ItemColaEvidencia,
  leerColaEvidenciaDeTraslado,
  sincronizarColaEvidencia
} from "../../../../lib/cola-offline";

export function itemColaAFotoEvidencia(item: ItemColaEvidencia): FotoEvidencia {
  return {
    id: item.localId,
    traslado_id: item.trasladoId,
    tipo: item.tipo,
    angulo: item.angulo as AnguloEvidencia,
    local_path: item.dataUrl,
    timestamp: item.capturadaEn,
    ...(item.lat !== undefined ? { lat: item.lat } : {}),
    ...(item.lng !== undefined ? { lng: item.lng } : {}),
    sincronizada: false
  };
}

export function useEvidenceQueue({ trasladoId, tipo }: { trasladoId: string; tipo: TipoEvidencia | null }) {
  const [sincronizando, setSincronizando] = useState(false);
  const [pendientesSubida, setPendientesSubida] = useState(0);

  const cargarPendientesLocales = useCallback(async () => {
    const pendientes = await leerColaEvidenciaDeTraslado(trasladoId);
    setPendientesSubida(pendientes.length);
    return pendientes.map(itemColaAFotoEvidencia);
  }, [trasladoId]);

  const registrarFotoEnCola = useCallback(
    async ({ angulo, dataUrl }: { angulo: AnguloEvidencia; dataUrl: string }) => {
      if (!tipo) return [];
      const coords = await obtenerUbicacionActual();
      const localId = crypto.randomUUID();
      await encolarEvidencia({
        localId,
        trasladoId,
        tipo,
        angulo,
        dataUrl,
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        capturadaEn: new Date().toISOString(),
        retryCount: 0
      });
      return cargarPendientesLocales();
    },
    [cargarPendientesLocales, tipo, trasladoId]
  );

  const drenarColaPendiente = useCallback(async () => {
    if (!tipo || !tieneSupabaseConfigurado() || (typeof navigator !== "undefined" && !navigator.onLine)) return null;
    const pendientes = await contarColaEvidencia(trasladoId);
    setPendientesSubida(pendientes);
    if (pendientes === 0) return 0;

    setSincronizando(true);
    try {
      const cliente = crearClienteNavegador();
      return await sincronizarColaEvidencia(cliente, {
        trasladoId,
        onItemSincronizado: async () => {
          setPendientesSubida(await contarColaEvidencia(trasladoId));
        }
      });
    } catch (err) {
      throw new Error(traducirErrorOperativo(err, "No pudimos sincronizar el registro pendiente del vehículo."));
    } finally {
      setSincronizando(false);
    }
  }, [tipo, trasladoId]);

  return {
    pendientesSubida,
    sincronizando,
    cargarPendientesLocales,
    drenarColaPendiente,
    registrarFotoEnCola
  };
}
