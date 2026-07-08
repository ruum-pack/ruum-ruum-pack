"use client";

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Aviso, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO, MENSAJES_CLAVE_UX, TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { determinarMomentoPago, calcularCargoCancelacion } from "@ruum/shared/rules";
import type { Database, TipoVehiculo } from "@ruum/shared/types";
import type { TipoCuenta, Usuario } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { crearVehiculo, crearTraslado, listarVehiculosDeUsuario, obtenerUsuarioActual } from "@ruum/api/services";
import { esNativo } from "../../../lib/capacitor";
import { obtenerUbicacionActual } from "../../../lib/ubicacion";
import { consultarCodigoPostalMx, type DatosCodigoPostal } from "../../../lib/codigos-postales";
import { PagoStripe, tieneStripePublicoConfigurado } from "../../PagoStripe";
import { NavegacionUsuario } from "../../NavegacionUsuario";

const PASOS = ["Datos básicos", "Agenda + Servicio"] as const;
type TransmisionVehiculo = "manual" | "automatica" | "electrica";
type ModalidadProgramacion = "lo_antes_posible" | "programado";
type TipoRutaTraslado = "local" | "foraneo";
type TipoServicioTraslado = "personal" | "empresarial" | "agencia" | "lote" | "flotilla";
type MotivoServicioTraslado = "entrega_cliente" | "recuperacion" | "traslado_especial";
type ErroresFormulario = Partial<Record<keyof DatosFormulario, string>>;
type VehiculoGuardado = Database["public"]["Tables"]["vehiculos"]["Row"];

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          AutocompleteService: new () => {
            getPlacePredictions: (
              request: {
                input: string;
                types?: string[];
                componentRestrictions?: { country: string };
              },
              callback: (predictions: Array<{ description: string }> | null) => void
            ) => void;
          };
        };
      };
    };
  }
}

const MARCAS_AUTOS_MEXICO = [
  "Acura",
  "Audi",
  "BMW",
  "BYD",
  "Cadillac",
  "Changan",
  "Chevrolet",
  "Chirey",
  "Chrysler",
  "Cupra",
  "Dodge",
  "Fiat",
  "Ford",
  "GAC",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "JAC",
  "Jaecoo",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Mazda",
  "Mercedes-Benz",
  "MG",
  "MINI",
  "Mitsubishi",
  "Nissan",
  "Omoda",
  "Peugeot",
  "Porsche",
  "RAM",
  "Renault",
  "SEAT",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo"
] as const;

const ESTADOS_GENERALES_VEHICULO = [
  "Excelente, sin daños visibles",
  "Buen estado, desgaste normal",
  "Detalles estéticos menores",
  "Rayones o golpes visibles",
  "Requiere revisión mecánica",
  "No enciende",
  "No puede circular rodando"
] as const;

