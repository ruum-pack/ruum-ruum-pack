"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Aviso, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import { determinarMomentoPago, calcularCargoCancelacion } from "@ruum/shared/rules";
import type { TipoVehiculo } from "@ruum/shared/types";
import type { TipoCuenta, Usuario } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { crearVehiculo, crearTraslado, obtenerUsuarioActual } from "@ruum/api/services";
import { esNativo } from "../../../lib/capacitor";
import { obtenerUbicacionActual } from "../../../lib/ubicacion";
import { PagoStripe } from "../../PagoStripe";

const PASOS = ["Vehículo", "Documentos", "Origen y destino", "Contactos", "Cotización", "Confirmación"] as const;

interface DatosFormulario {
  // Vehículo — PRD §4.2
  tipo: TipoVehiculo;
  marca: string;
  modelo: string;
  anio: string;
  // Documentos — PRD §4.2
  tieneTarjeta: boolean;
  tieneVerificacion: boolean;
  tienePlacas: boolean;
  puedeCircular: boolean;
  // Origen / destino
  origenDireccion: string;
  origenCiudad: string;
  // Solo se llenan dentro del shell nativo, vía "Usar mi ubicación actual"
  // (lib/ubicacion.ts). Geocodificación real de la dirección sigue
  // pendiente — sin esto, origen_lat/lng se siguen enviando en 0.
  origenLat?: number;
  origenLng?: number;
  destinoDireccion: string;
  destinoCiudad: string;
  // Contactos — PRD §4.1
  entregaNombre: string;
  entregaTelefono: string;
  recepcionNombre: string;
  recepcionTelefono: string;
  // Cotización — motor automático es fase posterior; por ahora es una
  // estimación manual que el equipo de operaciones ajusta.
  precioEstimado: string;
}

