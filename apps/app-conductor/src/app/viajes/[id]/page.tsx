import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

import { obtenerPasaporteDigital } from "@ruum/api/services";
import { Aviso, TripCard, EstadoBadge, EstadoStepper } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import { resumenClasificacionVehiculo } from "@ruum/shared/catalogos";
import { crearClienteServidor } from "../../../lib/supabase-server";
import { getTripPresentation } from "../../../lib/trip-presentation";
import { AccionesViaje } from "./AccionesViaje";
import { ChatViaje } from "./ChatViaje";
import { ContactActionBar, type ContactRole } from "./ContactActionBar";
import { MapaRutaOrigen } from "./MapaRutaOrigen";
import { ReportarIncidencia } from "./ReportarIncidencia";
import { EmergencyPanel } from "./EmergencyPanel";
import { AbrirDisputaConductor } from "./AbrirDisputa";
import { TripEvidenceComparison } from "./TripEvidenceComparison";
import { RegistroViajeActivo } from "../../ViajeActivoContext";
import { EstadoError } from "../../EstadoError";
import { registroViajeActivoDesdePasaporte } from "../../active-trip-state";

function calcularHorasDesdeCierre(actualizadoEn: string | null) {
  if (!actualizadoEn) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(actualizadoEn).getTime()) / (1000 * 60 * 60);
}

type Pasaporte = NonNullable<Awaited<ReturnType<typeof obtenerDatos>>["pasaporte"]>;

function usaDestinoActual(action: ReturnType<typeof getTripPresentation>["primaryAction"]["action"]) {
  return ["go_destination", "mark_arrived_destination", "capture_destination_record", "confirm_delivery", "close_trip"].includes(action);
}

function direccionActual(pasaporte: Pasaporte, action: ReturnType<typeof getTripPresentation>["primaryAction"]["action"]) {
  if (["contact_support", "review_status", "view_available_trips", "none"].includes(action)) {
    return {
      etiqueta: "Seguimiento operativo",
      direccion: "Espera indicaciones de Torre de Control",
      ciudad: null,
      referencias: null,
      lat: null,
      lng: null
    };
  }

  const destino = usaDestinoActual(action);
  return {
    etiqueta: destino ? "Dirección de entrega" : "Dirección de recolección",
    direccion: destino ? pasaporte.destino_direccion : pasaporte.origen_direccion,
    ciudad: destino ? pasaporte.destino_ciudad : pasaporte.origen_ciudad,
    referencias: destino ? pasaporte.destino_referencias : pasaporte.origen_referencias,
    lat: destino ? pasaporte.destino_lat : pasaporte.origen_lat,
    lng: destino ? pasaporte.destino_lng : pasaporte.origen_lng
  };
}

function contactoRelevante(pasaporte: Pasaporte, action: ReturnType<typeof getTripPresentation>["primaryAction"]["action"]) {
  const soporte = ["contact_support", "review_status", "view_available_trips", "none"].includes(action);
  if (soporte) {
    return {
      rol: "soporte" as ContactRole,
      etiqueta: "Soporte Ruum",
      nombre: "Equipo de soporte",
      telefono: null
    };
  }

  const destino = usaDestinoActual(action);
  return {
    rol: destino ? ("destino" as ContactRole) : ("origen" as ContactRole),
    etiqueta: destino ? "Contacto de recepción" : "Contacto de entrega",
    nombre: destino ? pasaporte.contacto_recepcion_nombre : pasaporte.contacto_entrega_nombre,
    telefono: destino ? pasaporte.contacto_recepcion_telefono : pasaporte.contacto_entrega_telefono
  };
}

function rutaVolverViajes(valor: string | undefined) {
  if (!valor) return "/viajes";
  try {
    const decodificada = decodeURIComponent(valor);
    return decodificada.startsWith("/viajes") && !decodificada.startsWith("/viajes/") ? decodificada : "/viajes";
  } catch {
    return "/viajes";
  }
}

async function obtenerDatos(id: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { pasaporte: null };
  }

  // Bug real encontrado en producción (2026-06-29): un cliente anónimo (sin
  // cookies, sin sesión) sí podía ver viajes disponibles sin asignar
  // (política RLS abierta por estado), pero en cuanto el conductor acepta
  // uno, solo aplica "conductor_ve_sus_traslados_asignados" — que exige
  // auth.uid() real. Sin sesión, esa consulta nunca encontraba la fila, y
  // la pantalla mostraba "No encontramos ese viaje" justo después de
  // aceptar. Se usa el cliente de servidor con cookies (sesión real) en su
  // lugar, mismo patrón que ya usan las acciones de aceptar/evidencia.
  const cliente = await crearClienteServidor();
  const pasaporte = await obtenerPasaporteDigital(cliente, id);
  return { pasaporte };
}

