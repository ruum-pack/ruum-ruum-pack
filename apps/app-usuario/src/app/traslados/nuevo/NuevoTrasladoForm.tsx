"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Aviso, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO, MENSAJES_CLAVE_UX, TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { determinarMomentoPago, calcularCargoCancelacion } from "@ruum/shared/rules";
import type { Database, TipoVehiculo } from "@ruum/shared/types";
import type { TipoCuenta, Usuario } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { listarVehiculosDeUsuario, obtenerUsuarioActual, previsualizarTarifaUsuario, aceptarCotizacionUsuario, type PrevisualizacionTarifa } from "@ruum/api/services";
import { PagoStripe, tieneStripePublicoConfigurado } from "../../PagoStripe";
import { esNativo } from "../../../lib/capacitor";
import { obtenerUbicacionActual } from "../../../lib/ubicacion";
import { consultarCodigoPostalMx, type DatosCodigoPostal } from "../../../lib/codigos-postales";
import { registrarEventoUx } from "../../../lib/analytics";
import { sugerirDireccionesPorCodigoPostal, tieneMapboxConfigurado } from "../../../lib/mapbox";
import { MARCAS_CATALOGO, clasificacionesPorVehiculo, modelosPorMarca, resumenClasificacionVehiculo, tipoSugeridoParaVehiculo } from "../../../lib/catalogo-vehiculos";
import {
  guardarBorradorTrasladoLocal,
  leerBorradorTrasladoLocal,
  limpiarBorradorTrasladoLocal,
  type BorradorTrasladoLocal
} from "../../../lib/borrador-traslado";
import { NavegacionUsuario } from "../../NavegacionUsuario";
import { esquemaSolicitudTraslado, erroresFormulario } from "./schema";
import type { CondicionVehiculo, DatosFormulario, ErroresFormulario, ModalidadProgramacion, MotivoServicioTraslado, TipoRutaTraslado, TipoServicioTraslado, TransmisionVehiculo, VehiculoGuardado } from "./types";
import { useGeocodificacion } from "./hooks/useGeocodificacion";
import { useNuevoTraslado } from "./hooks/useNuevoTraslado";
import { EstadoCreacion } from "./components/EstadoCreacion";

const PASOS = ["¿Qué vehículo trasladamos?", "¿Dónde lo recogemos y llevamos?", "¿Cuándo lo trasladamos?", "Pago"] as const;

const CAMPOS_PASO_VEHICULO = new Set([
  "vehiculoSeleccionadoId", "marca", "modelo", "color", "placas", "vin", "anio",
  "transmision", "condicion", "estadoGeneral", "tieneTarjeta", "tieneVerificacion", "tienePlacas", "puedeCircular"
]);
const CAMPOS_PASO_RUTA = new Set([
  "origenCodigoPostal", "origenEstado", "origenCiudad", "origenColonia", "origenCalle", "origenNumero",
  "destinoCodigoPostal", "destinoEstado", "destinoCiudad", "destinoColonia", "destinoCalle", "destinoNumero",
  "entregaNombre", "entregaApellido", "entregaTelefono", "recepcionNombre", "recepcionApellido", "recepcionTelefono"
]);
const CAMPOS_RUTA_ORIGEN = new Set([
  "origenCodigoPostal", "origenEstado", "origenCiudad", "origenColonia", "origenCalle", "origenNumero"
]);
const CAMPOS_RUTA_DESTINO_CONTACTOS = new Set([
  "destinoCodigoPostal", "destinoEstado", "destinoCiudad", "destinoColonia", "destinoCalle", "destinoNumero",
  "entregaNombre", "entregaApellido", "entregaTelefono", "recepcionNombre", "recepcionApellido", "recepcionTelefono"
]);

function pasoDeCampo(campo: string): number {
  if (CAMPOS_PASO_VEHICULO.has(campo)) return 0;
  if (CAMPOS_PASO_RUTA.has(campo)) return 1;
  return 2;
}

// Geocodificación y sugerencias usan Mapbox mediante lib/mapbox.ts.

const ESTADOS_GENERALES_VEHICULO = [
  "Excelente, sin daños visibles",
  "Buen estado, desgaste normal",
  "Detalles estéticos menores",
  "Rayones o golpes visibles"
] as const;

const CONDICIONES_VEHICULO: Array<{ valor: CondicionVehiculo; etiqueta: string }> = [
  { valor: "nueva", etiqueta: "Nueva" },
  { valor: "seminueva", etiqueta: "Seminueva" },
  { valor: "rescate_mecanico", etiqueta: "Rescate mecánico" }
];

interface DatosFormularioLegacy {
  // Vehículo — PRD §4.2
  tipo: TipoVehiculo;
  transmision: TransmisionVehiculo;
  marca: string;
  modelo: string;
  anio: string;
  color: string;
  placas: string;
  vin: string;
  condicion: CondicionVehiculo | "";
  estadoGeneral: string;
  // Documentos — PRD §4.2
  tieneTarjeta: boolean;
  tieneVerificacion: boolean;
  tienePlacas: boolean;
  puedeCircular: boolean;
  // Origen / destino
  origenCodigoPostal: string;
  origenEstado: string;
  origenCiudad: string;
  origenColonia: string;
  origenCalle: string;
  origenNumero: string;
  origenReferencias: string;
  // Solo se llenan dentro del shell nativo, vía "Usar mi ubicación actual"
  // (lib/ubicacion.ts). Geocodificación real de la dirección sigue
  // pendiente — sin esto, origen_lat/lng se siguen enviando en 0.
  origenLat?: number;
  origenLng?: number;
  destinoCodigoPostal: string;
  destinoEstado: string;
  destinoCiudad: string;
  destinoColonia: string;
  destinoCalle: string;
  destinoNumero: string;
  destinoReferencias: string;
  // Contactos — PRD §4.1
  entregaNombre: string;
  entregaApellido: string;
  entregaTelefono: string;
  recepcionNombre: string;
  recepcionApellido: string;
  recepcionTelefono: string;
  instruccionesEspeciales: string;
  modalidadProgramacion: ModalidadProgramacion;
  fechaHoraProgramada: string;
  tipoRuta: TipoRutaTraslado;
  ventanaRecoleccion: string;
  ventanaEntrega: string;
  tipoServicio: TipoServicioTraslado;
  motivoServicio: MotivoServicioTraslado;
}

const VALORES_INICIALES: DatosFormulario = {
  tipo: "sedan",
  transmision: "automatica",
  marca: "",
  modelo: "",
  anio: "",
  color: "",
  placas: "",
  vin: "",
  condicion: "",
  estadoGeneral: "",
  tieneTarjeta: false,
  tieneVerificacion: false,
  tienePlacas: false,
  puedeCircular: false,
  origenCodigoPostal: "",
  origenEstado: "",
  origenCiudad: "",
  origenColonia: "",
  origenCalle: "",
  origenNumero: "",
  origenReferencias: "",
  destinoCodigoPostal: "",
  destinoEstado: "",
  destinoCiudad: "",
  destinoColonia: "",
  destinoCalle: "",
  destinoNumero: "",
  destinoReferencias: "",
  entregaNombre: "",
  entregaApellido: "",
  entregaTelefono: "",
  recepcionNombre: "",
  recepcionApellido: "",
  recepcionTelefono: "",
  instruccionesEspeciales: "",
  modalidadProgramacion: "lo_antes_posible",
  fechaHoraProgramada: "",
  tipoRuta: "local",
  ventanaRecoleccion: "",
  ventanaEntrega: "",
  tipoServicio: "personal",
  motivoServicio: "entrega_cliente"
};

// Usuario sin historial (PRD §4.6): valor temporal mientras se confirma
// la sesión real. Nunca se usa para insertar registros.
const USUARIO_PENDIENTE = {
  id: "",
  tipo_cuenta: "personal" as const,
  rol: "personal" as const,
  estado_verificacion: "pendiente" as const,
  traslados_completados_sin_incidencia: 0,
  metodo_pago_registrado: false,
  creado_en: new Date().toISOString()
};

type PrefijoDomicilio = "origen" | "destino";
type SubpasoRuta = "origen" | "destino_contactos";

function soloDigitos(valor: string, maximo?: number) {
  const limpio = valor.replace(/\D/g, "");
  return maximo ? limpio.slice(0, maximo) : limpio;
}

function telefonoLocalMx(valor: string) {
  const limpio = soloDigitos(valor);
  const sinCodigoPais = limpio.length > 10 && limpio.startsWith("52") ? limpio.slice(2) : limpio;
  return sinCodigoPais.slice(0, 10);
}

function telefonoMx(diezDigitos: string) {
  const telefono = soloDigitos(diezDigitos, 10);
  return telefono ? `+52${telefono}` : "";
}

function nombreCompleto(nombre: string, apellido: string) {
  return [nombre.trim(), apellido.trim()].filter(Boolean).join(" ");
}

