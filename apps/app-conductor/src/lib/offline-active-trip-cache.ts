import type { Database } from "@ruum/shared/types";
import { CONTACTOS_SOPORTE_CONDUCTOR } from "./contactos-soporte";
import { getTripPresentation } from "./trip-presentation";
import { eliminarJsonLocalSeguro, guardarJsonLocalSeguro, leerJsonLocalSeguro } from "./almacenamiento-seguro-local";
import type { Coordenadas } from "./ubicacion";

export type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
export type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

export type OfflineSyncStatus =
  | "todo_sincronizado"
  | "sin_conexion"
  | "pendientes"
  | "sincronizando"
  | "accion_requerida"
  | "error_recuperable"
  | "conflicto_revision";

export interface OfflineActiveTripCache {
  trasladoId: string;
  folio: string;
  estado: EstadoTraslado;
  siguienteAccion: {
    label: string;
    instruction: string;
    nextStep?: string | null;
  };
  origen: {
    direccion: string | null;
    ciudad: string | null;
    referencias: string | null;
    lat: number | null;
    lng: number | null;
  };
  destino: {
    direccion: string | null;
    ciudad: string | null;
    referencias: string | null;
    lat: number | null;
    lng: number | null;
  };
  vehiculo: {
    descripcion: string;
    placas: string | null;
    color: string | null;
    vin?: string | null;
  };
  contactosAutorizados: Array<{
    rol: "origen" | "destino" | "soporte" | "emergencia";
    nombre: string;
    telefono: string | null;
    href?: string;
  }>;
  horario: {
    creadoEn: string | null;
    actualizadoEn: string | null;
  };
  requisitosEvidencia: {
    tipo: "inicial" | "final" | null;
    pendientes: string[];
  };
  ultimaSincronizacion: string;
  ultimaUbicacionConocida: (Coordenadas & { registradaEn: string }) | null;
  telefonosSoporteEmergencia: {
    soporte: string;
    soporteHref: string;
    emergencia: string;
    emergenciaHref: string;
  };
}

const CLAVE_CACHE_VIAJE_ACTIVO = "ruum_cache_viaje_activo_v1";
const RETENCION_CACHE_MS = 72 * 60 * 60 * 1000;

function folioDesdeId(trasladoId: string) {
  return trasladoId.slice(0, 8).toUpperCase();
}

function descripcionVehiculo(pasaporte: PasaporteRow) {
  return [pasaporte.vehiculo_marca, pasaporte.vehiculo_modelo, pasaporte.vehiculo_anio].filter(Boolean).join(" ") || "Vehículo";
}

function tipoEvidenciaPorEstado(estado: EstadoTraslado): "inicial" | "final" | null {
  if (estado === "verificacion_vehiculo_en_proceso" || estado === "evidencia_inicial_en_proceso") return "inicial";
  if (estado === "llegada_a_destino" || estado === "evidencia_final_en_proceso") return "final";
  return null;
}

function requisitosPendientes(tipo: "inicial" | "final" | null, pasaporte: PasaporteRow) {
  if (!tipo) return [];
  const sincronizadas = tipo === "final" ? pasaporte.evidencia_final_fotos_sincronizadas : pasaporte.evidencia_inicial_fotos_sincronizadas;
  const faltantes = Math.max(0, 5 - (sincronizadas ?? 0));
  return faltantes === 0 ? [] : [`${faltantes} fotos ${tipo === "final" ? "finales" : "iniciales"} pendientes`];
}

