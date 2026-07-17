"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCard, Button, Card, FinancialCard, OperationalCard, TripCard, Aviso, DriverEarning } from "@ruum/ui";
import { GLOSARIO_OPERATIVO } from "@ruum/shared/constants";
import type { Conductor } from "@ruum/shared/types";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import {
  guardarDisponibilidadConductor,
  listarViajesAceptados,
  listarViajesDisponibles,
  obtenerDisponibilidadConductor,
  obtenerConductorActual,
  obtenerSolicitudConductorActual
} from "@ruum/api/services";
import { RegistroViajeActivo, viajeEsOperacionActiva } from "../ViajeActivoContext";
import { getTripPresentation } from "../../lib/trip-presentation";
import { ConfirmarDisponibilidad } from "../ConfirmarDisponibilidad";
import { EstadoRevisionConductor } from "./EstadoRevisionConductor";
import { limpiarBorradorRegistroLocal } from "../../lib/borrador-registro";
import { MapaRutaOrigen } from "../viajes/[id]/MapaRutaOrigen";
import { ContactActionBar, type ContactRole } from "../viajes/[id]/ContactActionBar";
import { ESTADOS_QUE_REQUIEREN_EVIDENCIA } from "../viajes/[id]/AccionesViaje";
import { DriverAvailabilityControl, type DriverAvailability } from "./DriverAvailabilityControl";

type Disponibilidad = DriverAvailability;
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type DocumentoConductorRow = Database["public"]["Tables"]["documentos_conductor"]["Row"];

function nombreVehiculo(viaje: PasaporteRow) {
  return [viaje.vehiculo_marca, viaje.vehiculo_modelo, viaje.vehiculo_anio].filter(Boolean).join(" ") || "Vehículo";
}

function folioViaje(viaje: PasaporteRow) {
  return viaje.traslado_id.slice(0, 8).toUpperCase();
}

function destinoOperativo(viaje: PasaporteRow) {
  const presentation = getTripPresentation(viaje.estado);
  const vaADestino = ["go_destination", "mark_arrived_destination", "capture_destination_record", "confirm_delivery", "close_trip"].includes(
    presentation.primaryAction.action
  );
  const direccion = vaADestino ? viaje.destino_direccion : viaje.origen_direccion;
  const ciudad = vaADestino ? viaje.destino_ciudad : viaje.origen_ciudad;

  if (direccion && ciudad) return `${direccion} · ${ciudad}`;
  if (direccion) return direccion;
  if (ciudad) return ciudad;
  return vaADestino ? "Punto de entrega" : "Punto de recolección";
}

function usaDestinoActual(action: ReturnType<typeof getTripPresentation>["primaryAction"]["action"]) {
  return ["go_destination", "mark_arrived_destination", "capture_destination_record", "confirm_delivery", "close_trip"].includes(action);
}

function puntoActual(viaje: PasaporteRow, action: ReturnType<typeof getTripPresentation>["primaryAction"]["action"]) {
  const destino = usaDestinoActual(action);
  return {
    lat: destino ? viaje.destino_lat : viaje.origen_lat,
    lng: destino ? viaje.destino_lng : viaje.origen_lng,
    etiqueta: destino ? "Punto de entrega" : "Punto de recolección"
  };
}

function contactoRelevante(viaje: PasaporteRow, action: ReturnType<typeof getTripPresentation>["primaryAction"]["action"]) {
  const destino = usaDestinoActual(action);
  return {
    role: destino ? ("destino" as ContactRole) : ("origen" as ContactRole),
    name: destino ? viaje.contacto_recepcion_nombre : viaje.contacto_entrega_nombre,
    phone: destino ? viaje.contacto_recepcion_telefono : viaje.contacto_entrega_telefono
  };
}

function fechaViaje(viaje: PasaporteRow) {
  const fecha = viaje.creado_en ?? viaje.actualizado_en;
  if (!fecha) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City"
  }).format(new Date(fecha));
}

function esViajePorCerrar(viaje: PasaporteRow) {
  return ["llegada_a_destino", "evidencia_final_en_proceso", "evidencia_final_completada", "entrega_confirmada"].includes(viaje.estado);
}