// Sprint 4 — los mensajes que usuario_crea_traslado() lanza a propósito
// (migraciones 20260711000118/119) ya están redactados para la persona, en
// español llano: se muestran tal cual. Cualquier OTRA cosa (RLS crudo, error
// de red, timeout de Supabase) no debe llegarle así — mismo criterio que ya
// exige el test a1 sobre la RPC de cancelación ("no expone el error crudo
// del trigger").
const PATRON_MENSAJE_DE_NEGOCIO = /vehículo|precio cotizado|usuario autenticado|sesión/i;

function mensajeAmigableErrorCreacion(err: unknown): string {
  if (err instanceof Error) {
    if (PATRON_MENSAJE_DE_NEGOCIO.test(err.message)) return err.message;
    console.error("[traslados/nuevo] Error inesperado al crear la solicitud:", err);
    return "No pudimos crear la solicitud por un problema técnico. Intenta de nuevo en unos segundos; si sigue fallando, contáctanos por soporte.";
  }
  console.error("[traslados/nuevo] Error inesperado (no-Error) al crear la solicitud:", err);
  return "No pudimos crear la solicitud. Intenta de nuevo.";
}

function domicilioCompleto({
  calle,
  numero,
  colonia,
  codigoPostal,
  ciudad,
  estado
}: {
  calle: string;
  numero: string;
  colonia: string;
  codigoPostal: string;
  ciudad: string;
  estado: string;
}) {
  return [
    [calle.trim(), numero.trim()].filter(Boolean).join(" "),
    colonia.trim() ? `Col. ${colonia.trim()}` : "",
    codigoPostal.trim() ? `CP ${codigoPostal.trim()}` : "",
    ciudad.trim(),
    estado.trim()
  ]
    .filter(Boolean)
    .join(", ");
}

function referenciasDomicilio(referencias: string, estado: string, codigoPostal: string) {
  return [
    referencias.trim(),
    estado.trim() ? `Estado: ${estado.trim()}` : "",
    codigoPostal.trim() ? `CP: ${codigoPostal.trim()}` : ""
  ]
    .filter(Boolean)
    .join(" | ");
}

function formatearDistancia(km: number) {
  return `${km.toLocaleString("es-MX", { maximumFractionDigits: 1 })} km`;
}

function formatearTiempo(horas: number) {
  const minutosTotales = Math.round(horas * 60);
  const horasEnteras = Math.floor(minutosTotales / 60);
  const minutos = minutosTotales % 60;
  if (horasEnteras <= 0) return `${minutos} min`;
  return `${horasEnteras} h ${minutos.toString().padStart(2, "0")} min`;
}

interface CampoCodigoPostalProps {
  valor: string;
  ciudadActual: string;
  opciones: DatosCodigoPostal | null;
  sugerenciasMapbox: string[];
  consultando: boolean;
  aviso: string | null;
  error?: string;
  onCambiar: (valor: string) => void;
  onSalir: (valor: string) => void;
  onAplicarSugerencia: (ciudad: string, colonia: string) => void;
}

