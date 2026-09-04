"use client";
import { Button, Field, PassportCard } from "@ruum/ui";
import { esNativo } from "../../../../lib/capacitor";
import { obtenerUbicacionActual } from "../../../../lib/ubicacion";
import type { DatosCodigoPostal } from "../../../../lib/codigos-postales";
import type { sugerirDireccionesAutocomplete } from "../../../../lib/mapbox";
import { CampoCodigoPostal } from "./CampoCodigoPostal";
import { EscalasAcordeon } from "./EscalasAcordeon";
import { formatearDistancia, formatearTiempo, type PrefijoDomicilio } from "../constants";
import type { DatosFormulario, ErroresFormulario, ParadaForm } from "../types";

export interface PasoRutaProps {
  datos: DatosFormulario;
  errores: ErroresFormulario;
  claseControl: (campo: keyof DatosFormulario) => string;
  actualizar: <K extends keyof DatosFormulario>(campo: K, valor: DatosFormulario[K]) => void;
  actualizarTelefono: (campo: "entregaTelefono" | "recepcionTelefono", valor: string) => void;
  actualizarCodigoPostal: (prefijo: PrefijoDomicilio, valor: string) => void;
  consultarCodigoPostal: (prefijo: PrefijoDomicilio, codigoPostal: string) => Promise<void>;
  validarCampo: (campo: keyof DatosFormulario) => void;
  aplicarSugerenciaCp: (prefijo: PrefijoDomicilio, ciudad: string, colonia: string) => void;
  aplicarSugerenciaDireccion: (prefijo: PrefijoDomicilio, s: Awaited<ReturnType<typeof sugerirDireccionesAutocomplete>>[number]) => void;
  cpConsultando: PrefijoDomicilio | null;
  cpAviso: Record<PrefijoDomicilio, string | null>;
  cpOpciones: Record<PrefijoDomicilio, DatosCodigoPostal | null>;
  placesOpciones: Record<PrefijoDomicilio, string[]>;
  origenBusqueda: string;
  setOrigenBusqueda: (v: string) => void;
  destinoBusqueda: string;
  setDestinoBusqueda: (v: string) => void;
  origenSugerencias: Awaited<ReturnType<typeof sugerirDireccionesAutocomplete>>;
  destinoSugerencias: Awaited<ReturnType<typeof sugerirDireccionesAutocomplete>>;
  buscandoOrigen: boolean;
  buscandoDestino: boolean;
  rutaEstimacion: {
    origenLat?: number;
    origenLng?: number;
    destinoLat?: number;
    destinoLng?: number;
    paradasCoords?: Array<{ lat?: number; lng?: number }>;
    distanciaKm?: number;
    tiempoEstimadoHoras?: number;
    incompletas: boolean;
  } | null;
  rutaCalculando: boolean;
  rutaAviso: string | null;
  onParadasChange: (next: ParadaForm[]) => void;
  erroresParadas?: Array<Partial<Record<keyof ParadaForm, string>>>;
}

