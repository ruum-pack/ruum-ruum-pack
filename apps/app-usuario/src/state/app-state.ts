import type { MensajeChat } from "@ruum/ui";
import type { PrevisualizacionTarifa, UbicacionTraslado } from "@ruum/api/services";
import type { Usuario, Database } from "@ruum/shared/types";
import type { SetStateAction } from "react";
import type { sugerirDireccionesAutocomplete } from "../lib/mapbox";
import type { DatosCodigoPostal } from "../lib/codigos-postales";
import type { BorradorTrasladoLocal } from "../lib/borrador-traslado";
import { USUARIO_PENDIENTE, VALORES_INICIALES, type PrefijoDomicilio, type SubpasoRuta } from "../app/traslados/nuevo/constants";
import type { DatosFormulario, ErroresFormulario, VehiculoGuardado } from "../app/traslados/nuevo/types";

export type SugerenciaDireccion = Awaited<ReturnType<typeof sugerirDireccionesAutocomplete>>[number];
export type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export interface RutaEstimacion {
  origenLat?: number;
  origenLng?: number;
  destinoLat?: number;
  destinoLng?: number;
  paradasCoords?: Array<{ lat?: number; lng?: number }>;
  distanciaKm?: number;
  tiempoEstimadoHoras?: number;
  incompletas: boolean;
}

export interface TrasladoCreado {
  id: string;
  tipoPago: "anticipado" | "al_cierre";
  precioCotizado: number | null;
}

export interface NuevoTrasladoState {
  paso: number;
  datos: DatosFormulario;
  enviando: boolean;
  resultado: { ok: boolean; mensaje: string } | null;
  bloqueoVerificacion: string | null;
  usuario: Usuario;
  sesionReal: boolean;
  cargandoSesion: boolean;
  aceptaPoliticasPagoCancelacion: boolean;
  cpConsultando: PrefijoDomicilio | null;
  cpAviso: Record<PrefijoDomicilio, string | null>;
  cpOpciones: Record<PrefijoDomicilio, DatosCodigoPostal | null>;
  placesOpciones: Record<PrefijoDomicilio, string[]>;
  subpasoRuta: SubpasoRuta;
  vehiculosGuardados: VehiculoGuardado[];
  vehiculoSeleccionadoId: string;
  errorPaso: string | null;
  errores: ErroresFormulario;
  detallesVehiculoExpandido: boolean;
  origenBusqueda: string;
  destinoBusqueda: string;
  origenSugerencias: SugerenciaDireccion[];
  destinoSugerencias: SugerenciaDireccion[];
  buscandoOrigen: boolean;
  buscandoDestino: boolean;
  previsualizacion: PrevisualizacionTarifa | null;
  previsualizando: boolean;
  tarifaPreviaAceptada: boolean;
  tarifaPreviaSnapshot: string | null;
  rutaEstimacion: RutaEstimacion | null;
  rutaCalculando: boolean;
  rutaAviso: string | null;
  rutaReintento: number;
  borradorDisponible: BorradorTrasladoLocal | null;
  claveIdempotencia: string;
  trasladoCreado: TrasladoCreado | null;
  reintentoAceptacion: number;
  estadoGuardado: "inactivo" | "guardando" | "guardado";
  tiempoUltimoGuardado: string | null;
}


export function crearEstadoNuevoTrasladoInicial(): NuevoTrasladoState {
  return {
    paso: 0,
    datos: { ...VALORES_INICIALES, paradas: [] },
    enviando: false,
    resultado: null,
    bloqueoVerificacion: null,
    usuario: USUARIO_PENDIENTE,
    sesionReal: false,
    cargandoSesion: true,
    aceptaPoliticasPagoCancelacion: false,
    cpConsultando: null,
    cpAviso: { origen: null, destino: null },
    cpOpciones: { origen: null, destino: null },
    placesOpciones: { origen: [], destino: [] },
    subpasoRuta: "origen",
    vehiculosGuardados: [],
    vehiculoSeleccionadoId: "",
    errorPaso: null,
    errores: {},
    detallesVehiculoExpandido: false,
    origenBusqueda: "",
    destinoBusqueda: "",
    origenSugerencias: [],
    destinoSugerencias: [],
    buscandoOrigen: false,
    buscandoDestino: false,
    previsualizacion: null,
    previsualizando: false,
    tarifaPreviaAceptada: false,
    tarifaPreviaSnapshot: null,
    rutaEstimacion: null,
    rutaCalculando: false,
    rutaAviso: null,
    rutaReintento: 0,
    borradorDisponible: null,
    claveIdempotencia: "",
    trasladoCreado: null,
    reintentoAceptacion: 0,
    estadoGuardado: "inactivo",
    tiempoUltimoGuardado: null
  };
}


