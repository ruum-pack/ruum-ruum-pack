"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Aviso, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO, MENSAJES_CLAVE_UX } from "@ruum/shared/constants";
import { determinarMomentoPago, calcularCargoCancelacion } from "@ruum/shared/rules";
import type { TipoVehiculo } from "@ruum/shared/types";
import type { TipoCuenta, Usuario } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { crearVehiculo, crearTraslado, obtenerUsuarioActual } from "@ruum/api/services";
import { esNativo } from "../../../lib/capacitor";
import { obtenerUbicacionActual } from "../../../lib/ubicacion";
import { PagoStripe, tieneStripePublicoConfigurado } from "../../PagoStripe";

const PASOS = ["Vehículo", "Ruta", "Agenda", "Servicio"] as const;
type TransmisionVehiculo = "manual" | "automatica";
type ModalidadProgramacion = "lo_antes_posible" | "programado";
type TipoRutaTraslado = "local" | "foraneo";
type TipoServicioTraslado = "personal" | "empresarial" | "agencia" | "lote" | "flotilla";
type MotivoServicioTraslado = "entrega_cliente" | "recuperacion" | "traslado_especial";

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
  origenDireccion: string;
  origenCiudad: string;
  origenReferencias: string;
  // Solo se llenan dentro del shell nativo, vía "Usar mi ubicación actual"
  // (lib/ubicacion.ts). Geocodificación real de la dirección sigue
  // pendiente — sin esto, origen_lat/lng se siguen enviando en 0.
  origenLat?: number;
  origenLng?: number;
  destinoDireccion: string;
  destinoCiudad: string;
  destinoReferencias: string;
  // Contactos — PRD §4.1
  entregaNombre: string;
  entregaTelefono: string;
  recepcionNombre: string;
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
  origenDireccion: "",
  origenCiudad: "",
  origenReferencias: "",
  destinoDireccion: "",
  destinoCiudad: "",
  destinoReferencias: "",
  entregaNombre: "",
  entregaTelefono: "",
  recepcionNombre: "",
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

// Usuario sin historial (PRD §4.6): valor de respaldo mientras se confirma
// si hay sesión real (ver useEffect en el componente). Si Supabase está
// configurado y hay sesión, se reemplaza por el usuario real de
// obtenerUsuarioActual(); si no hay sesión, enviarSolicitud() manda a
// /login en vez de usar este id vacío contra la base real.
const USUARIO_NUEVO_DEMO = {
  id: "",
  tipo_cuenta: "personal" as const,
  rol: "personal" as const,
  estado_verificacion: "pendiente" as const,
  traslados_completados_sin_incidencia: 0,
  metodo_pago_registrado: false,
  creado_en: new Date().toISOString()
};

