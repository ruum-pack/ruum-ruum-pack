"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Conductor } from "@ruum/shared/types";
import { traducirErrorOperativo, suscribirCanalSeguro, limpiarCanalesSeguros } from "@ruum/shared/utils";
import {
  guardarDisponibilidadConductor,
  listarViajesAceptados,
  listarViajesDisponibles,
  obtenerConductorActual,
  obtenerDisponibilidadConductor,
  obtenerSolicitudConductorActual
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { viajeEsOperacionActiva } from "../ViajeActivoContext";
import type { DriverAvailability } from "./DriverAvailabilityControl";
import type { DocumentoConductorRow, PanelReviewState, PasaporteRow } from "./panel-utils";

export type Disponibilidad = DriverAvailability;

export type DocumentosStatus = "vigentes" | "por_vencer" | "bloqueantes";

function conductorOperativo(
  real: Awaited<ReturnType<typeof obtenerConductorActual>>,
  email?: string | null
): Conductor | null {
  if (!real) return null;
  return {
    id: real.id,
    nombre: real.nombre,
    email: email ?? null,
    telefono: real.telefono ?? null,
    estado: real.estado,
    calificacion_promedio: real.calificacion_promedio,
    traslados_completados: real.traslados_completados,
    suspensiones_activas: real.suspensiones_activas,
    no_presentaciones_6m: real.no_presentaciones_6m,
    cancelaciones_sin_justificacion_count: real.cancelaciones_sin_justificacion_count,
    documentos_vigentes: real.documentos_vigentes,
    certificaciones: [],
    incidencias_graves_6m: real.incidencias_graves_6m,
    incidencias_graves_12m: real.incidencias_graves_12m,
    creado_en: real.creado_en
  };
}

export function usePanelData() {
  const router = useRouter();
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad>("disponible");
  const [disponibilidadPendiente, setDisponibilidadPendiente] = useState<Disponibilidad | null>(null);
  const [persistiendoDisponibilidad, setPersistiendoDisponibilidad] = useState(false);
  const [errorDisponibilidad, setErrorDisponibilidad] = useState<string | null>(null);
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [viajesAceptados, setViajesAceptados] = useState<PasaporteRow[]>([]);
  const [viajesDisponibles, setViajesDisponibles] = useState<PasaporteRow[]>([]);
  const [enRevision, setEnRevision] = useState<PanelReviewState | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoConductorRow[]>([]);
  const [notificacionesCount, setNotificacionesCount] = useState(0);
  const [gananciasHoy, setGananciasHoy] = useState<number>(0);
  const [trasladosHoy, setTrasladosHoy] = useState<number>(0);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const ultimoTriggerDisponibilidadRef = useRef(0);
  const recargaDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const cargar = useCallback(async (esRefrescoSilencioso = false) => {
    if (!tieneSupabaseConfigurado()) {
      setErrorDisponibilidad("Supabase no está configurado. No se puede cargar tu información operativa.");
      setCargando(false);
      setRefrescando(false);
      return;
    }

    if (esRefrescoSilencioso) {
      setRefrescando(true);
    }

    try {
      const cliente = crearClienteNavegador();
      const { data: sesion } = await cliente.auth.getUser();
      if (!sesion.user) {
        router.replace("/login");
        return;
      }

      const real = await obtenerConductorActual(cliente);
      if (!real) {
        const solicitud = await obtenerSolicitudConductorActual(cliente);
        if (!solicitud) {
          router.replace("/registro");
          return;
        }
        if (["borrador", "correo_pendiente", "datos_incompletos", "documentos_pendientes"].includes(solicitud.estado)) {
          router.replace("/registro");
          return;
        }
        const { data: docs, error: errorDocs } = await cliente
          .from("documentos_conductor")
          .select("*")
          .eq("solicitud_id", solicitud.id)
          .order("creado_en", { ascending: false });
        if (errorDocs) throw errorDocs;
        const personales = solicitud.datos_personales as { nombre?: string };
        setEnRevision({
          solicitudId: solicitud.id,
          nombre: personales.nombre ?? "Conductor",
          documentos: docs ?? [],
          estado: solicitud.estado,
          enviadoEn: solicitud.enviado_en
        });
        return;
      }

      if (real.estado_expediente !== "aprobado" || !["activo", "modo_prueba_supervisada"].includes(real.estado)) {
        const { data: docs, error: errorDocs } = await cliente
          .from("documentos_conductor")
          .select("*")
          .eq("conductor_id", real.id)
          .order("creado_en", { ascending: false });
        if (errorDocs) throw errorDocs;
        setEnRevision({ conductorId: real.id, nombre: real.nombre, documentos: docs ?? [], estado: real.estado_expediente });
        return;
      }

      const conductorActual = conductorOperativo(real, sesion.user?.email);
      setConductor(conductorActual);

      const inicioHoy = new Date();
      inicioHoy.setHours(0, 0, 0, 0);
      const resultados = await Promise.allSettled([
        listarViajesAceptados(cliente, real.id),
        listarViajesDisponibles(cliente),
        obtenerDisponibilidadConductor(cliente, real.id),
        cliente
          .from("notificaciones_conductor")
          .select("id", { count: "exact", head: true })
          .is("leida_en", null),
        cliente
          .from("traslados")
          .select("ganancia_conductor_congelada, precio_final, precio_cotizado")
          .eq("conductor_id", real.id)
          .eq("estado", "servicio_cerrado")
          .gte("cerrado_en", inicioHoy.toISOString()),
        cliente
          .from("documentos_conductor")
          .select("*")
          .eq("conductor_id", real.id)
          .order("creado_en", { ascending: false })
      ]);

      const aceptados = resultados[0].status === "fulfilled" ? resultados[0].value : [];
      const disponibles = resultados[1].status === "fulfilled" ? resultados[1].value : [];
      const disponibilidadOperativa = resultados[2].status === "fulfilled"
        ? resultados[2].value
        : ("no_disponible" as const);
      const countNoLeidas =
        resultados[3].status === "fulfilled" && "count" in resultados[3].value
          ? (resultados[3].value.count ?? 0)
          : 0;
      const trasladosDelDia: Array<{ ganancia_conductor_congelada: number | null; precio_final: number | null; precio_cotizado: number | null }> =
        resultados[4].status === "fulfilled" && "data" in resultados[4].value
          ? ((resultados[4].value.data as Array<{ ganancia_conductor_congelada: number | null; precio_final: number | null; precio_cotizado: number | null }>) ?? [])
          : [];
      const docsConductor: DocumentoConductorRow[] =
        resultados[5].status === "fulfilled" && "data" in resultados[5].value && resultados[5].value.data
          ? (resultados[5].value.data as DocumentoConductorRow[])
          : [];

      const gananciaDelDia = trasladosDelDia.reduce((acc, t) => {
        const monto = Number(t.ganancia_conductor_congelada ?? ((t.precio_final ?? t.precio_cotizado ?? 0) * 0.85));
        return acc + monto;
      }, 0);

      setViajesAceptados(aceptados);
      setViajesDisponibles(disponibles);
      setNotificacionesCount(countNoLeidas);
      setGananciasHoy(gananciaDelDia);
      setTrasladosHoy(trasladosDelDia.length);
      setDocumentos(docsConductor);
      setDisponibilidad(aceptados.some((viaje) => viaje.estado === "traslado_en_curso") ? "en_viaje" : disponibilidadOperativa);
      setUltimaActualizacion(new Date());
      setErrorDisponibilidad(null);
    } catch (err) {
      setErrorDisponibilidad(traducirErrorOperativo(err, "No pudimos cargar tu información operativa."));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [router]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Suscripción Realtime a Traslados y Notificaciones
  useEffect(() => {
    if (!conductor?.id || !tieneSupabaseConfigurado()) return;

    let cliente: ReturnType<typeof crearClienteNavegador>;
    try {
      cliente = crearClienteNavegador();
    } catch {
      return;
    }

    const triggerRecarga = () => {
      if (recargaDebounceRef.current) clearTimeout(recargaDebounceRef.current);
      recargaDebounceRef.current = setTimeout(() => {
        void cargar(true);
      }, 800);
    };

    const canalTraslados = cliente
      .channel(`panel_traslados_${conductor.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "traslados" },
        () => triggerRecarga()
      );

    const canalNotificaciones = cliente
      .channel(`panel_notificaciones_${conductor.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificaciones_conductor",
          filter: `conductor_id=eq.${conductor.id}`
        },
        () => triggerRecarga()
      );

    const desuscribirTraslados = suscribirCanalSeguro(cliente, canalTraslados, {
      onError: (err) => console.warn("[usePanelData] error en canalTraslados", err)
    });
    const desuscribirNotificaciones = suscribirCanalSeguro(cliente, canalNotificaciones, {
      onError: (err) => console.warn("[usePanelData] error en canalNotificaciones", err)
    });

    return () => {
      if (recargaDebounceRef.current) clearTimeout(recargaDebounceRef.current);
      void Promise.allSettled([desuscribirTraslados(), desuscribirNotificaciones()]);
      void limpiarCanalesSeguros(cliente, [canalTraslados, canalNotificaciones]);
    };
  }, [conductor?.id, cargar]);

  const viajeActivoPrincipal = useMemo(
    () => viajesAceptados.find((viaje) => viaje.estado && viajeEsOperacionActiva(viaje.estado)) ?? null,
    [viajesAceptados]
  );
  const proximoViaje = useMemo(
    () => viajesAceptados.find((viaje) => !viaje.estado || !viajeEsOperacionActiva(viaje.estado)) ?? null,
    [viajesAceptados]
  );

  const documentoBloqueante = Boolean(conductor && !conductor.documentos_vigentes);

  const documentoPorVencer = useMemo(() => {
    if (documentoBloqueante) return false;
    const ahora = Date.now();
    const quinceDiasMs = 15 * 24 * 60 * 60 * 1000;
    return documentos.some((doc) => {
      if (!doc.expira_en) return false;
      const fechaExp = new Date(doc.expira_en).getTime();
      return fechaExp > ahora && fechaExp - ahora <= quinceDiasMs;
    });
  }, [documentos, documentoBloqueante]);

  const persistirDisponibilidad = useCallback(
    async (nuevaDisponibilidad: Exclude<Disponibilidad, "en_viaje">) => {
      const anterior = disponibilidad;
      setDisponibilidad(nuevaDisponibilidad);
      setPersistiendoDisponibilidad(true);
      setErrorDisponibilidad(null);

      try {
        if (!conductor) throw new Error("Inicia sesión como conductor para cambiar tu disponibilidad.");
        const cliente = crearClienteNavegador();
        await guardarDisponibilidadConductor(cliente, conductor.id, nuevaDisponibilidad);
      } catch (err) {
        setDisponibilidad(anterior);
        setErrorDisponibilidad(traducirErrorOperativo(err, "No pudimos actualizar tu disponibilidad. Restauramos el estado anterior."));
      } finally {
        setPersistiendoDisponibilidad(false);
        setDisponibilidadPendiente(null);
      }
    },
    [disponibilidad, conductor]
  );

  const seleccionarDisponibilidad = useCallback(
    (nuevaDisponibilidad: Disponibilidad) => {
      const ahora = Date.now();
      if (ahora - ultimoTriggerDisponibilidadRef.current < 500) return;
      ultimoTriggerDisponibilidadRef.current = ahora;

      if (disponibilidad === "en_viaje" || nuevaDisponibilidad === "en_viaje" || persistiendoDisponibilidad) return;
      if (disponibilidad === nuevaDisponibilidad) return;

      if (nuevaDisponibilidad === "no_disponible") {
        setDisponibilidadPendiente(nuevaDisponibilidad);
        return;
      }

      void persistirDisponibilidad(nuevaDisponibilidad);
    },
    [disponibilidad, persistiendoDisponibilidad, persistirDisponibilidad]
  );

  return {
    cargando,
    refrescando,
    ultimaActualizacion,
    conductor,
    disponibilidad,
    disponibilidadPendiente,
    persistiendoDisponibilidad,
    viajesDisponibles,
    enRevision,
    viajeActivoPrincipal,
    proximoViaje,
    documentoBloqueante,
    documentoPorVencer,
    documentos,
    notificacionesCount,
    gananciasHoy,
    trasladosHoy,
    errorDisponibilidad,
    seleccionarDisponibilidad,
    persistirDisponibilidad,
    setDisponibilidadPendiente,
    recargar: () => cargar(true)
  };
}