export type NuevoTrasladoAction =
  | { type: "set"; key: keyof NuevoTrasladoState; value: unknown }
  | { type: "reset" };

export function nuevoTrasladoReducer(state: NuevoTrasladoState, action: NuevoTrasladoAction): NuevoTrasladoState {
  if (action.type === "reset") return crearEstadoNuevoTrasladoInicial();

  const actual = state[action.key];
  const siguiente = typeof action.value === "function"
    ? (action.value as (previo: unknown) => unknown)(actual)
    : action.value;

  if (Object.is(actual, siguiente)) return state;
  return { ...state, [action.key]: siguiente } as NuevoTrasladoState;
}

export type SetNuevoTrasladoField = <K extends keyof NuevoTrasladoState>(
  key: K,
  value: SetStateAction<NuevoTrasladoState[K]>
) => void;

export interface EstadoRealtimeTraslado {
  mensajes: MensajeChat[];
  errorChat: string | null;
  llamando: boolean;
  errorLlamada: string | null;
  cotizacionAceptada: boolean;
  aceptandoCotizacion: boolean;
  errorAceptacion: string | null;
  pagoConfirmado: boolean;
  ubicacion: UbicacionTraslado | null;
  estadoRealtime: EstadoTraslado | null;
  estadoActualizadoEn: string | null;
  cargando: boolean;
  mapaCargadoUrl: string | null;
}

export function crearEstadoRealtimeTraslado(ubicacionInicial: UbicacionTraslado | null = null): EstadoRealtimeTraslado {
  return {
    mensajes: [],
    errorChat: null,
    llamando: false,
    errorLlamada: null,
    cotizacionAceptada: false,
    aceptandoCotizacion: false,
    errorAceptacion: null,
    pagoConfirmado: false,
    ubicacion: ubicacionInicial,
    estadoRealtime: null,
    estadoActualizadoEn: null,
    cargando: false,
    mapaCargadoUrl: null
  };
}

export type RealtimeTrasladosState = Record<string, EstadoRealtimeTraslado>;
export type RealtimeTrasladoPatch = Partial<EstadoRealtimeTraslado>;

function combinarMensajes(actuales: MensajeChat[], cargados: MensajeChat[]) {
  const porId = new Map(actuales.map((mensaje) => [mensaje.id, mensaje]));
  for (const mensaje of cargados) porId.set(mensaje.id, mensaje);

  return Array.from(porId.values()).sort((a, b) => {
    const tiempoA = Date.parse(a.enviado_en);
    const tiempoB = Date.parse(b.enviado_en);
    if (Number.isFinite(tiempoA) && Number.isFinite(tiempoB) && tiempoA !== tiempoB) return tiempoA - tiempoB;
    return a.enviado_en.localeCompare(b.enviado_en);
  });
}

export type RealtimeTrasladosAction =
  | { type: "init"; trasladoId: string; ubicacionInicial: UbicacionTraslado | null }
  | { type: "patch"; trasladoId: string; patch: RealtimeTrasladoPatch }
  | { type: "messages"; trasladoId: string; mensajes: MensajeChat[] }
  | { type: "message"; trasladoId: string; mensaje: MensajeChat }
  | { type: "clear"; trasladoId: string };

export function realtimeTrasladosReducer(
  state: RealtimeTrasladosState,
  action: RealtimeTrasladosAction
): RealtimeTrasladosState {
  if (action.type === "clear") {
    if (!(action.trasladoId in state)) return state;
    const siguiente = { ...state };
    delete siguiente[action.trasladoId];
    return siguiente;
  }

  const actual = state[action.trasladoId] ?? crearEstadoRealtimeTraslado();

  if (action.type === "init") {
    return {
      ...state,
      [action.trasladoId]: {
        ...actual,
        ubicacion: actual.ubicacion ?? action.ubicacionInicial
      }
    };
  }

  if (action.type === "messages") {
    // La carga inicial puede resolver después de un INSERT Realtime. Se
    // fusionan ambos canales para no perder el evento ni duplicarlo.
    return { ...state, [action.trasladoId]: { ...actual, mensajes: combinarMensajes(actual.mensajes, action.mensajes) } };
  }

  if (action.type === "message") {
    if (actual.mensajes.some((mensaje) => mensaje.id === action.mensaje.id)) return state;
    return {
      ...state,
      [action.trasladoId]: { ...actual, mensajes: [...actual.mensajes, action.mensaje] }
    };
  }

  return {
    ...state,
    [action.trasladoId]: { ...actual, ...action.patch }
  };
}
