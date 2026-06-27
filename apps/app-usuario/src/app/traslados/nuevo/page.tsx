"use client";

import { useMemo, useState } from "react";
import { Button, Field, Aviso, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import { determinarMomentoPago, calcularCargoCancelacion } from "@ruum/shared/rules";
import type { TipoVehiculo } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { crearVehiculo } from "@ruum/api/services";
import { crearTraslado } from "@ruum/api/services";

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

// Usuario sin historial (PRD §4.6): es el caso real de alguien que llena
// este formulario por primera vez, antes de tener cuenta con historial.
// Una vez exista login real, este objeto debe venir de la sesión.
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
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<DatosFormulario>(VALORES_INICIALES);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);

  const momentoPago = useMemo(() => determinarMomentoPago(USUARIO_NUEVO_DEMO), []);
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

    try {
      const cliente = crearClienteNavegador();
      // Nota: requiere un usuario_id real de una sesión autenticada; el
      // login todavía no existe en este corte, así que esta rama solo
      // queda lista para conectarse en cuanto exista auth.
      const vehiculo = await crearVehiculo(cliente, {
        usuario_id: USUARIO_NUEVO_DEMO.id,
        tipo: datos.tipo,
        marca: datos.marca,
        modelo: datos.modelo,
        anio: Number(datos.anio),
        tiene_tarjeta_circulacion: datos.tieneTarjeta,
        tiene_verificacion: datos.tieneVerificacion,
        tiene_placas: datos.tienePlacas,
        puede_circular_rodando: datos.puedeCircular
      });

      await crearTraslado(cliente, {
        usuario_id: USUARIO_NUEVO_DEMO.id,
        vehiculo_id: vehiculo.id,
        contacto_entrega_nombre: datos.entregaNombre,
        contacto_entrega_telefono: datos.entregaTelefono,
        contacto_recepcion_nombre: datos.recepcionNombre,
        contacto_recepcion_telefono: datos.recepcionTelefono,
        origen_lat: 0,
        origen_lng: 0,
        origen_direccion: datos.origenDireccion,
        origen_ciudad: datos.origenCiudad,
        destino_lat: 0,
        destino_lng: 0,
        destino_direccion: datos.destinoDireccion,
        destino_ciudad: datos.destinoCiudad,
        precio_cotizado: Number(datos.precioEstimado) || 0,
        tipo_pago: momentoPago.momento
      });

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
