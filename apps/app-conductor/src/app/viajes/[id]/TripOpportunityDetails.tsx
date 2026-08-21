"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO, TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { aceptarViaje } from "@ruum/api/services";
import { obtenerUbicacionActualConEstado, distanciaMetrosEntre, type Coordenadas } from "../../../lib/ubicacion";
import { nombreVehiculo } from "../trips-utils";
import { MapaRutaConduccion } from "./MapaRutaConduccion";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

function extraerColonia(direccion: string | null): string {
  if (!direccion) return "";
  const partes = direccion.split(",").map((p) => p.trim());
  return partes[1] ?? partes[0] ?? "";
}

export function TripOpportunityDetails({
  pasaporte,
  volver
}: {
  pasaporte: PasaporteRow;
  volver: string;
}) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoExito, setAvisoExito] = useState<string | null>(null);
  const [ofertaTomada, setOfertaTomada] = useState(false);
  const [posicionConductor, setPosicionConductor] = useState<Coordenadas | null>(null);
  const [calculandoAproximacion, setCalculandoAproximacion] = useState(true);

  const trasladoId = pasaporte.traslado_id!;

  // 2. Suscripción Realtime a cambios en este traslado (Detección de asignación concurrente)
  useEffect(() => {
    if (!trasladoId || !tieneSupabaseConfigurado()) return;

    let cliente: ReturnType<typeof crearClienteNavegador>;
    try {
      cliente = crearClienteNavegador();
    } catch {
      return;
    }

    const canal = cliente
      .channel(`oferta_detalle_${trasladoId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "traslados",
          filter: `id=eq.${trasladoId}`
        },
        (payload: any) => {
          const nuevo = payload.new;
          if (nuevo && nuevo.conductor_id && nuevo.estado !== "pendiente_de_conductor") {
            setOfertaTomada(true);
          }
        }
      )
      .subscribe();

    return () => {
      cliente.removeChannel(canal);
    };
  }, [trasladoId]);

  // Si el viaje ya está asignado o no está pendiente, redirigir al flujo activo
  useEffect(() => {
    async function verificarAsignacion() {
      if (!tieneSupabaseConfigurado()) return;
      try {
        const cliente = crearClienteNavegador();
        const { data: { session } } = await cliente.auth.getSession();
        if (!session?.user) return;
        const { data: cond } = await cliente
          .from("conductores")
          .select("id")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();

        if (cond && pasaporte.conductor_id === cond.id) {
          router.replace(`/viajes/${trasladoId}`);
        }
      } catch {
        // Ignorar error de lectura de sesión
      }
    }

    if (pasaporte.conductor_id || pasaporte.estado !== "pendiente_de_conductor") {
      void verificarAsignacion();
    }
  }, [pasaporte.conductor_id, pasaporte.estado, trasladoId, router]);

  // 3. Cálculo real de aproximación GPS
  useEffect(() => {
    let cancelado = false;
    async function obtenerGPS() {
      try {
        const resultado = await obtenerUbicacionActualConEstado();
        if (!cancelado && resultado.estado === "ok") {
          setPosicionConductor(resultado.coordenadas);
        }
      } catch {
        // Ignorar fallo de geolocalización
      } finally {
        if (!cancelado) setCalculandoAproximacion(false);
      }
    }
    void obtenerGPS();
    return () => {
      cancelado = true;
    };
  }, []);

  const aproximacionReal = useMemo(() => {
    if (
      posicionConductor &&
      pasaporte.origen_lat !== null &&
      pasaporte.origen_lng !== null
    ) {
      const metros = distanciaMetrosEntre(
        { lat: posicionConductor.lat, lng: posicionConductor.lng },
        { lat: pasaporte.origen_lat, lng: pasaporte.origen_lng }
      );
      const km = (metros / 1000).toFixed(1);
      const min = Math.max(1, Math.round((metros / 1000) * 2.5));
      return { distancia: `${km} km`, tiempo: `${min} min`, exacto: true };
    }

    if (pasaporte.distancia_km) {
      const kmAprox = (pasaporte.distancia_km * 0.08).toFixed(1);
      const minAprox = Math.max(5, Math.round(pasaporte.distancia_km * 0.2));
      return { distancia: `${kmAprox} km`, tiempo: `${minAprox} min`, exacto: false };
    }

    return { distancia: "Por calcular", tiempo: "Por calcular", exacto: false };
  }, [posicionConductor, pasaporte.origen_lat, pasaporte.origen_lng, pasaporte.distancia_km]);

  const origenCiudad = pasaporte.origen_ciudad || "Por confirmar";
  const origenColonia = extraerColonia(pasaporte.origen_direccion);
  const destinoCiudad = pasaporte.destino_ciudad || "Por confirmar";
  const destinoColonia = extraerColonia(pasaporte.destino_direccion);

  const distanciaTotal = pasaporte.distancia_km ? `${pasaporte.distancia_km.toFixed(1)} km` : "Por confirmar";
  const tiempoEstimado = pasaporte.tiempo_estimado_horas
    ? `${Math.round(pasaporte.tiempo_estimado_horas * 60)} min`
    : "Por confirmar";

  const gananciaNeta = pasaporte.ganancia_conductor || 0;
  const autoNombre = nombreVehiculo(pasaporte);
  const tipoVehiculo = pasaporte.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo] : null;

  async function handleAceptar() {
    setProcesando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();
      const { data: { session } } = await cliente.auth.getSession();
      if (!session?.user) {
        throw new Error("Inicia sesión para poder aceptar traslados.");
      }

      const { data: conductorData, error: condError } = await cliente
        .from("conductores")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (condError || !conductorData) {
        throw new Error("No se encontró tu perfil de conductor en el sistema.");
      }

      await aceptarViaje(cliente, trasladoId, conductorData.id);
      setAvisoExito("¡Traslado aceptado con éxito! Redirigiendo...");
      setTimeout(() => {
        router.push(`/viajes/${trasladoId}`);
      }, 1000);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos aceptar el traslado."));
      setProcesando(false);
    }
  }

  const tieneCoordenadas =
    pasaporte.origen_lat !== null &&
    pasaporte.origen_lng !== null &&
    pasaporte.destino_lat !== null &&
    pasaporte.destino_lng !== null;

  return (
    <div className="mx-auto w-full max-w-md bg-surface min-h-screen flex flex-col text-text-primary pb-8 px-4">
      {/* HEADER */}
      <header className="flex items-center justify-between py-4 border-b border-border/15">
        <Link
          href={volver}
          className="p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors rounded-full hover:bg-surface-elevated"
          aria-label="Volver a la lista de viajes"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Link>
        <span className="font-display text-sm font-black uppercase tracking-widest text-signal flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-signal animate-pulse" />
          NUEVA OFERTA DISPONIBLE
        </span>
        <div className="w-10" />
      </header>

      {/* ALERTA EN TIEMPO REAL SI OTRO CONDUCTOR YA TOMÓ LA OFERTA */}
      {ofertaTomada && (
        <div className="my-4">
          <Aviso tono="atencion">
            <div className="flex flex-col gap-2">
              <span className="font-bold">Esta oferta ya fue asignada a otro conductor.</span>
              <Link
                href={volver}
                className="inline-block font-display text-xs font-black text-route-action hover:underline"
              >
                Volver a la lista de ofertas disponibles →
              </Link>
            </div>
          </Aviso>
        </div>
      )}

      <div className="flex flex-col flex-1 gap-5 mt-4">
        {/* GANANCIA DESTACADA */}
        <div className="flex flex-col items-center bg-surface-elevated rounded-3xl p-5 border border-border/20 shadow-xs">
          <span className="font-mono text-xs font-extrabold tracking-widest mb-2 px-3 py-1 rounded-full border text-signal border-signal/30 bg-signal/10">
            DISPONIBLE PARA ACEPTAR
          </span>

          <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest mt-1">
            Ganancia Neta Conductor
          </span>

          <div className="flex items-start mt-1.5">
            <span className="text-xl font-bold text-signal mt-1 mr-1">$</span>
            <span className="font-display text-[48px] font-black text-signal leading-none tracking-tight tabular-nums">
              {gananciaNeta.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-[11px] text-text-secondary mt-2 font-semibold">
            Tarifa base garantizada + bonos operativos
          </span>
        </div>

        {/* FICHA TÉCNICA DEL VEHÍCULO */}
        <div className="bg-surface-elevated border border-border/20 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
          <span className="text-[10px] text-text-tertiary font-extrabold uppercase tracking-widest">
            Vehículo a Trasladar
          </span>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚗</span>
              <div className="flex flex-col">
                <span className="font-display text-sm font-black text-text-primary leading-tight">
                  {autoNombre}
                </span>
                <span className="font-body text-[11px] text-text-secondary mt-0.5">
                  {pasaporte.vehiculo_color ? `Color: ${pasaporte.vehiculo_color}` : "Color por confirmar"}
                </span>
              </div>
            </div>

            {tipoVehiculo && (
              <span className="px-2.5 py-1 rounded-lg bg-surface border border-border/30 text-[10px] font-bold text-text-primary uppercase">
                {tipoVehiculo}
              </span>
            )}
          </div>

          {pasaporte.vehiculo_placas && (
            <div className="flex items-center justify-between pt-2 border-t border-border/15">
              <span className="text-[10px] text-text-tertiary font-bold uppercase">Placas / Folio</span>
              <span className="font-mono text-xs font-black text-text-primary bg-surface px-2 py-0.5 rounded border border-border/20">
                {pasaporte.vehiculo_placas}
              </span>
            </div>
          )}
        </div>

        {/* ITINERARIO Y RUTAS */}
        <div className="bg-surface-elevated border border-border/20 rounded-3xl p-5 flex flex-col gap-4 shadow-xs">
          <span className="text-[10px] text-text-tertiary font-extrabold uppercase tracking-widest block">
            Itinerario de Ruta
          </span>

          <div className="flex flex-col gap-4">
            {/* Origen */}
            <div className="flex items-start gap-3">
              <div className="mt-1 flex flex-col items-center">
                <span className="h-3 w-3 rounded-full border-2 border-emerald-400 bg-transparent" />
                <span className="w-[1px] h-8 bg-border/40 my-1" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-display text-[9px] font-bold text-emerald-400 tracking-widest uppercase">
                  Punto de Recolección
                </span>
                {origenColonia && (
                  <span className="font-display text-sm font-black text-text-primary leading-tight truncate mt-0.5">
                    {origenColonia}
                  </span>
                )}
                <span className="font-body text-xs text-text-secondary truncate mt-0.5">
                  {origenCiudad}
                </span>
              </div>
            </div>

            {/* Destino */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <span className="h-3 w-3 rounded-full bg-route-action block" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-display text-[9px] font-bold text-route-action tracking-widest uppercase">
                  Punto de Entrega
                </span>
                {destinoColonia && (
                  <span className="font-display text-sm font-black text-text-primary leading-tight truncate mt-0.5">
                    {destinoColonia}
                  </span>
                )}
                <span className="font-body text-xs text-text-secondary truncate mt-0.5">
                  {destinoCiudad}
                </span>
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-border/20 my-1" />

          {/* Estadísticas de Ruta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Distancia total</span>
              <span className="font-display text-sm font-black text-text-primary mt-0.5 tabular-nums">{distanciaTotal}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Tiempo estimado</span>
              <span className="font-display text-sm font-black text-text-primary mt-0.5 tabular-nums">{tiempoEstimado}</span>
            </div>
          </div>
        </div>

        {/* MINI MAPA DE RUTA (Si hay coordenadas) */}
        {tieneCoordenadas && (
          <div className="overflow-hidden rounded-2xl border border-border/20 shadow-xs">
            <MapaRutaConduccion
              origen={{ lat: pasaporte.origen_lat!, lng: pasaporte.origen_lng! }}
              destino={{ lat: pasaporte.destino_lat!, lng: pasaporte.destino_lng! }}
            />
          </div>
        )}

        {/* DISTANCIA DE APROXIMACIÓN (GPS REAL) */}
        <div className="bg-surface-elevated border border-route-action/25 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div className="flex flex-col">
            <span className="text-[10px] text-route-action font-extrabold uppercase tracking-widest flex items-center gap-1.5">
              <span>📍</span>
              {aproximacionReal.exacto ? "Distancia desde tu ubicación" : "Aproximación estimada"}
            </span>
            <span className="font-display text-sm font-black text-text-primary mt-1">
              A {aproximacionReal.distancia} • ~{aproximacionReal.tiempo}
            </span>
          </div>
          {posicionConductor && (
            <span className="h-2.5 w-2.5 rounded-full bg-signal shrink-0" title="GPS activo" />
          )}
        </div>

        {/* BENEFICIOS OPERATIVOS */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-surface-elevated border border-border/15 rounded-xl flex items-center gap-2.5">
            <span className="text-lg">🛡️</span>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-bold text-text-primary">Seguro Incluido</span>
              <span className="text-[9px] text-text-secondary">Cobertura amplia activa</span>
            </div>
          </div>

          <div className="p-3 bg-surface-elevated border border-border/15 rounded-xl flex items-center gap-2.5">
            <span className="text-lg">⚡</span>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-bold text-text-primary">Pago Garantizado</span>
              <span className="text-[9px] text-text-secondary">Acreditación al entregar</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Aviso tono="danger">{error}</Aviso>
        </div>
      )}

      {avisoExito && (
        <div className="mt-4">
          <Aviso tono="info">{avisoExito}</Aviso>
        </div>
      )}

      {/* BOTONES DE ACCIÓN */}
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleAceptar}
          disabled={procesando || ofertaTomada}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-signal hover:bg-signal/85 px-4 min-h-[52px] font-display text-sm font-black tracking-widest text-slate-950 uppercase shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {procesando ? TEXTOS_CARGANDO.actualizando : "ACEPTAR TRASLADO →"}
        </button>

        <Link
          href={volver}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-surface-elevated hover:bg-surface border border-border/30 text-text-secondary hover:text-text-primary px-4 min-h-[44px] font-display text-xs font-bold tracking-widest uppercase transition-all text-center"
        >
          Volver y ver más ofertas
        </Link>
      </div>
    </div>
  );
}