export function PasoRuta({
  datos,
  errores,
  claseControl,
  actualizar,
  actualizarTelefono,
  actualizarCodigoPostal,
  consultarCodigoPostal,
  validarCampo,
  aplicarSugerenciaCp,
  aplicarSugerenciaDireccion,
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
  onParadasChange,
  erroresParadas
}: PasoRutaProps) {
  return (
    <div className="space-y-4">
      <PassportCard>
        <div className="grid gap-6">
          <p className="font-body text-sm font-semibold">¿De dónde sale y a dónde llega?</p>

          {/* Origen — siempre visible, ancla superior */}
          <div className="grid gap-4" aria-label="Origen del traslado">
            <div className="rounded-lg border border-signal/30 bg-signal/10 p-3">
              <label className="font-body text-xs font-semibold text-ink">Busca tu dirección (autocompleta calle, colonia y CP)</label>
              <div className="relative mt-2">
                <input
                  value={origenBusqueda}
                  onChange={(e) => setOrigenBusqueda(e.target.value)}
                  placeholder="Ej. Av Patriotismo 12, Escandón, CDMX"
                  className="w-full rounded-xl border border-ink/20 bg-mist px-3.5 py-2.5 pr-10 font-body text-sm text-ink placeholder:text-ink/45 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
                  aria-label="Buscar dirección de origen"
                  autoComplete="off"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/40">
                  {buscandoOrigen ? "…" : "🔍"}
                </span>
                {origenSugerencias.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-ink/10 bg-mist shadow-2">
                    {origenSugerencias.map((s, i) => (
                      <li key={`${s.textoCompleto}-${i}`}>
                        <button
                          type="button"
                          onClick={() => aplicarSugerenciaDireccion("origen", s)}
                          className="w-full px-3 py-2 text-left font-body text-xs leading-5 hover:bg-signal/10"
                        >
                          <span className="font-semibold text-ink">{s.textoCompleto}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="mt-1.5 font-body text-[11px] leading-4 text-ink/55">
                Escribe al menos 3 letras y elige una sugerencia. Precargamos calle, colonia, ciudad, estado y CP — puedes editarlos abajo.
              </p>
            </div>

            <div className="grid gap-4 rounded-lg border border-ink/10 p-4">
              <p className="font-body text-sm font-semibold">Domicilio de origen</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoCodigoPostal
                  id="origenCodigoPostal"
                  nombre="origenCodigoPostal"
                  valor={datos.origenCodigoPostal}
                  ciudadActual={datos.origenCiudad}
                  opciones={cpOpciones.origen}
                  sugerenciasMapbox={placesOpciones.origen}
                  consultando={cpConsultando === "origen"}
                  aviso={cpAviso.origen}
                  error={errores.origenCodigoPostal}
                  onCambiar={(valor) => actualizarCodigoPostal("origen", valor)}
                  onSalir={(valor) => {
                    consultarCodigoPostal("origen", valor);
                    validarCampo("origenCodigoPostal");
                  }}
                  onAplicarSugerencia={(ciudad, colonia) => aplicarSugerenciaCp("origen", ciudad, colonia)}
                />
                <Field
                  id="origenEstado"
                  name="origenEstado"
                  etiqueta="Estado"
                  value={datos.origenEstado}
                  onChange={(e) => actualizar("origenEstado", e.target.value)}
                  onBlur={() => validarCampo("origenEstado")}
                  error={errores.origenEstado}
                />
                <Field
                  id="origenCiudad"
                  name="origenCiudad"
                  etiqueta="Ciudad"
                  value={datos.origenCiudad}
                  onChange={(e) => actualizar("origenCiudad", e.target.value)}
                  onBlur={() => validarCampo("origenCiudad")}
                  error={errores.origenCiudad}
                />
                <Field
                  id="origenColonia"
                  name="origenColonia"
                  etiqueta="Colonia"
                  value={datos.origenColonia}
                  onChange={(e) => actualizar("origenColonia", e.target.value)}
                  onBlur={() => validarCampo("origenColonia")}
                  error={errores.origenColonia}
                />
                <Field
                  id="origenCalle"
                  name="origenCalle"
                  etiqueta="Calle"
                  value={datos.origenCalle}
                  onChange={(e) => actualizar("origenCalle", e.target.value)}
                  onBlur={() => validarCampo("origenCalle")}
                  error={errores.origenCalle}
                />
                <Field
                  id="origenNumero"
                  name="origenNumero"
                  etiqueta="Número exterior / interior"
                  value={datos.origenNumero}
                  onChange={(e) => actualizar("origenNumero", e.target.value)}
                  onBlur={() => validarCampo("origenNumero")}
                  error={errores.origenNumero}
                />
              </div>
              <Field
                id="origenReferencias"
                name="origenReferencias"
                etiqueta="Referencias"
                value={datos.origenReferencias}
                onChange={(e) => actualizar("origenReferencias", e.target.value)}
                onBlur={() => validarCampo("origenReferencias")}
                placeholder="Entre calles, color de fachada, acceso, piso, etc."
              />
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
          </div>

          {/* Escalas / Tareas — acordeón entre origen y destino (hasta 8) */}
          <div className="rounded-xl border border-ink/10 bg-white p-4">
            <EscalasAcordeon
              paradas={datos.paradas}
              onChange={onParadasChange}
              erroresParadas={erroresParadas}
            />
            {errores.paradas && typeof errores.paradas === "string" && (
              <p className="mt-2 font-body text-xs text-danger">{errores.paradas as unknown as string}</p>
            )}
          </div>

          <div className="grid gap-4" aria-label="Destino y contactos del traslado">
            <div className="rounded-lg border border-signal/30 bg-signal/10 p-3">
              <label htmlFor="input-busqueda-destino" className="font-body text-xs font-semibold text-ink">
                Busca la dirección de destino
              </label>
              <div className="relative mt-2">
                <input
                  id="input-busqueda-destino"
                  value={destinoBusqueda}
                  onChange={(e) => setDestinoBusqueda(e.target.value)}
                  placeholder="Ej. Calle 5 123, Centro, Puebla"
                  className="w-full rounded-xl border border-ink/20 bg-mist px-3.5 py-2.5 pr-10 font-body text-sm text-ink placeholder:text-ink/45 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
                  aria-label="Buscar dirección de destino"
                  autoComplete="off"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/40">
                  {buscandoDestino ? "…" : "🔍"}
                </span>
                {destinoSugerencias.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-ink/10 bg-mist shadow-2">
                    {destinoSugerencias.map((s, i) => (
                      <li key={`${s.textoCompleto}-${i}`}>
                        <button
                          type="button"
                          onClick={() => aplicarSugerenciaDireccion("destino", s)}
                          className="w-full px-3 py-2 text-left font-body text-xs leading-5 hover:bg-signal/10"
                        >
                          <span className="font-semibold text-ink">{s.textoCompleto}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="mt-1.5 font-body text-[11px] leading-4 text-ink/55">
                Elige una sugerencia para autocompletar el formulario.
              </p>
            </div>

            <div className="grid gap-4 rounded-lg border border-ink/10 p-4">
              <p className="font-body text-sm font-semibold">Domicilio de destino</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoCodigoPostal
                  id="destinoCodigoPostal"
                  nombre="destinoCodigoPostal"
                  valor={datos.destinoCodigoPostal}
                  ciudadActual={datos.destinoCiudad}
                  opciones={cpOpciones.destino}
                  sugerenciasMapbox={placesOpciones.destino}
                  consultando={cpConsultando === "destino"}
                  aviso={cpAviso.destino}
                  error={errores.destinoCodigoPostal}
                  onCambiar={(valor) => actualizarCodigoPostal("destino", valor)}
                  onSalir={(valor) => {
                    consultarCodigoPostal("destino", valor);
                    validarCampo("destinoCodigoPostal");
                  }}
                  onAplicarSugerencia={(ciudad, colonia) => aplicarSugerenciaCp("destino", ciudad, colonia)}
                />
                <Field
                  id="destinoEstado"
                  name="destinoEstado"
                  etiqueta="Estado"
                  value={datos.destinoEstado}
                  onChange={(e) => actualizar("destinoEstado", e.target.value)}
                  onBlur={() => validarCampo("destinoEstado")}
                  error={errores.destinoEstado}
                />
                <Field
                  id="destinoCiudad"
                  name="destinoCiudad"
                  etiqueta="Ciudad"
                  value={datos.destinoCiudad}
                  onChange={(e) => actualizar("destinoCiudad", e.target.value)}
                  onBlur={() => validarCampo("destinoCiudad")}
                  error={errores.destinoCiudad}
                />
                <Field
                  id="destinoColonia"
                  name="destinoColonia"
                  etiqueta="Colonia"
                  value={datos.destinoColonia}
                  onChange={(e) => actualizar("destinoColonia", e.target.value)}
                  onBlur={() => validarCampo("destinoColonia")}
                  error={errores.destinoColonia}
                />
                <Field
                  id="destinoCalle"
                  name="destinoCalle"
                  etiqueta="Calle"
                  value={datos.destinoCalle}
                  onChange={(e) => actualizar("destinoCalle", e.target.value)}
                  onBlur={() => validarCampo("destinoCalle")}
                  error={errores.destinoCalle}
                />
                <Field
                  id="destinoNumero"
                  name="destinoNumero"
                  etiqueta="Número exterior / interior"
                  value={datos.destinoNumero}
                  onChange={(e) => actualizar("destinoNumero", e.target.value)}
                  onBlur={() => validarCampo("destinoNumero")}
                  error={errores.destinoNumero}
                />
              </div>
              <Field
                id="destinoReferencias"
                name="destinoReferencias"
                etiqueta="Referencias"
                value={datos.destinoReferencias}
                onChange={(e) => actualizar("destinoReferencias", e.target.value)}
                onBlur={() => validarCampo("destinoReferencias")}
                placeholder="Entre calles, color de fachada, acceso, piso, etc."
              />
            </div>

            <section className="rounded-lg border border-route/20 bg-route-soft px-4 py-4" aria-labelledby="titulo-estimacion-ruta">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p id="titulo-estimacion-ruta" className="font-body text-sm font-semibold text-ink">
                    Distancia y tiempo estimado
                  </p>
                  <p className="mt-1 font-body text-xs leading-5 text-ink/65">
                    Se calcula con Mapbox usando origen y destino. Si no se puede resolver, nuestro equipo de operaciones lo revisará.
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
              <Field
                id="entregaNombre"
                name="entregaNombre"
                etiqueta="Nombre"
                value={datos.entregaNombre}
                onChange={(e) => actualizar("entregaNombre", e.target.value)}
                onBlur={() => validarCampo("entregaNombre")}
                error={errores.entregaNombre}
              />
              <Field
                id="entregaApellido"
                name="entregaApellido"
                etiqueta="Apellido"
                value={datos.entregaApellido}
                onChange={(e) => actualizar("entregaApellido", e.target.value)}
                onBlur={() => validarCampo("entregaApellido")}
                error={errores.entregaApellido}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="entregaTelefono" className="font-body text-sm font-medium">Teléfono de contacto para recolección</label>
              <div className={`flex overflow-hidden rounded-lg border bg-mist ${claseControl("entregaTelefono")}`}>
                <span className="flex items-center border-r border-ink/10 px-3.5 font-body text-sm font-semibold text-ink/70">+52</span>
                <input
                  id="entregaTelefono"
                  name="entregaTelefono"
                  value={datos.entregaTelefono}
                  onChange={(e) => actualizarTelefono("entregaTelefono", e.target.value)}
                  onBlur={() => validarCampo("entregaTelefono")}
                  inputMode="numeric"
                  maxLength={10}
                  className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark"
                  placeholder="10 dígitos"
                  aria-label="Teléfono de entrega (10 dígitos)"
                  aria-invalid={Boolean(errores.entregaTelefono)}
                  aria-describedby={errores.entregaTelefono ? "telefono-entrega-error" : undefined}
                />
              </div>
              {errores.entregaTelefono && <p id="telefono-entrega-error" className="font-body text-xs text-danger">{errores.entregaTelefono}</p>}
            </div>

            <p className="mt-2 font-body text-sm font-semibold">Quien recibe el vehículo</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="recepcionNombre"
                name="recepcionNombre"
                etiqueta="Nombre"
                value={datos.recepcionNombre}
                onChange={(e) => actualizar("recepcionNombre", e.target.value)}
                onBlur={() => validarCampo("recepcionNombre")}
                error={errores.recepcionNombre}
              />
              <Field
                id="recepcionApellido"
                name="recepcionApellido"
                etiqueta="Apellido"
                value={datos.recepcionApellido}
                onChange={(e) => actualizar("recepcionApellido", e.target.value)}
                onBlur={() => validarCampo("recepcionApellido")}
                error={errores.recepcionApellido}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="recepcionTelefono" className="font-body text-sm font-medium">Teléfono de contacto para entrega</label>
              <div className={`flex overflow-hidden rounded-lg border bg-mist ${claseControl("recepcionTelefono")}`}>
                <span className="flex items-center border-r border-ink/10 px-3.5 font-body text-sm font-semibold text-ink/70">+52</span>
                <input
                  id="recepcionTelefono"
                  name="recepcionTelefono"
                  value={datos.recepcionTelefono}
                  onChange={(e) => actualizarTelefono("recepcionTelefono", e.target.value)}
                  onBlur={() => validarCampo("recepcionTelefono")}
                  inputMode="numeric"
                  maxLength={10}
                  className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark"
                  placeholder="10 dígitos"
                  aria-label="Teléfono de recepción (10 dígitos)"
                  aria-invalid={Boolean(errores.recepcionTelefono)}
                  aria-describedby={errores.recepcionTelefono ? "telefono-recepcion-error" : undefined}
                />
              </div>
              {errores.recepcionTelefono && <p id="telefono-recepcion-error" className="font-body text-xs text-danger">{errores.recepcionTelefono}</p>}
            </div>

            <label htmlFor="instruccionesEspeciales" className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-medium">Instrucciones especiales</span>
              <textarea
                id="instruccionesEspeciales"
                name="instruccionesEspeciales"
                value={datos.instruccionesEspeciales}
                onChange={(e) => actualizar("instruccionesEspeciales", e.target.value)}
                onBlur={() => validarCampo("instruccionesEspeciales")}
                maxLength={1000}
                placeholder="Detalles sobre caseta de acceso, horarios de entrega en privada o requisitos de seguridad."
                aria-label="Instrucciones especiales para el traslado"
                className="min-h-24 rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark"
              />
            </label>
          </div>
        </div>
      </PassportCard>
    </div>
  );
}
