"use client";
import React, { memo, useMemo } from "react";
import { Field, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { PrevisualizacionTarifa } from "@ruum/api/services";
import { MARCAS_CATALOGO } from "../../../../lib/catalogo-vehiculos";
import { CONDICIONES_VEHICULO, ESTADOS_GENERALES_VEHICULO } from "../constants";
import type { CondicionVehiculo, DatosFormulario, ErroresFormulario, TransmisionVehiculo, VehiculoGuardado } from "../types";

export interface PasoVehiculoProps {
  datos: DatosFormulario;
  errores: ErroresFormulario;
  claseControl: (campo: keyof DatosFormulario) => string;
  actualizar: <K extends keyof DatosFormulario>(campo: K, valor: DatosFormulario[K]) => void;
  actualizarMarcaCatalogo: (marca: string) => void;
  actualizarModeloCatalogo: (modelo: string) => void;
  validarCampo: (campo: keyof DatosFormulario) => void;
  vehiculosGuardados: VehiculoGuardado[];
  vehiculoSeleccionadoId: string;
  aplicarVehiculoGuardado: (vehiculo: VehiculoGuardado) => void;
  limpiarVehiculoGuardado: () => void;
  categoriaCatalogo: string;
  gamaCatalogo: string;
  modelosDisponibles: string[];
  clasificacionCatalogo: string | null;
  previsualizacion: PrevisualizacionTarifa | null;
  onEditarTarifa: () => void;
  detallesVehiculoExpandido: boolean;
  setDetallesVehiculoExpandido: (valor: React.SetStateAction<boolean>) => void;
  tarifaPreviaAceptada?: boolean;
}


function PasoVehiculoComponent({
  datos,
  errores,
  claseControl,
  actualizar,
  actualizarMarcaCatalogo,
  actualizarModeloCatalogo,
  validarCampo,
  vehiculosGuardados,
  vehiculoSeleccionadoId,
  aplicarVehiculoGuardado,
  limpiarVehiculoGuardado,
  categoriaCatalogo,
  gamaCatalogo,
  modelosDisponibles,
  clasificacionCatalogo,
  previsualizacion,
  onEditarTarifa,
  detallesVehiculoExpandido,
  setDetallesVehiculoExpandido,
  tarifaPreviaAceptada
}: PasoVehiculoProps) {
  // 1.2 useMemo en valores derivados (modelos ya viene memoizado del hook, reforzamos aquí)
  const modelosMemo = useMemo(() => modelosDisponibles, [modelosDisponibles]);

  return (
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
                        {vehiculo.placas ?? "Sin placas"} · {ETIQUETA_TIPO_VEHICULO[vehiculo.tipo]}
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
                  <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Tipo de vehículo</p>
                  <p className="mt-1 font-body text-sm font-bold text-ink">{ETIQUETA_TIPO_VEHICULO[datos.tipo]}</p>
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium">Transmisión</span>
                <select
                  id="transmision"
                  name="transmision"
                  value={datos.transmision}
                  onChange={(e) => actualizar("transmision", e.target.value as TransmisionVehiculo)}
                  onBlur={() => validarCampo("transmision")}
                  aria-invalid={Boolean(errores.transmision)}
                  aria-describedby={errores.transmision ? "transmision-error" : undefined}
                  className={`rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark ${claseControl("transmision")}`}
                >
                  <option value="automatica">Automática</option>
                  <option value="manual">Manual</option>
                  <option value="electrica">Eléctrica</option>
                </select>
                {errores.transmision && <p id="transmision-error" className="font-body text-xs text-danger">{errores.transmision}</p>}
              </label>

              <div>
                <Field
                  etiqueta="Marca"
                  name="marca"
                  id="marca"
                  list="catalogo-marcas-vehiculos"
                  value={datos.marca}
                  onChange={(e) => actualizarMarcaCatalogo(e.target.value)}
                  onBlur={() => validarCampo("marca")}
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
                  name="modelo"
                  id="modelo"
                  list="catalogo-modelos-vehiculos"
                  value={datos.modelo}
                  onChange={(e) => actualizarModeloCatalogo(e.target.value)}
                  onBlur={() => validarCampo("modelo")}
                  disabled={!datos.marca.trim()}
                  error={errores.modelo}
                  ayuda={clasificacionCatalogo
                    ? `Clasificación del catálogo: ${clasificacionCatalogo}. El tipo de vehículo se prellenó automáticamente.`
                    : datos.marca.trim()
                    ? `${modelosMemo.length} modelos disponibles. Al elegir uno sugeriremos el tipo de vehículo.`
                    : "Primero captura o selecciona la marca."}
                />
                <datalist id="catalogo-modelos-vehiculos">
                  {modelosMemo.map((modelo) => <option key={modelo} value={modelo} />)}
                </datalist>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium">Condición</span>
                <select
                  id="condicion"
                  name="condicion"
                  value={datos.condicion}
                  onChange={(e) => actualizar("condicion", e.target.value as CondicionVehiculo)}
                  onBlur={() => validarCampo("condicion")}
                  className={`rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark ${claseControl("condicion")}`}
                  aria-invalid={Boolean(errores.condicion)}
                  aria-describedby={errores.condicion ? "condicion-error" : undefined}
                >
                  <option value="">Selecciona condición</option>
                  {CONDICIONES_VEHICULO.map((condicion) => (
                    <option key={condicion.valor} value={condicion.valor}>
                      {condicion.etiqueta}
                    </option>
                  ))}
                </select>
                {errores.condicion && <p id="condicion-error" className="font-body text-xs text-danger">{errores.condicion}</p>}
              </label>

              <Field
                etiqueta="Año"
                name="anio"
                id="anio"
                type="number"
                min={1980}
                max={new Date().getFullYear() + 1}
                value={datos.anio}
                onChange={(e) => actualizar("anio", e.target.value)}
                onBlur={() => validarCampo("anio")}
                error={errores.anio}
              />

              {/* Tarifa aceptada: visible desde paso 1 */}
              <div
                className={`rounded-xl border px-4 py-3 ${
                  tarifaPreviaAceptada === false
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-signal/30 bg-signal/10"
                }`}
                aria-live="polite"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-body text-xs font-semibold uppercase tracking-wide ${tarifaPreviaAceptada === false ? "text-amber-800" : "text-ink/55"}`}>
                      {tarifaPreviaAceptada === false ? "⚠️ Tarifa invalidada por cambios" : "Tarifa aceptada"}
                    </p>
                    {tarifaPreviaAceptada === false ? (
                      <p className="mt-1 font-body text-xs font-medium text-amber-900 leading-snug">
                        Modificaste campos que afectan la tarifa. Confírmala de nuevo.
                      </p>
                    ) : previsualizacion?.disponible ? (
                      <p className="mt-1 font-display text-xl font-bold text-ink">
                        ${Number(previsualizacion.tarifa ?? 0).toLocaleString("es-MX")}{" "}
                        <span className="font-body text-xs font-semibold text-ink/55">MXN</span>
                      </p>
                    ) : (
                      <p className="mt-1 font-display text-base font-bold text-ink">Cotización por nuestro equipo</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onEditarTarifa}
                    className={`rounded-lg border px-3 py-1.5 font-body text-xs font-semibold shadow-xs transition ${
                      tarifaPreviaAceptada === false
                        ? "border-amber-500 bg-paper text-amber-950 hover:bg-amber-100"
                        : "border-signal/40 bg-paper text-ink hover:bg-mist"
                    }`}
                  >
                    {tarifaPreviaAceptada === false ? "Re-confirmar tarifa" : "Editar"}
                  </button>
                </div>
              </div>


              <button
                type="button"
                onClick={() => setDetallesVehiculoExpandido((v) => !v)}
                aria-expanded={detallesVehiculoExpandido}
                className="flex w-full items-center justify-between rounded-lg border border-ink/10 bg-mist px-3.5 py-3 font-body text-sm font-semibold text-ink transition hover:border-signal/30"
              >
                <span>Detalles del vehículo {detallesVehiculoExpandido ? "▲" : "▼"}</span>
                <span className="font-body text-xs font-normal text-ink/55">{detallesVehiculoExpandido ? "Ocultar" : "Completar después (color, placas, VIN…)"}</span>
              </button>

              {detallesVehiculoExpandido && (
                <div className="grid gap-4 animate-fade-in">
                  <Field etiqueta="Color" name="color" id="color" value={datos.color} onChange={(e) => actualizar("color", e.target.value)} onBlur={() => validarCampo("color")} error={errores.color} />
                  <Field
                    etiqueta="Placas"
                    name="placas"
                    id="placas"
                    value={datos.placas}
                    onChange={(e) => actualizar("placas", e.target.value)}
                    onBlur={() => validarCampo("placas")}
                    error={errores.placas}
                    autoCapitalize="characters"
                    autoCorrect="off"
                  />
                  <Field
                    etiqueta="Número de serie / VIN"
                    name="vin"
                    id="vin"
                    value={datos.vin}
                    onChange={(e) => actualizar("vin", e.target.value)}
                    onBlur={() => validarCampo("vin")}
                    error={errores.vin}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    ayuda="17 caracteres. Si no lo tienes a mano, podrás agregarlo antes de la recolección."
                  />
                  <label className="flex flex-col gap-1.5">
                    <span className="font-body text-sm font-medium">Estado general declarado</span>
                    <select
                      id="estadoGeneral"
                      name="estadoGeneral"
                      value={datos.estadoGeneral}
                      onChange={(e) => actualizar("estadoGeneral", e.target.value)}
                      onBlur={() => validarCampo("estadoGeneral")}
                      className={`rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark ${claseControl("estadoGeneral")}`}
                      aria-invalid={Boolean(errores.estadoGeneral)}
                      aria-describedby={errores.estadoGeneral ? "estadoGeneral-error" : undefined}
                    >
                      <option value="">Selecciona estado</option>
                      {ESTADOS_GENERALES_VEHICULO.map((estado) => (
                        <option key={estado} value={estado}>
                          {estado}
                        </option>
                      ))}
                    </select>
                    {errores.estadoGeneral && <p id="estadoGeneral-error" className="font-body text-xs text-danger">{errores.estadoGeneral}</p>}
                  </label>

                  <div className="grid gap-3 rounded-lg border border-ink/10 p-4">
                    <div>
                      <p className="font-body text-sm font-semibold">Documentación mínima requerida</p>
                      <p className="mt-1 font-body text-xs text-ink/65">
                        {datos.condicion === "rescate_mecanico"
                          ? "Para rescate mecánico el vehículo puede no circular rodando — se asignará grúa o plataforma. Sigue requiriendo tarjeta, verificación y placas vigentes."
                          : "Por el momento, el servicio está disponible únicamente para vehículos que encienden, cuentan con documentación vigente y pueden circular rodando."}
                      </p>
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
                            id={campo}
                            name={campo}
                            type="checkbox"
                            checked={datos[campo]}
                            onChange={(e) => actualizar(campo, e.target.checked)}
                            onBlur={() => validarCampo(campo)}
                            className={`size-5 rounded text-signal focus-visible:outline-route-dark ${errores[campo] ? "border-danger" : "border-ink/50"}`}
                            aria-invalid={Boolean(errores[campo])}
                            aria-describedby={errores[campo] ? `${campo}-error` : undefined}
                          />
                          {etiqueta}
                        </label>
                        {errores[campo] && <p id={`${campo}-error`} className="pl-7 font-body text-xs text-danger">{errores[campo]}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!detallesVehiculoExpandido && (
                <p className="rounded-lg border border-dashed border-ink/15 bg-ink/[0.02] px-3 py-2 font-body text-xs leading-5 text-ink/55">
                  Completarás color, placas, VIN y documentación antes de confirmar. Puedes avanzar y volver después.
                </p>
              )}
            </div>
          </div>
        </PassportCard>
      </div>
    </div>
  );
}

function areEqualPasoVehiculo(prev: PasoVehiculoProps, next: PasoVehiculoProps) {
  return (
    prev.datos.marca === next.datos.marca &&
    prev.datos.modelo === next.datos.modelo &&
    prev.datos.anio === next.datos.anio &&
    prev.datos.condicion === next.datos.condicion &&
    prev.datos.transmision === next.datos.transmision &&
    prev.datos.color === next.datos.color &&
    prev.previsualizacion === next.previsualizacion &&
    prev.vehiculoSeleccionadoId === next.vehiculoSeleccionadoId &&
    prev.errores === next.errores &&
    prev.modelosDisponibles === next.modelosDisponibles
  );
}
export const PasoVehiculo = memo(PasoVehiculoComponent, areEqualPasoVehiculo);
