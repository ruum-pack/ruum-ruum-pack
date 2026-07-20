"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@ruum/ui";
import { leerCacheViajeActivo, type OfflineActiveTripCache } from "../lib/offline-active-trip-cache";
import { publicarSyncSnapshot } from "../lib/offline-sync-status";

function formatearFecha(iso: string | null | undefined) {
  if (!iso) return "Sin registro";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(iso));
}

export function OfflineShell() {
  const [offline, setOffline] = useState(false);
  const [cache, setCache] = useState<OfflineActiveTripCache | null>(null);
  const [reintentando, setReintentando] = useState(false);

  const cargar = useCallback(async () => {
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    setCache(await leerCacheViajeActivo());
  }, []);

  useEffect(() => {
    void cargar();
    window.addEventListener("online", cargar);
    window.addEventListener("offline", cargar);
    window.addEventListener("ruum:offline-cache-updated", cargar);
    return () => {
      window.removeEventListener("online", cargar);
      window.removeEventListener("offline", cargar);
      window.removeEventListener("ruum:offline-cache-updated", cargar);
    };
  }, [cargar]);

  if (!offline || !cache) return null;

  async function reintentar() {
    setReintentando(true);
    await publicarSyncSnapshot(typeof navigator !== "undefined" && navigator.onLine ? undefined : "sin_conexion");
    window.setTimeout(() => {
      setReintentando(false);
      if (typeof navigator !== "undefined" && navigator.onLine) window.location.reload();
    }, 600);
  }

  return (
    <section className="fixed inset-0 z-50 overflow-y-auto bg-canvas px-4 py-6 text-text-primary">
      <div className="mx-auto grid min-h-full max-w-xl content-start gap-4">
        <div className="rounded-2xl border border-warning/45 bg-warning/10 p-4">
          <p className="font-body text-sm font-bold text-warning">Sin conexión</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">Modo offline del traslado</h1>
          <p className="mt-2 font-body text-sm text-text-secondary">
            Última sincronización: {formatearFecha(cache.ultimaSincronizacion)}
          </p>
        </div>

        <article className="rounded-2xl border border-route-action/35 bg-surface p-4 shadow-2">
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Traslado activo</p>
          <div className="mt-3 flex flex-col gap-2">
            <p className="font-display text-xl font-semibold">Folio {cache.folio}</p>
            <p className="font-body text-sm font-semibold text-text-primary">{cache.vehiculo.descripcion}</p>
            <p className="font-body text-sm text-text-secondary">Placas: {cache.vehiculo.placas ?? "Por confirmar"}</p>
          </div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-border bg-surface-elevated p-3">
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Origen</p>
              <p className="mt-1 font-body text-sm font-semibold">{cache.origen.direccion ?? "Por confirmar"}</p>
              {cache.origen.ciudad && <p className="font-body text-sm text-text-secondary">{cache.origen.ciudad}</p>}
            </div>
            <div className="rounded-xl border border-border bg-surface-elevated p-3">
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Destino</p>
              <p className="mt-1 font-body text-sm font-semibold">{cache.destino.direccion ?? "Por confirmar"}</p>
              {cache.destino.ciudad && <p className="font-body text-sm text-text-secondary">{cache.destino.ciudad}</p>}
            </div>
          </div>
        </article>

        <section className="rounded-2xl border border-border bg-surface p-4">
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Próxima instrucción disponible</p>
          <p className="mt-2 font-body text-base font-semibold">{cache.siguienteAccion.label}</p>
          <p className="mt-1 font-body text-sm leading-6 text-text-secondary">{cache.siguienteAccion.instruction}</p>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-4">
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Evidencias pendientes</p>
          {cache.requisitosEvidencia.pendientes.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 font-body text-sm text-text-secondary">
              {cache.requisitosEvidencia.pendientes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 font-body text-sm text-text-secondary">Sin requisitos pendientes conocidos.</p>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <a href={cache.telefonosSoporteEmergencia.soporteHref} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface px-4 font-body text-sm font-bold text-text-primary">
            Llamar soporte
          </a>
          <a href={cache.telefonosSoporteEmergencia.emergenciaHref} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-danger-action bg-danger-action px-4 font-body text-sm font-bold text-white">
            Emergencia
          </a>
          <Button variant="primary" loading={reintentando} onClick={reintentar} className="w-full">
            Reintentar conexión
          </Button>
        </div>
      </div>
    </section>
  );
}

