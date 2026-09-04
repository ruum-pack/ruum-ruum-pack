"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO, TEXTOS_CARGANDO, type MotivoRechazo } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo, suscribirCanalSeguro } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { solicitarAsignacionViaje, registrarEvento } from "@ruum/api/services";
import { obtenerUbicacionActualConEstado, distanciaMetrosEntre, type Coordenadas } from "../../../lib/ubicacion";
import { nombreVehiculo } from "../trips-utils";
import { MapaRutaConduccion } from "./MapaRutaConduccion";
import { RejectTripDialog } from "../RejectTripDialog";
import { ConductorStatusBadge } from "../../../components/v2/ConductorUI";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

function formatearTiempoEstimado(horasDecimal: number | null): string {
  if (horasDecimal == null || isNaN(horasDecimal)) return "Por confirmar";
  const totalMinutos = Math.round(horasDecimal * 60);
  const horas = Math.floor(totalMinutos / 60);
  const mins = totalMinutos % 60;
  return `${horas}:${mins.toString().padStart(2, "0")} hrs`;
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
  const [conductorId, setConductorId] = useState<string | null>(null);
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [posicionConductor, setPosicionConductor] = useState<Coordenadas | null>(null);
  const [calculandoAproximacion, setCalculandoAproximacion] = useState(true);
  const [mostrarModalRechazo, setMostrarModalRechazo] = useState(false);

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
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "traslados",
          filter: `id=eq.${trasladoId}`
        },
        (payload: { new: { conductor_id?: string | null; estado?: string | null } }) => {
          const nuevo = payload.new;
          if (nuevo && nuevo.conductor_id && nuevo.estado !== "pendiente_de_conductor") {
            if (conductorId && nuevo.conductor_id === conductorId) {
              setAvisoExito("El traslado fue asignado a tu cuenta. Abriendo el flujo operativo...");
              router.push(`/viajes?vista=mis-viajes`);
            } else {
              setOfertaTomada(true);
            }
          }
        }
      );

    const desuscribir = suscribirCanalSeguro(cliente, canal, {
      onError: (err) => console.warn("[TripOpportunityDetails] error en canal oferta", err)
    });

    return () => {
      void desuscribir();
    };
  }, [trasladoId, conductorId, router]);

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

        if (cond) setConductorId(cond.id);
        if (cond && pasaporte.conductor_id === cond.id) {
          router.replace(`/viajes/${trasladoId}`);
        }
      } catch {
        // Ignorar error de lectura de sesión
      }
    }

    void verificarAsignacion();
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
      const totalMinutos = Math.max(1, Math.round((metros / 1000) * 2.5));
      const horas = Math.floor(totalMinutos / 60);
      const mins = totalMinutos % 60;
      const tiempoTexto = horas > 0 ? `${horas}:${mins.toString().padStart(2, "0")} hrs` : `${mins} min`;
      return { distancia: `${km} km`, tiempo: tiempoTexto, exacto: true };
    }

    if (pasaporte.distancia_km) {
      const kmAprox = (pasaporte.distancia_km * 0.08).toFixed(1);
      const totalMinutos = Math.max(5, Math.round(pasaporte.distancia_km * 0.2));
      const horas = Math.floor(totalMinutos / 60);
      const mins = totalMinutos % 60;
      const tiempoTexto = horas > 0 ? `${horas}:${mins.toString().padStart(2, "0")} hrs` : `${mins} min`;
      return { distancia: `${kmAprox} km`, tiempo: tiempoTexto, exacto: false };
    }

    return { distancia: "Por calcular", tiempo: "Por calcular", exacto: false };
  }, [posicionConductor, pasaporte.origen_lat, pasaporte.origen_lng, pasaporte.distancia_km]);

  const origenCiudad = pasaporte.origen_ciudad || "Por confirmar";
  const origenDireccionCompleta = pasaporte.origen_direccion || "Dirección de recolección por confirmar";
  const destinoCiudad = pasaporte.destino_ciudad || "Por confirmar";
  const destinoDireccionCompleta = pasaporte.destino_direccion || "Dirección de entrega por confirmar";

  const distanciaTotal = pasaporte.distancia_km ? `${pasaporte.distancia_km.toFixed(1)} km` : "Por confirmar";
  const tiempoEstimado = formatearTiempoEstimado(pasaporte.tiempo_estimado_horas);

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

      setConductorId(conductorData.id);
      const resultado = await solicitarAsignacionViaje(cliente, trasladoId, conductorData.id, posicionConductor);
      const cierre = new Date(resultado.cierra_en).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
      setSolicitudEnviada(true);
      setAvisoExito(`Solicitud registrada. La competencia cierra a las ${cierre}; te avisaremos si eres seleccionado.`);
      setProcesando(false);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos aceptar el traslado."));
      setProcesando(false);
    }
  }

  async function handleConfirmarRechazo(motivo: MotivoRechazo) {
    setMostrarModalRechazo(false);
    setProcesando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();
      const { data: { session } } = await cliente.auth.getSession();
      if (session?.user) {
        const { data: conductorData } = await cliente
          .from("conductores")
          .select("id")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();

        if (conductorData) {
          await registrarEvento(cliente, "modificacion_traslado_activo", "conductor", conductorData.id, {
            traslado_id: trasladoId,
            accion: "rechazo_oferta_conductor",
            motivo
          });
        }
      }
      router.push(volver);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos registrar el rechazo de la oferta."));
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
        <ConductorStatusBadge status="active" label="Nueva oferta disponible" />
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
          <span className="font-mono text-xs font-extrabold tracking-widest mb-2 px-3 py-1 rounded-full border text-text-primary border-border/60 bg-surface uppercase">
            SOLICITA O RECHAZA
          </span>

          <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest mt-1">
            Ganancia Neta Conductor
          </span>

          <div className="flex items-start mt-1.5">
            <span className="text-xl font-bold text-text-primary mt-1 mr-1">$</span>
            <span className="font-display text-[48px] font-black text-text-primary leading-none tracking-tight tabular-nums">
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
                <span className="w-[1px] h-full min-h-[40px] bg-border/40 my-1" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-display text-[9px] font-bold text-emerald-400 tracking-widest uppercase">
                  Punto de Recolección (Datos Completos)
                </span>
                <span className="font-body text-sm font-semibold text-text-primary mt-1 leading-snug break-words">
                  {origenDireccionCompleta}
                </span>
                <span className="font-body text-xs text-text-secondary mt-0.5">
                  {origenCiudad}
                </span>
                {pasaporte.origen_referencias && (
                  <span className="font-body text-[11px] text-text-tertiary mt-1 italic">
                    Ref: {pasaporte.origen_referencias}
                  </span>
                )}
              </div>
            </div>

            {/* Destino */}
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <span className="h-3 w-3 rounded-full bg-route-action block" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-display text-[9px] font-bold text-route-action tracking-widest uppercase">
                  Punto de Entrega (Datos Completos)
                </span>
                <span className="font-body text-sm font-semibold text-text-primary mt-1 leading-snug break-words">
                  {destinoDireccionCompleta}
                </span>
                <span className="font-body text-xs text-text-secondary mt-0.5">
                  {destinoCiudad}
                </span>
                {pasaporte.destino_referencias && (
                  <span className="font-body text-[11px] text-text-tertiary mt-1 italic">
                    Ref: {pasaporte.destino_referencias}
                  </span>
                )}
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

      {/* BOTONES DE ACCIÓN: ACEPTAR O RECHAZAR */}
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleAceptar}
          disabled={procesando || ofertaTomada || solicitudEnviada}
          className="conductor-button conductor-button-primary w-full min-h-[52px] disabled:cursor-not-allowed"
        >
          {procesando ? TEXTOS_CARGANDO.actualizando : solicitudEnviada ? "SOLICITUD REGISTRADA" : "SOLICITAR ASIGNACIÓN →"}
        </button>

        <button
          type="button"
          onClick={() => setMostrarModalRechazo(true)}
          disabled={procesando || ofertaTomada || solicitudEnviada}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-surface-elevated hover:bg-surface border border-danger/40 hover:border-danger text-danger px-4 min-h-[48px] font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer select-none"
        >
          RECHAZAR TRASLADO
        </button>

        <Link
          href={volver}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-transparent hover:bg-surface-elevated/40 text-text-secondary hover:text-text-primary px-4 min-h-11 font-body text-xs font-semibold tracking-wide transition-all text-center"
        >
          Volver a la lista de ofertas
        </Link>
      </div>

      {mostrarModalRechazo && (
        <RejectTripDialog
          viaje={pasaporte}
          onClose={() => setMostrarModalRechazo(false)}
          onConfirm={handleConfirmarRechazo}
        />
      )}

      {/* FAB Navegación — replica /panel pattern, solo mobile, evita scroll hasta CTA */}
      {pasaporte.origen_lat != null && pasaporte.origen_lng != null && !ofertaTomada && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${pasaporte.origen_lat},${pasaporte.origen_lng}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Navegar al punto de recolección"
          className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-4 z-30 inline-flex items-center gap-2 rounded-full bg-signal px-5 py-3.5 font-display text-sm font-black text-slate-950 shadow-lg shadow-signal/20 hover:bg-signal/90 active:scale-[0.98] transition-all focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-signal lg:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          Navegar
        </a>
      )}
    </div>
  );
}
