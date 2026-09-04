"use client";
import { useCallback, useEffect, useMemo, useRef, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TipoCuenta, TipoVehiculo, Usuario } from "@ruum/shared/types";
import { determinarMomentoPago, calcularCargoCancelacion } from "@ruum/shared/rules";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../../lib/supabase-browser";
import {
  crearTraslado,
  listarVehiculosDeUsuario,
  obtenerUsuarioActual,
  previsualizarTarifaUsuario,
  aceptarCotizacionUsuario,
  type PrevisualizacionTarifa
} from "@ruum/api/services";
import { registrarEventoUx, iniciarFlujoTraslado, registrarPasoIniciado, registrarPasoCompletado, registrarAbandono } from "../../../../lib/analytics";
import { consultarCodigoPostalMx, type DatosCodigoPostal } from "../../../../lib/codigos-postales";
import {
  esErrorConfiguracionMapbox,
  mensajeErrorMapbox,
  sugerirDireccionesAutocomplete,
  sugerirDireccionesPorCodigoPostal,
  tieneMapboxConfigurado
} from "../../../../lib/mapbox";
import {
  clasificacionesPorVehiculo,
  modelosPorMarca,
  resumenClasificacionVehiculo,
  tipoSugeridoParaVehiculo
} from "../../../../lib/catalogo-vehiculos";
import {
  guardarBorradorTrasladoLocal,
  leerBorradorTrasladoLocal,
  limpiarBorradorTrasladoLocal,
  type BorradorTrasladoLocal
} from "../../../../lib/borrador-traslado";
import { esquemaSolicitudTraslado, erroresFormulario } from "../schema";
import { CAMPOS_PASO_TARIFA, codigoPostalCompleto, generarTarifaSnapshot, haCambiadoTarifa } from "../tarifa-gate";
import { construirPayloadCreacion, type CoordenadasTraslado, type CoordenadasParada } from "../adapters";
import { useGeocodificacion } from "./useGeocodificacion";
import { useNuevoTrasladoState, useTrasladoRealtime } from "../../../../state/AppStateProvider";
import type { NuevoTrasladoState, RutaEstimacion, TrasladoCreado } from "../../../../state/app-state";
import {
  CAMPOS_PASO_RUTA,
  CAMPOS_PASO_VEHICULO,
  CAMPOS_PASO_VEHICULO_DETALLE,
  CAMPOS_PASO_VEHICULO_ESENCIAL,
  CAMPOS_RUTA_DESTINO_CONTACTOS,
  CAMPOS_RUTA_ORIGEN,
  RETRASO_CONSULTA_CODIGO_POSTAL_MS,
  RETRASO_GUARDADO_BORRADOR_MS,
  domicilioCompleto,
  esCampoEsencialVehiculo,
  mensajeAmigableErrorCreacion,
  pasoDeCampo,
  soloDigitos,
  telefonoLocalMx,
  type PrefijoDomicilio,
  type SubpasoRuta
} from "../constants";
import type {
  CondicionVehiculo,
  DatosFormulario,
  ErroresFormulario,
  ModalidadProgramacion,
  MotivoServicioTraslado,
  ParadaForm,
  TipoRutaTraslado,
  TipoServicioTraslado,
  TransmisionVehiculo,
  VehiculoGuardado
} from "../types";