export default function PaginaNuevoTraslado() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<DatosFormulario>(VALORES_INICIALES);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [trasladoCreadoId, setTrasladoCreadoId] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario>(USUARIO_NUEVO_DEMO);
  const [sesionReal, setSesionReal] = useState(false);
  const [cargandoSesion, setCargandoSesion] = useState(tieneSupabaseConfigurado());
  const [aceptaPoliticasPagoCancelacion, setAceptaPoliticasPagoCancelacion] = useState(false);

  // Si hay sesión real, usa el usuario real (PRD §4.6: su historial decide
  // pago anticipado vs. al cierre); si no, sigue en modo demo como antes.
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
        if (real) {
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
          if (real.estado_verificacion === "pendiente" && !real.doc_identidad_url) {
            router.push("/verificacion?next=/traslados/nuevo");
            return;
          }
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
    setDatos((prev) => ({ ...prev, [campo]: valor }));
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
      // Modo demo: no hay proyecto de Supabase conectado todavía.
      await new Promise((r) => setTimeout(r, 600));
      setEnviando(false);
      setResultado({
        ok: true,
        mensaje:
          "Solicitud capturada en modo demo (Supabase no está configurado). Conecta NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY para guardarla de verdad."
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

    try {
      const cliente = crearClienteNavegador();
      const vehiculo = await crearVehiculo(cliente, {
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
        contacto_entrega_nombre: datos.entregaNombre,
        contacto_entrega_telefono: datos.entregaTelefono,
        contacto_recepcion_nombre: datos.recepcionNombre,
        contacto_recepcion_telefono: datos.recepcionTelefono,
        origen_lat: datos.origenLat ?? 0,
        origen_lng: datos.origenLng ?? 0,
        origen_direccion: datos.origenDireccion,
        origen_ciudad: datos.origenCiudad,
        origen_referencias: datos.origenReferencias,
        destino_lat: 0,
        destino_lng: 0,
        destino_direccion: datos.destinoDireccion,
        destino_ciudad: datos.destinoCiudad,
        destino_referencias: datos.destinoReferencias,
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
      <main className="mx-auto max-w-xl px-6 py-20">
        <Aviso tono={resultado.ok ? "info" : "peligro"}>{resultado.mensaje}</Aviso>
      </main>
    );
  }

  if (trasladoCreadoId) {
    return (
      <main className="mx-auto max-w-xl px-6 py-12">
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
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="font-display text-2xl font-semibold">Nuevo traslado</h1>

      <ol className="mt-6 flex gap-2 font-mono-ruum text-[10px] uppercase tracking-wide text-ink/40">
        {PASOS.map((etiqueta, i) => (
          <li key={etiqueta} className={i === paso ? "font-semibold text-signal" : i < paso ? "text-ink" : ""}>
            {String(i + 1).padStart(2, "0")} {etiqueta}
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {paso === 0 && (
          <PassportCard>
            <div className="grid gap-4">
              <p className="font-body text-sm font-semibold">¿Qué vehículo vamos a mover?</p>
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium">Tipo de vehículo</span>
                <select
                  value={datos.tipo}
                  onChange={(e) => actualizar("tipo", e.target.value as TipoVehiculo)}
                  className="rounded-lg border border-ink/15 bg-mist px-3.5 py-2.5 font-body text-sm"
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
                  className="rounded-lg border border-ink/15 bg-mist px-3.5 py-2.5 font-body text-sm"
                >
                  <option value="automatica">Automática</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
              <Field etiqueta="Marca" value={datos.marca} onChange={(e) => actualizar("marca", e.target.value)} />
              <Field etiqueta="Modelo" value={datos.modelo} onChange={(e) => actualizar("modelo", e.target.value)} />
              <Field
                etiqueta="Año"
                type="number"
                min={1980}
                max={new Date().getFullYear() + 1}
                value={datos.anio}
                onChange={(e) => actualizar("anio", e.target.value)}
              />
              <Field etiqueta="Color" value={datos.color} onChange={(e) => actualizar("color", e.target.value)} />
              <Field etiqueta="Placas" value={datos.placas} onChange={(e) => actualizar("placas", e.target.value)} />
              <Field
                etiqueta="Número de serie / VIN"
                value={datos.vin}
                onChange={(e) => actualizar("vin", e.target.value)}
              />
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium">Estado general declarado</span>
                <textarea
                  value={datos.estadoGeneral}
                  onChange={(e) => actualizar("estadoGeneral", e.target.value)}
                  className="min-h-24 rounded-lg border border-ink/15 bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route"
                />
              </label>
              <div className="grid gap-3 border-t border-ink/10 pt-4">
                <p className="font-body text-sm font-semibold">Documentación y condición mínima</p>
                {(
                  [
                    ["tieneTarjeta", "Tarjeta de circulación vigente"],
                    ["tieneVerificacion", "Verificación vehicular vigente"],
                    ["tienePlacas", "Ambas placas instaladas"],
                    ["puedeCircular", "El vehículo enciende y puede circular rodando"]
                  ] as const
                ).map(([campo, etiqueta]) => (
                  <label key={campo} className="flex items-center gap-2.5 font-body text-sm">
                    <input
                      type="checkbox"
                      checked={datos[campo]}
                      onChange={(e) => actualizar(campo, e.target.checked)}
                      className="size-4 rounded border-ink/30 text-signal focus-visible:outline-route"
                    />
                    {etiqueta}
                  </label>
                ))}
                {!datos.puedeCircular && (
                  <Aviso tono="atencion">
                    {MENSAJES_CLAVE_UX.antes_de_confirmar_traslado}
                  </Aviso>
                )}
              </div>
            </div>
          </PassportCard>
        )}

        {paso === 1 && (
          <PassportCard>
            <div className="grid gap-4">
              <p className="font-body text-sm font-semibold">¿De dónde sale y a dónde llega?</p>
              <Field
                etiqueta="Dirección de origen"
                value={datos.origenDireccion}
                onChange={(e) => actualizar("origenDireccion", e.target.value)}
              />
              <Field
                etiqueta="Ciudad de origen"
                value={datos.origenCiudad}
                onChange={(e) => actualizar("origenCiudad", e.target.value)}
              />
              <Field
                etiqueta="Referencias de origen"
                value={datos.origenReferencias}
                onChange={(e) => actualizar("origenReferencias", e.target.value)}
              />
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
              <Field
                etiqueta="Dirección de destino"
                value={datos.destinoDireccion}
                onChange={(e) => actualizar("destinoDireccion", e.target.value)}
              />
              <Field
                etiqueta="Ciudad de destino"
                value={datos.destinoCiudad}
                onChange={(e) => actualizar("destinoCiudad", e.target.value)}
              />
              <Field
                etiqueta="Referencias de destino"
                value={datos.destinoReferencias}
                onChange={(e) => actualizar("destinoReferencias", e.target.value)}
              />
              <p className="font-body text-sm font-semibold">Quien entrega el vehículo</p>
              <Field
                etiqueta="Nombre"
                value={datos.entregaNombre}
                onChange={(e) => actualizar("entregaNombre", e.target.value)}
              />
              <Field
                etiqueta="Teléfono"
                value={datos.entregaTelefono}
                onChange={(e) => actualizar("entregaTelefono", e.target.value)}
              />
              <p className="mt-2 font-body text-sm font-semibold">Quien recibe el vehículo</p>
              <Field
                etiqueta="Nombre"
                value={datos.recepcionNombre}
                onChange={(e) => actualizar("recepcionNombre", e.target.value)}
              />
              <Field
                etiqueta="Teléfono"
                value={datos.recepcionTelefono}
                onChange={(e) => actualizar("recepcionTelefono", e.target.value)}
              />
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium">Instrucciones especiales</span>
                <textarea
                  value={datos.instruccionesEspeciales}
                  onChange={(e) => actualizar("instruccionesEspeciales", e.target.value)}
                  className="min-h-24 rounded-lg border border-ink/15 bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route"
                />
              </label>
            </div>
          </PassportCard>
        )}

        {paso === 2 && (
          <PassportCard>
            <div className="grid gap-4">
              <p className="font-body text-sm font-semibold">¿Cuándo lo necesitas?</p>
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium">Disponibilidad</span>
                <select
                  value={datos.modalidadProgramacion}
                  onChange={(e) => actualizar("modalidadProgramacion", e.target.value as ModalidadProgramacion)}
                  className="rounded-lg border border-ink/15 bg-mist px-3.5 py-2.5 font-body text-sm"
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
                  className="rounded-lg border border-ink/15 bg-mist px-3.5 py-2.5 font-body text-sm"
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

        {paso === 3 && (
          <div className="space-y-4">
            <PassportCard>
              <div className="grid gap-4">
                <p className="font-body text-sm font-semibold">Tipo de servicio</p>
                <label className="flex flex-col gap-1.5">
                  <span className="font-body text-sm font-medium">Servicio</span>
                  <select
                    value={datos.tipoServicio}
                    onChange={(e) => actualizar("tipoServicio", e.target.value as TipoServicioTraslado)}
                    className="rounded-lg border border-ink/15 bg-mist px-3.5 py-2.5 font-body text-sm"
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
                    className="rounded-lg border border-ink/15 bg-mist px-3.5 py-2.5 font-body text-sm"
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
                />
              </div>
            </PassportCard>
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
                <dd>{datos.tipoServicio.replace("_", " ")}</dd>
                <dt className="text-ink/45">Monto estimado</dt>
                <dd>${Number(datos.precioEstimado || 0).toLocaleString("es-MX")}</dd>
                <dt className="text-ink/45">Momento de pago</dt>
                <dd className="capitalize">{momentoPago.momento.replace("_", " ")}</dd>
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
                className="mt-0.5 size-4 rounded border-ink/30 text-signal focus-visible:outline-route"
              />
              <span>Acepto la política de cancelación y que el pago es solo por medios electrónicos.</span>
            </label>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between">
        <Button variant="fantasma" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>
          Atrás
        </Button>
        {paso < PASOS.length - 1 ? (
          <Button onClick={() => setPaso((p) => p + 1)}>Continuar</Button>
        ) : (
          <Button onClick={enviarSolicitud} disabled={enviando || cargandoSesion || !aceptaPoliticasPagoCancelacion}>
            {enviando ? "Enviando…" : cargandoSesion ? "Validando sesión…" : "Confirmar solicitud"}
          </Button>
        )}
      </div>
    </main>
  );
}
