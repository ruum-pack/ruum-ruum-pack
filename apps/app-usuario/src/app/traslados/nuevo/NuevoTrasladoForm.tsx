"use client";
import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Button, Aviso } from "@ruum/ui";
import { NavegacionUsuario } from "../../NavegacionUsuario";
import { PASOS } from "./constants";
import { formatearTiempoRelativoBorrador } from "../../../lib/borrador-traslado";
import { useNuevoTraslado } from "./hooks/useNuevoTraslado";

import { EstadoCreacion } from "./components/EstadoCreacion";
import { PasoTarifa } from "./components/PasoTarifa";
import { PasoVehiculo } from "./components/PasoVehiculo";
import { PasoRuta } from "./components/PasoRuta";
import { PasoDetalles } from "./components/PasoDetalles";
import { PasoPago } from "./components/PasoPago";

export function NuevoTrasladoForm() {
  const t = useNuevoTraslado();
  const encabezadoPasoRef = useRef<HTMLHeadingElement>(null);
  const { setPaso, setResultado } = t;
  const volverPasoInicial = useCallback(() => setPaso(0), [setPaso]);
  const cerrarResultado = useCallback(() => setResultado(null), [setResultado]);

  useEffect(() => {
    encabezadoPasoRef.current?.focus();
  }, [t.paso]);

  if (t.resultado) {
    return <EstadoCreacion resultado={t.resultado} volver={cerrarResultado} />;
  }

  if (t.bloqueoVerificacion) {
    return (
      <main className="user-v2-scope user-v2-page user-v2-secondary-screen">
        <NavegacionUsuario variante="claro" />
        <div className="mx-auto max-w-xl px-6 py-12">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Verificación requerida</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">Antes de solicitar un traslado</h1>
          <div className="mt-5">
            <Aviso tono="atencion">{t.bloqueoVerificacion}</Aviso>
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
    <main className="user-v2-scope user-v2-page user-v2-secondary-screen">
      <NavegacionUsuario variante="claro" />
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-6 sm:py-12">
        <h1 className="font-display text-2xl sm:text-3xl font-black text-text-primary">Nuevo traslado</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 font-body text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-signal/15 px-3 py-1 font-semibold text-ink border border-signal/30">⏱ Te tomará ~3 min</span>
          {t.estadoGuardado === "guardando" ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-amber-900 font-medium animate-pulse"
              role="status"
              aria-live="polite"
            >
              <span className="inline-block size-1.5 rounded-full bg-amber-500 animate-ping" />
              💾 Guardando cambios…
            </span>
          ) : t.estadoGuardado === "guardado" ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-emerald-800 font-medium transition-all"
              role="status"
              aria-live="polite"
            >
              <span className="font-bold text-emerald-600">✓</span> Guardado {t.tiempoUltimoGuardado ? formatearTiempoRelativoBorrador(t.tiempoUltimoGuardado) : "automático"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-border px-3 py-1 text-text-secondary">
              💾 Guardado automático
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-route-soft border border-route/20 px-3 py-1 text-route-dark">🔒 Pago seguro con Stripe</span>
        </div>


        <div className="mt-4 p-3.5 rounded-xl border border-[#FFC400]/30 bg-[#FFC400]/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="text-lg" aria-hidden="true">📁</span>
            <div>
              <p className="font-bold text-text-primary">¿Tienes varios vehículos?</p>
              <p className="text-[#8E9CAE] text-[11px]">Crea hasta 100 traslados a la vez con un archivo CSV</p>
            </div>
          </div>
          <Link
            href="/traslados/masivo"
            className="text-xs font-bold text-[#FFC400] hover:text-[#e6b000] whitespace-nowrap underline transition"
          >
            Carga masiva CSV →
          </Link>
        </div>

        {/* Slim sticky progress visible en móvil al hacer scroll */}
        <div className="sticky top-0 z-10 -mx-4 mt-4 h-1 bg-surface-elevated sm:hidden" aria-hidden>
          <div className="h-full bg-signal transition-all duration-300" style={{ width: `${((t.paso + 1) / PASOS.length) * 100}%` }} />
        </div>

        {t.borradorDisponible && (
          <div className="mt-4 rounded-xl border border-route-action/30 bg-route-action/10 p-4" role="region" aria-label="Borrador pendiente">
            <p className="font-body text-sm font-semibold text-text-primary">Encontramos una solicitud sin terminar</p>
            <p className="mt-1 font-body text-xs leading-5 text-text-secondary">
              Guardada <strong>{formatearTiempoRelativoBorrador(t.borradorDisponible.guardadoEn)}</strong> ({new Date(t.borradorDisponible.guardadoEn).toLocaleString("es-MX")}).
              Vigencia de 24 horas. Ten en cuenta que los precios y la disponibilidad de conductores pueden haber cambiado.
            </p>
            <p className="mt-1 font-body text-[11px] text-text-secondary/70">
              Por seguridad no guardamos domicilio exacto, teléfonos de contacto, VIN, placas ni instrucciones especiales.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={t.restaurarBorrador}>Continuar donde iba</Button>
              <Button type="button" variant="quiet" onClick={t.descartarBorrador}>Empezar de cero</Button>
            </div>
          </div>
        )}


        {/* Stepper móvil y de escritorio */}
        <div className="mt-6" aria-label={`Paso ${t.paso + 1} de ${PASOS.length} — ${PASOS[t.paso]}`}>
          <div className="flex items-center justify-between text-xs font-bold font-display uppercase tracking-wider text-text-tertiary">
            <span>Paso {t.paso + 1} de {PASOS.length}</span>
            <span className="text-signal font-extrabold">{PASOS[t.paso]}</span>
          </div>

          <div className="mt-2 grid grid-cols-5 gap-1.5 sm:hidden">
            {PASOS.map((_, i) => (
              <div
                key={i}
                className={[
                  "h-1.5 rounded-full transition-all duration-300",
                  i <= t.paso ? "bg-signal" : "bg-surface-elevated border border-border/40"
                ].join(" ")}
              />
            ))}
          </div>

          <ol className="mt-3 hidden sm:flex items-center gap-2">
            {PASOS.map((etiqueta, i) => (
              <li key={etiqueta} className="flex items-center gap-2">
                <span
                  className={[
                    "flex size-7 items-center justify-center rounded-full font-mono-ruum text-xs font-bold",
                    i === t.paso
                      ? "bg-signal text-slate-950 shadow-xs"
                      : i < t.paso
                        ? "bg-control/20 text-control border border-control/40"
                        : "bg-surface-elevated text-text-tertiary border border-border"
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className={i === t.paso ? "font-body text-xs font-bold text-text-primary" : "font-body text-xs text-text-tertiary"}>
                  {etiqueta}
                </span>
                {i < PASOS.length - 1 && <span className="text-border mx-1" aria-hidden>›</span>}
              </li>
            ))}
          </ol>
        </div>

        {/* Aviso de tarifa desactualizada si se editó algún campo relevante */}
        {!t.tarifaPreviaAceptada && t.tarifaPreviaSnapshot && t.paso > 0 && (
          <div className="mt-4" role="status" aria-live="polite">
            <Aviso tono="atencion">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>Tu tarifa puede haber cambiado. Confírmala antes de continuar.</span>
                <Button type="button" variant="secondary" onClick={volverPasoInicial}>
                  Confirmar tarifa
                </Button>
              </div>
            </Aviso>
          </div>
        )}

        {/* Anuncio de paso actual para lectores de pantalla + gestión de foco */}
        <h2
          ref={encabezadoPasoRef}
          tabIndex={-1}
          className="sr-only"
          aria-live="polite"
        >
          Paso {t.paso + 1} de {PASOS.length}: {PASOS[t.paso]}
        </h2>

        {/* Pasos */}
        <div className="mt-6">
          {t.paso === 0 && (
            <PasoTarifa
              datos={t.datos}
              errores={t.errores}
              claseControl={t.claseControl}
              actualizar={t.actualizar}
              actualizarCodigoPostal={t.actualizarCodigoPostal}
              actualizarMarcaCatalogo={t.actualizarMarcaCatalogo}
              actualizarModeloCatalogo={t.actualizarModeloCatalogo}
              validarCampo={t.validarCampo}
              cpConsultando={t.cpConsultando}
              modelosDisponibles={t.modelosDisponibles}
              previsualizacion={t.previsualizacion}
              previsualizando={t.previsualizando}
              onContinuar={t.aceptarTarifaYContinuar}
            />
          )}

          {t.paso === 1 && (
            <PasoVehiculo
              datos={t.datos}
              errores={t.errores}
              claseControl={t.claseControl}
              actualizar={t.actualizar}
              actualizarMarcaCatalogo={t.actualizarMarcaCatalogo}
              actualizarModeloCatalogo={t.actualizarModeloCatalogo}
              validarCampo={t.validarCampo}
              vehiculosGuardados={t.vehiculosGuardados}
              vehiculoSeleccionadoId={t.vehiculoSeleccionadoId}
              aplicarVehiculoGuardado={t.aplicarVehiculoGuardado}
              limpiarVehiculoGuardado={t.limpiarVehiculoGuardado}
              categoriaCatalogo={t.categoriaCatalogo}
              gamaCatalogo={t.gamaCatalogo}
              modelosDisponibles={t.modelosDisponibles}
              clasificacionCatalogo={t.clasificacionCatalogo}
              previsualizacion={t.previsualizacion}
              onEditarTarifa={volverPasoInicial}
              detallesVehiculoExpandido={t.detallesVehiculoExpandido}
              setDetallesVehiculoExpandido={t.setDetallesVehiculoExpandido}
              tarifaPreviaAceptada={t.tarifaPreviaAceptada}
            />
          )}


          {t.paso === 2 && (
            <PasoRuta
              datos={t.datos}
              errores={t.errores}
              claseControl={t.claseControl}
              actualizar={t.actualizar}
              actualizarTelefono={t.actualizarTelefono}
              actualizarCodigoPostal={t.actualizarCodigoPostal}
              consultarCodigoPostal={t.consultarCodigoPostal}
              validarCampo={t.validarCampo}
              aplicarSugerenciaCp={t.aplicarSugerenciaCp}
              aplicarSugerenciaDireccion={t.aplicarSugerenciaDireccion}
              cpConsultando={t.cpConsultando}
              cpAviso={t.cpAviso}
              cpOpciones={t.cpOpciones}
              placesOpciones={t.placesOpciones}
              origenBusqueda={t.origenBusqueda}
              setOrigenBusqueda={t.setOrigenBusqueda}
              destinoBusqueda={t.destinoBusqueda}
              setDestinoBusqueda={t.setDestinoBusqueda}
              origenSugerencias={t.origenSugerencias}
              destinoSugerencias={t.destinoSugerencias}
              buscandoOrigen={t.buscandoOrigen}
              buscandoDestino={t.buscandoDestino}
              rutaEstimacion={t.rutaEstimacion}
              rutaCalculando={t.rutaCalculando}
              rutaAviso={t.rutaAviso}
              onReintentarRuta={t.reintentarRuta}
              onParadasChange={t.actualizarParadas}
              erroresParadas={t.erroresParadas}
            />
          )}

          {t.paso === 3 && (
            <PasoDetalles
              datos={t.datos}
              actualizar={t.actualizar}
              onEditarAgenda={volverPasoInicial}
              previsualizacion={t.previsualizacion}
              previsualizando={t.previsualizando}
              momentoPago={t.momentoPago}
              categoriaCatalogo={t.categoriaCatalogo}
              gamaCatalogo={t.gamaCatalogo}
              rutaEstimacion={t.rutaEstimacion}
              politicaCancelacion={t.politicaCancelacion}
              aceptaPoliticasPagoCancelacion={t.aceptaPoliticasPagoCancelacion}
              setAceptaPoliticasPagoCancelacion={t.setAceptaPoliticasPagoCancelacion}
              enviarSolicitud={t.enviarSolicitud}
              enviando={t.enviando}
              cargandoSesion={t.cargandoSesion}
              tarifaPreviaAceptada={t.tarifaPreviaAceptada}
              onRevisarTarifa={volverPasoInicial}
            />
          )}


          {t.paso === 4 && t.trasladoCreado && (
            <PasoPago
              trasladoCreado={t.trasladoCreado}
              pagoConfirmado={t.pagoConfirmado}
              setPagoConfirmado={t.setPagoConfirmado}
              errorAceptacion={t.errorAceptacion}
              onReintentarAceptacion={t.reintentarAceptacion}
              aceptandoCotizacion={t.aceptandoCotizacion}
              cotizacionAceptada={t.cotizacionAceptada}
            />
          )}
        </div>

        {t.errorPaso && (
          <div className="mt-6" role="status" aria-live="polite">
            <Aviso tono="danger">{t.errorPaso}</Aviso>
          </div>
        )}

        {t.paso > 0 && t.paso < 4 && (
          <div className="mt-8 flex justify-between">
            <Button variant="secondary" onClick={t.retrocederPaso}>
              ← Atrás
            </Button>
            {t.paso < 3 ? (
              <Button onClick={t.avanzarPaso}>
                Continuar
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