export default async function PaginaDetalleViaje({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ volver?: string }>;
}) {
  const { id } = await params;
  const volver = rutaVolverViajes((await searchParams)?.volver);
  const { pasaporte } = await obtenerDatos(id);

  if (!pasaporte) {
    return (
      <EstadoError
        titulo="No encontramos ese viaje"
        descripcion="Revisa el enlace o vuelve a tu lista de viajes para continuar."
        acciones={[
          { etiqueta: "Ver mis viajes", href: "/viajes", variant: "primary" },
          { etiqueta: "Volver al panel", href: "/", variant: "quiet" }
        ]}
      />
    );
  }

  if (!pasaporte.estado || !pasaporte.traslado_id) {
    return (
      <EstadoError
        titulo="No pudimos cargar el viaje completo"
        descripcion="Vuelve a intentarlo o contacta a soporte si el problema continúa."
        acciones={[
          { etiqueta: "Ver mis viajes", href: "/viajes", variant: "primary" },
          { etiqueta: "Volver al panel", href: "/", variant: "quiet" }
        ]}
      />
    );
  }

  const horasDesdeCierre = calcularHorasDesdeCierre(pasaporte.actualizado_en);
  const puedeAbrirDisputa =
    ["servicio_cerrado", "reclamo_resuelto", "cierre_operativo_con_incidencia_abierta"].includes(pasaporte.estado) &&
    horasDesdeCierre <= 72;
  const fotosCompletadas =
    pasaporte.estado === "evidencia_final_en_proceso"
      ? pasaporte.evidencia_final_fotos_sincronizadas
      : pasaporte.evidencia_inicial_fotos_sincronizadas;
  const fotosCompletadasOperacion = fotosCompletadas ?? undefined;
  const clasificacionCatalogo = resumenClasificacionVehiculo(
    pasaporte.vehiculo_marca ?? "",
    pasaporte.vehiculo_modelo ?? "",
  );
  const presentation = getTripPresentation(pasaporte.estado);
  const actual = direccionActual(pasaporte, presentation.primaryAction.action);
  const contacto = contactoRelevante(pasaporte, presentation.primaryAction.action);
  const vehiculo = [pasaporte.vehiculo_marca, pasaporte.vehiculo_modelo, pasaporte.vehiculo_anio].filter(Boolean).join(" ") || "Vehículo";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href={volver} className="mb-4 inline-flex font-body text-sm font-semibold text-route-action underline-offset-4 hover:underline">
        Volver a viajes
      </Link>
      <RegistroViajeActivo
        viaje={registroViajeActivoDesdePasaporte(pasaporte)}
      />
      <TripCard folio={pasaporte.traslado_id.slice(0, 8).toUpperCase()} className="overflow-visible">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-body text-sm font-semibold text-route-action">
              Paso {presentation.stage} de {presentation.totalStages}
            </p>
            <h1 className="mt-1 truncate font-display text-xl font-semibold">{presentation.title}</h1>
          </div>
          <div className="hidden md:block">
            <EstadoBadge estado={pasaporte.estado} />
          </div>
        </div>
        <div className="mt-4 hidden md:block">
          <EstadoStepper estado={pasaporte.estado} currentLabel={presentation.title} />
        </div>

        <div className="sticky top-[var(--conductor-sticky-action-top)] z-20 mt-5 rounded-2xl bg-surface/95 pb-1 backdrop-blur">
          <AccionesViaje
            trasladoId={pasaporte.traslado_id}
            estado={pasaporte.estado}
            presentation={presentation}
            fotosCompletadas={fotosCompletadasOperacion}
            origenDireccion={pasaporte.origen_direccion}
            origenCiudad={pasaporte.origen_ciudad}
            origenReferencias={pasaporte.origen_referencias}
            origenLat={pasaporte.origen_lat}
            origenLng={pasaporte.origen_lng}
            destinoDireccion={pasaporte.destino_direccion}
            destinoCiudad={pasaporte.destino_ciudad}
            destinoReferencias={pasaporte.destino_referencias}
            destinoLat={pasaporte.destino_lat}
            destinoLng={pasaporte.destino_lng}
            contactoEntregaNombre={pasaporte.contacto_entrega_nombre}
            contactoEntregaTelefono={pasaporte.contacto_entrega_telefono}
            contactoRecepcionNombre={pasaporte.contacto_recepcion_nombre}
            contactoRecepcionTelefono={pasaporte.contacto_recepcion_telefono}
            vehiculoMarca={pasaporte.vehiculo_marca}
            vehiculoModelo={pasaporte.vehiculo_modelo}
            vehiculoAnio={pasaporte.vehiculo_anio}
            vehiculoColor={pasaporte.vehiculo_color}
            vehiculoPlacas={pasaporte.vehiculo_placas}
            vehiculoVin={pasaporte.vehiculo_vin}
          />
        </div>

        <section className="mt-5">
          {actual.lat !== null && actual.lng !== null ? (
            <MapaRutaOrigen destino={{ lat: actual.lat, lng: actual.lng }} />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border bg-surface-elevated px-4 text-center font-body text-sm text-tertiary">
              Mapa no disponible. Usa la dirección actual para continuar.
            </div>
          )}
        </section>

        <section className="mt-5 rounded-card border border-route-action bg-route-soft p-4 shadow-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-body text-sm font-semibold text-text-tertiary">{actual.etiqueta}</p>
              <p className="mt-1 break-words font-display text-2xl font-semibold leading-7 text-text-primary">
                {actual.direccion ?? "Dirección por confirmar"}
              </p>
              {actual.ciudad && <p className="mt-1 font-body text-base text-text-secondary">{actual.ciudad}</p>}
              {actual.referencias && <p className="mt-2 font-body text-sm leading-6 text-text-secondary">Referencias: {actual.referencias}</p>}
            </div>
            {actual.lat !== null && actual.lng !== null && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${actual.lat},${actual.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-action-primary px-4 py-2 text-xs font-bold text-on-primary"
              >
                Abrir en Maps
              </a>
            )}
          </div>
        </section>

        <ContactActionBar trasladoId={pasaporte.traslado_id} role={contacto.rol} name={contacto.nombre} phone={contacto.telefono} />

        {presentation.nextStep && (
          <section className="mt-4 rounded-card border border-border bg-surface p-4 shadow-1">
            <p className="font-body text-sm font-semibold text-text-tertiary">Próximo paso</p>
            <p className="mt-1 font-body text-base font-semibold text-text-primary">{presentation.nextStep}</p>
          </section>
        )}

        <div className="mt-6 grid gap-3">
          <details className="group overflow-hidden rounded-xl border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 font-body text-sm font-semibold hover:bg-route-soft [&::-webkit-details-marker]:hidden">
              <span>📍 Ruta</span>
              <span className="font-display text-lg leading-none text-text-tertiary transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <div className="grid gap-4 border-t border-border px-4 py-4 font-body text-sm sm:grid-cols-2">
              <div className="grid gap-3 sm:col-span-2 md:hidden">
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-tertiary">Estado operativo</p>
                  <div className="mt-2"><EstadoBadge estado={pasaporte.estado} /></div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-tertiary">Progreso</p>
                  <p className="mt-1 font-body font-semibold">Paso {presentation.stage} de {presentation.totalStages}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-tertiary">Origen</p>
                <p className="mt-1 text-base font-semibold">{pasaporte.origen_direccion ?? "Por confirmar"}</p>
                <p className="text-text-secondary">{pasaporte.origen_ciudad}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-tertiary">Destino</p>
                <p className="mt-1 text-base font-semibold">{pasaporte.destino_direccion ?? "Por confirmar"}</p>
                <p className="text-text-secondary">{pasaporte.destino_ciudad}</p>
              </div>
            </div>
          </details>

          <details className="group overflow-hidden rounded-xl border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 font-body text-sm font-semibold hover:bg-route-soft [&::-webkit-details-marker]:hidden">
              <span>🚗 Vehículo</span>
              <span className="font-display text-lg leading-none text-text-tertiary transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <div className="grid gap-3 border-t border-border px-4 py-4 font-body text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-tertiary">Vehículo</p>
                <p className="mt-1 font-semibold">{vehiculo}</p>
                <p className="text-text-secondary">{pasaporte.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo] : "Tipo por confirmar"}{clasificacionCatalogo ? ` · ${clasificacionCatalogo}` : ""}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-tertiary">Detalles</p>
                <p className="mt-1 font-semibold">{[pasaporte.vehiculo_color, pasaporte.vehiculo_placas].filter(Boolean).join(" · ") || "Datos por confirmar"}</p>
              </div>
            </div>
          </details>

          <details className="group overflow-hidden rounded-xl border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 font-body text-sm font-semibold hover:bg-route-soft [&::-webkit-details-marker]:hidden">
              <span>📸 Evidencia</span>
              <span className="font-display text-lg leading-none text-text-tertiary transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <div className="grid gap-4 border-t border-border px-4 py-4 font-body text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-tertiary">Registro inicial del vehículo</p>
                <p className="mt-1 font-semibold">{pasaporte.evidencia_inicial_fotos_sincronizadas} / 5 fotos</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-tertiary">Registro final del vehículo</p>
                <p className="mt-1 font-semibold">{pasaporte.evidencia_final_fotos_sincronizadas} / 5 fotos</p>
              </div>
            </div>
          </details>

          {pasaporte.tiene_incidencia_abierta && (
            <div className="mt-1">
              <Aviso tono="atencion">Este viaje tiene un problema reportado.</Aviso>
            </div>
          )}
        </div>

        {/* Comparación de evidencia inicial vs final */}
        {(pasaporte.evidencia_inicial_fotos_sincronizadas ?? 0) > 0 || (pasaporte.evidencia_final_fotos_sincronizadas ?? 0) > 0 ? (
          <section className="mt-6">
            <TripEvidenceComparison trasladoId={pasaporte.traslado_id} />
          </section>
        ) : null}

        <section className="mt-6 border-t border-border pt-6">
          <p className="mb-3 font-body text-sm font-semibold text-text-tertiary">Soporte</p>
          <ReportarIncidencia trasladoId={pasaporte.traslado_id} />
          <AbrirDisputaConductor trasladoId={pasaporte.traslado_id} disponible={puedeAbrirDisputa} />
          <EmergencyPanel trasladoId={pasaporte.traslado_id} />
        </section>
      </TripCard>

      <ChatViaje trasladoId={pasaporte.traslado_id} estado={pasaporte.estado} />
    </div>
  );
}
