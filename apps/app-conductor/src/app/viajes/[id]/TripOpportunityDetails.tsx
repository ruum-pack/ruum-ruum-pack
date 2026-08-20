"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { aceptarViaje } from "@ruum/api/services";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

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

  // Countdown timer for offer acceptance (120 seconds default)
  const [segundosRestantes, setSegundosRestantes] = useState(120);

  const trasladoId = pasaporte.traslado_id!;
  
  useEffect(() => {
    const interval = setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (seg: number) => {
    const mins = Math.floor(seg / 60);
    const secs = seg % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const porcentajeProgreso = Math.max(0, Math.min(100, (segundosRestantes / 120) * 100));

  const origenCiudad = pasaporte.origen_ciudad || "Por confirmar";
  const destinoCiudad = pasaporte.destino_ciudad || "Por confirmar";
  const distanciaTotal = pasaporte.distancia_km ? pasaporte.distancia_km.toFixed(1) : "0";
  const tiempoEstimado = pasaporte.tiempo_estimado_horas 
    ? Math.round(pasaporte.tiempo_estimado_horas * 60) 
    : 0;

  // Aproximación (Mock calculation, normally comes from backend)
  const distanciaAprox = pasaporte.distancia_km ? (pasaporte.distancia_km * 0.08).toFixed(1) : "4.2";
  const tiempoAprox = pasaporte.tiempo_estimado_horas ? Math.max(5, Math.round(pasaporte.tiempo_estimado_horas * 60 * 0.1)) : 9;

  const gananciaNeta = pasaporte.ganancia_conductor || 0;

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
      setAvisoExito("¡Traslado aceptado! Preparando viaje...");
      setTimeout(() => {
        router.push(`/viajes/${trasladoId}`);
      }, 1000);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos aceptar el traslado."));
      setProcesando(false);
    }
  }

  function handleRechazar() {
    router.push("/viajes?vista=disponibles");
  }

  const expirado = segundosRestantes === 0;

  return (
    <div className="mx-auto w-full max-w-md bg-[#070B14] min-h-screen flex flex-col text-white pb-6 px-4">
      {/* HEADER */}
      <header className="flex items-center justify-between py-4">
        <button onClick={handleRechazar} className="p-2 -ml-2 text-text-tertiary hover:text-white transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        </button>
        <span className="font-display text-[13px] font-black uppercase tracking-widest text-amber-400">NUEVA OFERTA</span>
        <div className="w-10" />
      </header>

      {/* TIMELINE PROGRESS */}
      <div className="w-full bg-[#0E1524] h-2 rounded-full overflow-hidden mb-6 border border-border/20">
        <div 
          className={`h-full transition-all duration-1000 ease-linear ${segundosRestantes < 30 ? 'bg-rose-500' : 'bg-amber-400'}`}
          style={{ width: `${porcentajeProgreso}%` }}
        />
      </div>

      <div className="flex flex-col flex-1 gap-6">
        {/* TIMER & HERO */}
        <div className="flex flex-col items-center">
          <span className={`font-mono text-sm font-bold tracking-widest mb-2 ${segundosRestantes < 30 ? 'text-rose-400 animate-pulse' : 'text-text-secondary'}`}>
            {expirado ? "OFERTA EXPIRADA" : `EXPIRA EN ${formatTimer(segundosRestantes)}`}
          </span>
          <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Ganancia Neta</span>
          <div className="flex items-start mt-1">
            <span className="text-2xl font-bold text-emerald-400 mt-1 mr-1">$</span>
            <span className="font-display text-[56px] font-black text-emerald-400 leading-none tracking-tight">
              {gananciaNeta.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-xs text-text-secondary mt-2 font-medium">Incluye tarifa base y bonos</span>
        </div>

        {/* RUTAS Y LOGÍSTICA */}
        <div className="bg-[#0E1524] border border-border/20 rounded-3xl p-5 mt-2 flex flex-col gap-4 shadow-lg">
          <div className="flex flex-col">
            <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest mb-3 block">ITINERARIO</span>
            
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center mt-1">
                <span className="text-emerald-400 text-sm">📍</span>
                <div className="w-px h-8 bg-border/40 my-1" />
                <span className="text-[#3B82F6] text-sm">📍</span>
              </div>
              <div className="flex flex-col justify-between py-0.5">
                <div className="flex flex-col mb-4">
                  <span className="font-display text-lg font-black leading-none">{origenCiudad}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-lg font-black leading-none">{destinoCiudad}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-border/20 my-1" />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Distancia total</span>
              <span className="font-bold text-base mt-0.5">{distanciaTotal} km</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Tiempo estimado</span>
              <span className="font-bold text-base mt-0.5">{tiempoEstimado} min</span>
            </div>
          </div>
        </div>

        {/* APROXIMACIÓN */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5-1.5zM5 11l1.5-4.5h11L19 11H5z" /></svg>
              Distancia de Aproximación
            </span>
            <span className="font-bold text-white mt-1">A {distanciaAprox} km • {tiempoAprox} min</span>
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

      {/* CTAs */}
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleAceptar}
          disabled={procesando || expirado}
          className="flex w-full items-center justify-center gap-2 rounded-[1rem] bg-emerald-500 hover:bg-emerald-600 px-4 py-4 font-display text-[15px] font-black tracking-widest text-[#070B14] uppercase shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {procesando ? TEXTOS_CARGANDO.actualizando : "ACEPTAR TRASLADO"}
        </button>
        <button
          type="button"
          onClick={handleRechazar}
          disabled={procesando}
          className="flex w-full items-center justify-center gap-2 rounded-[1rem] bg-transparent text-text-tertiary hover:text-white px-4 py-3 font-display text-[11px] font-bold tracking-widest uppercase transition-all"
        >
          Rechazar y ver más ofertas
        </button>
      </div>

    </div>
  );
}