export function crearCacheViajeActivoDesdePasaporte(
  pasaporte: PasaporteRow,
  ultimaUbicacionConocida: OfflineActiveTripCache["ultimaUbicacionConocida"] = null
): OfflineActiveTripCache | null {
  if (!pasaporte.traslado_id || !pasaporte.estado) return null;

  const presentation = getTripPresentation(pasaporte.estado);
  const tipoEvidencia = tipoEvidenciaPorEstado(pasaporte.estado);

  return {
    trasladoId: pasaporte.traslado_id,
    folio: folioDesdeId(pasaporte.traslado_id),
    estado: pasaporte.estado,
    siguienteAccion: {
      label: presentation.primaryAction.label,
      instruction: presentation.instruction,
      nextStep: presentation.nextStep ?? null
    },
    origen: {
      direccion: pasaporte.origen_direccion,
      ciudad: pasaporte.origen_ciudad,
      referencias: pasaporte.origen_referencias,
      lat: pasaporte.origen_lat,
      lng: pasaporte.origen_lng
    },
    destino: {
      direccion: pasaporte.destino_direccion,
      ciudad: pasaporte.destino_ciudad,
      referencias: pasaporte.destino_referencias,
      lat: pasaporte.destino_lat,
      lng: pasaporte.destino_lng
    },
    vehiculo: {
      descripcion: descripcionVehiculo(pasaporte),
      placas: pasaporte.vehiculo_placas,
      color: pasaporte.vehiculo_color,
      vin: pasaporte.vehiculo_vin
    },
    contactosAutorizados: [
      { rol: "origen", nombre: pasaporte.contacto_entrega_nombre ?? "Contacto de origen", telefono: pasaporte.contacto_entrega_telefono },
      { rol: "destino", nombre: pasaporte.contacto_recepcion_nombre ?? "Contacto de destino", telefono: pasaporte.contacto_recepcion_telefono },
      {
        rol: "soporte",
        nombre: "Soporte Ruum Ruum",
        telefono: CONTACTOS_SOPORTE_CONDUCTOR.soporte.telefono.valor,
        href: CONTACTOS_SOPORTE_CONDUCTOR.soporte.telefono.href
      },
      {
        rol: "emergencia",
        nombre: "Emergencia",
        telefono: CONTACTOS_SOPORTE_CONDUCTOR.emergencia.telefono.valor,
        href: CONTACTOS_SOPORTE_CONDUCTOR.emergencia.telefono.href
      }
    ],
    horario: {
      creadoEn: pasaporte.creado_en,
      actualizadoEn: pasaporte.actualizado_en
    },
    requisitosEvidencia: {
      tipo: tipoEvidencia,
      pendientes: requisitosPendientes(tipoEvidencia, pasaporte)
    },
    ultimaSincronizacion: new Date().toISOString(),
    ultimaUbicacionConocida,
    telefonosSoporteEmergencia: {
      soporte: CONTACTOS_SOPORTE_CONDUCTOR.soporte.telefono.valor,
      soporteHref: CONTACTOS_SOPORTE_CONDUCTOR.soporte.telefono.href,
      emergencia: CONTACTOS_SOPORTE_CONDUCTOR.emergencia.telefono.valor,
      emergenciaHref: CONTACTOS_SOPORTE_CONDUCTOR.emergencia.telefono.href
    }
  };
}

export async function guardarCacheViajeActivo(cache: OfflineActiveTripCache) {
  await guardarJsonLocalSeguro(CLAVE_CACHE_VIAJE_ACTIVO, cache);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ruum:offline-cache-updated"));
}

export async function leerCacheViajeActivo(): Promise<OfflineActiveTripCache | null> {
  const cache = await leerJsonLocalSeguro<OfflineActiveTripCache>(CLAVE_CACHE_VIAJE_ACTIVO);
  if (!cache) return null;
  const sincronizacionMs = new Date(cache.ultimaSincronizacion).getTime();
  if (!Number.isFinite(sincronizacionMs) || Date.now() - sincronizacionMs > RETENCION_CACHE_MS) {
    await limpiarCacheViajeActivo();
    return null;
  }
  return cache;
}

export async function actualizarUltimaUbicacionCache(ubicacion: Coordenadas) {
  const cache = await leerCacheViajeActivo();
  if (!cache) return;
  await guardarCacheViajeActivo({
    ...cache,
    ultimaUbicacionConocida: {
      ...ubicacion,
      registradaEn: new Date().toISOString()
    }
  });
}

export async function limpiarCacheViajeActivo() {
  await eliminarJsonLocalSeguro(CLAVE_CACHE_VIAJE_ACTIVO);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ruum:offline-cache-updated"));
}

export const OFFLINE_ACTIVE_TRIP_CACHE_KEY = CLAVE_CACHE_VIAJE_ACTIVO;