export default function PaginaPanel() {
  const router = useRouter();
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad>("disponible");
  const [disponibilidadPendiente, setDisponibilidadPendiente] = useState<Disponibilidad | null>(null);
  const [persistiendoDisponibilidad, setPersistiendoDisponibilidad] = useState(false);
  const [errorDisponibilidad, setErrorDisponibilidad] = useState<string | null>(null);
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [viajesAceptados, setViajesAceptados] = useState<PasaporteRow[]>([]);
  const [viajesDisponibles, setViajesDisponibles] = useState<PasaporteRow[]>([]);
  const [enRevision, setEnRevision] = useState<{
    conductorId?: string;
    solicitudId?: string;
    nombre: string;
    documentos: DocumentoConductorRow[];
    estado: Database["public"]["Enums"]["estado_expediente_conductor"];
    enviadoEn?: string|null;
  } | null>(null);
  const ultimoTriggerDisponibilidadRef = useRef(0);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) return;
      try {
        const cliente = crearClienteNavegador();

        // H-5 — antes, sin sesión, este efecto simplemente no hacía nada:
        // se quedaba mostrando el dashboard vacío ("Listo para operar",
        // todo en cero) con un link discreto de "Iniciar sesión" en vez de
        // dejar claro que no hay sesión. Lo separamos del caso "sí hay
        // sesión pero no hay conductor ni solicitud" (que ahora, con el fix
        // en /registro, se autosana ahí mismo en vez de llegar aquí).
        const { data: sesion } = await cliente.auth.getUser();
        if (!sesion.user) { router.replace("/login"); return; }

        const real = await obtenerConductorActual(cliente);
        if (!real) {
          const solicitud = await obtenerSolicitudConductorActual(cliente);
          if (!solicitud) { router.replace("/registro"); return; }
          if (["borrador","correo_pendiente","datos_incompletos","documentos_pendientes"].includes(solicitud.estado)) {
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
          setEnRevision({ solicitudId: solicitud.id, nombre: personales.nombre ?? "Conductor", documentos: docs ?? [],estado:solicitud.estado,enviadoEn:solicitud.enviado_en });
          return;
        }

        // Fase 2 — conductor todavía en revisión: no tiene sentido (ni permisos)
        // pedir viajes. Mostramos el seguimiento de su expediente y salimos.
        if (real.estado === "pendiente_verificacion" && real.estado_expediente !== "aprobado") {
          const { data: docs, error: errorDocs } = await cliente
            .from("documentos_conductor")
            .select("*")
            .eq("conductor_id", real.id)
            .order("creado_en", { ascending: false });
          if (errorDocs) throw errorDocs;
          setEnRevision({ conductorId: real.id, nombre: real.nombre, documentos: docs ?? [],estado:real.estado_expediente });
          return;
        }

        setConductor({
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
        });

        const [aceptados, disponibles, disponibilidadOperativa] = await Promise.all([
          listarViajesAceptados(cliente, real.id),
          listarViajesDisponibles(cliente),
          obtenerDisponibilidadConductor(cliente, real.id)
        ]);
        setViajesAceptados(aceptados);
        setViajesDisponibles(disponibles);
        if (aceptados.some((viaje) => viaje.estado === "traslado_en_curso")) {
          setDisponibilidad("en_viaje");
        } else {
          setDisponibilidad(disponibilidadOperativa);
        }
      } catch (err) {
        setErrorDisponibilidad(traducirErrorOperativo(err,"No pudimos cargar tu información operativa."));
      }
    }
    cargar();
  }, [router]);

  const viajeActivoPrincipal = useMemo(
    () => viajesAceptados.find((viaje) => viajeEsOperacionActiva(viaje.estado)) ?? null,
    [viajesAceptados]
  );
  const presentationActiva = viajeActivoPrincipal ? getTripPresentation(viajeActivoPrincipal.estado) : null;
  const proximoViaje = useMemo(
    () => viajesAceptados.find((viaje) => !viajeEsOperacionActiva(viaje.estado)) ?? null,
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
        setErrorDisponibilidad(traducirErrorOperativo(err,"No pudimos actualizar tu disponibilidad. Restauramos el estado anterior."));
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

  async function cerrarSesion() {
    const cliente = crearClienteNavegador();
    await cliente.auth.signOut();
    limpiarBorradorRegistroLocal();
    router.push("/onboarding");
    router.refresh();
  }

  if (enRevision) {
    return (
      <EstadoRevisionConductor
        conductorId={enRevision.conductorId}
        solicitudId={enRevision.solicitudId}
        nombre={enRevision.nombre}
        documentosIniciales={enRevision.documentos}
        estadoExpediente={enRevision.estado}
        enviadoEn={enRevision.enviadoEn}
        onSalir={cerrarSesion}
      />
    );
  }

  const puntoActivo = viajeActivoPrincipal && presentationActiva ? puntoActual(viajeActivoPrincipal, presentationActiva.primaryAction.action) : null;
  const contactoActivo = viajeActivoPrincipal && presentationActiva ? contactoRelevante(viajeActivoPrincipal, presentationActiva.primaryAction.action) : null;
  const requiereEvidenciaActiva = viajeActivoPrincipal ? ESTADOS_QUE_REQUIEREN_EVIDENCIA.includes(viajeActivoPrincipal.estado) : false;
  const requiereCierreActivo = viajeActivoPrincipal ? esViajePorCerrar(viajeActivoPrincipal) : false;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <RegistroViajeActivo
        viaje={
          viajeActivoPrincipal
            ? {
                trasladoId: viajeActivoPrincipal.traslado_id,
                estado: viajeActivoPrincipal.estado,
                origenDireccion: viajeActivoPrincipal.origen_direccion,
                origenCiudad: viajeActivoPrincipal.origen_ciudad,
                destinoDireccion: viajeActivoPrincipal.destino_direccion,
                destinoCiudad: viajeActivoPrincipal.destino_ciudad
              }
            : null
        }
      />
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight">Panel</h1>
          <p className="mt-1 font-body text-sm text-text-secondary">Hola, {conductor?.nombre ?? "conductor"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/cuenta">
            <Button variant="quiet">Configuración</Button>
          </Link>
          {conductor ? (
            <button onClick={cerrarSesion} className="inline-flex min-h-11 items-center font-body text-sm text-text-secondary hover:text-text-primary">
              Cerrar sesión
            </button>
          ) : (
            <Link href="/login" className="font-body text-sm font-medium text-text-secondary hover:text-text-primary">
              Iniciar sesión
            </Link>
          )}
        </div>
      </header>

      {viajeActivoPrincipal && presentationActiva ? (
        <main className="mt-8 grid gap-5" aria-label="Viaje activo">
          <OperationalCard>
            <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr] lg:items-center">
              <div>
                <p className="font-body text-sm font-semibold text-route-action">
                  Viaje activo · Folio {folioViaje(viajeActivoPrincipal)}
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">{presentationActiva.title}</h2>
                <p className="mt-3 max-w-2xl font-body text-sm leading-6 text-text-secondary">{presentationActiva.instruction}</p>
                <div className="mt-4 rounded-xl border border-route-action bg-route-soft px-4 py-3">
                  <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Destino actual</p>
                  <p className="mt-1 break-words font-body text-base font-semibold text-text-primary">{destinoOperativo(viajeActivoPrincipal)}</p>
                </div>
              </div>
              <div className="grid gap-3">
                <Link href={`/viajes/${viajeActivoPrincipal.traslado_id}`}>
                  <Button variant="primary" className="min-h-14 w-full text-base">
                    {presentationActiva.primaryAction.label}
                  </Button>
                </Link>
                <p className="font-body text-sm text-text-secondary">{nombreVehiculo(viajeActivoPrincipal)}</p>
              </div>
            </div>
          </OperationalCard>

          <Card>
            <p className="mb-3 font-body text-xs uppercase tracking-wide text-text-tertiary">Mapa</p>
            {puntoActivo?.lat !== null && puntoActivo?.lng !== null && puntoActivo ? (
              <MapaRutaOrigen destino={{ lat: puntoActivo.lat, lng: puntoActivo.lng }} />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-surface-elevated px-4 text-center font-body text-sm text-tertiary">
                Mapa no disponible. Usa la dirección del {puntoActivo?.etiqueta.toLowerCase() ?? "punto actual"}.
              </div>
            )}
          </Card>

          {contactoActivo && (
            <Card>
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Contacto</p>
              <ContactActionBar
                trasladoId={viajeActivoPrincipal.traslado_id}
                role={contactoActivo.role}
                name={contactoActivo.name}
                phone={contactoActivo.phone}
              />
            </Card>
          )}

          <OperationalCard>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Evidencia o requisito pendiente</p>
            <h2 className="mt-1 font-display text-xl font-semibold">
              {requiereEvidenciaActiva ? GLOSARIO_OPERATIVO.evidencia : requiereCierreActivo ? "Cierre pendiente" : "Sin requisito bloqueante"}
            </h2>
            <p className="mt-2 font-body text-sm text-text-secondary">
              {requiereEvidenciaActiva
                ? "Completa el registro del vehículo antes de continuar."
                : requiereCierreActivo
                  ? "Confirma entrega o cierre operativo para terminar el traslado."
                  : "Continúa con la acción principal del viaje activo."}
            </p>
            {(requiereEvidenciaActiva || requiereCierreActivo) && (
              <Link href={requiereEvidenciaActiva ? `/viajes/${viajeActivoPrincipal.traslado_id}/evidencia` : `/viajes/${viajeActivoPrincipal.traslado_id}`}>
                <Button variant="secondary" className="mt-4 w-full sm:w-auto">
                  {requiereEvidenciaActiva ? "Abrir registro" : "Abrir viaje"}
                </Button>
              </Link>
            )}
          </OperationalCard>

          <AlertCard>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Soporte</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Link href={`/viajes/${viajeActivoPrincipal.traslado_id}#contacto`}>
                <Button variant="secondary" className="w-full">Contacto</Button>
              </Link>
              <Link href={`/viajes/${viajeActivoPrincipal.traslado_id}#reportar-problema`}>
                <Button variant="secondary" className="w-full">Reportar problema</Button>
              </Link>
              <Link href={`/viajes/${viajeActivoPrincipal.traslado_id}#emergencia`}>
                <Button variant="emergency" className="w-full">Emergencia</Button>
              </Link>
            </div>
          </AlertCard>
        </main>
      ) : (
        <main className="mt-8 grid gap-5" aria-label="Inicio operativo">
          <OperationalCard>
            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <DriverAvailabilityControl
                value={disponibilidad}
                saving={persistiendoDisponibilidad}
                onChange={seleccionarDisponibilidad}
              />
              <Link href="/viajes?vista=disponibles">
                <Button variant="primary" className="min-h-14 w-full text-base">
                  Ver oportunidades ({viajesDisponibles.length})
                </Button>
              </Link>
            </div>
          </OperationalCard>

          <TripCard>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Próximo viaje</p>
            {proximoViaje ? (
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold">{nombreVehiculo(proximoViaje)}</h2>
                  <p className="mt-1 font-body text-sm text-text-secondary">{fechaViaje(proximoViaje)} · Folio {folioViaje(proximoViaje)}</p>
                </div>
                <Link href={`/viajes/${proximoViaje.traslado_id}`}>
                  <Button variant="secondary" className="w-full sm:w-auto">Ver viaje</Button>
                </Link>
              </div>
            ) : (
              <p className="mt-2 font-body text-sm text-text-secondary">Aún no tienes viajes aceptados próximos.</p>
            )}
          </TripCard>

          {documentoBloqueante ? (
            <AlertCard>
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Documento bloqueante</p>
              <div className="mt-2">
                <h2 className="font-display text-xl font-semibold">Revisa tus documentos</h2>
                <p className="mt-2 font-body text-sm text-text-secondary">
                  Este pendiente puede bloquear oportunidades. Atiéndelo antes de aceptar nuevos viajes.
                </p>
                <Link href="/cuenta/documentos">
                  <Button variant="primary" className="mt-4 w-full sm:w-auto">Abrir documentos</Button>
                </Link>
              </div>
            </AlertCard>
          ) : (
            <TripCard>
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Oportunidades cercanas</p>
              <div className="mt-3 grid gap-3">
                {viajesDisponibles.slice(0, 2).map((viaje) => (
                  <Link key={viaje.traslado_id} href="/viajes?vista=disponibles" className="rounded-xl border border-border px-4 py-3 hover:border-route-action hover:bg-route-soft">
                    <p className="font-body text-sm font-semibold">{nombreVehiculo(viaje)}</p>
                    <p className="mt-1 font-body text-xs text-text-tertiary">Folio {folioViaje(viaje)}</p>
                  </Link>
                ))}
                {viajesDisponibles.length === 0 && <p className="font-body text-sm text-text-secondary">No hay oportunidades disponibles por ahora.</p>}
              </div>
            </TripCard>
          )}

          <FinancialCard>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Ganancia semanal</p>
            <DriverEarning amount={null} status="sin_calcular" currency="MXN" className="mt-2" amountClassName="font-display text-2xl" />
            <Link href="/ganancias" className="mt-3 inline-flex font-body text-sm font-semibold text-route-action hover:underline">
              Abrir módulo de ganancias
            </Link>
          </FinancialCard>

          <AlertCard>
            <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Aviso prioritario</p>
            <div className="mt-2">
              <Aviso tono={avisoPrioritario.tono}>
                <strong>{avisoPrioritario.titulo}.</strong> {avisoPrioritario.cuerpo}
              </Aviso>
            </div>
          </AlertCard>
        </main>
      )}

      <ConfirmarDisponibilidad
        abierto={disponibilidadPendiente === "no_disponible"}
        persistiendo={persistiendoDisponibilidad}
        onCancelar={() => {
          if (!persistiendoDisponibilidad) setDisponibilidadPendiente(null);
        }}
        onConfirmar={() => void persistirDisponibilidad("no_disponible")}
      />
    </div>
  );
}