// Componente a nivel de módulo a propósito: antes vivía declarado dentro de
// NuevoTrasladoForm, así que React lo veía como un tipo de componente nuevo
// en cada render (nueva referencia de función) y desmontaba/remontaba el
// <input> en cada tecla — de ahí que solo se pudiera capturar un dígito del
// CP a la vez y hubiera que hacer click de nuevo para seguir escribiendo.
function CampoCodigoPostal({
  valor,
  ciudadActual,
  opciones,
  sugerenciasMapbox,
  consultando,
  aviso,
  error,
  onCambiar,
  onSalir,
  onAplicarSugerencia
}: CampoCodigoPostalProps) {
  const ciudadBase = ciudadActual || opciones?.ciudades[0] || "";
  const sugerencias = opciones
    ? opciones.colonias.slice(0, 5).map((colonia) => ({
        ciudad: opciones.ciudades[0] ?? ciudadBase,
        colonia
      }))
    : [];

  return (
    <div className="grid gap-2">
      <Field
        etiqueta="Código Postal"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        onBlur={(e) => onSalir(e.target.value)}
        inputMode="numeric"
        maxLength={5}
        ayuda={consultando ? "Consultando CP..." : aviso}
        error={error}
      />
      {(sugerenciasMapbox.length > 0 || sugerencias.length > 0) && (
        <div className="rounded-lg border border-ink/10 bg-mist px-3 py-2">
          {sugerenciasMapbox.length > 0 && (
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Referencias Mapbox</p>
              <div className="mt-1 grid gap-1">
                {sugerenciasMapbox.map((opcion) => (
                  <p
                    key={opcion}
                    className="rounded-md px-2 py-1 font-body text-xs text-ink/70"
                  >
                    {opcion}
                  </p>
                ))}
              </div>
            </div>
          )}
          {sugerencias.length > 0 && (
            <div className={sugerenciasMapbox.length ? "mt-2 border-t border-ink/10 pt-2" : ""}>
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Colonias sugeridas</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {sugerencias.map((opcion) => (
                  <button
                    key={`${opcion.ciudad}-${opcion.colonia}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onAplicarSugerencia(opcion.ciudad, opcion.colonia)}
                    className="rounded-full border border-ink/10 px-2.5 py-1 font-body text-xs text-ink/70 hover:border-signal/40"
                  >
                    {opcion.colonia}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NuevoTrasladoForm() {
  const { geocodificarRuta } = useGeocodificacion();
  const { crear: crearNuevoTraslado } = useNuevoTraslado();
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  /* Ítem 11 — gestión de foco al cambiar paso: el foco va al título del paso
     nuevo para que usuarios de teclado/SR no pierdan la referencia. */
  const encabezadoPasoRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    encabezadoPasoRef.current?.focus();
  }, [paso]);

  useEffect(() => {
    registrarEventoUx("traslado_nuevo_visto");
  }, []);
  const [datos, setDatos] = useState<DatosFormulario>(VALORES_INICIALES);
  const modelosDisponibles = useMemo(() => modelosPorMarca(datos.marca), [datos.marca]);
  const clasificacionCatalogo = useMemo(
    () => resumenClasificacionVehiculo(datos.marca, datos.modelo),
    [datos.marca, datos.modelo],
  );
  const clasificacionesCatalogo = useMemo(
    () => clasificacionesPorVehiculo(datos.marca, datos.modelo),
    [datos.marca, datos.modelo],
  );
  const categoriaCatalogo = useMemo(() => {
    const valores = [...new Set(clasificacionesCatalogo.map((vehiculo) => vehiculo.categoria))];
    return valores.length ? valores.join(" / ") : "Pendiente";
  }, [clasificacionesCatalogo]);
  const gamaCatalogo = useMemo(() => {
    const valores = [...new Set(clasificacionesCatalogo.map((vehiculo) => vehiculo.gama))];
    return valores.length ? valores.join(" / ") : "Pendiente";
  }, [clasificacionesCatalogo]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [bloqueoVerificacion, setBloqueoVerificacion] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario>(USUARIO_PENDIENTE);
  const [sesionReal, setSesionReal] = useState(false);
  const [cargandoSesion, setCargandoSesion] = useState(tieneSupabaseConfigurado());
  const [aceptaPoliticasPagoCancelacion, setAceptaPoliticasPagoCancelacion] = useState(false);
  const [cpConsultando, setCpConsultando] = useState<PrefijoDomicilio | null>(null);
  const [cpAviso, setCpAviso] = useState<Record<PrefijoDomicilio, string | null>>({ origen: null, destino: null });
  const [cpOpciones, setCpOpciones] = useState<Record<PrefijoDomicilio, DatosCodigoPostal | null>>({ origen: null, destino: null });
  const [placesOpciones, setPlacesOpciones] = useState<Record<PrefijoDomicilio, string[]>>({ origen: [], destino: [] });
  const [subpasoRuta, setSubpasoRuta] = useState<SubpasoRuta>("origen");
  const [vehiculosGuardados, setVehiculosGuardados] = useState<VehiculoGuardado[]>([]);
  const [vehiculoSeleccionadoId, setVehiculoSeleccionadoId] = useState<string>("");
  const [errorPaso, setErrorPaso] = useState<string | null>(null);
  const [errores, setErrores] = useState<ErroresFormulario>({});
  // RT-13 — previsualización de tarifa en vivo (paso "Agenda + Servicio"):
  // reemplaza el presupuesto que antes tecleaba la persona. null = todavía
  // no hay suficientes datos o el vehículo no está en el catálogo de
  // autoclasificación (Torre de Control cotizará esa solicitud a mano).
  const [previsualizacion, setPrevisualizacion] = useState<PrevisualizacionTarifa | null>(null);
  const [previsualizando, setPrevisualizando] = useState(false);
  const [rutaEstimacion, setRutaEstimacion] = useState<{
    origenLat?: number;
    origenLng?: number;
    destinoLat?: number;
    destinoLng?: number;
    distanciaKm?: number;
    tiempoEstimadoHoras?: number;
    incompletas: boolean;
  } | null>(null);
  const [rutaCalculando, setRutaCalculando] = useState(false);
  const [rutaAviso, setRutaAviso] = useState<string | null>(null);

  // Sprint 4 — borrador NO sensible del wizard (ver lib/borrador-traslado.ts
  // para qué se excluye y por qué). Mismo patrón que
  // app-conductor/lib/borrador-registro.ts: detectar al montar, guardar con
  // debounce mientras se llena, restaurar u ofrecer descartar.
  const [borradorDisponible, setBorradorDisponible] = useState<BorradorTrasladoLocal | null>(null);
  const [claveIdempotencia, setClaveIdempotencia] = useState("");

  // Paso 4 (Pago) — una vez creada la solicitud, el cobro se resuelve aquí
  // mismo en el wizard en lugar de mandar a la persona a buscarlo en el
  // Pasaporte Digital (/traslados/[id], que ahora es de solo consulta).
  const [trasladoCreado, setTrasladoCreado] = useState<{
    id: string;
    tipoPago: "anticipado" | "al_cierre";
    precioCotizado: number | null;
  } | null>(null);
  const [cotizacionAceptada, setCotizacionAceptada] = useState(false);
  const [aceptandoCotizacion, setAceptandoCotizacion] = useState(false);
  const [errorAceptacion, setErrorAceptacion] = useState<string | null>(null);
  const [pagoConfirmado, setPagoConfirmado] = useState(false);
  const [reintentoAceptacion, setReintentoAceptacion] = useState(0);
  // Deduplica el intento de aceptación por id de traslado. Un ref (no un
  // booleano en un cleanup) porque React 18 Strict Mode monta/limpia/vuelve
  // a montar los efectos en desarrollo: con un flag "cancelado" en el
  // cleanup, la primera pasada quedaba cancelada antes de que su promesa
  // resolviera y nunca bajaba `aceptandoCotizacion`, dejando el paso de pago
  // congelado para siempre en "Confirmando tarifa…". El ref sobrevive esas
  // dos pasadas sin duplicar la llamada RPC.
  const trasladoAceptacionIntentado = useRef<string | null>(null);

  // El pago anticipado (Stripe) solo puede iniciarse cuando el traslado está
  // en 'cotizacion_aceptada' (ver crear-payment-intent). Como en el wizard
  // ya se le mostró la tarifa antes de confirmar, aceptamos la cotización
  // automáticamente en cuanto se crea la solicitud, sin pedirle un segundo
  // "acepto" a la persona.
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
  }, [trasladoCreado, reintentoAceptacion]);
  const RETRASO_GUARDADO_BORRADOR_MS = 600;

  useEffect(() => {
    const timer = setTimeout(() => {
      const borrador = leerBorradorTrasladoLocal();
      setBorradorDisponible(borrador);
      setClaveIdempotencia(borrador?.claveIdempotencia ?? crypto.randomUUID());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (enviando || resultado) return;
    const hayContenido = [datos.marca, datos.modelo, datos.origenCodigoPostal, datos.destinoCodigoPostal, datos.entregaNombre].some(
      (v) => v.trim()
    );
    if (!hayContenido) return;

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
    datos.ventanaRecoleccion, datos.ventanaEntrega, datos.tipoServicio, datos.motivoServicio
  ]);

  // Se dispara con debounce en cuanto ambas direcciones están completas, sin
  // importar en qué paso esté la persona: antes solo se intentaba mientras
  // paso === 1, así que si alguien avanzaba a "¿Cuándo lo trasladamos?" antes
  // de que el debounce de 650ms terminara, el cálculo se cancelaba (cleanup
  // del efecto al cambiar de paso) y nunca se reintentaba -- la tarifa se
  // quedaba sin calcular para siempre porque dependía de esta ruta.
  useEffect(() => {
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

    if (!origenDireccion.trim() || !destinoDireccion.trim()) {
      const timer = setTimeout(() => {
        setRutaEstimacion(null);
        setRutaAviso(null);
        setRutaCalculando(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    let cancelado = false;
    const timer = setTimeout(async () => {
      setRutaCalculando(true);
      setRutaAviso(null);
      try {
        const coordenadas = await geocodificarRuta(
          origenDireccion,
          destinoDireccion,
          datos.origenLat !== undefined && datos.origenLng !== undefined ? { lat: datos.origenLat, lng: datos.origenLng } : undefined
        );
        if (cancelado) return;
        setRutaEstimacion(coordenadas);
        if (coordenadas.incompletas) {
          setRutaAviso(
            tieneMapboxConfigurado()
              ? "No pudimos resolver una de las direcciones. Revisa calle, número, colonia y CP."
              : "Mapbox no está configurado; se guardará la solicitud sin distancia ni tiempo estimado."
          );
        } else if (coordenadas.distanciaKm === undefined || coordenadas.tiempoEstimadoHoras === undefined) {
          setRutaAviso("Mapbox resolvió las direcciones, pero no devolvió una ruta con distancia y tiempo.");
        }
      } catch {
        if (!cancelado) {
          setRutaEstimacion(null);
          setRutaAviso("No pudimos calcular distancia y tiempo en este momento.");
        }
      } finally {
        if (!cancelado) setRutaCalculando(false);
      }
    }, 650);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [
    datos.origenCalle, datos.origenNumero, datos.origenColonia, datos.origenCodigoPostal, datos.origenCiudad, datos.origenEstado,
    datos.destinoCalle, datos.destinoNumero, datos.destinoColonia, datos.destinoCodigoPostal, datos.destinoCiudad, datos.destinoEstado,
    datos.origenLat, datos.origenLng, geocodificarRuta
  ]);

  // RT-13 — calcula la tarifa en vivo apenas hay ruta y clasificación.
  useEffect(() => {
    if (paso !== 2 || !sesionReal) {
      return;
    }
    if (!datos.marca.trim() || !datos.modelo.trim() || !datos.condicion) {
      const timer = setTimeout(() => setPrevisualizacion(null), 0);
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
    const condicionSeleccionada = datos.condicion;
    let cancelado = false;
    const timer = setTimeout(async () => {
      setPrevisualizando(true);
      try {
        const cliente = crearClienteNavegador();
        const resultado = await previsualizarTarifaUsuario(cliente, {
          marca: datos.marca,
          modelo: datos.modelo,
          distanciaKm,
          tiempoEstimadoHoras,
          fechaHora: datos.modalidadProgramacion === "programado" && datos.fechaHoraProgramada ? new Date(datos.fechaHoraProgramada) : null,
          condicion: condicionSeleccionada
        });
        if (!cancelado) setPrevisualizacion(resultado);
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
    paso, sesionReal, datos.marca, datos.modelo, datos.condicion,
    datos.modalidadProgramacion, datos.fechaHoraProgramada, rutaEstimacion
  ]);

  function restaurarBorrador() {
    const borrador = borradorDisponible;
    if (!borrador) return;

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
      modalidadProgramacion: (borrador.modalidadProgramacion || prev.modalidadProgramacion) as ModalidadProgramacion,
      fechaHoraProgramada: borrador.fechaHoraProgramada,
      tipoRuta: (borrador.tipoRuta || prev.tipoRuta) as TipoRutaTraslado,
      ventanaRecoleccion: borrador.ventanaRecoleccion,
      ventanaEntrega: borrador.ventanaEntrega,
      tipoServicio: (borrador.tipoServicio || prev.tipoServicio) as TipoServicioTraslado,
      motivoServicio: (borrador.motivoServicio || prev.motivoServicio) as MotivoServicioTraslado
    }));

    // Domicilio preciso (calle, número), teléfonos de contacto, VIN, placas
    // e instrucciones especiales se recapturan a propósito: no viajan en el
    // borrador local (ver lib/borrador-traslado.ts).
    setPaso(borrador.paso);
    setClaveIdempotencia(borrador.claveIdempotencia);
    setBorradorDisponible(null);

    // Repobla las sugerencias de ciudad/colonia que dependen del CP.
    if (borrador.origenCodigoPostal.length === 5) void consultarCodigoPostal("origen", borrador.origenCodigoPostal);
    if (borrador.destinoCodigoPostal.length === 5) void consultarCodigoPostal("destino", borrador.destinoCodigoPostal);
  }

  function descartarBorrador() {
    limpiarBorradorTrasladoLocal();
    setClaveIdempotencia(crypto.randomUUID());
    setBorradorDisponible(null);
  }

  // Si hay sesión real, usa el usuario real (PRD §4.6: su historial decide
  // pago anticipado vs. al cierre).
  // tipo_cuenta/rol/estado_verificacion se castean desde el tipo de columna
  // de la base (texto con CHECK, no enum nativo — ver 0002_usuarios.sql) al
  // tipo conceptual más estrecho que ya usan las reglas de negocio.
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
  }, [router]);

  const momentoPago = useMemo(() => determinarMomentoPago(usuario), [usuario]);
  // El monto de este cálculo no se muestra en el wizard (solo el mensaje,
  // que únicamente depende del porcentaje) -- antes de tener conductor
  // asignado el porcentaje siempre es 0% aquí, así que el precio ya no
  // hace falta como argumento.
  const politicaCancelacion = useMemo(() => calcularCargoCancelacion(0, 0, false, false), []);

  function actualizar<K extends keyof DatosFormulario>(campo: K, valor: DatosFormulario[K]) {
    setErrorPaso(null);
    setErrores((prev) => {
      if (!prev[campo]) return prev;
      const siguiente = { ...prev };
      delete siguiente[campo];
      return siguiente;
    });
    setDatos((prev) => ({ ...prev, [campo]: valor }));
  }

  function actualizarTelefono(campo: "entregaTelefono" | "recepcionTelefono", valor: string) {
    actualizar(campo, telefonoLocalMx(valor));
  }

  function actualizarMarcaCatalogo(marca: string) {
    const cambioMarca = marca !== datos.marca;
    actualizar("marca", marca);
    if (cambioMarca && datos.modelo) actualizar("modelo", "");
  }

  function actualizarModeloCatalogo(modelo: string) {
    actualizar("modelo", modelo);
    const tipoSugerido = tipoSugeridoParaVehiculo(datos.marca, modelo);
    if (tipoSugerido) actualizar("tipo", tipoSugerido);
  }

  function actualizarCodigoPostal(prefijo: PrefijoDomicilio, valor: string) {
    const cp = soloDigitos(valor, 5);
    actualizar(`${prefijo}CodigoPostal` as keyof DatosFormulario, cp as never);
    if (cp.length === 5) void consultarCodigoPostal(prefijo, cp);
  }

  async function consultarCodigoPostal(prefijo: PrefijoDomicilio, codigoPostal: string) {
    const cp = soloDigitos(codigoPostal, 5);
    actualizar(`${prefijo}CodigoPostal` as keyof DatosFormulario, cp as never);

    if (cp.length !== 5) {
      setCpAviso((prev) => ({ ...prev, [prefijo]: null }));
      setCpOpciones((prev) => ({ ...prev, [prefijo]: null }));
      setPlacesOpciones((prev) => ({ ...prev, [prefijo]: [] }));
      return;
    }

    setCpConsultando(prefijo);
    setCpAviso((prev) => ({ ...prev, [prefijo]: null }));

    try {
      const sugerenciasMapbox = await sugerirDireccionesPorCodigoPostal(cp);
      setPlacesOpciones((prev) => ({ ...prev, [prefijo]: sugerenciasMapbox }));
      const datosCp = await consultarCodigoPostalMx(cp);
      if (!datosCp) throw new Error("CP no encontrado");
      const ciudad = datosCp.ciudades[0] ?? datosCp.colonias[0] ?? "";
      const colonia = datosCp.colonias[0] ?? ciudad;

      setDatos((prev) => ({
        ...prev,
        [`${prefijo}Estado`]: datosCp.estado || prev[`${prefijo}Estado` as keyof DatosFormulario],
        [`${prefijo}Ciudad`]: ciudad || prev[`${prefijo}Ciudad` as keyof DatosFormulario],
        [`${prefijo}Colonia`]: colonia || prev[`${prefijo}Colonia` as keyof DatosFormulario]
      }));
      setCpOpciones((prev) => ({ ...prev, [prefijo]: datosCp }));
    } catch {
      setCpAviso((prev) => ({
        ...prev,
        [prefijo]: "No pudimos encontrar ese CP. Captura estado, ciudad y colonia manualmente."
      }));
    } finally {
      setCpConsultando(null);
    }
  }

  function aplicarSugerenciaCp(prefijo: PrefijoDomicilio, ciudad: string, colonia: string) {
    setDatos((prev) => ({
      ...prev,
      [`${prefijo}Ciudad`]: ciudad,
      [`${prefijo}Colonia`]: colonia
    }));
  }

  function aplicarVehiculoGuardado(vehiculo: VehiculoGuardado) {
    const transmisionGuardada =
      vehiculo.transmision === "manual" || vehiculo.transmision === "automatica" || vehiculo.transmision === "electrica"
        ? vehiculo.transmision
        : datos.transmision;

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
      condicion: vehiculo.condicion ?? prev.condicion,
      estadoGeneral: vehiculo.estado_general_declarado ?? prev.estadoGeneral,
      tieneTarjeta: Boolean(vehiculo.tiene_tarjeta_circulacion),
      tieneVerificacion: Boolean(vehiculo.tiene_verificacion),
      tienePlacas: Boolean(vehiculo.tiene_placas),
      puedeCircular: Boolean(vehiculo.puede_circular_rodando)
    }));
  }

  function limpiarVehiculoGuardado() {
    setVehiculoSeleccionadoId("");
  }

  function BloqueRuta() {
    const hayErroresOrigen = Object.keys(errores).some((campo) => CAMPOS_RUTA_ORIGEN.has(campo));
    const hayErroresDestinoContactos = Object.keys(errores).some((campo) => CAMPOS_RUTA_DESTINO_CONTACTOS.has(campo));

    return (
      <div className="grid gap-4">
        <p className="font-body text-sm font-semibold">¿De dónde sale y a dónde llega?</p>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-mist p-1" aria-label="Secciones de origen y destino">
          <button
            type="button"
            aria-pressed={subpasoRuta === "origen"}
            onClick={() => setSubpasoRuta("origen")}
            className={[
              "rounded-lg px-3 py-2.5 text-left font-body text-sm font-semibold transition focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-dark",
              subpasoRuta === "origen" ? "bg-signal text-ink shadow-sm" : "text-ink/65 hover:bg-ink/[0.04] hover:text-ink"
            ].join(" ")}
          >
            Origen
            {hayErroresOrigen && <span className="ml-2 text-danger" aria-label="con errores">•</span>}
          </button>
          <button
            type="button"
            aria-pressed={subpasoRuta === "destino_contactos"}
            onClick={() => setSubpasoRuta("destino_contactos")}
            className={[
              "rounded-lg px-3 py-2.5 text-left font-body text-sm font-semibold transition focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-dark",
              subpasoRuta === "destino_contactos" ? "bg-signal text-ink shadow-sm" : "text-ink/65 hover:bg-ink/[0.04] hover:text-ink"
            ].join(" ")}
          >
            Destino y contactos
            {hayErroresDestinoContactos && <span className="ml-2 text-danger" aria-label="con errores">•</span>}
          </button>
        </div>

        {subpasoRuta === "origen" && (
          <div className="grid gap-4" aria-label="Origen del traslado">
            <div className="grid gap-4 rounded-lg border border-ink/10 p-4">
              <p className="font-body text-sm font-semibold">Domicilio de origen</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoCodigoPostal
                  valor={datos.origenCodigoPostal}
                  ciudadActual={datos.origenCiudad}
                  opciones={cpOpciones.origen}
                  sugerenciasMapbox={placesOpciones.origen}
                  consultando={cpConsultando === "origen"}
                  aviso={cpAviso.origen}
                  error={errores.origenCodigoPostal}
                  onCambiar={(valor) => actualizarCodigoPostal("origen", valor)}
                  onSalir={(valor) => consultarCodigoPostal("origen", valor)}
                  onAplicarSugerencia={(ciudad, colonia) => aplicarSugerenciaCp("origen", ciudad, colonia)}
                />
                <Field etiqueta="Estado" value={datos.origenEstado} onChange={(e) => actualizar("origenEstado", e.target.value)} error={errores.origenEstado} />
                <Field etiqueta="Ciudad" value={datos.origenCiudad} onChange={(e) => actualizar("origenCiudad", e.target.value)} error={errores.origenCiudad} />
                <Field etiqueta="Colonia" value={datos.origenColonia} onChange={(e) => actualizar("origenColonia", e.target.value)} error={errores.origenColonia} />
                <Field etiqueta="Calle" value={datos.origenCalle} onChange={(e) => actualizar("origenCalle", e.target.value)} error={errores.origenCalle} />
                <Field etiqueta="Número" value={datos.origenNumero} onChange={(e) => actualizar("origenNumero", e.target.value)} error={errores.origenNumero} />
              </div>
              <Field etiqueta="Referencias" value={datos.origenReferencias} onChange={(e) => actualizar("origenReferencias", e.target.value)} placeholder="Entre calles, color de fachada, acceso, piso, etc." />
            </div>
            {esNativo() && (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    const coords = await obtenerUbicacionActual();
                    if (coords) {
                      actualizar("origenLat", coords.lat);
                      actualizar("origenLng", coords.lng);
                    }
                  }}
                >
                  Usar mi ubicación actual
                </Button>
                {datos.origenLat !== undefined && <p className="mt-1 font-body text-xs text-ink/45">Ubicación capturada ✓</p>}
              </div>
            )}
            <div className="flex justify-end">
              <Button type="button" onClick={() => setSubpasoRuta("destino_contactos")}>
                Continuar con destino
              </Button>
            </div>
          </div>
        )}

        {subpasoRuta === "destino_contactos" && (
          <div className="grid gap-4" aria-label="Destino y contactos del traslado">
            <div className="grid gap-4 rounded-lg border border-ink/10 p-4">
              <p className="font-body text-sm font-semibold">Domicilio de destino</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoCodigoPostal
                  valor={datos.destinoCodigoPostal}
                  ciudadActual={datos.destinoCiudad}
                  opciones={cpOpciones.destino}
                  sugerenciasMapbox={placesOpciones.destino}
                  consultando={cpConsultando === "destino"}
                  aviso={cpAviso.destino}
                  error={errores.destinoCodigoPostal}
                  onCambiar={(valor) => actualizarCodigoPostal("destino", valor)}
                  onSalir={(valor) => consultarCodigoPostal("destino", valor)}
                  onAplicarSugerencia={(ciudad, colonia) => aplicarSugerenciaCp("destino", ciudad, colonia)}
                />
                <Field etiqueta="Estado" value={datos.destinoEstado} onChange={(e) => actualizar("destinoEstado", e.target.value)} error={errores.destinoEstado} />
                <Field etiqueta="Ciudad" value={datos.destinoCiudad} onChange={(e) => actualizar("destinoCiudad", e.target.value)} error={errores.destinoCiudad} />
                <Field etiqueta="Colonia" value={datos.destinoColonia} onChange={(e) => actualizar("destinoColonia", e.target.value)} error={errores.destinoColonia} />
                <Field etiqueta="Calle" value={datos.destinoCalle} onChange={(e) => actualizar("destinoCalle", e.target.value)} error={errores.destinoCalle} />
                <Field etiqueta="Número" value={datos.destinoNumero} onChange={(e) => actualizar("destinoNumero", e.target.value)} error={errores.destinoNumero} />
              </div>
              <Field etiqueta="Referencias" value={datos.destinoReferencias} onChange={(e) => actualizar("destinoReferencias", e.target.value)} placeholder="Entre calles, color de fachada, acceso, piso, etc." />
            </div>
            <section className="rounded-lg border border-route/20 bg-route-soft px-4 py-4" aria-labelledby="titulo-estimacion-ruta">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p id="titulo-estimacion-ruta" className="font-body text-sm font-semibold text-ink">
                    Distancia y tiempo estimado
                  </p>
                  <p className="mt-1 font-body text-xs leading-5 text-ink/65">
                    Se calcula con Mapbox usando origen y destino. Si no se puede resolver, operaciones lo revisará.
                  </p>
                </div>
                {rutaCalculando ? (
                  <p className="rounded-full bg-mist px-3 py-1.5 font-body text-xs font-semibold text-route-dark">
                    Calculando ruta...
                  </p>
                ) : rutaEstimacion?.distanciaKm !== undefined && rutaEstimacion.tiempoEstimadoHoras !== undefined ? (
                  <dl className="grid grid-cols-2 gap-2 rounded-lg bg-mist px-4 py-3 text-center font-body">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink/45">Distancia</dt>
                      <dd className="mt-1 text-sm font-bold text-ink">{formatearDistancia(rutaEstimacion.distanciaKm)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink/45">Tiempo</dt>
                      <dd className="mt-1 text-sm font-bold text-ink">{formatearTiempo(rutaEstimacion.tiempoEstimadoHoras)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="rounded-full bg-mist px-3 py-1.5 font-body text-xs font-semibold text-ink/55">
                    Completa ambas direcciones
                  </p>
                )}
              </div>
              {rutaAviso && <p className="mt-3 font-body text-xs leading-5 text-danger">{rutaAviso}</p>}
            </section>
            <p className="font-body text-sm font-semibold">Quien entrega el vehículo</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field etiqueta="Nombre" value={datos.entregaNombre} onChange={(e) => actualizar("entregaNombre", e.target.value)} error={errores.entregaNombre} />
              <Field etiqueta="Apellido" value={datos.entregaApellido} onChange={(e) => actualizar("entregaApellido", e.target.value)} error={errores.entregaApellido} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="telefono-entrega" className="font-body text-sm font-medium">Teléfono</label>
              <div className={`flex overflow-hidden rounded-lg border bg-mist ${claseControl("entregaTelefono")}`}>
                <span className="flex items-center border-r border-ink/10 px-3.5 font-body text-sm font-semibold text-ink/70">+52</span>
                <input id="telefono-entrega" value={datos.entregaTelefono} onChange={(e) => actualizarTelefono("entregaTelefono", e.target.value)} inputMode="numeric" maxLength={10} className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark" placeholder="10 dígitos" aria-label="Teléfono de entrega (10 dígitos)" aria-invalid={Boolean(errores.entregaTelefono)} aria-describedby={errores.entregaTelefono ? "telefono-entrega-error" : undefined} />
              </div>
              {errores.entregaTelefono && <p id="telefono-entrega-error" className="font-body text-xs text-danger">{errores.entregaTelefono}</p>}
            </div>
            <p className="mt-2 font-body text-sm font-semibold">Quien recibe el vehículo</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field etiqueta="Nombre" value={datos.recepcionNombre} onChange={(e) => actualizar("recepcionNombre", e.target.value)} error={errores.recepcionNombre} />
              <Field etiqueta="Apellido" value={datos.recepcionApellido} onChange={(e) => actualizar("recepcionApellido", e.target.value)} error={errores.recepcionApellido} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="telefono-recepcion" className="font-body text-sm font-medium">Teléfono</label>
              <div className={`flex overflow-hidden rounded-lg border bg-mist ${claseControl("recepcionTelefono")}`}>
                <span className="flex items-center border-r border-ink/10 px-3.5 font-body text-sm font-semibold text-ink/70">+52</span>
                <input id="telefono-recepcion" value={datos.recepcionTelefono} onChange={(e) => actualizarTelefono("recepcionTelefono", e.target.value)} inputMode="numeric" maxLength={10} className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark" placeholder="10 dígitos" aria-label="Teléfono de recepción (10 dígitos)" aria-invalid={Boolean(errores.recepcionTelefono)} aria-describedby={errores.recepcionTelefono ? "telefono-recepcion-error" : undefined} />
              </div>
              {errores.recepcionTelefono && <p id="telefono-recepcion-error" className="font-body text-xs text-danger">{errores.recepcionTelefono}</p>}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-medium">Instrucciones especiales</span>
              <textarea value={datos.instruccionesEspeciales} onChange={(e) => actualizar("instruccionesEspeciales", e.target.value)} maxLength={1000} aria-label="Instrucciones especiales para el traslado" className="min-h-24 rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark" />
            </label>
          </div>
        )}
      </div>
    );
  }

  function claseControl(campo: keyof DatosFormulario) {
    return errores[campo] ? "border-danger" : "border-ink/50";
  }

  function validarPasoActual() {
    const todos = erroresFormulario(esquemaSolicitudTraslado.safeParse(datosParaValidacion()));
    const siguientesErrores = Object.fromEntries(Object.entries(todos).filter(([campo]) => pasoDeCampo(campo) === paso)) as ErroresFormulario;

    const totalErrores = Object.keys(siguientesErrores).length;
    setErrores(siguientesErrores);
    setErrorPaso(totalErrores ? `${totalErrores} ${totalErrores === 1 ? "campo requiere" : "campos requieren"} atención.` : null);
    if (paso === 1 && totalErrores > 0) {
      const primerCampo = Object.keys(siguientesErrores)[0];
      setSubpasoRuta(CAMPOS_RUTA_ORIGEN.has(primerCampo) ? "origen" : "destino_contactos");
    }
    return totalErrores === 0;
  }

  function datosParaValidacion() {
    return {
      ...datos,
      vehiculoSeleccionadoId,
      vehiculosUsuarioIds: vehiculosGuardados.map((v) => v.id),
      aceptaPoliticas: aceptaPoliticasPagoCancelacion,
      zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  async function enviarSolicitud() {
    const validacionFinal = esquemaSolicitudTraslado.safeParse(datosParaValidacion());
    if (!validacionFinal.success) {
      const siguientesErrores = erroresFormulario(validacionFinal) as ErroresFormulario;
      setErrores(siguientesErrores);
      const primerCampo = String(validacionFinal.error.issues[0]?.path[0] ?? "");
      setPaso(pasoDeCampo(primerCampo));
      setErrorPaso(`${validacionFinal.error.issues.length} campos requieren atención.`);
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
      // Supabase sí está configurado, pero no hay sesión: usuario.id sería
      // "" y la inserción real fallaría contra RLS (no hay fila propia que
      // crear/usar). Mejor mandarlo a iniciar sesión que fallar en silencio.
      setEnviando(false);
      registrarEventoUx("traslado_nuevo_sin_sesion", { origen: "envio" });
      router.push("/login?next=/traslados/nuevo&reason=authentication_required");
      return;
    }

    // Bug real encontrado en producción (2026-06-29): un campo "Año" vacío
    // o fuera de rango llegaba intacto hasta Postgres y tronaba con el
    // mensaje crudo de la constraint (vehiculos_anio_check), sin que la
    // persona supiera qué corregir. Se valida aquí antes de gastar un
    // insert real.
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

    // RT-13 — la tarifa ya no la escribe la persona: la calcula el sistema
    // (usuario_previsualizar_tarifa / usuario_crea_traslado) a partir de
    // vehículo + ruta + fecha/hora. No se bloquea el envío si el vehículo no
    // está en el catálogo de autoclasificación -- esa solicitud se crea igual
    // y queda pendiente de cotización manual por Torre de Control, como
    // pasaba con cualquier traslado antes de RT-13.

    try {
      registrarEventoUx("traslado_nuevo_enviado", {
        modalidad: datos.modalidadProgramacion,
        tipo_servicio: datos.tipoServicio,
        tipo_ruta: datos.tipoRuta
      });
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

      // Sprint 2 (2026-07-11) — antes: origen_lat/lng solo se llenaba si la
      // persona usaba "Usar mi ubicación actual" en el shell nativo (y aun
      // así, solo servía para origen); destino_lat/lng se mandaba en 0,0
      // siempre, sin excepción. Ahora se geocodifica la dirección capturada
      // para ambos. Si ya hay coordenadas de GPS real para origen (más
      // precisas que geocodificar el texto de la dirección), esas ganan y
      // no se pisan.
      const coordenadas = rutaEstimacion ?? await geocodificarRuta(
        origenDireccion,
        destinoDireccion,
        datos.origenLat !== undefined && datos.origenLng !== undefined ? { lat: datos.origenLat, lng: datos.origenLng } : undefined
      );

      // No bloqueamos la solicitud por esto — operaciones puede ubicar la
      // dirección a mano igual que hacía antes de que existiera geocodificación
      // — pero si Maps no está configurado o la dirección no resolvió, hay que
      // dejarlo visible en vez de mandar 0,0 disfrazado de coordenada real.
      if (coordenadas.incompletas && !tieneMapboxConfigurado()) {
        console.warn(
          "[traslados/nuevo] NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN no está configurado: origen/destino se guardan sin geocodificar."
        );
      }

      // Vehículo y traslado ahora se crean en una sola RPC transaccional
      // (usuario_crea_traslado, migración 20260711000118): ya no hay un
      // insert de vehículo suelto que pueda quedar huérfano si el del
      // traslado falla, y si se reutiliza un vehículo guardado, la base
      // valida ahí mismo que sea del usuario autenticado.
      const nuevoTraslado = await crearNuevoTraslado(cliente, datos, vehiculoSeleccionadoId, coordenadas, claveIdempotencia);

      // A partir de aquí la solicitud ya vive en la base — el borrador local
      // ya no sirve para nada (y si se quedara, mostraría un banner de
      // "continuar donde ibas" sobre un traslado que ya se creó).
      setTrasladoCreado({
        id: nuevoTraslado.id,
        tipoPago: nuevoTraslado.tipo_pago,
        precioCotizado: nuevoTraslado.precio_cotizado ?? null
      });
      setPaso(3);
      registrarEventoUx("traslado_nuevo_exitoso", {
        tipo_pago: nuevoTraslado.tipo_pago,
        modalidad: datos.modalidadProgramacion,
        tipo_servicio: datos.tipoServicio,
        tipo_ruta: datos.tipoRuta
      });
    } catch (err) {
      setResultado({
        ok: false,
        mensaje: mensajeAmigableErrorCreacion(err)
      });
      registrarEventoUx("traslado_nuevo_error", {
        modalidad: datos.modalidadProgramacion,
        tipo_servicio: datos.tipoServicio,
        tipo_ruta: datos.tipoRuta
      });
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return <EstadoCreacion resultado={resultado} volver={() => setResultado(null)} />;
  }

  if (bloqueoVerificacion) {
    return (
      <main className="app-page">
        <NavegacionUsuario />
        <div className="mx-auto max-w-xl px-6 py-12">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Verificación requerida</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">Antes de solicitar un traslado</h1>
          <div className="mt-5">
            <Aviso tono="atencion">{bloqueoVerificacion}</Aviso>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/verificacion?next=/traslados/nuevo"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-signal px-5 py-3 font-display text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-signal/90 focus-visible:outline-route-dark"
            >
              Ir a verificación
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/20 bg-mist px-5 py-3 font-body text-sm font-medium text-ink transition hover:border-ink/40 focus-visible:outline-route-dark"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page">
      <NavegacionUsuario />
      <div className="mx-auto max-w-xl px-6 py-12">
        <h1 className="font-display text-2xl font-semibold">Nuevo traslado</h1>

        {borradorDisponible && (
          <div className="mt-5 rounded-xl border border-route/25 bg-route-soft p-4">
            <p className="font-body text-sm font-semibold text-ink">Encontramos una solicitud sin terminar</p>
            <p className="mt-1 font-body text-xs leading-5 text-ink/65">
              Guardada el {new Date(borradorDisponible.guardadoEn).toLocaleString("es-MX")} y disponible por 24 horas.
              Por seguridad no guardamos domicilio exacto, teléfonos de contacto, VIN, placas ni instrucciones especiales.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={restaurarBorrador}>Continuar donde iba</Button>
              <Button type="button" variant="quiet" onClick={descartarBorrador}>Empezar de cero</Button>
            </div>
          </div>
        )}

      <div className="mt-6" aria-label={`Paso ${paso + 1} de ${PASOS.length} — ${PASOS[paso]}`}>
        <p className="font-body text-sm font-semibold text-ink">
          Paso {paso + 1} de {PASOS.length} — {PASOS[paso]}
        </p>
        <ol className="mt-3 flex items-center gap-3">
          {PASOS.map((etiqueta, i) => (
            <li key={etiqueta} className="flex items-center gap-2">
              <span
                className={[
                  "flex size-8 items-center justify-center rounded-full border font-body text-sm font-semibold",
                  i === paso
                    ? "border-signal bg-signal text-ink"
                    : i < paso
                      ? "border-control bg-control-soft text-control"
                      : "border-ink/20 bg-mist text-ink/70"
                ].join(" ")}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className={i === paso ? "font-body text-sm font-medium text-ink" : "font-body text-sm text-ink/70"}>
                {etiqueta}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Anuncio de paso actual para lectores de pantalla + gestión de foco */}
      <h2
        ref={encabezadoPasoRef}
        tabIndex={-1}
        className="sr-only"
        aria-live="polite"
      >
        Paso {paso + 1} de {PASOS.length}: {PASOS[paso]}
      </h2>

      <div className="mt-8">
        {paso === 0 && (
          <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-6">
          <PassportCard>
            <div className="grid gap-6">
              {vehiculosGuardados.length > 0 && (
                <div className="grid gap-3 rounded-lg border border-signal/20 bg-signal-soft/50 p-4">
                  <div>
                    <p className="font-body text-sm font-semibold">Usar vehículo guardado</p>
                    <p className="mt-1 font-body text-xs text-ink/60">Selecciona uno de tu historial para precargar la información.</p>
                  </div>
                  <div className="grid gap-2">
                    {vehiculosGuardados.slice(0, 4).map((vehiculo) => (
                      <button
                        key={vehiculo.id}
                        type="button"
                        onClick={() => aplicarVehiculoGuardado(vehiculo)}
                        className={[
                          "rounded-lg border px-3 py-2 text-left font-body text-sm transition",
                          vehiculoSeleccionadoId === vehiculo.id
                            ? "border-signal bg-signal text-ink"
                            : "border-ink/10 bg-mist text-ink/70 hover:border-signal/40"
                        ].join(" ")}
                      >
                        <span className="block font-semibold">
                          {vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}
                        </span>
                        <span className="mt-0.5 block text-xs opacity-70">
                          {vehiculo.placas ?? "Sin placas"} · {ETIQUETA_TIPO_VEHICULO[vehiculo.tipo as TipoVehiculo]}
                        </span>
                      </button>
                    ))}
                  </div>
                  {vehiculoSeleccionadoId && (
                    <button type="button" onClick={limpiarVehiculoGuardado} className="justify-self-start font-body text-xs font-semibold text-route-dark">
                      Capturar como vehículo nuevo
                    </button>
                  )}
                </div>
              )}
              <div className="grid gap-4 rounded-lg border border-ink/10 p-4">
                <div>
                  <p className="font-body text-sm font-semibold">Datos del vehículo</p>
                  <p className="mt-1 font-body text-xs text-ink/65">Identificación básica para cotizar y documentar el traslado.</p>
                </div>
                <div className="grid gap-3 rounded-lg border border-route/15 bg-route-soft/60 p-4 sm:grid-cols-3">
                  <div>
                    <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Categoría</p>
                    <p className="mt-1 font-body text-sm font-bold text-ink">{categoriaCatalogo}</p>
                  </div>
                  <div>
                    <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Gama</p>
                    <p className="mt-1 font-body text-sm font-bold text-ink">{gamaCatalogo}</p>
                  </div>
                  <div>
                    <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Tipo operativo</p>
                    <p className="mt-1 font-body text-sm font-bold text-ink">{ETIQUETA_TIPO_VEHICULO[datos.tipo]}</p>
                  </div>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="font-body text-sm font-medium">Transmisión</span>
                  <select
                    value={datos.transmision}
                    onChange={(e) => actualizar("transmision", e.target.value as TransmisionVehiculo)}
                    className="rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm"
                  >
                    <option value="automatica">Automática</option>
                    <option value="manual">Manual</option>
                    <option value="electrica">Eléctrica</option>
                  </select>
                </label>
                <div>
                  <Field
                    etiqueta="Marca"
                    list="catalogo-marcas-vehiculos"
                    value={datos.marca}
                    onChange={(e) => actualizarMarcaCatalogo(e.target.value)}
                    error={errores.marca}
                    ayuda="Selecciona una marca del catálogo o escríbela manualmente."
                  />
                  <datalist id="catalogo-marcas-vehiculos">
                    {MARCAS_CATALOGO.map((marca) => <option key={marca} value={marca} />)}
                  </datalist>
                </div>
                <div>
                  <Field
                    etiqueta="Modelo"
                    list="catalogo-modelos-vehiculos"
                    value={datos.modelo}
                    onChange={(e) => actualizarModeloCatalogo(e.target.value)}
                    disabled={!datos.marca.trim()}
                    error={errores.modelo}
                    ayuda={clasificacionCatalogo
                      ? `Clasificación del catálogo: ${clasificacionCatalogo}. El tipo de vehículo se prellenó automáticamente.`
                      : datos.marca.trim()
                      ? `${modelosDisponibles.length} modelos disponibles. Al elegir uno sugeriremos el tipo de vehículo.`
                      : "Primero captura o selecciona la marca."}
                  />
                  <datalist id="catalogo-modelos-vehiculos">
                    {modelosDisponibles.map((modelo) => <option key={modelo} value={modelo} />)}
                  </datalist>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="font-body text-sm font-medium">Condición</span>
                  <select
                    value={datos.condicion}
                    onChange={(e) => actualizar("condicion", e.target.value as CondicionVehiculo)}
                    className={`rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark ${claseControl("condicion")}`}
                    aria-invalid={Boolean(errores.condicion)}
                  >
                    <option value="">Selecciona condición</option>
                    {CONDICIONES_VEHICULO.map((condicion) => (
                      <option key={condicion.valor} value={condicion.valor}>
                        {condicion.etiqueta}
                      </option>
                    ))}
                  </select>
                  {errores.condicion && <p className="font-body text-xs text-danger">{errores.condicion}</p>}
                </label>
                <Field
                  etiqueta="Año"
                  type="number"
                  min={1980}
                  max={new Date().getFullYear() + 1}
                  value={datos.anio}
                  onChange={(e) => actualizar("anio", e.target.value)}
                  error={errores.anio}
                />
                <Field etiqueta="Color" value={datos.color} onChange={(e) => actualizar("color", e.target.value)} error={errores.color} />
                <Field etiqueta="Placas" value={datos.placas} onChange={(e) => actualizar("placas", e.target.value)} error={errores.placas} />
                <Field
                  etiqueta="Número de serie / VIN"
                  value={datos.vin}
                  onChange={(e) => actualizar("vin", e.target.value)}
                  error={errores.vin}
                />
                <label className="flex flex-col gap-1.5">
                  <span className="font-body text-sm font-medium">Estado general declarado</span>
                  <select
                    value={datos.estadoGeneral}
                    onChange={(e) => actualizar("estadoGeneral", e.target.value)}
                    className={`rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark ${claseControl("estadoGeneral")}`}
                    aria-invalid={Boolean(errores.estadoGeneral)}
                  >
                    <option value="">Selecciona estado</option>
                    {ESTADOS_GENERALES_VEHICULO.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado}
                      </option>
                    ))}
                  </select>
                  {errores.estadoGeneral && <p className="font-body text-xs text-danger">{errores.estadoGeneral}</p>}
                </label>
              </div>
              <div className="grid gap-3 rounded-lg border border-ink/10 p-4">
                <div>
                  <p className="font-body text-sm font-semibold">Documentación mínima requerida</p>
                  <p className="mt-1 font-body text-xs text-ink/65">Por el momento, el servicio está disponible únicamente para vehículos que encienden, cuentan con documentación vigente y pueden circular rodando.</p>
                </div>
                {(
                  [
                    ["tieneTarjeta", "Tarjeta de circulación vigente"],
                    ["tieneVerificacion", "Verificación vehicular vigente"],
                    ["tienePlacas", "Ambas placas instaladas"],
                    ["puedeCircular", "El vehículo enciende y puede circular rodando"]
                  ] as const
                ).map(([campo, etiqueta]) => (
                  <div key={campo} className="grid gap-1">
                    <label className="flex items-center gap-2.5 font-body text-sm">
                      <input
                        type="checkbox"
                        checked={datos[campo]}
                        onChange={(e) => actualizar(campo, e.target.checked)}
                        className={`size-5 rounded text-signal focus-visible:outline-route-dark ${errores[campo] ? "border-danger" : "border-ink/50"}`}
                        aria-invalid={Boolean(errores[campo])}
                      />
                      {etiqueta}
                    </label>
                    {errores[campo] && <p className="pl-7 font-body text-xs text-danger">{errores[campo]}</p>}
                  </div>
                ))}
              </div>
            </div>
          </PassportCard>
          </div>
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-4">
            <PassportCard>
              {BloqueRuta()}
            </PassportCard>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <PassportCard>
              <div className="grid gap-4">
                <p className="font-body text-sm font-semibold">¿Cuándo lo necesitas?</p>
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium">Disponibilidad</span>
                <select
                  value={datos.modalidadProgramacion}
                  onChange={(e) => {
                    const modalidad = e.target.value as ModalidadProgramacion;
                    actualizar("modalidadProgramacion", modalidad);
                    if (modalidad === "lo_antes_posible") actualizar("fechaHoraProgramada", "");
                  }}
                  className="rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm"
                >
                  <option value="lo_antes_posible">Lo antes posible</option>
                  <option value="programado">Programar fecha y hora</option>
                </select>
              </label>
              {datos.modalidadProgramacion === "programado" && (
                <Field
                  etiqueta="Fecha y hora programada"
                  type="datetime-local"
                  value={datos.fechaHoraProgramada}
                  onChange={(e) => actualizar("fechaHoraProgramada", e.target.value)}
                  error={errores.fechaHoraProgramada}
                />
              )}
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium">Tipo de traslado</span>
                <select
                  value={datos.tipoRuta}
                  onChange={(e) => actualizar("tipoRuta", e.target.value as TipoRutaTraslado)}
                  className="rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm"
                >
                  <option value="local">Local</option>
                  <option value="foraneo">Foráneo</option>
                </select>
              </label>
              <Field
                etiqueta="Ventana de recolección"
                value={datos.ventanaRecoleccion}
                onChange={(e) => actualizar("ventanaRecoleccion", e.target.value)}
                placeholder="Ej. 09:00 a 12:00"
              />
              <Field
                etiqueta="Ventana de entrega"
                value={datos.ventanaEntrega}
                onChange={(e) => actualizar("ventanaEntrega", e.target.value)}
                placeholder="Ej. Mismo día por la tarde"
              />
              </div>
            </PassportCard>
            <PassportCard>
              <div className="grid gap-4">
                <p className="font-body text-sm font-semibold">Tipo de servicio</p>
                <label className="flex flex-col gap-1.5">
                  <span className="font-body text-sm font-medium">Servicio</span>
                  <select
                    value={datos.tipoServicio}
                    onChange={(e) => actualizar("tipoServicio", e.target.value as TipoServicioTraslado)}
                    className="rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm"
                  >
                    <option value="personal">Traslado personal</option>
                    <option value="empresarial">Traslado empresarial</option>
                    <option value="agencia">Para agencia</option>
                    <option value="lote">Para lote</option>
                    <option value="flotilla">Para flotilla</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-body text-sm font-medium">Motivo</span>
                  <select
                    value={datos.motivoServicio}
                    onChange={(e) => actualizar("motivoServicio", e.target.value as MotivoServicioTraslado)}
                    className="rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm"
                  >
                    <option value="entrega_cliente">Entrega a cliente</option>
                    <option value="recuperacion">Recuperación</option>
                    <option value="traslado_especial">Traslado especial</option>
                  </select>
                </label>
              </div>
            </PassportCard>

            <section className="app-status-strip px-5 py-5" aria-labelledby="titulo-tarifa-calculada">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p id="titulo-tarifa-calculada" className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">
                    Tarifa a pagar
                  </p>
                  {previsualizando && (
                    <p className="mt-1 font-body text-sm text-ink/55">Calculando tarifa…</p>
                  )}
                  {!previsualizando && previsualizacion?.disponible && (
                    <>
                      <p className="mt-1 font-display text-4xl font-bold leading-tight text-ink">
                        ${Number(previsualizacion.tarifa ?? 0).toLocaleString("es-MX")}
                      </p>
                      <p className="mt-2 max-w-sm font-body text-sm leading-6 text-ink/65">
                        Este es el monto final calculado para tu traslado, no una estimación.
                      </p>
                    </>
                  )}
                  {!previsualizando && previsualizacion && !previsualizacion.disponible && (
                    <p className="mt-1 max-w-sm font-body text-sm leading-6 text-ink/65">
                      {previsualizacion.motivo ?? "Torre de Control te enviará la cotización manualmente."}
                    </p>
                  )}
                  {!previsualizando && !previsualizacion && (
                    <p className="mt-1 max-w-sm font-body text-sm leading-6 text-ink/65">
                      Completa el origen, el destino y la fecha/hora para calcular tu tarifa.
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-ink/10 bg-mist/80 px-4 py-3">
                  <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Momento de pago</p>
                  <p className="mt-2 flex items-center gap-2 font-body text-sm font-bold capitalize text-ink">
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-signal text-ink" aria-hidden="true">
                      $
                    </span>
                    {momentoPago.momento === "anticipado" ? "Pago anticipado" : "Pago a la entrega"}
                  </p>
                </div>
              </div>
            </section>

            <PassportCard>
              <dl className="grid grid-cols-2 gap-3 font-body text-sm">
                <dt className="text-ink/45">Vehículo</dt>
                <dd>
                  {datos.marca} {datos.modelo} {datos.anio}
                </dd>
                <dt className="text-ink/45">Clasificación</dt>
                <dd>
                  {categoriaCatalogo} · {gamaCatalogo} · {datos.condicion ? CONDICIONES_VEHICULO.find((c) => c.valor === datos.condicion)?.etiqueta : "Sin condición"}
                </dd>
                <dt className="text-ink/45">Ruta</dt>
                <dd>
                  {datos.origenCiudad} → {datos.destinoCiudad}
                </dd>
                <dt className="text-ink/45">Estimación</dt>
                <dd>
                  {rutaEstimacion?.distanciaKm !== undefined && rutaEstimacion.tiempoEstimadoHoras !== undefined
                    ? `${formatearDistancia(rutaEstimacion.distanciaKm)} · ${formatearTiempo(rutaEstimacion.tiempoEstimadoHoras)}`
                    : "Pendiente"}
                </dd>
                <dt className="text-ink/45">Agenda</dt>
                <dd>{datos.modalidadProgramacion === "programado" ? datos.fechaHoraProgramada : "Lo antes posible"}</dd>
                <dt className="text-ink/45">Servicio</dt>
                <dd>{datos.tipoServicio.replaceAll("_", " ")}</dd>
              </dl>
            </PassportCard>

            <Aviso tono="info">
              {MENSAJES_CLAVE_UX.pago} {momentoPago.razon}
            </Aviso>
            <Aviso tono="atencion">
              {MENSAJES_CLAVE_UX.cancelacion} {politicaCancelacion.mensaje}
            </Aviso>
            <label className="flex items-start gap-2.5 rounded-lg border border-ink/10 bg-mist px-4 py-3 font-body text-sm">
              <input
                type="checkbox"
                checked={aceptaPoliticasPagoCancelacion}
                onChange={(e) => setAceptaPoliticasPagoCancelacion(e.target.checked)}
                className="mt-0.5 size-5 rounded border-ink/50 text-signal focus-visible:outline-route-dark"
              />
              <span>Acepto la política de cancelación y que el pago es solo por medios electrónicos.</span>
            </label>

            <section
              className="sticky bottom-4 z-20 rounded-[var(--ruum-radius-modal)] border border-ink/15 bg-mist px-5 py-5 shadow-3"
              aria-labelledby="titulo-tarifa-flotante"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p id="titulo-tarifa-flotante" className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">
                    Tarifa estimada
                  </p>
                  {previsualizando ? (
                    <p className="mt-2 font-body text-sm text-ink/55">Calculando tarifa…</p>
                  ) : previsualizacion?.disponible ? (
                    <p className="mt-1 font-display text-[32px] font-extrabold leading-none text-ink">
                      ${Number(previsualizacion.tarifa ?? 0).toLocaleString("es-MX")}
                      <span className="ml-1 font-body text-sm font-medium text-ink/55">MXN</span>
                    </p>
                  ) : (
                    <p className="mt-2 max-w-sm font-body text-sm leading-6 text-ink/65">
                      {previsualizacion?.motivo ?? "Completa la agenda para calcular la tarifa."}
                    </p>
                  )}
                  <p className="mt-2 max-w-xs font-body text-xs leading-5 text-ink/60">{momentoPago.razon}</p>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:w-48">
                  <Button
                    onClick={enviarSolicitud}
                    disabled={enviando || cargandoSesion || !aceptaPoliticasPagoCancelacion}
                    aria-disabled={enviando || cargandoSesion || !aceptaPoliticasPagoCancelacion}
                    aria-describedby={!aceptaPoliticasPagoCancelacion ? "confirmar-solicitud-ayuda" : undefined}
                  >
                    {enviando
                      ? TEXTOS_CARGANDO.enviando
                      : cargandoSesion
                        ? "Validando sesión…"
                        : previsualizacion?.disponible && momentoPago.momento === "anticipado"
                          ? "Confirmar y pagar"
                          : "Confirmar solicitud"}
                  </Button>
                  {!aceptaPoliticasPagoCancelacion && (
                    <p id="confirmar-solicitud-ayuda" className="font-body text-xs leading-5 text-ink/65">
                      Acepta la política arriba para continuar.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {paso === 3 && trasladoCreado && (
          <div className="space-y-4">
            <PassportCard>
              <div className="grid gap-2">
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Solicitud creada</p>
                {trasladoCreado.precioCotizado != null ? (
                  <p className="font-display text-4xl font-bold leading-tight text-ink">
                    ${Number(trasladoCreado.precioCotizado).toLocaleString("es-MX")}
                    <span className="ml-1 font-body text-sm font-normal text-ink/55">MXN</span>
                  </p>
                ) : (
                  <p className="font-body text-sm leading-6 text-ink/65">
                    Torre de Control te enviará la cotización manualmente. Podrás verla y aceptarla desde tu Pasaporte Digital.
                  </p>
                )}
              </div>
            </PassportCard>

            {pagoConfirmado ? (
              <Aviso tono="info">
                Pago confirmado. Puede tardar unos segundos en reflejarse mientras Stripe termina de procesarlo. Da seguimiento a tu traslado desde “Mis traslados”.
              </Aviso>
            ) : trasladoCreado.precioCotizado == null ? (
              <Aviso tono="info">
                No se requiere pago en este momento. Te avisaremos en cuanto exista una cotización autorizada.
              </Aviso>
            ) : trasladoCreado.tipoPago === "al_cierre" ? (
              <Aviso tono="info">
                Tu traslado quedó confirmado con pago al cierre. El cobro se activará más adelante, cuando el servicio esté por concluir.
              </Aviso>
            ) : errorAceptacion ? (
              <div className="space-y-3">
                <Aviso tono="danger">{errorAceptacion}</Aviso>
                <Button variant="secondary" onClick={() => setReintentoAceptacion((n) => n + 1)}>
                  Reintentar
                </Button>
              </div>
            ) : aceptandoCotizacion || !cotizacionAceptada ? (
              <p className="font-body text-sm text-ink/55">Confirmando tarifa para iniciar el pago…</p>
            ) : !tieneSupabaseConfigurado() ? (
              <Aviso tono="danger">Supabase no está configurado. No se puede capturar el pago.</Aviso>
            ) : !tieneStripePublicoConfigurado() ? (
              <Aviso tono="info">Stripe no está configurado — el cobro real no está disponible en este entorno.</Aviso>
            ) : (
              <PagoStripe trasladoId={trasladoCreado.id} onPagado={() => setPagoConfirmado(true)} />
            )}

            <div className="pt-2">
              <a
                href="/mis-viajes"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/20 bg-mist px-4 py-2 font-body text-sm font-medium text-ink"
              >
                Ver mis traslados
              </a>
            </div>
          </div>
        )}
      </div>

      {errorPaso && (
        <div className="mt-6">
          <Aviso tono="danger">{errorPaso}</Aviso>
        </div>
      )}

      {paso !== 3 && (
        <div className="mt-8 flex justify-between">
          <Button variant="secondary" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>
            ← Atrás
          </Button>
          {paso < 2 ? (
            <Button
              onClick={() => {
                if (!validarPasoActual()) return;
                setPaso((p) => p + 1);
              }}
            >
              Continuar
            </Button>
          ) : null}
        </div>
      )}
      </div>
    </main>
  );
}