export function useNuevoTraslado() {
  const { geocodificarRuta, geocodificarRutaConParadas } = useGeocodificacion();
  const router = useRouter();

  const { state: formulario, setField, reset } = useNuevoTrasladoState();
  const {
    paso,
    datos,
    enviando,
    resultado,
    bloqueoVerificacion,
    usuario,
    sesionReal,
    cargandoSesion,
    aceptaPoliticasPagoCancelacion,
    cpConsultando,
    cpAviso,
    cpOpciones,
    placesOpciones,
    subpasoRuta,
    vehiculosGuardados,
    vehiculoSeleccionadoId,
    errorPaso,
    errores,
    detallesVehiculoExpandido,
    origenBusqueda,
    destinoBusqueda,
    origenSugerencias,
    destinoSugerencias,
    buscandoOrigen,
    buscandoDestino,
    previsualizacion,
    previsualizando,
    tarifaPreviaAceptada,
    tarifaPreviaSnapshot,
    rutaEstimacion,
    rutaCalculando,
    rutaAviso,
    rutaReintento,
    borradorDisponible,
    claveIdempotencia,
    trasladoCreado,
    reintentoAceptacion,
    estadoGuardado,
    tiempoUltimoGuardado
  } = formulario;

  const estadoTrasladoId = trasladoCreado?.id ?? "nuevo";
  const {
    pagoConfirmado,
    cotizacionAceptada,
    aceptandoCotizacion,
    errorAceptacion,
    actualizar: actualizarEstadoTraslado
  } = useTrasladoRealtime(estadoTrasladoId);

  const setFormulario = useCallback(<K extends keyof NuevoTrasladoState>(campo: K, valor: SetStateAction<NuevoTrasladoState[K]>) => setField(campo, valor), [setField]);
  const setEstadoGuardado = useCallback((valor: SetStateAction<NuevoTrasladoState["estadoGuardado"]>) => setFormulario("estadoGuardado", valor), [setFormulario]);
  const setTiempoUltimoGuardado = useCallback((valor: SetStateAction<string | null>) => setFormulario("tiempoUltimoGuardado", valor), [setFormulario]);

  const setPaso = useCallback((valor: SetStateAction<number>) => setFormulario("paso", valor), [setFormulario]);
  const setDatos = useCallback((valor: SetStateAction<DatosFormulario>) => setFormulario("datos", valor), [setFormulario]);
  const setEnviando = useCallback((valor: SetStateAction<boolean>) => setFormulario("enviando", valor), [setFormulario]);
  const setResultado = useCallback((valor: SetStateAction<{ ok: boolean; mensaje: string } | null>) => setFormulario("resultado", valor), [setFormulario]);
  const setBloqueoVerificacion = useCallback((valor: SetStateAction<string | null>) => setFormulario("bloqueoVerificacion", valor), [setFormulario]);
  const setUsuario = useCallback((valor: SetStateAction<Usuario>) => setFormulario("usuario", valor), [setFormulario]);
  const setSesionReal = useCallback((valor: SetStateAction<boolean>) => setFormulario("sesionReal", valor), [setFormulario]);
  const setCargandoSesion = useCallback((valor: SetStateAction<boolean>) => setFormulario("cargandoSesion", valor), [setFormulario]);
  const setAceptaPoliticasPagoCancelacion = useCallback((valor: SetStateAction<boolean>) => setFormulario("aceptaPoliticasPagoCancelacion", valor), [setFormulario]);
  const setCpConsultando = useCallback((valor: SetStateAction<PrefijoDomicilio | null>) => setFormulario("cpConsultando", valor), [setFormulario]);
  const setCpAviso = useCallback((valor: SetStateAction<Record<PrefijoDomicilio, string | null>>) => setFormulario("cpAviso", valor), [setFormulario]);
  const setCpOpciones = useCallback((valor: SetStateAction<Record<PrefijoDomicilio, DatosCodigoPostal | null>>) => setFormulario("cpOpciones", valor), [setFormulario]);
  const setPlacesOpciones = useCallback((valor: SetStateAction<Record<PrefijoDomicilio, string[]>>) => setFormulario("placesOpciones", valor), [setFormulario]);
  const setSubpasoRuta = useCallback((valor: SetStateAction<SubpasoRuta>) => setFormulario("subpasoRuta", valor), [setFormulario]);
  const setVehiculosGuardados = useCallback((valor: SetStateAction<VehiculoGuardado[]>) => setFormulario("vehiculosGuardados", valor), [setFormulario]);
  const setVehiculoSeleccionadoId = useCallback((valor: SetStateAction<string>) => setFormulario("vehiculoSeleccionadoId", valor), [setFormulario]);
  const setErrorPaso = useCallback((valor: SetStateAction<string | null>) => setFormulario("errorPaso", valor), [setFormulario]);
  const setErrores = useCallback((valor: SetStateAction<ErroresFormulario>) => setFormulario("errores", valor), [setFormulario]);
  const setDetallesVehiculoExpandido = useCallback((valor: SetStateAction<boolean>) => setFormulario("detallesVehiculoExpandido", valor), [setFormulario]);
  const setOrigenBusqueda = useCallback((valor: SetStateAction<string>) => setFormulario("origenBusqueda", valor), [setFormulario]);
  const setDestinoBusqueda = useCallback((valor: SetStateAction<string>) => setFormulario("destinoBusqueda", valor), [setFormulario]);
  const setOrigenSugerencias = useCallback((valor: SetStateAction<NuevoTrasladoState["origenSugerencias"]>) => setFormulario("origenSugerencias", valor), [setFormulario]);
  const setDestinoSugerencias = useCallback((valor: SetStateAction<NuevoTrasladoState["destinoSugerencias"]>) => setFormulario("destinoSugerencias", valor), [setFormulario]);
  const setBuscandoOrigen = useCallback((valor: SetStateAction<boolean>) => setFormulario("buscandoOrigen", valor), [setFormulario]);
  const setBuscandoDestino = useCallback((valor: SetStateAction<boolean>) => setFormulario("buscandoDestino", valor), [setFormulario]);
  const setPrevisualizacion = useCallback((valor: SetStateAction<PrevisualizacionTarifa | null>) => setFormulario("previsualizacion", valor), [setFormulario]);
  const setPrevisualizando = useCallback((valor: SetStateAction<boolean>) => setFormulario("previsualizando", valor), [setFormulario]);
  const setTarifaPreviaAceptada = useCallback((valor: SetStateAction<boolean>) => setFormulario("tarifaPreviaAceptada", valor), [setFormulario]);
  const setTarifaPreviaSnapshot = useCallback((valor: SetStateAction<string | null>) => setFormulario("tarifaPreviaSnapshot", valor), [setFormulario]);
  const setRutaEstimacion = useCallback((valor: SetStateAction<RutaEstimacion | null>) => setFormulario("rutaEstimacion", valor), [setFormulario]);
  const setRutaCalculando = useCallback((valor: SetStateAction<boolean>) => setFormulario("rutaCalculando", valor), [setFormulario]);
  const setRutaAviso = useCallback((valor: SetStateAction<string | null>) => setFormulario("rutaAviso", valor), [setFormulario]);
  const setRutaReintento = useCallback((valor: SetStateAction<number>) => setFormulario("rutaReintento", valor), [setFormulario]);
  const setBorradorDisponible = useCallback((valor: SetStateAction<BorradorTrasladoLocal | null>) => setFormulario("borradorDisponible", valor), [setFormulario]);
  const setClaveIdempotencia = useCallback((valor: SetStateAction<string>) => setFormulario("claveIdempotencia", valor), [setFormulario]);
  const setTrasladoCreado = useCallback((valor: SetStateAction<TrasladoCreado | null>) => setFormulario("trasladoCreado", valor), [setFormulario]);
  const setCotizacionAceptada = useCallback((valor: boolean) => actualizarEstadoTraslado({ cotizacionAceptada: valor }), [actualizarEstadoTraslado]);
  const setAceptandoCotizacion = useCallback((valor: boolean) => actualizarEstadoTraslado({ aceptandoCotizacion: valor }), [actualizarEstadoTraslado]);
  const setErrorAceptacion = useCallback((valor: string | null) => actualizarEstadoTraslado({ errorAceptacion: valor }), [actualizarEstadoTraslado]);
  const setPagoConfirmado = useCallback((valor: boolean) => actualizarEstadoTraslado({ pagoConfirmado: valor }), [actualizarEstadoTraslado]);
  const setReintentoAceptacion = useCallback((valor: SetStateAction<number>) => setFormulario("reintentoAceptacion", valor), [setFormulario]);
  const reintentarAceptacion = useCallback(() => setReintentoAceptacion((n) => n + 1), [setReintentoAceptacion]);

  // Analítica del gate de tarifa (Paso 0)
  const tarifaGateVistaRegistrada = useRef(false);
  const tarifaGateCalculadaRegistrada = useRef(false);
  const tarifaGateNoDisponibleRegistrada = useRef(false);
  const tarifaGateAbandonadaRegistrada = useRef(false);
  const pasoRef = useRef(paso);
  pasoRef.current = paso;
  const tarifaPreviaAceptadaRef = useRef(tarifaPreviaAceptada);
  tarifaPreviaAceptadaRef.current = tarifaPreviaAceptada;
  const formEnviadoRef = useRef(false);

  // Borrador local no sensible

  const trasladoAceptacionIntentado = useRef<string | null>(null);
  const seqGeocodificaRef = useRef(0);
  const abortGeocodificaRef = useRef<AbortController | null>(null);
  // 1.4 Debounce dinámico — inmediato si onBlur, 650ms si typing
  const geocodificacionInmediataRef = useRef(false);
  const solicitarGeocodificacionInmediata = useCallback(() => {
    geocodificacionInmediataRef.current = true;
  }, []);
  const seqCodigoPostalRef = useRef<Record<PrefijoDomicilio, number>>({ origen: 0, destino: 0 });
  const codigoPostalTimersRef = useRef<Record<PrefijoDomicilio, ReturnType<typeof setTimeout> | null>>({ origen: null, destino: null });
  const codigoPostalAbortRef = useRef<Record<PrefijoDomicilio, AbortController | null>>({ origen: null, destino: null });
  const codigoPostalSolicitadoRef = useRef<Record<PrefijoDomicilio, string>>({ origen: "", destino: "" });
  const datosRef = useRef(datos);
  datosRef.current = datos;
  const erroresRef = useRef(errores);
  erroresRef.current = errores;
  const tarifaPreviaSnapshotRef = useRef(tarifaPreviaSnapshot);
  tarifaPreviaSnapshotRef.current = tarifaPreviaSnapshot;

  useEffect(() => () => {
    (Object.keys(codigoPostalTimersRef.current) as PrefijoDomicilio[]).forEach((prefijo) => {
      const timer = codigoPostalTimersRef.current[prefijo];
      if (timer) clearTimeout(timer);
      codigoPostalAbortRef.current[prefijo]?.abort();
    });
  }, []);

  // El provider vive en el layout para que el estado sea único. El wizard se
  // reinicia al entrar para no reutilizar un envío anterior de la misma sesión.
  useEffect(() => {
    reset();
  }, [reset]);

  // Modelos y catálogo
  const modelosDisponibles = useMemo(() => modelosPorMarca(datos.marca), [datos.marca]);
  const clasificacionCatalogo = useMemo(
    () => resumenClasificacionVehiculo(datos.marca, datos.modelo),
    [datos.marca, datos.modelo]
  );
  const clasificacionesCatalogo = useMemo(
    () => clasificacionesPorVehiculo(datos.marca, datos.modelo),
    [datos.marca, datos.modelo]
  );
  const categoriaCatalogo = useMemo(() => {
    const valores = [...new Set(clasificacionesCatalogo.map((vehiculo) => vehiculo.categoria))];
    return valores.length ? valores.join(" / ") : "Pendiente";
  }, [clasificacionesCatalogo]);
  const gamaCatalogo = useMemo(() => {
    const valores = [...new Set(clasificacionesCatalogo.map((vehiculo) => vehiculo.gama))];
    return valores.length ? valores.join(" / ") : "Pendiente";
  }, [clasificacionesCatalogo]);

  const momentoPago = useMemo(() => determinarMomentoPago(usuario), [usuario]);
  const politicaCancelacion = useMemo(() => calcularCargoCancelacion(0, 0, false, false), []);
  const cpTarifaListo = useMemo(
    () => codigoPostalCompleto(datos.origenCodigoPostal) && codigoPostalCompleto(datos.destinoCodigoPostal),
    [datos.destinoCodigoPostal, datos.origenCodigoPostal]
  );

  // Evento inicial + 3.1 flujo duración y abandono
  useEffect(() => {
    registrarEventoUx("traslado_nuevo_visto");
    iniciarFlujoTraslado();
    registrarPasoIniciado(paso);
    const handleBeforeUnload = () => registrarAbandono(paso, "usuario_navegó_fuera");
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      registrarAbandono(paso, "unmount_flujo");
    };
  }, []);

  // 3.1 tracking duración por paso
  const prevPasoRef = useRef(paso);
  useEffect(() => {
    if (prevPasoRef.current !== paso) {
      registrarPasoCompletado(prevPasoRef.current);
      registrarPasoIniciado(paso);
      prevPasoRef.current = paso;
    }
  }, [paso]);

  // Analítica gate tarifa
  useEffect(() => {
    if (paso === 0 && !tarifaGateVistaRegistrada.current) {
      tarifaGateVistaRegistrada.current = true;
      registrarEventoUx("tarifa_gate_vista");
    }
  }, [paso]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pasoRef.current === 0 && !tarifaPreviaAceptadaRef.current && !tarifaGateAbandonadaRegistrada.current) {
        tarifaGateAbandonadaRegistrada.current = true;
        registrarEventoUx("tarifa_gate_abandonada");
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (pasoRef.current === 0 && !tarifaPreviaAceptadaRef.current && !formEnviadoRef.current && !tarifaGateAbandonadaRegistrada.current) {
        tarifaGateAbandonadaRegistrada.current = true;
        registrarEventoUx("tarifa_gate_abandonada");
      }
    };
  }, []);

  // Aceptación automática cotización anticipada
  useEffect(() => {
    if (!trasladoCreado) return;
    if (trasladoCreado.tipoPago !== "anticipado" || trasladoCreado.precioCotizado == null) return;
    if (trasladoAceptacionIntentado.current === trasladoCreado.id) return;
    trasladoAceptacionIntentado.current = trasladoCreado.id;

    setAceptandoCotizacion(true);
    setErrorAceptacion(null);
    (async () => {
      try {
        const cliente = crearClienteNavegador();
        await aceptarCotizacionUsuario(cliente, trasladoCreado.id);
        setCotizacionAceptada(true);
      } catch (err) {
        trasladoAceptacionIntentado.current = null; // permite reintentar
        setErrorAceptacion(err instanceof Error ? err.message : "No se pudo confirmar la tarifa para iniciar el pago.");
      } finally {
        setAceptandoCotizacion(false);
      }
    })();
  }, [reintentoAceptacion, setAceptandoCotizacion, setCotizacionAceptada, setErrorAceptacion, trasladoCreado]);

  // Borrador: lectura al montar
  useEffect(() => {
    const timer = setTimeout(() => {
      const borrador = leerBorradorTrasladoLocal();
      setBorradorDisponible(borrador);
      setClaveIdempotencia(borrador?.claveIdempotencia ?? crypto.randomUUID());
    }, 0);
    return () => clearTimeout(timer);
  }, [setBorradorDisponible, setClaveIdempotencia]);

  // Borrador: guardado con debounce
  useEffect(() => {
    if (enviando || resultado) return;
    const hayContenido = [datos.marca, datos.modelo, datos.origenCodigoPostal, datos.destinoCodigoPostal, datos.entregaNombre].some(
      (v) => v.trim()
    );
    if (!hayContenido) return;

    setEstadoGuardado("guardando");

    const timer = setTimeout(() => {
      guardarBorradorTrasladoLocal({
        claveIdempotencia,
        paso,
        tipo: datos.tipo,
        transmision: datos.transmision,
        marca: datos.marca,
        modelo: datos.modelo,
        anio: datos.anio,
        color: datos.color,
        condicion: datos.condicion,
        estadoGeneral: datos.estadoGeneral,
        tieneTarjeta: datos.tieneTarjeta,
        tieneVerificacion: datos.tieneVerificacion,
        tienePlacas: datos.tienePlacas,
        puedeCircular: datos.puedeCircular,
        origenCodigoPostal: datos.origenCodigoPostal,
        origenEstado: datos.origenEstado,
        origenCiudad: datos.origenCiudad,
        origenColonia: datos.origenColonia,
        destinoCodigoPostal: datos.destinoCodigoPostal,
        destinoEstado: datos.destinoEstado,
        destinoCiudad: datos.destinoCiudad,
        destinoColonia: datos.destinoColonia,
        entregaNombre: datos.entregaNombre,
        entregaApellido: datos.entregaApellido,
        recepcionNombre: datos.recepcionNombre,
        recepcionApellido: datos.recepcionApellido,
        modalidadProgramacion: datos.modalidadProgramacion,
        fechaHoraProgramada: datos.fechaHoraProgramada,
        tipoRuta: datos.tipoRuta,
        ventanaRecoleccion: datos.ventanaRecoleccion,
        ventanaEntrega: datos.ventanaEntrega,
        tipoServicio: datos.tipoServicio,
        motivoServicio: datos.motivoServicio
      });
      setEstadoGuardado("guardado");
      setTiempoUltimoGuardado(new Date().toISOString());
    }, RETRASO_GUARDADO_BORRADOR_MS);

    return () => clearTimeout(timer);
  }, [
    enviando, resultado, paso, claveIdempotencia,
    datos.tipo, datos.transmision, datos.marca, datos.modelo, datos.anio, datos.color, datos.condicion, datos.estadoGeneral,
    datos.tieneTarjeta, datos.tieneVerificacion, datos.tienePlacas, datos.puedeCircular,
    datos.origenCodigoPostal, datos.origenEstado, datos.origenCiudad, datos.origenColonia,
    datos.destinoCodigoPostal, datos.destinoEstado, datos.destinoCiudad, datos.destinoColonia,
    datos.entregaNombre, datos.entregaApellido, datos.recepcionNombre, datos.recepcionApellido,
    datos.modalidadProgramacion, datos.fechaHoraProgramada, datos.tipoRuta,
    datos.ventanaRecoleccion, datos.ventanaEntrega, datos.tipoServicio, datos.motivoServicio,
    setEstadoGuardado, setTiempoUltimoGuardado
  ]);


  // Geocodificación y cálculo de ruta Mapbox con debounce y AbortController
  useEffect(() => {
    const origenTieneCalle = Boolean(datos.origenCalle.trim());
    const destinoTieneCalle = Boolean(datos.destinoCalle.trim());
    const origenCPValido = codigoPostalCompleto(datos.origenCodigoPostal);
    const destinoCPValido = codigoPostalCompleto(datos.destinoCodigoPostal);

    const origenDireccion = origenTieneCalle
      ? domicilioCompleto({
          calle: datos.origenCalle,
          numero: datos.origenNumero,
          colonia: datos.origenColonia,
          codigoPostal: datos.origenCodigoPostal,
          ciudad: datos.origenCiudad,
          estado: datos.origenEstado
        })
      : origenCPValido
        ? `${datos.origenCodigoPostal.trim()}, México`
        : "";

    const destinoDireccion = destinoTieneCalle
      ? domicilioCompleto({
          calle: datos.destinoCalle,
          numero: datos.destinoNumero,
          colonia: datos.destinoColonia,
          codigoPostal: datos.destinoCodigoPostal,
          ciudad: datos.destinoCiudad,
          estado: datos.destinoEstado
        })
      : destinoCPValido
        ? `${datos.destinoCodigoPostal.trim()}, México`
        : "";

    const paradasDirecciones = (datos.paradas ?? []).map((p) => domicilioCompleto({
      calle: p.calle, numero: p.numero, colonia: p.colonia, codigoPostal: p.codigoPostal, ciudad: p.ciudad, estado: p.estado
    }));

    if (!origenDireccion.trim() || !destinoDireccion.trim()) {
      abortGeocodificaRef.current?.abort();
      const timer = setTimeout(() => {
        setRutaEstimacion(null);
        setRutaAviso(null);
        setRutaCalculando(false);
        setPrevisualizacion(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    // Invalida el cálculo anterior antes del debounce para no mostrar una
    // tarifa construida con direcciones viejas mientras llega la respuesta.
    setRutaEstimacion(null);
    setRutaAviso(null);
    setRutaCalculando(true);
    setPrevisualizacion(null);

    // 1.4 Debounce dinámico: 0 si viene de onBlur, 650 si es typing
    const delay = geocodificacionInmediataRef.current ? 0 : 650;
    geocodificacionInmediataRef.current = false;
    const timer = setTimeout(async () => {
      abortGeocodificaRef.current?.abort();
      const controller = new AbortController();
      abortGeocodificaRef.current = controller;
      const seqActual = ++seqGeocodificaRef.current;
      const esStale = () => seqGeocodificaRef.current !== seqActual || controller.signal.aborted;

      setRutaCalculando(true);
      setRutaAviso(null);
      try {
        const usarParadas = paradasDirecciones.some((d) => d.trim());
        const coordsOrigen = datos.origenLat !== undefined && datos.origenLng !== undefined ? { lat: datos.origenLat, lng: datos.origenLng } : undefined;
        const coordenadas = usarParadas
          ? await geocodificarRutaConParadas(origenDireccion, destinoDireccion, paradasDirecciones, coordsOrigen, controller.signal)
          : await geocodificarRuta(origenDireccion, destinoDireccion, coordsOrigen, controller.signal);
        if (esStale()) return;
        setRutaEstimacion(coordenadas as typeof rutaEstimacion);
        if (coordenadas.incompletas) {
          setRutaAviso(
            tieneMapboxConfigurado()
              ? "No pudimos resolver una de las direcciones (origen, destino o alguna parada). Revisa calle, número, colonia y CP."
              : "Mapbox no está configurado; se guardará la solicitud sin distancia ni tiempo estimado."
          );
        } else if (coordenadas.distanciaKm === undefined || coordenadas.tiempoEstimadoHoras === undefined) {
          setRutaAviso("Mapbox resolvió las direcciones, pero no devolvió una ruta con distancia y tiempo.");
        }
      } catch (error) {
        if (esStale()) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRutaEstimacion({ incompletas: true });
        setRutaAviso(mensajeErrorMapbox(error));
      } finally {
        if (!esStale()) setRutaCalculando(false);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      abortGeocodificaRef.current?.abort();
    };
  }, [
    datos.origenCalle, datos.origenNumero, datos.origenColonia, datos.origenCodigoPostal, datos.origenCiudad, datos.origenEstado,
    datos.destinoCalle, datos.destinoNumero, datos.destinoColonia, datos.destinoCodigoPostal, datos.destinoCiudad, datos.destinoEstado,
    datos.paradas,
    datos.origenLat, datos.origenLng, geocodificarRuta, geocodificarRutaConParadas,
    rutaReintento, setPrevisualizacion, setRutaAviso, setRutaCalculando, setRutaEstimacion
  ]);

  // Cálculo de tarifa real desde Paso 0
  useEffect(() => {
    if (!sesionReal) {
      return;
    }
    if (!cpTarifaListo) {
      const timer = setTimeout(() => setPrevisualizacion(null), 0);
      return () => clearTimeout(timer);
    }
    if (!datos.marca.trim() || !datos.modelo.trim() || !datos.condicion) {
      const timer = setTimeout(() => setPrevisualizacion(null), 0);
      return () => clearTimeout(timer);
    }
    if (rutaEstimacion?.incompletas && rutaAviso && !rutaCalculando) {
      const timer = setTimeout(() => setPrevisualizacion({
        disponible: false,
        motivo: "No pudimos calcular la ruta automáticamente. Puedes enviar la solicitud y nuestro equipo confirmará la distancia y la cotización."
      }), 0);
      return () => clearTimeout(timer);
    }
    if (rutaEstimacion?.distanciaKm === undefined || rutaEstimacion.tiempoEstimadoHoras === undefined) {
      const timer = setTimeout(() => setPrevisualizacion(null), 0);
      return () => clearTimeout(timer);
    }
    if (datos.modalidadProgramacion === "programado" && !datos.fechaHoraProgramada) {
      const timer = setTimeout(() => setPrevisualizacion(null), 0);
      return () => clearTimeout(timer);
    }

    const distanciaKm = rutaEstimacion.distanciaKm;
    const tiempoEstimadoHoras = rutaEstimacion.tiempoEstimadoHoras;
    const condicionSeleccionada = datos.condicion ? (datos.condicion as CondicionVehiculo) : undefined;
    let cancelado = false;
    const timer = setTimeout(async () => {
      setPrevisualizando(true);
      try {
        const cliente = crearClienteNavegador();
        const res = await previsualizarTarifaUsuario(cliente, {
          marca: datos.marca,
          modelo: datos.modelo,
          distanciaKm,
          tiempoEstimadoHoras,
          fechaHora: datos.modalidadProgramacion === "programado" && datos.fechaHoraProgramada ? new Date(datos.fechaHoraProgramada) : null,
          condicion: condicionSeleccionada
        });
        if (!cancelado) {
          setPrevisualizacion(res);
          if (res?.disponible) {
            if (!tarifaGateCalculadaRegistrada.current) {
              tarifaGateCalculadaRegistrada.current = true;
              registrarEventoUx("tarifa_gate_calculada", { monto: res.tarifa });
            }
          } else if (res && !res.disponible) {
            if (!tarifaGateNoDisponibleRegistrada.current) {
              tarifaGateNoDisponibleRegistrada.current = true;
              registrarEventoUx("tarifa_gate_no_disponible");
            }
          }
        }
      } catch {
        if (!cancelado) setPrevisualizacion(null);
      } finally {
        if (!cancelado) setPrevisualizando(false);
      }
    }, 600);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [
    sesionReal, datos.marca, datos.modelo, datos.condicion,
    datos.modalidadProgramacion, datos.fechaHoraProgramada, rutaEstimacion,
    cpTarifaListo, rutaAviso, rutaCalculando, setPrevisualizacion, setPrevisualizando
  ]);

  // Buscador autocomplete Mapbox
  useEffect(() => {
    if (origenBusqueda.trim().length < 3) {
      setOrigenSugerencias([]);
      return;
    }
    let cancelado = false;
    const t = setTimeout(async () => {
      setBuscandoOrigen(true);
      try {
        const res = await sugerirDireccionesAutocomplete(origenBusqueda);
        if (!cancelado) setOrigenSugerencias(res);
      } finally {
        if (!cancelado) setBuscandoOrigen(false);
      }
    }, 350);
    return () => { cancelado = true; clearTimeout(t); };
  }, [origenBusqueda, setBuscandoOrigen, setOrigenSugerencias]);

  useEffect(() => {
    if (destinoBusqueda.trim().length < 3) {
      setDestinoSugerencias([]);
      return;
    }
    let cancelado = false;
    const t = setTimeout(async () => {
      setBuscandoDestino(true);
      try {
        const res = await sugerirDireccionesAutocomplete(destinoBusqueda);
        if (!cancelado) setDestinoSugerencias(res);
      } finally {
        if (!cancelado) setBuscandoDestino(false);
      }
    }, 350);
    return () => { cancelado = true; clearTimeout(t); };
  }, [destinoBusqueda, setBuscandoDestino, setDestinoSugerencias]);

  // Carga de sesión de usuario y vehículos
  useEffect(() => {
    async function cargarUsuario() {
      if (!tieneSupabaseConfigurado()) {
        setCargandoSesion(false);
        return;
      }
      try {
        const cliente = crearClienteNavegador();
        const real = await obtenerUsuarioActual(cliente);
        if (!real) {
          registrarEventoUx("traslado_nuevo_sin_sesion", { origen: "carga" });
          router.replace("/login?next=/traslados/nuevo&reason=authentication_required");
          return;
        }
        if (real) {
          if (real.estado_verificacion !== "verificado") {
            setBloqueoVerificacion(
              real.estado_verificacion === "en_revision"
                ? "Tu cuenta está en revisión. Podrás solicitar traslados cuando el equipo apruebe tu documentación."
                : "Necesitamos verificar tu cuenta antes de que solicites un traslado."
            );
            return;
          }
          setUsuario({
            id: real.id,
            tipo_cuenta: real.tipo_cuenta as TipoCuenta,
            rol: real.rol,
            ...(real.empresa_id ? { empresa_id: real.empresa_id } : {}),
            estado_verificacion: real.estado_verificacion,
            traslados_completados_sin_incidencia: real.traslados_completados_sin_incidencia,
            metodo_pago_registrado: real.metodo_pago_registrado,
            creado_en: real.creado_en
          });
          setSesionReal(true);
          setVehiculosGuardados(await listarVehiculosDeUsuario(cliente, real.id));
        }
      } catch (err) {
        setResultado({
          ok: false,
          mensaje: err instanceof Error ? err.message : "No pudimos validar tu sesión. Intenta iniciar sesión de nuevo."
        });
      } finally {
        setCargandoSesion(false);
      }
    }
    cargarUsuario();
  }, [router, setBloqueoVerificacion, setCargandoSesion, setResultado, setSesionReal, setUsuario, setVehiculosGuardados]);

  // Métodos de formulario
  const actualizar = useCallback(<K extends keyof DatosFormulario>(campo: K, valor: DatosFormulario[K]) => {
    setErrorPaso(null);
    setErrores((prev) => {
      if (!prev[campo]) return prev;
      const siguiente = { ...prev };
      delete siguiente[campo];
      return siguiente;
    });

    if (pasoRef.current > 0 && tarifaPreviaSnapshotRef.current && CAMPOS_PASO_TARIFA.has(campo)) {
      const datosNuevos = { ...datosRef.current, [campo]: valor };
      if (haCambiadoTarifa(tarifaPreviaSnapshotRef.current, datosNuevos)) {
        setTarifaPreviaAceptada(false);
        setErrorPaso("Tu tarifa puede haber cambiado. Confírmala antes de continuar.");
        // 3.1 tarifa validación fallida
        try {
          const prev = JSON.parse(tarifaPreviaSnapshotRef.current) as Record<string, unknown>;
          registrarEventoUx("tarifa_validacion_fallida", {
            paso: pasoRef.current,
            razon: String(campo),
            tarifa_anterior: String(prev.marca ?? ""),
            tarifa_nueva: String(valor ?? ""),
            timestamp: new Date().toISOString(),
          } as never);
        } catch {}
      }
    }

    setDatos((prev) => ({ ...prev, [campo]: valor }));
  }, [setDatos, setErrorPaso, setErrores, setTarifaPreviaAceptada]);

  const actualizarTelefono = useCallback((campo: "entregaTelefono" | "recepcionTelefono", valor: string) => {
    actualizar(campo, telefonoLocalMx(valor));
  }, [actualizar]);

  const actualizarMarcaCatalogo = useCallback((marca: string) => {
    const cambioMarca = marca !== datosRef.current.marca;
    actualizar("marca", marca);
    if (cambioMarca && datosRef.current.modelo) actualizar("modelo", "");
  }, [actualizar]);

  const actualizarModeloCatalogo = useCallback((modelo: string) => {
    actualizar("modelo", modelo);
    const tipoSugerido = tipoSugeridoParaVehiculo(datosRef.current.marca, modelo);
    if (tipoSugerido) actualizar("tipo", tipoSugerido);
  }, [actualizar]);

  const limpiarConsultaCodigoPostal = useCallback((prefijo: PrefijoDomicilio) => {
    const timer = codigoPostalTimersRef.current[prefijo];
    if (timer) clearTimeout(timer);
    codigoPostalTimersRef.current[prefijo] = null;
    codigoPostalAbortRef.current[prefijo]?.abort();
    codigoPostalAbortRef.current[prefijo] = null;
    codigoPostalSolicitadoRef.current[prefijo] = "";
    ++seqCodigoPostalRef.current[prefijo];
    setCpConsultando((actual) => actual === prefijo ? null : actual);
    setCpAviso((prev) => prev[prefijo] === null ? prev : { ...prev, [prefijo]: null });
    setCpOpciones((prev) => prev[prefijo] === null ? prev : { ...prev, [prefijo]: null });
    setPlacesOpciones((prev) => prev[prefijo].length === 0 ? prev : { ...prev, [prefijo]: [] });
  }, [setCpAviso, setCpConsultando, setCpOpciones, setPlacesOpciones]);

  const ejecutarConsultaCodigoPostal = useCallback(async (prefijo: PrefijoDomicilio, cp: string, secuencia: number) => {
    const vigente = () => seqCodigoPostalRef.current[prefijo] === secuencia;
    if (!vigente()) return;

    const controller = new AbortController();
    codigoPostalAbortRef.current[prefijo] = controller;
    let avisoMapbox: string | null = null;
    try {
      const sugerenciasMapboxPromise = sugerirDireccionesPorCodigoPostal(cp, controller.signal).catch(() => {
        // Mapbox es complementario: un fallo externo no invalida el catálogo
        // postal local ni debe presentarse como CP inexistente.
        avisoMapbox = "No pudimos cargar referencias de Mapbox. Puedes continuar con el catálogo postal local.";
        return [] as string[];
      });
      const [sugerenciasMapbox, datosCp] = await Promise.all([
        sugerenciasMapboxPromise,
        consultarCodigoPostalMx(cp)
      ]);
      if (!vigente()) return;
      setPlacesOpciones((prev) => ({ ...prev, [prefijo]: sugerenciasMapbox }));
      if (!datosCp) {
        setCpAviso((prev) => ({
          ...prev,
          [prefijo]: "No pudimos encontrar ese CP. Captura estado, ciudad y colonia manualmente."
        }));
        setCpOpciones((prev) => ({ ...prev, [prefijo]: null }));
        return;
      }
      const ciudad = datosCp.ciudades[0] ?? datosCp.colonias[0] ?? "";
      const colonia = datosCp.colonias[0] ?? ciudad;

      setDatos((prev) => ({
        ...prev,
        [`${prefijo}Estado`]: datosCp.estado || prev[`${prefijo}Estado` as keyof DatosFormulario],
        [`${prefijo}Ciudad`]: ciudad || prev[`${prefijo}Ciudad` as keyof DatosFormulario],
        [`${prefijo}Colonia`]: colonia || prev[`${prefijo}Colonia` as keyof DatosFormulario]
      }));
      setCpOpciones((prev) => ({ ...prev, [prefijo]: datosCp }));
      if (avisoMapbox) setCpAviso((prev) => ({ ...prev, [prefijo]: avisoMapbox }));
    } catch {
      if (vigente()) {
        setCpAviso((prev) => ({
          ...prev,
          [prefijo]: "No pudimos encontrar ese CP. Captura estado, ciudad y colonia manualmente."
        }));
      }
    } finally {
      if (codigoPostalAbortRef.current[prefijo] === controller) codigoPostalAbortRef.current[prefijo] = null;
      if (vigente()) setCpConsultando(null);
    }
  }, [setCpAviso, setCpConsultando, setCpOpciones, setDatos, setPlacesOpciones]);

  const programarConsultaCodigoPostal = useCallback((prefijo: PrefijoDomicilio, cp: string) => {
    if (codigoPostalSolicitadoRef.current[prefijo] === cp) return;
    const timerAnterior = codigoPostalTimersRef.current[prefijo];
    if (timerAnterior) clearTimeout(timerAnterior);
    codigoPostalAbortRef.current[prefijo]?.abort();
    codigoPostalAbortRef.current[prefijo] = null;

    const secuencia = ++seqCodigoPostalRef.current[prefijo];
    codigoPostalSolicitadoRef.current[prefijo] = cp;
    setCpConsultando(prefijo);
    setCpAviso((prev) => prev[prefijo] === null ? prev : { ...prev, [prefijo]: null });
    setCpOpciones((prev) => prev[prefijo] === null ? prev : { ...prev, [prefijo]: null });
    setPlacesOpciones((prev) => prev[prefijo].length === 0 ? prev : { ...prev, [prefijo]: [] });
    const timer = setTimeout(() => {
      codigoPostalTimersRef.current[prefijo] = null;
      void ejecutarConsultaCodigoPostal(prefijo, cp, secuencia);
    }, RETRASO_CONSULTA_CODIGO_POSTAL_MS);
    codigoPostalTimersRef.current[prefijo] = timer;
  }, [ejecutarConsultaCodigoPostal, setCpAviso, setCpConsultando, setCpOpciones, setPlacesOpciones]);

  const consultarCodigoPostal = useCallback((prefijo: PrefijoDomicilio, codigoPostal: string): Promise<void> => {
    const cp = soloDigitos(codigoPostal, 5);
    const campo = `${prefijo}CodigoPostal` as keyof DatosFormulario;
    if (datosRef.current[campo] !== cp) actualizar(campo, cp as never);
    if (cp.length !== 5) limpiarConsultaCodigoPostal(prefijo);
    else programarConsultaCodigoPostal(prefijo, cp);
    return Promise.resolve();
  }, [actualizar, limpiarConsultaCodigoPostal, programarConsultaCodigoPostal]);

  const actualizarCodigoPostal = useCallback((prefijo: PrefijoDomicilio, valor: string) => {
    const cp = soloDigitos(valor, 5);
    actualizar(`${prefijo}CodigoPostal` as keyof DatosFormulario, cp as never);
    if (cp.length === 5) programarConsultaCodigoPostal(prefijo, cp);
    else limpiarConsultaCodigoPostal(prefijo);
  }, [actualizar, limpiarConsultaCodigoPostal, programarConsultaCodigoPostal]);

  const aplicarSugerenciaCp = useCallback((prefijo: PrefijoDomicilio, ciudad: string, colonia: string) => {
    setDatos((prev) => ({
      ...prev,
      [`${prefijo}Ciudad`]: ciudad,
      [`${prefijo}Colonia`]: colonia
    }));
  }, [setDatos]);

  const actualizarParadas = useCallback((paradas: ParadaForm[]) => {
    setErrorPaso(null);
    setDatos((prev) => ({ ...prev, paradas }));
  }, [setDatos, setErrorPaso]);

  const reintentarRuta = useCallback(() => {
    setRutaReintento((valor) => valor + 1);
  }, [setRutaReintento]);

  const aplicarSugerenciaDireccion = useCallback((prefijo: PrefijoDomicilio, s: Awaited<ReturnType<typeof sugerirDireccionesAutocomplete>>[number]) => {
    const calleExtraida = s.direccion || s.textoCompleto.split(",")[0] || "";

    if (pasoRef.current > 0 && tarifaPreviaSnapshotRef.current && s.codigoPostal) {
      const campoCp = `${prefijo}CodigoPostal` as keyof DatosFormulario;
      const datosNuevos = { ...datosRef.current, [campoCp]: s.codigoPostal };
      if (haCambiadoTarifa(tarifaPreviaSnapshotRef.current, datosNuevos)) {
        setTarifaPreviaAceptada(false);
        setErrorPaso("Tu tarifa puede haber cambiado. Confírmala antes de continuar.");
      }
    }

    setDatos((prev) => ({
      ...prev,
      [`${prefijo}Calle`]: calleExtraida || prev[`${prefijo}Calle` as keyof DatosFormulario] as string,
      [`${prefijo}Colonia`]: s.colonia || prev[`${prefijo}Colonia` as keyof DatosFormulario] as string,
      [`${prefijo}Ciudad`]: s.ciudad || prev[`${prefijo}Ciudad` as keyof DatosFormulario] as string,
      [`${prefijo}Estado`]: s.estado || prev[`${prefijo}Estado` as keyof DatosFormulario] as string,
      [`${prefijo}CodigoPostal`]: s.codigoPostal || prev[`${prefijo}CodigoPostal` as keyof DatosFormulario] as string,
      ...(prefijo === "origen" && s.lat && s.lng ? { origenLat: s.lat, origenLng: s.lng } : {}),
    }));
    if (prefijo === "origen") { setOrigenBusqueda(s.textoCompleto); setOrigenSugerencias([]); }
    else { setDestinoBusqueda(s.textoCompleto); setDestinoSugerencias([]); }
    if (s.codigoPostal && s.codigoPostal.length === 5) void consultarCodigoPostal(prefijo, s.codigoPostal);
  }, [consultarCodigoPostal, setDestinoBusqueda, setDestinoSugerencias, setErrorPaso, setOrigenBusqueda, setOrigenSugerencias, setDatos, setTarifaPreviaAceptada]);

  const aplicarVehiculoGuardado = useCallback((vehiculo: VehiculoGuardado) => {
    const transmisionGuardada =
      vehiculo.transmision === "manual" || vehiculo.transmision === "automatica" || vehiculo.transmision === "electrica"
        ? vehiculo.transmision
        : datosRef.current.transmision;

    if (pasoRef.current > 0 && tarifaPreviaSnapshotRef.current) {
      const datosNuevos = {
        ...datosRef.current,
        marca: vehiculo.marca ?? "",
        modelo: vehiculo.modelo ?? "",
        condicion: (vehiculo.condicion as CondicionVehiculo) ?? datosRef.current.condicion
      };
      if (haCambiadoTarifa(tarifaPreviaSnapshotRef.current, datosNuevos)) {
        setTarifaPreviaAceptada(false);
        setErrorPaso("Tu tarifa puede haber cambiado. Confírmala antes de continuar.");
      }
    }

    setVehiculoSeleccionadoId(vehiculo.id);
    setDatos((prev) => ({
      ...prev,
      tipo: vehiculo.tipo,
      transmision: transmisionGuardada,
      marca: vehiculo.marca ?? "",
      modelo: vehiculo.modelo ?? "",
      anio: vehiculo.anio ? String(vehiculo.anio) : "",
      color: vehiculo.color ?? "",
      placas: vehiculo.placas ?? "",
      vin: vehiculo.vin ?? "",
      condicion: (vehiculo.condicion as CondicionVehiculo) ?? prev.condicion,
      estadoGeneral: vehiculo.estado_general_declarado ?? prev.estadoGeneral,
      tieneTarjeta: Boolean(vehiculo.tiene_tarjeta_circulacion),
      tieneVerificacion: Boolean(vehiculo.tiene_verificacion),
      tienePlacas: Boolean(vehiculo.tiene_placas),
      puedeCircular: Boolean(vehiculo.puede_circular_rodando)
    }));
  }, [setDatos, setErrorPaso, setTarifaPreviaAceptada, setVehiculoSeleccionadoId]);

  const limpiarVehiculoGuardado = useCallback(() => {
    setVehiculoSeleccionadoId("");
  }, [setVehiculoSeleccionadoId]);

  const claseControl = useCallback((campo: keyof DatosFormulario) => (
    erroresRef.current[campo] ? "border-danger" : "border-ink/50"
  ), []);

  const enfocarPrimerError = useCallback((campos: string[]) => {
    if (campos.length === 0) return;
    const primer = campos[0]!;
    setTimeout(() => {
      const candidato =
        document.getElementById(primer) ??
        (document.querySelector(`[name="${primer}"]`) as HTMLElement | null) ??
        (document.querySelector(`[data-ruum-label]`) as HTMLElement | null) ??
        (document.querySelector('[aria-invalid="true"]') as HTMLElement | null);
      if (candidato) {
        candidato.focus();
        candidato.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 60);
  }, []);

  const datosParaValidacion = useCallback(() => {
    return {
      ...datos,
      vehiculoSeleccionadoId,
      vehiculosUsuarioIds: vehiculosGuardados.map((v) => v.id),
      aceptaPoliticas: aceptaPoliticasPagoCancelacion,
      zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }, [aceptaPoliticasPagoCancelacion, datos, vehiculoSeleccionadoId, vehiculosGuardados]);

  const erroresParadas = useMemo(() => {
    const res = esquemaSolicitudTraslado.safeParse(datosParaValidacion());
    if (res.success) return undefined;
    const byIdx: Array<Partial<Record<keyof ParadaForm, string>>> = [];
    for (const issue of res.error.issues) {
      if (issue.path[0] === "paradas" && typeof issue.path[1] === "number") {
        const idx = issue.path[1] as number;
        const field = String(issue.path[2] ?? "calle") as keyof ParadaForm;
        byIdx[idx] = { ...byIdx[idx], [field]: issue.message };
      }
    }
    return byIdx.length ? byIdx : undefined;
  }, [datosParaValidacion]);

  const validarCampo = useCallback((campo: keyof DatosFormulario) => {
    const res = esquemaSolicitudTraslado.safeParse(datosParaValidacion());
    if (!res.success) {
      const map = erroresFormulario(res) as ErroresFormulario;
      if (map[campo]) {
        setErrores((prev) => ({ ...prev, [campo]: map[campo] }));
      } else {
        setErrores((prev) => {
          if (!prev[campo]) return prev;
          const n = { ...prev };
          delete n[campo];
          return n;
        });
      }
    } else {
      setErrores((prev) => {
        if (!prev[campo]) return prev;
        const n = { ...prev };
        delete n[campo];
        return n;
      });
    }
  }, [datosParaValidacion, setErrores]);

  const validarPasoActual = useCallback(() => {
    if (paso > 0 && paso < 3 && !tarifaPreviaAceptada) {
      setErrorPaso("Tu tarifa cambió o requiere confirmación. Por favor revísala en el paso inicial.");
      setPaso(0);
      return false;
    }

    const todos = erroresFormulario(esquemaSolicitudTraslado.safeParse(datosParaValidacion()));
    const siguientesErrores = Object.fromEntries(
      Object.entries(todos).filter(([campo]) => {
        if (paso === 0) return CAMPOS_PASO_TARIFA.has(campo as keyof DatosFormulario);
        if (paso === 1) return esCampoEsencialVehiculo(campo);
        if (paso === 2) return CAMPOS_PASO_RUTA.has(campo) || campo === "paradas";
        return pasoDeCampo(campo) === paso;
      })
    ) as ErroresFormulario;

    const detallesFaltantes = paso === 1 ? Object.keys(todos).filter((c) => CAMPOS_PASO_VEHICULO_DETALLE.has(c)).length : 0;
    const totalErrores = Object.keys(siguientesErrores).length;
    setErrores(siguientesErrores);

    if (totalErrores) {
      setErrorPaso(`${totalErrores} ${totalErrores === 1 ? "campo por completar" : "campos por completar"}. Revisa los campos marcados.`);
      if (paso === 2) {
        const primerCampo = Object.keys(siguientesErrores)[0]!;
        if (CAMPOS_RUTA_ORIGEN.has(primerCampo)) setSubpasoRuta("origen");
        else if (CAMPOS_RUTA_DESTINO_CONTACTOS.has(primerCampo)) setSubpasoRuta("destino_contactos");
      }
      enfocarPrimerError(Object.keys(siguientesErrores));
    } else if (detallesFaltantes > 0 && paso === 1) {
      setErrorPaso(null);
      setDetallesVehiculoExpandido(true);
    } else {
      setErrorPaso(null);
    }
    return totalErrores === 0;
  }, [datosParaValidacion, enfocarPrimerError, paso, setDetallesVehiculoExpandido, setErrorPaso, setErrores, setPaso, setSubpasoRuta, tarifaPreviaAceptada]);

  function restaurarBorrador() {
    const borrador = borradorDisponible;
    if (!borrador) return;

    let fechaRestaurada = borrador.fechaHoraProgramada;
    let modalidadRestaurada = (borrador.modalidadProgramacion || datos.modalidadProgramacion) as ModalidadProgramacion;

    if (fechaRestaurada && new Date(fechaRestaurada).getTime() <= Date.now()) {
      fechaRestaurada = "";
      modalidadRestaurada = "lo_antes_posible";
      setErrorPaso("La fecha programada en tu borrador ya pasó. Se restableció a 'Lo antes posible'.");
    }

    setDatos((prev) => ({
      ...prev,
      tipo: (borrador.tipo || prev.tipo) as TipoVehiculo,
      transmision: (borrador.transmision || prev.transmision) as TransmisionVehiculo,
      marca: borrador.marca,
      modelo: borrador.modelo,
      anio: borrador.anio,
      color: borrador.color,
      condicion: (borrador.condicion || prev.condicion) as CondicionVehiculo | "",
      estadoGeneral: borrador.estadoGeneral,
      tieneTarjeta: borrador.tieneTarjeta,
      tieneVerificacion: borrador.tieneVerificacion,
      tienePlacas: borrador.tienePlacas,
      puedeCircular: borrador.puedeCircular,
      origenCodigoPostal: borrador.origenCodigoPostal,
      origenEstado: borrador.origenEstado,
      origenCiudad: borrador.origenCiudad,
      origenColonia: borrador.origenColonia,
      destinoCodigoPostal: borrador.destinoCodigoPostal,
      destinoEstado: borrador.destinoEstado,
      destinoCiudad: borrador.destinoCiudad,
      destinoColonia: borrador.destinoColonia,
      entregaNombre: borrador.entregaNombre,
      entregaApellido: borrador.entregaApellido,
      recepcionNombre: borrador.recepcionNombre,
      recepcionApellido: borrador.recepcionApellido,
      modalidadProgramacion: modalidadRestaurada,
      fechaHoraProgramada: fechaRestaurada,
      tipoRuta: (borrador.tipoRuta || prev.tipoRuta) as TipoRutaTraslado,
      ventanaRecoleccion: borrador.ventanaRecoleccion,
      ventanaEntrega: borrador.ventanaEntrega,
      tipoServicio: (borrador.tipoServicio || prev.tipoServicio) as TipoServicioTraslado,
      motivoServicio: (borrador.motivoServicio || prev.motivoServicio) as MotivoServicioTraslado
    }));

    setPaso(0);
    setTarifaPreviaAceptada(false);
    setTarifaPreviaSnapshot(null);
    setClaveIdempotencia(borrador.claveIdempotencia);
    setBorradorDisponible(null);

    if (borrador.origenCodigoPostal.length === 5) void consultarCodigoPostal("origen", borrador.origenCodigoPostal);
    if (borrador.destinoCodigoPostal.length === 5) void consultarCodigoPostal("destino", borrador.destinoCodigoPostal);
  }

  function descartarBorrador() {
    limpiarBorradorTrasladoLocal();
    setClaveIdempotencia(crypto.randomUUID());
    setBorradorDisponible(null);
  }

  const aceptarTarifaYContinuar = useCallback(() => {
    if (!validarPasoActual()) return;
    setTarifaPreviaAceptada(true);
    setTarifaPreviaSnapshot(generarTarifaSnapshot(datos));
    setErrorPaso(null);
    registrarEventoUx("tarifa_gate_aceptada", {
      monto: previsualizacion?.tarifa ?? null,
      marca: datos.marca,
      modelo: datos.modelo
    });
    setPaso(1);
  }, [datos, previsualizacion, setErrorPaso, setPaso, setTarifaPreviaAceptada, setTarifaPreviaSnapshot, validarPasoActual]);

  const avanzarPaso = useCallback(() => {
    if (!validarPasoActual()) return;
    setPaso((p) => p + 1);
  }, [setPaso, validarPasoActual]);

  const retrocederPaso = useCallback(() => {
    setPaso((p) => p - 1);
  }, [setPaso]);

  const crear = useCallback(async (
    cliente: SupabaseClient<Database>,
    datosForm: DatosFormulario,
    vehiculoId: string,
    coordenadas: CoordenadasTraslado & { paradasCoords?: CoordenadasParada[] },
    idempotenciaKey: string
  ) => {
    try {
      if (!idempotenciaKey) throw new Error("No se pudo generar la clave de seguridad de la solicitud.");
      const payload = construirPayloadCreacion(datosForm, vehiculoId, coordenadas);
      const traslado = await crearTraslado(cliente, payload.vehiculo, payload.traslado, idempotenciaKey, payload.paradas);
      limpiarBorradorTrasladoLocal();
      return traslado;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { componente: "NuevoTraslado", paso, etapa: "creacion" },
        contexts: { traslado: { paso, tarifaPreviaAceptada, datosCompletos: Boolean(datosForm.marca && datosForm.modelo) } },
      });
      throw error;
    }
  }, [paso, tarifaPreviaAceptada]);

  const enviarSolicitud = useCallback(async () => {
    if (!tarifaPreviaAceptada) {
      setErrorPaso("Tu tarifa puede haber cambiado. Confírmala antes de continuar.");
      setPaso(0);
      return;
    }

    const validacionFinal = esquemaSolicitudTraslado.safeParse(datosParaValidacion());
    if (!validacionFinal.success) {
      const siguientesErrores = erroresFormulario(validacionFinal) as ErroresFormulario;
      setErrores(siguientesErrores);
      const primerCampo = String(validacionFinal.error.issues[0]?.path[0] ?? "");
      const pasoDestino = pasoDeCampo(primerCampo);
      setPaso(pasoDestino);
      if (CAMPOS_PASO_VEHICULO_DETALLE.has(primerCampo)) setDetallesVehiculoExpandido(true);
      if (CAMPOS_RUTA_ORIGEN.has(primerCampo)) setSubpasoRuta("origen");
      else if (CAMPOS_RUTA_DESTINO_CONTACTOS.has(primerCampo)) setSubpasoRuta("destino_contactos");
      setErrorPaso(`${validacionFinal.error.issues.length} campos requieren atención. Revisa los campos marcados.`);
      enfocarPrimerError([primerCampo]);
      return;
    }

    setEnviando(true);
    setResultado(null);

    if (!tieneSupabaseConfigurado()) {
      setEnviando(false);
      setResultado({
        ok: false,
        mensaje: "Supabase no está configurado. No se puede crear una solicitud real en este entorno."
      });
      return;
    }

    if (cargandoSesion) {
      setEnviando(false);
      setResultado({ ok: false, mensaje: "Estamos validando tu sesión. Espera unos segundos e intenta de nuevo." });
      return;
    }

    if (!sesionReal) {
      setEnviando(false);
      registrarEventoUx("traslado_nuevo_sin_sesion", { origen: "envio" });
      router.push("/login?next=/traslados/nuevo&reason=authentication_required");
      return;
    }

    const anioNumerico = Number(datos.anio);
    const anioMaximo = new Date().getFullYear() + 1;
    if (!datos.anio || !Number.isInteger(anioNumerico) || anioNumerico < 1980 || anioNumerico > anioMaximo) {
      setEnviando(false);
      setResultado({
        ok: false,
        mensaje: `El año del vehículo debe ser un número entre 1980 y ${anioMaximo}.`
      });
      return;
    }

    // Sec3: defensa en cliente + validación servidor del paso del wizard (rechazar si <4)
    if (paso < 3) {
      setEnviando(false);
      setResultado({ ok: false, mensaje: "Debes completar todos los pasos del wizard antes de enviar." });
      return;
    }

    try {
      registrarEventoUx("traslado_nuevo_enviado", {
        modalidad: datos.modalidadProgramacion,
        tipo_servicio: datos.tipoServicio,
        tipo_ruta: datos.tipoRuta
      });
      // Sec3: validación servidor — el servidor es fuente de verdad, el cliente no puede falsificar paso
      try {
        const respPaso = await fetch("/api/traslados", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paso,
            wizardPaso: paso,
            ...datos,
            vehiculoSeleccionadoId,
            vehiculosUsuarioIds: vehiculosGuardados.map((v) => v.id),
            zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
            aceptaPoliticas: aceptaPoliticasPagoCancelacion,
            paradas: datos.paradas,
          }),
        });
        if (!respPaso.ok) {
          const j = await respPaso.json().catch(() => null) as { error?: string } | null;
          throw new Error(j?.error || "Validación de pasos fallida en el servidor.");
        }
      } catch (e) {
        // Si la validación de paso falla, no continuar con geocodificación/creación
        if (e instanceof Error && /Solicitud incompleta|Validación de pasos|Wizard incompleto/i.test(e.message)) throw e;
        // Error de red en validación no bloquea si es 5xx genérico, pero logueamos
        console.warn("[traslados/nuevo] validación paso servidor no disponible", e);
      }
      const cliente = crearClienteNavegador();
      const origenDireccion = domicilioCompleto({
        calle: datos.origenCalle,
        numero: datos.origenNumero,
        colonia: datos.origenColonia,
        codigoPostal: datos.origenCodigoPostal,
        ciudad: datos.origenCiudad,
        estado: datos.origenEstado
      });
      const destinoDireccion = domicilioCompleto({
        calle: datos.destinoCalle,
        numero: datos.destinoNumero,
        colonia: datos.destinoColonia,
        codigoPostal: datos.destinoCodigoPostal,
        ciudad: datos.destinoCiudad,
        estado: datos.destinoEstado
      });

      let coordenadas: typeof rutaEstimacion = rutaEstimacion as typeof rutaEstimacion;
      if (!coordenadas) {
        try {
          const paradasDirs = (datos.paradas ?? []).map((p) => domicilioCompleto({
            calle: p.calle, numero: p.numero, colonia: p.colonia, codigoPostal: p.codigoPostal, ciudad: p.ciudad, estado: p.estado
          }));
          const origenActual = datos.origenLat !== undefined && datos.origenLng !== undefined ? { lat: datos.origenLat, lng: datos.origenLng } : undefined;
          coordenadas = paradasDirs.length
            ? await geocodificarRutaConParadas(origenDireccion, destinoDireccion, paradasDirs, origenActual)
            : await geocodificarRuta(origenDireccion, destinoDireccion, origenActual);
        } catch (error) {
          if (!esErrorConfiguracionMapbox(error)) throw error;
          setRutaAviso(mensajeErrorMapbox(error));
          coordenadas = { incompletas: true };
        }
      }

      if (coordenadas.incompletas && !tieneMapboxConfigurado()) {
        // Sec2: log genérico sin exponer nombre de variable de entorno; detalle va a observabilidad
        console.warn("[traslados/nuevo] servicio de mapas no configurado: origen/destino se guardan sin geocodificar.");
      }

      const nuevoTraslado = await crear(cliente, datos, vehiculoSeleccionadoId, coordenadas, claveIdempotencia);

      setTrasladoCreado({
        id: nuevoTraslado.id,
        tipoPago: nuevoTraslado.tipo_pago,
        precioCotizado: nuevoTraslado.precio_cotizado ?? null
      });
      formEnviadoRef.current = true;
      setPaso(4);
      registrarEventoUx("traslado_nuevo_exitoso", {
        tipo_pago: nuevoTraslado.tipo_pago,
        modalidad: datos.modalidadProgramacion,
        tipo_servicio: datos.tipoServicio,
        tipo_ruta: datos.tipoRuta
      });
    } catch (err) {
      // 3.2 Monitoreo Sentry con contexto
      const isMapbox = err instanceof Error && /Mapbox/i.test(err.message);
      const isSupabase = err instanceof Error && /supabase|auth|usuario/i.test(err.message);
      Sentry.captureException(err, {
        tags: {
          componente: "NuevoTraslado",
          paso,
          etapa: isMapbox ? "geocodificacion" : isSupabase ? "supabase" : "creacion",
          error_code: err instanceof Error ? err.name : "unknown",
        },
        contexts: {
          traslado: {
            paso,
            tarifaPreviaAceptada,
            datosCompletos: Boolean(datos.marca && datos.modelo && datos.origenCodigoPostal),
            modalidad: datos.modalidadProgramacion,
            tipo_servicio: datos.tipoServicio,
          },
        },
        extra: {
          mensaje: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
        },
      });
      setResultado({
        ok: false,
        mensaje: mensajeAmigableErrorCreacion(err)
      });
      registrarEventoUx("traslado_nuevo_error", {
        modalidad: datos.modalidadProgramacion,
        tipo_servicio: datos.tipoServicio,
        tipo_ruta: datos.tipoRuta,
        error_code: err instanceof Error ? err.name : "unknown",
        timestamp: new Date().toISOString(),
      });
      // 3.1 eventos específicos
      if (isMapbox) {
        registrarEventoUx("traslado_geocodificacion_error", { paso, error_code: (err as Error & { status?: number })?.status?.toString() ?? "mapbox", timestamp: new Date().toISOString() } as never);
      }
    } finally {
      setEnviando(false);
    }
  }, [
    aceptaPoliticasPagoCancelacion, cargandoSesion, claveIdempotencia, crear, datos, datosParaValidacion, enfocarPrimerError,
    geocodificarRuta, geocodificarRutaConParadas,
    paso, router, sesionReal, setDetallesVehiculoExpandido, setEnviando, setErrorPaso,
    setErrores, setPaso, setResultado, setRutaAviso, setSubpasoRuta, setTrasladoCreado,
    tarifaPreviaAceptada, vehiculoSeleccionadoId, vehiculosGuardados, rutaEstimacion
  ]);

  return {
    // Paso
    paso,
    setPaso,
    avanzarPaso,
    retrocederPaso,
    // Formulario y validación
    datos,
    setDatos,
    actualizar,
    actualizarTelefono,
    actualizarMarcaCatalogo,
    actualizarModeloCatalogo,
    actualizarCodigoPostal,
    consultarCodigoPostal,
    aplicarSugerenciaCp,
    aplicarSugerenciaDireccion,
    aplicarVehiculoGuardado,
    limpiarVehiculoGuardado,
    claseControl,
    validarCampo,
    validarPasoActual,
    enviarSolicitud,
    aceptarTarifaYContinuar,
    errores,
    errorPaso,
    setErrorPaso,
    erroresParadas,
    actualizarParadas,
    // Catálogos y computados
    modelosDisponibles,
    clasificacionCatalogo,
    categoriaCatalogo,
    gamaCatalogo,
    momentoPago,
    politicaCancelacion,
    // CP y geocodificación
    cpConsultando,
    cpAviso,
    cpOpciones,
    placesOpciones,
    origenBusqueda,
    setOrigenBusqueda,
    destinoBusqueda,
    setDestinoBusqueda,
    origenSugerencias,
    destinoSugerencias,
    buscandoOrigen,
    buscandoDestino,
    rutaEstimacion,
    rutaCalculando,
    rutaAviso,
    reintentarRuta,
    // Vehículos y detalles
    vehiculosGuardados,
    vehiculoSeleccionadoId,
    detallesVehiculoExpandido,
    setDetallesVehiculoExpandido,
    // Tarifa
    previsualizacion,
    previsualizando,
    tarifaPreviaAceptada,
    tarifaPreviaSnapshot,
    // Sesión y estados
    cargandoSesion,
    sesionReal,
    usuario,
    bloqueoVerificacion,
    enviando,
    resultado,
    setResultado,
    aceptaPoliticasPagoCancelacion,
    setAceptaPoliticasPagoCancelacion,
    // Borrador y feedback guardado
    borradorDisponible,
    restaurarBorrador,
    descartarBorrador,
    estadoGuardado,
    tiempoUltimoGuardado,
    // Envío y estados finales
    trasladoCreado,
    cotizacionAceptada,
    aceptandoCotizacion,
    errorAceptacion,
    pagoConfirmado,
    setPagoConfirmado,
    reintentarAceptacion,
    // 1.4 debounce dinámico
    solicitarGeocodificacionInmediata,
    // Export backward-compatibility
    crear
  };
}
