"use client";
import React, { memo } from "react";
import { Button, PassportCard } from "@ruum/ui";
import type { PrevisualizacionTarifa } from "@ruum/api/services";
import { MARCAS_CATALOGO } from "../../../../lib/catalogo-vehiculos";
import { CONDICIONES_VEHICULO, SLOTS_HORARIOS, type PrefijoDomicilio } from "../constants";
import type { CondicionVehiculo, DatosFormulario, ErroresFormulario } from "../types";

export interface PasoTarifaProps {
  datos: DatosFormulario;
  errores: ErroresFormulario;
  claseControl: (campo: keyof DatosFormulario) => string;
  actualizar: <K extends keyof DatosFormulario>(campo: K, valor: DatosFormulario[K]) => void;
  actualizarCodigoPostal: (prefijo: PrefijoDomicilio, valor: string) => void;
  actualizarMarcaCatalogo: (marca: string) => void;
  actualizarModeloCatalogo: (modelo: string) => void;
  validarCampo: (campo: keyof DatosFormulario) => void;
  cpConsultando: PrefijoDomicilio | null;
  modelosDisponibles: string[];
  previsualizacion: PrevisualizacionTarifa | null;
  previsualizando: boolean;
  onContinuar: () => void;
}

function PasoTarifaComponent({
  datos,
  errores,
  claseControl,
  actualizar,
  actualizarCodigoPostal,
  actualizarMarcaCatalogo,
  actualizarModeloCatalogo,
  validarCampo,
  cpConsultando,
  modelosDisponibles,
  previsualizacion,
  previsualizando,
  onContinuar
}: PasoTarifaProps) {
  return (
    <div className="space-y-4">
      <PassportCard>
        <div className="grid gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Conoce tu tarifa</h2>
            <p className="mt-1 font-body text-xs text-ink/65">
              Ingresa los datos esenciales para calcular el precio real de tu traslado de inmediato.
            </p>
          </div>

          {/* CP Origen y CP Destino */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="gate-origenCodigoPostal" className="font-body text-sm font-medium text-ink">
                Código Postal de origen
              </label>
              <div className="relative">
                <input
                  id="gate-origenCodigoPostal"
                  name="origenCodigoPostal"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="Ej. 03100"
                  value={datos.origenCodigoPostal}
                  onChange={(e) => actualizarCodigoPostal("origen", e.target.value)}
                  onBlur={() => validarCampo("origenCodigoPostal")}
                  className={`w-full rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark ${claseControl("origenCodigoPostal")}`}
                  aria-invalid={Boolean(errores.origenCodigoPostal)}
                  aria-describedby={errores.origenCodigoPostal ? "gate-origen-cp-error" : undefined}
                />
                {cpConsultando === "origen" && (
                  <span className="absolute right-3 top-2.5 text-xs text-ink/40">Buscando…</span>
                )}
              </div>
              {datos.origenCiudad && (
                <p className="font-body text-xs text-emerald-700 font-medium">
                  ✓ {datos.origenCiudad}, {datos.origenEstado}
                </p>
              )}
              {errores.origenCodigoPostal && (
                <p id="gate-origen-cp-error" className="font-body text-xs text-danger">{errores.origenCodigoPostal}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="gate-destinoCodigoPostal" className="font-body text-sm font-medium text-ink">
                Código Postal de destino
              </label>
              <div className="relative">
                <input
                  id="gate-destinoCodigoPostal"
                  name="destinoCodigoPostal"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="Ej. 06600"
                  value={datos.destinoCodigoPostal}
                  onChange={(e) => actualizarCodigoPostal("destino", e.target.value)}
                  onBlur={() => validarCampo("destinoCodigoPostal")}
                  className={`w-full rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-dark ${claseControl("destinoCodigoPostal")}`}
                  aria-invalid={Boolean(errores.destinoCodigoPostal)}
                  aria-describedby={errores.destinoCodigoPostal ? "gate-destino-cp-error" : undefined}
                />
                {cpConsultando === "destino" && (
                  <span className="absolute right-3 top-2.5 text-xs text-ink/40">Buscando…</span>
                )}
              </div>
              {datos.destinoCiudad && (
                <p className="font-body text-xs text-emerald-700 font-medium">
                  ✓ {datos.destinoCiudad}, {datos.destinoEstado}
                </p>
              )}
              {errores.destinoCodigoPostal && (
                <p id="gate-destino-cp-error" className="font-body text-xs text-danger">{errores.destinoCodigoPostal}</p>
              )}
            </div>
          </div>

          {/* Marca, Modelo y Condición */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="gate-marca" className="font-body text-sm font-medium text-ink">
                Marca
              </label>
              <select
                id="gate-marca"
                name="marca"
                value={datos.marca}
                onChange={(e) => actualizarMarcaCatalogo(e.target.value)}
                onBlur={() => validarCampo("marca")}
                className={`rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm ${claseControl("marca")}`}
                aria-invalid={Boolean(errores.marca)}
                aria-describedby={errores.marca ? "gate-marca-error" : undefined}
              >
                <option value="">Selecciona una marca</option>
                {MARCAS_CATALOGO.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {errores.marca && <p id="gate-marca-error" className="font-body text-xs text-danger">{errores.marca}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="gate-modelo" className="font-body text-sm font-medium text-ink">
                Modelo
              </label>
              {modelosDisponibles.length > 0 ? (
                <select
                  id="gate-modelo"
                  name="modelo"
                  value={datos.modelo}
                  onChange={(e) => actualizarModeloCatalogo(e.target.value)}
                  onBlur={() => validarCampo("modelo")}
                  className={`rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm ${claseControl("modelo")}`}
                  aria-invalid={Boolean(errores.modelo)}
                  aria-describedby={errores.modelo ? "gate-modelo-error" : undefined}
                >
                  <option value="">Selecciona un modelo</option>
                  {modelosDisponibles.map((mod) => (
                    <option key={mod} value={mod}>{mod}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="gate-modelo"
                  name="modelo"
                  type="text"
                  placeholder="Escribe el modelo"
                  value={datos.modelo}
                  onChange={(e) => actualizarModeloCatalogo(e.target.value)}
                  onBlur={() => validarCampo("modelo")}
                  className={`rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm ${claseControl("modelo")}`}
                  aria-invalid={Boolean(errores.modelo)}
                  aria-describedby={errores.modelo ? "gate-modelo-error" : undefined}
                />
              )}
              {errores.modelo && <p id="gate-modelo-error" className="font-body text-xs text-danger">{errores.modelo}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="gate-condicion" className="font-body text-sm font-medium text-ink">
                Condición
              </label>
              <select
                id="gate-condicion"
                name="condicion"
                value={datos.condicion}
                onChange={(e) => actualizar("condicion", e.target.value as CondicionVehiculo)}
                onBlur={() => validarCampo("condicion")}
                className={`rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm ${claseControl("condicion")}`}
                aria-invalid={Boolean(errores.condicion)}
                aria-describedby={errores.condicion ? "gate-condicion-error" : undefined}
              >
                <option value="">Selecciona condición</option>
                {CONDICIONES_VEHICULO.map((c) => (
                  <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
                ))}
              </select>
              {errores.condicion && <p id="gate-condicion-error" className="font-body text-xs text-danger">{errores.condicion}</p>}
            </div>
          </div>

          {/* Bloque Modalidad + Fecha + Slots */}
          <div className="flex flex-col gap-2 pt-2 border-t border-ink/10">
            <label id="label-gate-modalidad-programacion" className="font-body text-sm font-semibold text-ink">
              ¿Cuándo necesitas el traslado?
            </label>
            <div
              className="grid grid-cols-2 gap-2 rounded-xl border border-ink/20 bg-mist p-1.5"
              role="radiogroup"
              aria-labelledby="label-gate-modalidad-programacion"
            >
              <button
                type="button"
                role="radio"
                aria-checked={datos.modalidadProgramacion === "lo_antes_posible"}
                onClick={() => {
                  actualizar("modalidadProgramacion", "lo_antes_posible");
                  actualizar("fechaHoraProgramada", "");
                  validarCampo("modalidadProgramacion");
                }}
                className={[
                  "flex items-center justify-center gap-2 rounded-lg py-3 px-3 font-body text-xs sm:text-sm font-bold transition-all focus-visible:outline-route-dark",
                  datos.modalidadProgramacion === "lo_antes_posible"
                    ? "bg-signal text-slate-950 shadow-sm ring-1 ring-signal"
                    : "text-ink/70 hover:bg-surface-elevated hover:text-ink"
                ].join(" ")}
              >
                <span aria-hidden="true">⚡</span>
                <span>Lo antes posible</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={datos.modalidadProgramacion === "programado"}
                onClick={() => {
                  actualizar("modalidadProgramacion", "programado");
                  if (!datos.fechaHoraProgramada) {
                    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
                    actualizar("fechaHoraProgramada", `${manana}T09:00`);
                  }
                  validarCampo("modalidadProgramacion");
                }}
                className={[
                  "flex items-center justify-center gap-2 rounded-lg py-3 px-3 font-body text-xs sm:text-sm font-bold transition-all focus-visible:outline-route-dark",
                  datos.modalidadProgramacion === "programado"
                    ? "bg-signal text-slate-950 shadow-sm ring-1 ring-signal"
                    : "text-ink/70 hover:bg-surface-elevated hover:text-ink"
                ].join(" ")}
              >
                <span aria-hidden="true">📅</span>
                <span>Programar fecha</span>
              </button>
            </div>
          </div>

          {datos.modalidadProgramacion === "programado" && (
            <div className="grid gap-3 rounded-lg border border-ink/10 bg-mist p-4">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Fecha y horario del servicio</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label htmlFor="gate-fechaHoraProgramada" className="flex flex-col gap-1.5">
                  <span className="font-body text-sm font-medium">Fecha de recolección</span>
                  <input
                    id="gate-fechaHoraProgramada"
                    name="fechaHoraProgramada"
                    type="date"
                    value={datos.fechaHoraProgramada ? datos.fechaHoraProgramada.split("T")[0] : ""}
                    min={new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" })}
                    onChange={(e) => {
                      const fecha = e.target.value;
                      const horaActual = datos.fechaHoraProgramada ? (datos.fechaHoraProgramada.split("T")[1]?.slice(0, 5) ?? "09:00") : "09:00";
                      if (!fecha) actualizar("fechaHoraProgramada", "");
                      else actualizar("fechaHoraProgramada", `${fecha}T${horaActual}`);
                    }}
                    onBlur={() => validarCampo("fechaHoraProgramada")}
                    className={`rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm ${claseControl("fechaHoraProgramada")}`}
                    aria-invalid={Boolean(errores.fechaHoraProgramada)}
                    aria-describedby={errores.fechaHoraProgramada ? "gate-fecha-error" : undefined}
                  />
                </label>

                <div className="flex flex-col gap-1.5">
                  <span id="label-gate-slots-horario" className="font-body text-sm font-medium">Horario sugerido</span>
                  <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-labelledby="label-gate-slots-horario">
                    {SLOTS_HORARIOS.map((s) => {
                      const t = datos.fechaHoraProgramada ? (datos.fechaHoraProgramada.split("T")[1]?.slice(0, 5) ?? "") : "";
                      const seleccionado = s.id === "personalizado"
                        ? Boolean(t && !SLOTS_HORARIOS.some((slot) => slot.id !== "personalizado" && slot.hora === t))
                        : s.hora === t;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={seleccionado}
                          aria-label={s.etiqueta}
                          onClick={() => {
                            const fecha = datos.fechaHoraProgramada ? datos.fechaHoraProgramada.split("T")[0] : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
                            if (s.hora) actualizar("fechaHoraProgramada", `${fecha}T${s.hora}`);
                            else {
                              const h = t || "10:00";
                              actualizar("fechaHoraProgramada", `${fecha}T${h}`);
                            }
                            validarCampo("fechaHoraProgramada");
                          }}
                          className={[
                            "rounded-lg border px-2.5 py-2 text-left font-body text-xs font-semibold transition-all focus-visible:outline-route-dark",
                            seleccionado
                              ? "border-route bg-route-soft text-route-dark shadow-xs"
                              : "border-ink/20 bg-mist text-ink/75 hover:border-ink/40 hover:text-ink"
                          ].join(" ")}
                        >
                          {s.etiqueta.split("·")[0]}
                          <span className="block text-[10px] font-normal opacity-70">
                            {s.etiqueta.includes("·") ? s.etiqueta.split("·")[1] : "Hora exacta"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {(() => {
                const t = datos.fechaHoraProgramada ? (datos.fechaHoraProgramada.split("T")[1]?.slice(0, 5) ?? "") : "";
                const esPersonalizado = t && !SLOTS_HORARIOS.some((s) => s.id !== "personalizado" && s.hora === t);
                if (!esPersonalizado) return null;
                return (
                  <label htmlFor="gate-horaExactaProgramada" className="flex flex-col gap-1.5 mt-2">
                    <span className="font-body text-sm font-medium">Especificar hora exacta</span>
                    <input
                      id="gate-horaExactaProgramada"
                      type="time"
                      value={t}
                      onChange={(e) => {
                        const fecha = datos.fechaHoraProgramada ? datos.fechaHoraProgramada.split("T")[0] : new Date().toISOString().split("T")[0];
                        actualizar("fechaHoraProgramada", `${fecha}T${e.target.value}`);
                      }}
                      onBlur={() => validarCampo("fechaHoraProgramada")}
                      className="rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm focus-visible:outline-route-dark"
                    />
                  </label>
                );
              })()}

              <div className="flex items-center gap-2 rounded-lg border border-route/15 bg-route-soft/50 p-2.5 font-body text-xs text-ink/70">
                <span aria-hidden="true">🌐</span>
                <span>Zona horaria: <strong className="text-ink">America/Mexico_City (Centro de México)</strong> · Anticipación mínima de 2 horas.</span>
              </div>
              {errores.fechaHoraProgramada && <p id="gate-fecha-error" className="font-body text-xs text-danger">{errores.fechaHoraProgramada}</p>}
            </div>
          )}
        </div>
      </PassportCard>

      {/* Resultado de la Tarifa a pagar */}
      <section className="app-status-strip px-5 py-5" aria-labelledby="titulo-tarifa-gate">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p id="titulo-tarifa-gate" className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">
              Tarifa de tu traslado
            </p>
            {previsualizando && (
              <p className="mt-1 font-body text-sm text-ink/55">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-signal mr-2" aria-hidden />
                Calculando tarifa real…
              </p>
            )}
            {!previsualizando && previsualizacion?.disponible && (
              <>
                <p className="mt-1 font-display text-4xl font-bold leading-tight text-ink">
                  ${Number(previsualizacion.tarifa ?? 0).toLocaleString("es-MX")}{" "}
                  <span className="font-body text-sm font-semibold text-ink/55">MXN</span>
                </p>
                <p className="mt-2 max-w-sm font-body text-sm leading-6 text-ink/65">
                  Tarifa real de tu traslado. Puede tener un ajuste mínimo posible si la dirección exacta cambia el rango de distancia.
                </p>
              </>
            )}
            {!previsualizando && previsualizacion && !previsualizacion.disponible && (
              <p className="mt-1 max-w-sm font-body text-sm leading-6 text-ink/65">
                {previsualizacion.motivo ? previsualizacion.motivo.replace("Torre de Control", "nuestro equipo") : "Nuestro equipo aplicará la tarifa correspondiente antes de enviarte la cotización."}
              </p>
            )}
            {!previsualizando && !previsualizacion && (
              <p className="mt-1 max-w-sm font-body text-sm leading-6 text-ink/65">
                Completa el CP de origen y destino, vehículo y fecha para conocer tu tarifa antes de llenar el resto del formulario.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:items-end">
            <Button
              type="button"
              disabled={!previsualizacion || previsualizando}
              onClick={onContinuar}
            >
              Continuar con mi solicitud
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function areEqualPasoTarifa(prev: PasoTarifaProps, next: PasoTarifaProps) {
  return (
    prev.datos.origenCodigoPostal === next.datos.origenCodigoPostal &&
    prev.datos.destinoCodigoPostal === next.datos.destinoCodigoPostal &&
    prev.datos.marca === next.datos.marca &&
    prev.datos.modelo === next.datos.modelo &&
    prev.datos.condicion === next.datos.condicion &&
    prev.datos.modalidadProgramacion === next.datos.modalidadProgramacion &&
    prev.datos.fechaHoraProgramada === next.datos.fechaHoraProgramada &&
    prev.previsualizacion === next.previsualizacion &&
    prev.previsualizando === next.previsualizando &&
    prev.cpConsultando === next.cpConsultando &&
    prev.errores === next.errores
  );
}
export const PasoTarifa = memo(PasoTarifaComponent, areEqualPasoTarifa);