const VALORES_INICIALES: DatosFormulario = {
  tipo: "sedan",
  marca: "",
  modelo: "",
  anio: "",
  tieneTarjeta: false,
  tieneVerificacion: false,
  tienePlacas: false,
  puedeCircular: false,
  origenDireccion: "",
  origenCiudad: "",
  destinoDireccion: "",
  destinoCiudad: "",
  entregaNombre: "",
  entregaTelefono: "",
  recepcionNombre: "",
  recepcionTelefono: "",
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

  // Si hay sesión real, usa el usuario real (PRD §4.6: su historial decide
  // pago anticipado vs. al cierre); si no, sigue en modo demo como antes.
  // tipo_cuenta/rol/estado_verificacion se castean desde el tipo de columna
  // de la base (texto con CHECK, no enum nativo — ver 0002_usuarios.sql) al
  // tipo conceptual más estrecho que ya usan las reglas de negocio.
  useEffect(() => {
    async function cargarUsuario() {
      if (!tieneSupabaseConfigurado()) return;
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
        }
      } catch {
        // Sigue en modo demo si algo falla al consultar la sesión.
      }
    }
    cargarUsuario();
  }, []);

  const momentoPago = useMemo(() => determinarMomentoPago(usuario), [usuario]);
  const politicaCancelacion = useMemo(() => calcularCargoCancelacion(Number(datos.precioEstimado) || 0, 0, false, false), [
    datos.precioEstimado
  ]);

  function actualizar<K extends keyof DatosFormulario>(campo: K, valor: DatosFormulario[K]) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
  }

  async function enviarSolicitud() {
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

    if (!sesionReal) {
      // Supabase sí está configurado, pero no hay sesión: usuario.id sería
      // "" y la inserción real fallaría contra RLS (no hay fila propia que
      // crear/usar). Mejor mandarlo a iniciar sesión que fallar en silencio.
      setEnviando(false);
      router.push("/login");
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      const vehiculo = await crearVehiculo(cliente, {
        usuario_id: usuario.id,
        tipo: datos.tipo,
        marca: datos.marca,
        modelo: datos.modelo,
        anio: Number(datos.anio),
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
        destino_lat: 0,
        destino_lng: 0,
        destino_direccion: datos.destinoDireccion,
        destino_ciudad: datos.destinoCiudad,
        precio_cotizado: Number(datos.precioEstimado) || 0,
        tipo_pago: momentoPago.momento
      });

      // PRD §4.6 — pago anticipado real solo si Stripe está configurado;
      // si no, sigue el comportamiento anterior (éxito inmediato, cobro
      // pendiente de implementarse). "al_cierre" nunca pasa por aquí — se
      // cobra hasta el cierre del traslado, no al solicitarlo.
      if (momentoPago.momento === "anticipado" && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
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
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium">Tipo de vehículo</span>
                <select
                  value={datos.tipo}
                  onChange={(e) => actualizar("tipo", e.target.value as TipoVehiculo)}
                  className="rounded-lg border border-ink/15 bg-paper px-3.5 py-2.5 font-body text-sm"
                >
                  {Object.entries(ETIQUETA_TIPO_VEHICULO).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <Field etiqueta="Marca" value={datos.marca} onChange={(e) => actualizar("marca", e.target.value)} />
              <Field etiqueta="Modelo" value={datos.modelo} onChange={(e) => actualizar("modelo", e.target.value)} />
              <Field
                etiqueta="Año"
                type="number"
                value={datos.anio}
                onChange={(e) => actualizar("anio", e.target.value)}
              />
            </div>
          </PassportCard>
        )}

        {paso === 1 && (
          <PassportCard>
            <p className="mb-4 font-body text-sm text-ink/60">
              Documentación obligatoria, salvo que tengas un permiso especial vigente para circular sin ella.
            </p>
            <div className="grid gap-3">
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
            </div>
            {!datos.puedeCircular && (
              <div className="mt-4">
                <Aviso tono="atencion">
                  Ruum Ruum no realiza arrastres como servicio estándar. Si el vehículo no puede circular rodando,
                  contáctanos antes de continuar.
                </Aviso>
              </div>
            )}
          </PassportCard>
        )}

        {paso === 2 && (
          <PassportCard>
            <div className="grid gap-4">
              <p className="font-body text-sm font-semibold">Origen</p>
              <Field
                etiqueta="Dirección"
                value={datos.origenDireccion}
                onChange={(e) => actualizar("origenDireccion", e.target.value)}
              />
              <Field
                etiqueta="Ciudad"
                value={datos.origenCiudad}
                onChange={(e) => actualizar("origenCiudad", e.target.value)}
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
              <p className="mt-2 font-body text-sm font-semibold">Destino</p>
              <Field
                etiqueta="Dirección"
                value={datos.destinoDireccion}
                onChange={(e) => actualizar("destinoDireccion", e.target.value)}
              />
              <Field
                etiqueta="Ciudad"
                value={datos.destinoCiudad}
                onChange={(e) => actualizar("destinoCiudad", e.target.value)}
              />
            </div>
          </PassportCard>
        )}

        {paso === 3 && (
          <PassportCard>
            <div className="grid gap-4">
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
            </div>
          </PassportCard>
        )}

        {paso === 4 && (
          <PassportCard>
            <Field
              etiqueta="Monto estimado (MXN)"
              type="number"
              value={datos.precioEstimado}
              onChange={(e) => actualizar("precioEstimado", e.target.value)}
              ayuda="Estimación manual. El motor de cotización automática llega en una fase posterior."
            />
          </PassportCard>
        )}

        {paso === 5 && (
          <div className="space-y-4">
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
                <dt className="text-ink/45">Monto estimado</dt>
                <dd>${Number(datos.precioEstimado || 0).toLocaleString("es-MX")}</dd>
                <dt className="text-ink/45">Momento de pago</dt>
                <dd className="capitalize">{momentoPago.momento.replace("_", " ")}</dd>
              </dl>
            </PassportCard>

            <Aviso tono="info">{momentoPago.razon}</Aviso>
            <Aviso tono="atencion">{politicaCancelacion.mensaje}</Aviso>
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
          <Button onClick={enviarSolicitud} disabled={enviando}>
            {enviando ? "Enviando…" : "Confirmar solicitud"}
          </Button>
        )}
      </div>
    </main>
  );
}
