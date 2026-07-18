"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Conductor } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
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
import type { PanelReviewState, PasaporteRow } from "./panel-utils";

export type Disponibilidad = DriverAvailability;

function conductorOperativo(real: Awaited<ReturnType<typeof obtenerConductorActual>>): Conductor | null {
  if (!real) return null;
  return {
    id: real.id,
    nombre: real.nombre,
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
  const ultimoTriggerDisponibilidadRef = useRef(0);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) return;
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

        const conductorActual = conductorOperativo(real);
        setConductor(conductorActual);

        const [aceptados, disponibles, disponibilidadOperativa] = await Promise.all([
          listarViajesAceptados(cliente, real.id),
          listarViajesDisponibles(cliente),
          obtenerDisponibilidadConductor(cliente, real.id)
        ]);
        setViajesAceptados(aceptados);
        setViajesDisponibles(disponibles);
        setDisponibilidad(aceptados.some((viaje) => viaje.estado === "traslado_en_curso") ? "en_viaje" : disponibilidadOperativa);
      } catch (err) {
        setErrorDisponibilidad(traducirErrorOperativo(err, "No pudimos cargar tu información operativa."));
      }
    }

    void cargar();
  }, [router]);

  const viajeActivoPrincipal = useMemo(
    () => viajesAceptados.find((viaje) => viaje.estado && viajeEsOperacionActiva(viaje.estado)) ?? null,
    [viajesAceptados]
  );
  const proximoViaje = useMemo(
    () => viajesAceptados.find((viaje) => !viaje.estado || !viajeEsOperacionActiva(viaje.estado)) ?? null,
    [viajesAceptados]
  );
  const documentoBloqueante = Boolean(conductor && !conductor.documentos_vigentes);
  const avisoPrioritario = useMemo(() => {
    if (documentoBloqueante) {
      return {
        tono: "atencion" as const,
        titulo: "Documento pendiente",
        cuerpo: "Actualiza tus documentos para evitar bloqueos al recibir oportunidades."
      };
    }
    if (errorDisponibilidad) {
      return { tono: "danger" as const, titulo: "No pudimos actualizar el panel", cuerpo: errorDisponibilidad };
    }
    if (disponibilidad === "no_disponible") {
      return {
        tono: "info" as const,
        titulo: "No estás disponible",
        cuerpo: "Activa tu disponibilidad cuando puedas recibir nuevos viajes."
      };
    }
    return {
      tono: "info" as const,
      titulo: viajesDisponibles.length > 0 ? "Oportunidades listas" : "Sin oportunidades nuevas",
      cuerpo: viajesDisponibles.length > 0
        ? `Hay ${viajesDisponibles.length} oportunidad(es) disponible(s).`
        : "Te avisaremos cuando haya viajes compatibles con tu perfil."
    };
  }, [disponibilidad, documentoBloqueante, errorDisponibilidad, viajesDisponibles.length]);

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
    conductor,
    disponibilidad,
    disponibilidadPendiente,
    persistiendoDisponibilidad,
    viajesDisponibles,
    enRevision,
    viajeActivoPrincipal,
    proximoViaje,
    documentoBloqueante,
    avisoPrioritario,
    seleccionarDisponibilidad,
    persistirDisponibilidad,
    setDisponibilidadPendiente
  };
}