interface DatosFormulario {
  // Vehículo — PRD §4.2
  tipo: TipoVehiculo;
  transmision: TransmisionVehiculo;
  marca: string;
  modelo: string;
  anio: string;
  color: string;
  placas: string;
  vin: string;
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
  // Cotización — motor automático es fase posterior; por ahora es una
  // estimación manual que el equipo de operaciones ajusta.
  precioEstimado: string;
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
  motivoServicio: "entrega_cliente",
  precioEstimado: ""
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

export default function PaginaNuevoTraslado() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  /* Ítem 11 — gestión de foco al cambiar paso: el foco va al título del paso
     nuevo para que usuarios de teclado/SR no pierdan la referencia. */
  const encabezadoPasoRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    encabezadoPasoRef.current?.focus();
  }, [paso]);
  const [datos, setDatos] = useState<DatosFormulario>(VALORES_INICIALES);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [trasladoCreadoId, setTrasladoCreadoId] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario>(USUARIO_PENDIENTE);
  const [sesionReal, setSesionReal] = useState(false);
  const [cargandoSesion, setCargandoSesion] = useState(tieneSupabaseConfigurado());
  const [aceptaPoliticasPagoCancelacion, setAceptaPoliticasPagoCancelacion] = useState(false);
  const [cpConsultando, setCpConsultando] = useState<PrefijoDomicilio | null>(null);
  const [cpAviso, setCpAviso] = useState<Record<PrefijoDomicilio, string | null>>({ origen: null, destino: null });
  const [cpOpciones, setCpOpciones] = useState<Record<PrefijoDomicilio, DatosCodigoPostal | null>>({ origen: null, destino: null });
  const [placesOpciones, setPlacesOpciones] = useState<Record<PrefijoDomicilio, string[]>>({ origen: [], destino: [] });
  const [vehiculosGuardados, setVehiculosGuardados] = useState<VehiculoGuardado[]>([]);
  const [vehiculoSeleccionadoId, setVehiculoSeleccionadoId] = useState<string>("");
  const [errorPaso, setErrorPaso] = useState<string | null>(null);
  const [errores, setErrores] = useState<ErroresFormulario>({});

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
          router.replace("/login?next=/traslados/nuevo");
          return;
        }
        if (real) {
          if (real.estado_verificacion !== "verificado") {
            router.replace("/verificacion?next=/traslados/nuevo");
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
  const politicaCancelacion = useMemo(() => calcularCargoCancelacion(Number(datos.precioEstimado) || 0, 0, false, false), [
    datos.precioEstimado
  ]);

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
      const sugerenciasGoogle = await consultarGooglePlacesCp(cp);
      setPlacesOpciones((prev) => ({ ...prev, [prefijo]: sugerenciasGoogle }));
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

  async function consultarGooglePlacesCp(cp: string): Promise<string[]> {
    if (typeof window === "undefined") return [];
    const Servicio = window.google?.maps?.places?.AutocompleteService;
    if (!Servicio) return [];

    return new Promise((resolve) => {
      const servicio = new Servicio();
      servicio.getPlacePredictions(
        {
          input: cp,
          types: ["postal_code"],
          componentRestrictions: { country: "mx" }
        },
        (predicciones) => resolve((predicciones ?? []).map((p) => p.description).slice(0, 3))
      );
    });
  }

  function aplicarSugerenciaCp(prefijo: PrefijoDomicilio, ciudad: string, colonia: string) {
    setDatos((prev) => ({
      ...prev,
      [`${prefijo}Ciudad`]: ciudad,
      [`${prefijo}Colonia`]: colonia
    }));
  }

  function aplicarVehiculoGuardado(vehiculo: VehiculoGuardado) {
    setVehiculoSeleccionadoId(vehiculo.id);
    setDatos((prev) => ({
      ...prev,
      tipo: vehiculo.tipo,
      transmision: vehiculo.transmision ?? prev.transmision,
      marca: vehiculo.marca ?? "",
      modelo: vehiculo.modelo ?? "",
      anio: vehiculo.anio ? String(vehiculo.anio) : "",
      color: vehiculo.color ?? "",
      placas: vehiculo.placas ?? "",
      vin: vehiculo.vin ?? "",
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

  function CampoCodigoPostal({ prefijo }: { prefijo: PrefijoDomicilio }) {
    const valor = datos[`${prefijo}CodigoPostal` as keyof DatosFormulario] as string;
    const opciones = cpOpciones[prefijo];
    const ciudadBase =
      (datos[`${prefijo}Ciudad` as keyof DatosFormulario] as string) ||
      opciones?.ciudades[0] ||
      "";
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
          onChange={(e) => actualizarCodigoPostal(prefijo, e.target.value)}
          onBlur={(e) => consultarCodigoPostal(prefijo, e.target.value)}
          inputMode="numeric"
          maxLength={5}
          ayuda={cpConsultando === prefijo ? "Consultando CP..." : cpAviso[prefijo]}
          error={errores[`${prefijo}CodigoPostal` as keyof DatosFormulario]}
        />
        {(placesOpciones[prefijo].length > 0 || sugerencias.length > 0) && (
          <div className="rounded-lg border border-ink/10 bg-mist px-3 py-2">
            {placesOpciones[prefijo].length > 0 && (
              <div>
                <p className="font-body text-[11px] font-semibold uppercase tracking-wide text-ink/45">Google Places</p>
                <div className="mt-1 grid gap-1">
                  {placesOpciones[prefijo].map((opcion) => (
                    <button
                      key={opcion}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void consultarCodigoPostal(prefijo, valor)}
                      className="rounded-md px-2 py-1 text-left font-body text-xs text-ink/70 hover:bg-ink/[0.04]"
                    >
                      {opcion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {sugerencias.length > 0 && (
              <div className={placesOpciones[prefijo].length ? "mt-2 border-t border-ink/10 pt-2" : ""}>
                <p className="font-body text-[11px] font-semibold uppercase tracking-wide text-ink/45">Colonias sugeridas</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {sugerencias.map((opcion) => (
                    <button
                      key={`${opcion.ciudad}-${opcion.colonia}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => aplicarSugerenciaCp(prefijo, opcion.ciudad, opcion.colonia)}
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

  function BloqueRuta() {
    return (
      <div className="grid gap-4">
        <p className="font-body text-sm font-semibold">¿De dónde sale y a dónde llega?</p>
        <div className="grid gap-4 rounded-lg border border-ink/10 p-4">
          <p className="font-body text-sm font-semibold">Domicilio de origen</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoCodigoPostal prefijo="origen" />
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
              variant="secundario"
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
        <div className="grid gap-4 rounded-lg border border-ink/10 p-4">
          <p className="font-body text-sm font-semibold">Domicilio de destino</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoCodigoPostal prefijo="destino" />
            <Field etiqueta="Estado" value={datos.destinoEstado} onChange={(e) => actualizar("destinoEstado", e.target.value)} error={errores.destinoEstado} />
            <Field etiqueta="Ciudad" value={datos.destinoCiudad} onChange={(e) => actualizar("destinoCiudad", e.target.value)} error={errores.destinoCiudad} />
            <Field etiqueta="Colonia" value={datos.destinoColonia} onChange={(e) => actualizar("destinoColonia", e.target.value)} error={errores.destinoColonia} />
            <Field etiqueta="Calle" value={datos.destinoCalle} onChange={(e) => actualizar("destinoCalle", e.target.value)} error={errores.destinoCalle} />
            <Field etiqueta="Número" value={datos.destinoNumero} onChange={(e) => actualizar("destinoNumero", e.target.value)} error={errores.destinoNumero} />
          </div>
          <Field etiqueta="Referencias" value={datos.destinoReferencias} onChange={(e) => actualizar("destinoReferencias", e.target.value)} placeholder="Entre calles, color de fachada, acceso, piso, etc." />
        </div>
        <p className="font-body text-sm font-semibold">Quien entrega el vehículo</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field etiqueta="Nombre" value={datos.entregaNombre} onChange={(e) => actualizar("entregaNombre", e.target.value)} error={errores.entregaNombre} />
          <Field etiqueta="Apellido" value={datos.entregaApellido} onChange={(e) => actualizar("entregaApellido", e.target.value)} error={errores.entregaApellido} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="telefono-entrega" className="font-body text-sm font-medium">Teléfono</label>
          <div className={`flex overflow-hidden rounded-lg border bg-mist ${claseControl("entregaTelefono")}`}>
            <span className="flex items-center border-r border-ink/10 px-3.5 font-body text-sm font-semibold text-ink/70">+52</span>
            <input id="telefono-entrega" value={datos.entregaTelefono} onChange={(e) => actualizarTelefono("entregaTelefono", e.target.value)} inputMode="numeric" maxLength={10} className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark" placeholder="10 dígitos" aria-label="Teléfono de entrega (10 dígitos)" aria-invalid={Boolean(errores.entregaTelefono)} />
          </div>
          {errores.entregaTelefono && <p className="font-body text-xs text-danger">{errores.entregaTelefono}</p>}
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
            <input id="telefono-recepcion" value={datos.recepcionTelefono} onChange={(e) => actualizarTelefono("recepcionTelefono", e.target.value)} inputMode="numeric" maxLength={10} className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark" placeholder="10 dígitos" aria-label="Teléfono de recepción (10 dígitos)" aria-invalid={Boolean(errores.recepcionTelefono)} />
          </div>
          {errores.recepcionTelefono && <p className="font-body text-xs text-danger">{errores.recepcionTelefono}</p>}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="font-body text-sm font-medium">Instrucciones especiales</span>
          <textarea value={datos.instruccionesEspeciales} onChange={(e) => actualizar("instruccionesEspeciales", e.target.value)} maxLength={1000} aria-label="Instrucciones especiales para el traslado" className="min-h-24 rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark" />
        </label>
      </div>
    );
  }

  function claseControl(campo: keyof DatosFormulario) {
    return errores[campo] ? "border-danger" : "border-ink/50";
  }

  function validarPasoActual() {
    const siguientesErrores: ErroresFormulario = {};
    const agregarRequerido = (campo: keyof DatosFormulario, mensaje = "Completa este campo.") => {
      const valor = datos[campo];
      if (typeof valor === "string" && !valor.trim()) siguientesErrores[campo] = mensaje;
    };

    if (paso === 0) {
      agregarRequerido("marca");
      agregarRequerido("modelo");
      agregarRequerido("color");
      agregarRequerido("placas");
      agregarRequerido("vin");
      agregarRequerido("estadoGeneral", "Describe el estado general del vehículo.");

      const anioNumerico = Number(datos.anio);
      const anioMaximo = new Date().getFullYear() + 1;
      if (!datos.anio.trim()) {
        siguientesErrores.anio = "Completa este campo.";
      } else if (!Number.isInteger(anioNumerico) || anioNumerico < 1980 || anioNumerico > anioMaximo) {
        siguientesErrores.anio = `Usa un año entre 1980 y ${anioMaximo}.`;
      }

      if (!datos.tieneTarjeta) siguientesErrores.tieneTarjeta = "Confirma que cuenta con tarjeta de circulación vigente.";
      if (!datos.tieneVerificacion) siguientesErrores.tieneVerificacion = "Confirma que cuenta con verificación vigente.";
      if (!datos.tienePlacas) siguientesErrores.tienePlacas = "Confirma que ambas placas están instaladas.";
      if (!datos.puedeCircular) siguientesErrores.puedeCircular = "Confirma que el vehículo puede circular rodando.";
      ([
        "origenCodigoPostal",
        "origenEstado",
        "origenCiudad",
        "origenColonia",
        "origenCalle",
        "origenNumero",
        "destinoCodigoPostal",
        "destinoEstado",
        "destinoCiudad",
        "destinoColonia",
        "destinoCalle",
        "destinoNumero",
        "entregaNombre",
        "entregaApellido",
        "recepcionNombre",
        "recepcionApellido"
      ] as const).forEach((campo) => agregarRequerido(campo));

      if (datos.origenCodigoPostal && datos.origenCodigoPostal.length !== 5) {
        siguientesErrores.origenCodigoPostal = "El Código Postal debe tener 5 dígitos.";
      }
      if (datos.destinoCodigoPostal && datos.destinoCodigoPostal.length !== 5) {
        siguientesErrores.destinoCodigoPostal = "El Código Postal debe tener 5 dígitos.";
      }
      if (datos.entregaTelefono.length !== 10) {
        siguientesErrores.entregaTelefono = "Captura 10 dígitos; el prefijo +52 ya está aplicado.";
      }
      if (datos.recepcionTelefono.length !== 10) {
        siguientesErrores.recepcionTelefono = "Captura 10 dígitos; el prefijo +52 ya está aplicado.";
      }
    }

    if (paso === 1) {
      const precioNum = Number(datos.precioEstimado);
      if (!datos.precioEstimado || !Number.isFinite(precioNum) || precioNum <= 0) {
        siguientesErrores.precioEstimado = "Captura el monto estimado del traslado antes de continuar.";
      }
    }

    const totalErrores = Object.keys(siguientesErrores).length;
    setErrores(siguientesErrores);
    setErrorPaso(totalErrores ? `${totalErrores} ${totalErrores === 1 ? "campo requiere" : "campos requieren"} atención.` : null);
    return totalErrores === 0;
  }

  async function enviarSolicitud() {
    if (!aceptaPoliticasPagoCancelacion) {
      setResultado({
        ok: false,
        mensaje: "Debes aceptar la política de cancelación y que el pago es solo por medios electrónicos."
      });
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
      router.push("/login?next=/traslados/nuevo");
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

    // FIX: precio_cotizado=0 hace que la Edge Function de Stripe rechace con 422.
    // El campo es estimación manual — si está vacío o en cero, bloqueamos antes
    // de crear el vehículo y el traslado en DB (ya que no pueden borrarse fácilmente).
    const precioNumerico = Number(datos.precioEstimado);
    if (!datos.precioEstimado || !Number.isFinite(precioNumerico) || precioNumerico <= 0) {
      setEnviando(false);
      setResultado({
        ok: false,
        mensaje: "Captura el monto estimado del traslado antes de continuar. Es necesario para procesar el pago."
      });
      return;
    }

    try {
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

      const vehiculo = vehiculoSeleccionadoId
        ? { id: vehiculoSeleccionadoId }
        : await crearVehiculo(cliente, {
            usuario_id: usuario.id,
            tipo: datos.tipo,
            transmision: datos.transmision,
            marca: datos.marca,
            modelo: datos.modelo,
            anio: Number(datos.anio),
            color: datos.color,
            placas: datos.placas,
            vin: datos.vin,
            estado_general_declarado: datos.estadoGeneral,
            tiene_tarjeta_circulacion: datos.tieneTarjeta,
            tiene_verificacion: datos.tieneVerificacion,
            tiene_placas: datos.tienePlacas,
            puede_circular_rodando: datos.puedeCircular
          });

      const nuevoTraslado = await crearTraslado(cliente, {
        usuario_id: usuario.id,
        vehiculo_id: vehiculo.id,
        contacto_entrega_nombre: nombreCompleto(datos.entregaNombre, datos.entregaApellido),
        contacto_entrega_telefono: telefonoMx(datos.entregaTelefono),
        contacto_recepcion_nombre: nombreCompleto(datos.recepcionNombre, datos.recepcionApellido),
        contacto_recepcion_telefono: telefonoMx(datos.recepcionTelefono),
        origen_lat: datos.origenLat ?? 0,
        origen_lng: datos.origenLng ?? 0,
        origen_direccion: origenDireccion,
        origen_ciudad: datos.origenCiudad,
        origen_referencias: referenciasDomicilio(datos.origenReferencias, datos.origenEstado, datos.origenCodigoPostal),
        destino_lat: 0,
        destino_lng: 0,
        destino_direccion: destinoDireccion,
        destino_ciudad: datos.destinoCiudad,
        destino_referencias: referenciasDomicilio(datos.destinoReferencias, datos.destinoEstado, datos.destinoCodigoPostal),
        instrucciones_especiales: datos.instruccionesEspeciales,
        modalidad_programacion: datos.modalidadProgramacion,
        fecha_hora_programada: datos.fechaHoraProgramada ? new Date(datos.fechaHoraProgramada).toISOString() : null,
        tipo_ruta: datos.tipoRuta,
        ventana_recoleccion: datos.ventanaRecoleccion,
        ventana_entrega: datos.ventanaEntrega,
        tipo_servicio: datos.tipoServicio,
        motivo_servicio: datos.motivoServicio,
        precio_cotizado: Number(datos.precioEstimado) || 0,
        tipo_pago: momentoPago.momento
      });

      // PRD §4.6 — el pago anticipado es obligatorio para usuarios sin
      // historial suficiente; no debe continuar como éxito si Stripe no está
      // disponible, porque entonces la solicitud queda creada sin cobro.
      if (momentoPago.momento === "anticipado") {
        if (!tieneStripePublicoConfigurado()) {
          setResultado({
            ok: false,
            mensaje:
              "Stripe no está configurado. Define NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY y vuelve a compilar la app para capturar el pago anticipado."
          });
          return;
        }
        setTrasladoCreadoId(nuevoTraslado.id);
        setEnviando(false);
        return;
      }

      setResultado({ ok: true, mensaje: "Solicitud creada. Te avisaremos cuando se confirme la cotización." });
    } catch (err) {
      setResultado({
        ok: false,
        mensaje: err instanceof Error ? err.message : "No pudimos crear la solicitud. Intenta de nuevo."
      });
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <main className="app-page">
        <NavegacionUsuario />
        <div className="mx-auto max-w-xl px-6 py-20">
          <Aviso tono={resultado.ok ? "info" : "peligro"}>{resultado.mensaje}</Aviso>
          {/* FIX: pantalla de error dejaba al usuario bloqueado sin salida */}
          {!resultado.ok && (
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setResultado(null)}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/20 bg-mist px-4 py-2 font-body text-sm font-medium text-ink transition hover:border-ink/40"
              >
                ← Volver al formulario
              </button>
            </div>
          )}
          {resultado.ok && (
            <div className="mt-6">
              <a
                href="/mis-viajes"
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-signal px-4 py-2 font-display text-sm font-bold text-ink transition hover:bg-signal/90"
              >
                Ver mis traslados
              </a>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (trasladoCreadoId) {
    return (
      <main className="app-page">
        <NavegacionUsuario />
        <div className="mx-auto max-w-xl px-6 py-12">
          <h1 className="font-display text-2xl font-semibold">Pago anticipado</h1>
        <p className="mt-2 font-body text-sm text-ink/60">
          Tu solicitud ya quedó creada — confirma el pago para enviarla a cotización.
        </p>
        <div className="mt-6">
          <PagoStripe
            trasladoId={trasladoCreadoId}
            onPagado={() =>
              setResultado({ ok: true, mensaje: "Pago confirmado. Te avisaremos cuando se confirme la cotización." })
            }
          />
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
            <section className="app-status-strip px-4 py-4" aria-labelledby="titulo-politica-cancelacion">
              <p id="titulo-politica-cancelacion" className="font-body text-sm font-semibold">
                Política de cancelación
              </p>
              <ul className="mt-2 grid gap-1.5 font-body text-sm leading-6 text-ink/65">
                <li>Sin costo antes de que operaciones confirme el servicio o asigne conductor.</li>
                <li>Con conductor asignado puede aplicar cargo por cancelación según avance y ventana del traslado.</li>
                <li>La aceptación formal se confirma al final del formulario.</li>
              </ul>
            </section>

          <div className="grid gap-4 lg:grid-cols-2">
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
                <label className="flex flex-col gap-1.5">
                  <span className="font-body text-sm font-medium">Tipo de vehículo</span>
                  <select
                    value={datos.tipo}
                    onChange={(e) => actualizar("tipo", e.target.value as TipoVehiculo)}
                    className="rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm"
                  >
                    {Object.entries(ETIQUETA_TIPO_VEHICULO).map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>
                        {etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
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
                <label className="flex flex-col gap-1.5">
                  <span className="font-body text-sm font-medium">Marca</span>
                  <select
                    value={datos.marca}
                    onChange={(e) => actualizar("marca", e.target.value)}
                    className={`rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm ${claseControl("marca")}`}
                    aria-invalid={Boolean(errores.marca)}
                  >
                    <option value="">Selecciona marca</option>
                    {MARCAS_AUTOS_MEXICO.map((marca) => (
                      <option key={marca} value={marca}>
                        {marca}
                      </option>
                    ))}
                  </select>
                  {errores.marca && <p className="font-body text-xs text-danger">{errores.marca}</p>}
                </label>
                <Field etiqueta="Modelo" value={datos.modelo} onChange={(e) => actualizar("modelo", e.target.value)} error={errores.modelo} />
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
                    className={`rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark ${claseControl("estadoGeneral")}`}
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
                  <p className="mt-1 font-body text-xs text-ink/65">Confirma los requisitos para que el conductor pueda recibir el vehículo.</p>
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
                {!datos.puedeCircular && (
                  <Aviso tono="atencion">
                    {MENSAJES_CLAVE_UX.antes_de_confirmar_traslado}
                  </Aviso>
                )}
              </div>
            </div>
          </PassportCard>
          <PassportCard>
            {BloqueRuta()}
          </PassportCard>
          </div>
          </div>
        )}

        {false && (
          <PassportCard>
            <div className="grid gap-4">
              <p className="font-body text-sm font-semibold">¿De dónde sale y a dónde llega?</p>
              <div className="grid gap-4 rounded-lg border border-ink/10 p-4">
                <p className="font-body text-sm font-semibold">Domicilio de origen</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    etiqueta="Código Postal"
                    value={datos.origenCodigoPostal}
                    onChange={(e) => actualizarCodigoPostal("origen", e.target.value)}
                    onBlur={(e) => consultarCodigoPostal("origen", e.target.value)}
                    inputMode="numeric"
                    maxLength={5}
                    ayuda={cpConsultando === "origen" ? "Consultando CP..." : cpAviso.origen}
                    error={errores.origenCodigoPostal}
                  />
                  <Field
                    etiqueta="Estado"
                    value={datos.origenEstado}
                    onChange={(e) => actualizar("origenEstado", e.target.value)}
                    error={errores.origenEstado}
                  />
                  <Field
                    etiqueta="Ciudad"
                    value={datos.origenCiudad}
                    onChange={(e) => actualizar("origenCiudad", e.target.value)}
                    error={errores.origenCiudad}
                  />
                  <Field
                    etiqueta="Colonia"
                    value={datos.origenColonia}
                    onChange={(e) => actualizar("origenColonia", e.target.value)}
                    error={errores.origenColonia}
                  />
                  <Field
                    etiqueta="Calle"
                    value={datos.origenCalle}
                    onChange={(e) => actualizar("origenCalle", e.target.value)}
                    error={errores.origenCalle}
                  />
                  <Field
                    etiqueta="Número"
                    value={datos.origenNumero}
                    onChange={(e) => actualizar("origenNumero", e.target.value)}
                    error={errores.origenNumero}
                  />
                </div>
                <Field
                  etiqueta="Referencias"
                  value={datos.origenReferencias}
                  onChange={(e) => actualizar("origenReferencias", e.target.value)}
                  placeholder="Entre calles, color de fachada, acceso, piso, etc."
                />
              </div>
              {esNativo() && (
                <div>
                  <Button
                    type="button"
                    variant="secundario"
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
                  {datos.origenLat !== undefined && (
                    <p className="mt-1 font-body text-xs text-ink/45">Ubicación capturada ✓</p>
                  )}
                </div>
              )}
              <div className="grid gap-4 rounded-lg border border-ink/10 p-4">
                <p className="font-body text-sm font-semibold">Domicilio de destino</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    etiqueta="Código Postal"
                    value={datos.destinoCodigoPostal}
                    onChange={(e) => actualizarCodigoPostal("destino", e.target.value)}
                    onBlur={(e) => consultarCodigoPostal("destino", e.target.value)}
                    inputMode="numeric"
                    maxLength={5}
                    ayuda={cpConsultando === "destino" ? "Consultando CP..." : cpAviso.destino}
                    error={errores.destinoCodigoPostal}
                  />
                  <Field
                    etiqueta="Estado"
                    value={datos.destinoEstado}
                    onChange={(e) => actualizar("destinoEstado", e.target.value)}
                    error={errores.destinoEstado}
                  />
                  <Field
                    etiqueta="Ciudad"
                    value={datos.destinoCiudad}
                    onChange={(e) => actualizar("destinoCiudad", e.target.value)}
                    error={errores.destinoCiudad}
                  />
                  <Field
                    etiqueta="Colonia"
                    value={datos.destinoColonia}
                    onChange={(e) => actualizar("destinoColonia", e.target.value)}
                    error={errores.destinoColonia}
                  />
                  <Field
                    etiqueta="Calle"
                    value={datos.destinoCalle}
                    onChange={(e) => actualizar("destinoCalle", e.target.value)}
                    error={errores.destinoCalle}
                  />
                  <Field
                    etiqueta="Número"
                    value={datos.destinoNumero}
                    onChange={(e) => actualizar("destinoNumero", e.target.value)}
                    error={errores.destinoNumero}
                  />
                </div>
                <Field
                  etiqueta="Referencias"
                  value={datos.destinoReferencias}
                  onChange={(e) => actualizar("destinoReferencias", e.target.value)}
                  placeholder="Entre calles, color de fachada, acceso, piso, etc."
                />
              </div>
              <p className="font-body text-sm font-semibold">Quien entrega el vehículo</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  etiqueta="Nombre"
                  value={datos.entregaNombre}
                  onChange={(e) => actualizar("entregaNombre", e.target.value)}
                  error={errores.entregaNombre}
                />
                <Field
                  etiqueta="Apellido"
                  value={datos.entregaApellido}
                  onChange={(e) => actualizar("entregaApellido", e.target.value)}
                  error={errores.entregaApellido}
                />
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium">Teléfono</span>
                <div className={`flex overflow-hidden rounded-lg border bg-mist ${claseControl("entregaTelefono")}`}>
                  <span className="flex items-center border-r border-ink/10 px-3.5 font-body text-sm font-semibold text-ink/70">
                    +52
                  </span>
                  <input
                    value={datos.entregaTelefono}
                    onChange={(e) => actualizarTelefono("entregaTelefono", e.target.value)}
                    inputMode="numeric"
                    maxLength={10}
                    className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
                    placeholder="10 dígitos"
                    aria-invalid={Boolean(errores.entregaTelefono)}
                  />
                </div>
                {errores.entregaTelefono && <p className="font-body text-xs text-danger">{errores.entregaTelefono}</p>}
              </label>
              <p className="mt-2 font-body text-sm font-semibold">Quien recibe el vehículo</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  etiqueta="Nombre"
                  value={datos.recepcionNombre}
                  onChange={(e) => actualizar("recepcionNombre", e.target.value)}
                  error={errores.recepcionNombre}
                />
                <Field
                  etiqueta="Apellido"
                  value={datos.recepcionApellido}
                  onChange={(e) => actualizar("recepcionApellido", e.target.value)}
                  error={errores.recepcionApellido}
                />
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium">Teléfono</span>
                <div className={`flex overflow-hidden rounded-lg border bg-mist ${claseControl("recepcionTelefono")}`}>
                  <span className="flex items-center border-r border-ink/10 px-3.5 font-body text-sm font-semibold text-ink/70">
                    +52
                  </span>
                  <input
                    value={datos.recepcionTelefono}
                    onChange={(e) => actualizarTelefono("recepcionTelefono", e.target.value)}
                    inputMode="numeric"
                    maxLength={10}
                    className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
                    placeholder="10 dígitos"
                    aria-invalid={Boolean(errores.recepcionTelefono)}
                  />
                </div>
                {errores.recepcionTelefono && <p className="font-body text-xs text-danger">{errores.recepcionTelefono}</p>}
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium">Instrucciones especiales</span>
                <textarea
                  value={datos.instruccionesEspeciales}
                  onChange={(e) => actualizar("instruccionesEspeciales", e.target.value)}
                  maxLength={1000}
                  aria-label="Instrucciones especiales para el traslado"
                  className="min-h-24 rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
                />
              </label>
            </div>
          </PassportCard>
        )}

        {paso === 1 && (
          <PassportCard>
            <div className="grid gap-4">
              <p className="font-body text-sm font-semibold">¿Cuándo lo necesitas?</p>
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium">Disponibilidad</span>
                <select
                  value={datos.modalidadProgramacion}
                  onChange={(e) => actualizar("modalidadProgramacion", e.target.value as ModalidadProgramacion)}
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
        )}

        {paso === 1 && (
          <div className="space-y-4">
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
                <Field
                  etiqueta="Monto estimado (MXN)"
                  type="number"
                  value={datos.precioEstimado}
                  onChange={(e) => actualizar("precioEstimado", e.target.value)}
                  ayuda="Estimación manual. El motor de cotización automática llega en una fase posterior."
                  className={errores.precioEstimado ? "border-danger" : ""}
                />
                {errores.precioEstimado && (
                  <p className="font-body text-xs text-danger mt-1">{errores.precioEstimado}</p>
                )}
              </div>
            </PassportCard>

            <section className="app-status-strip px-5 py-5" aria-labelledby="titulo-cotizacion-estimada">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p id="titulo-cotizacion-estimada" className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">
                    Cotización estimada
                  </p>
                  <p className="mt-1 font-display text-4xl font-bold leading-tight text-ink">
                    ${Number(datos.precioEstimado || 0).toLocaleString("es-MX")}
                  </p>
                  <p className="mt-2 max-w-sm font-body text-sm leading-6 text-ink/65">
                    Es una estimación sujeta a confirmación por operaciones antes de cerrar la cotización final.
                  </p>
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
                <dt className="text-ink/45">Ruta</dt>
                <dd>
                  {datos.origenCiudad} → {datos.destinoCiudad}
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
          </div>
        )}
      </div>

      {errorPaso && (
        <div className="mt-6">
          <Aviso tono="peligro">{errorPaso}</Aviso>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <Button variant="secundario" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>
          ← Atrás
        </Button>
        {paso < PASOS.length - 1 ? (
          <Button
            onClick={() => {
              if (!validarPasoActual()) return;
              setPaso((p) => p + 1);
            }}
          >
            Continuar
          </Button>
        ) : (
          <Button onClick={enviarSolicitud} disabled={enviando || cargandoSesion || !aceptaPoliticasPagoCancelacion}>
            {enviando ? TEXTOS_CARGANDO.enviando : cargandoSesion ? "Validando sesión…" : "Confirmar solicitud"}
          </Button>
        )}
      </div>
      </div>
    </main>
  );
}
