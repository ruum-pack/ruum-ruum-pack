"use client";
import { Button, PassportCard, Aviso } from "@ruum/ui";
import { MENSAJES_CLAVE_UX, TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { PrevisualizacionTarifa } from "@ruum/api/services";
import { CONDICIONES_VEHICULO, VENTANAS_PREDEFINIDAS, formatearDistancia, formatearTiempo } from "../constants";
import type { DatosFormulario, MotivoServicioTraslado, TipoRutaTraslado, TipoServicioTraslado } from "../types";

export interface PasoDetallesProps {
  datos: DatosFormulario;
  actualizar: <K extends keyof DatosFormulario>(campo: K, valor: DatosFormulario[K]) => void;
  onEditarAgenda: () => void;
  previsualizacion: PrevisualizacionTarifa | null;
  previsualizando: boolean;
  momentoPago: { momento: "anticipado" | "al_cierre"; razon: string };
  categoriaCatalogo: string;
  gamaCatalogo: string;
  rutaEstimacion: {
    distanciaKm?: number;
    tiempoEstimadoHoras?: number;
  } | null;
  politicaCancelacion: { mensaje: string };
  aceptaPoliticasPagoCancelacion: boolean;
  setAceptaPoliticasPagoCancelacion: (valor: React.SetStateAction<boolean>) => void;
  enviarSolicitud: () => Promise<void>;
  enviando: boolean;
  cargandoSesion: boolean;
}

export function PasoDetalles({
  datos,
  actualizar,
  onEditarAgenda,
  previsualizacion,
  previsualizando,
  momentoPago,
  categoriaCatalogo,
  gamaCatalogo,
  rutaEstimacion,
  politicaCancelacion,
  aceptaPoliticasPagoCancelacion,
  setAceptaPoliticasPagoCancelacion,
  enviarSolicitud,
  enviando,
  cargandoSesion
}: PasoDetallesProps) {
  return (
    <div className="space-y-4">
      <PassportCard>
        <div className="grid gap-4">
          {/* Agenda aceptada: visible como resumen de solo lectura */}
          <div className="rounded-xl border border-ink/15 bg-mist p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Fecha y horario de recolección</p>
                <p className="mt-1 font-body text-sm font-bold text-ink">
                  {datos.modalidadProgramacion === "lo_antes_posible"
                    ? "⚡ Lo antes posible"
                    : `📅 ${datos.fechaHoraProgramada ? datos.fechaHoraProgramada.replace("T", " ") : "Programado"}`}
                </p>
              </div>
              <button
                type="button"
                onClick={onEditarAgenda}
                className="rounded-lg border border-ink/20 bg-paper px-3 py-1.5 font-body text-xs font-semibold text-ink shadow-xs transition hover:bg-mist"
              >
                Editar
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium">Tipo de traslado</span>
            <select
              id="tipoRuta"
              name="tipoRuta"
              value={datos.tipoRuta}
              onChange={(e) => actualizar("tipoRuta", e.target.value as TipoRutaTraslado)}
              className="rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm"
            >
              <option value="local">Local</option>
              <option value="foraneo">Foráneo</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium">Ventana de recolección</span>
            <select
              value={VENTANAS_PREDEFINIDAS.includes(datos.ventanaRecoleccion as never) ? datos.ventanaRecoleccion : datos.ventanaRecoleccion ? "Otra (especificar)" : "Flexible (sin preferencia)"}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "Otra (especificar)") actualizar("ventanaRecoleccion", "Otra: ");
                else actualizar("ventanaRecoleccion", v);
              }}
              className="rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm"
            >
              {VENTANAS_PREDEFINIDAS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            {(() => {
              const sel = VENTANAS_PREDEFINIDAS.includes(datos.ventanaRecoleccion as never) ? datos.ventanaRecoleccion : datos.ventanaRecoleccion ? "Otra (especificar)" : "Flexible (sin preferencia)";
              if (sel !== "Otra (especificar)") return null;
              const valorCustom = VENTANAS_PREDEFINIDAS.includes(datos.ventanaRecoleccion as never) ? "" : datos.ventanaRecoleccion.replace(/^Otra:\s*/, "");
              return (
                <input
                  placeholder="Ej. 09:00 a 12:00 o indicación específica"
                  value={valorCustom}
                  onChange={(e) => actualizar("ventanaRecoleccion", `Otra: ${e.target.value}`)}
                  className="mt-2 rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm"
                />
              );
            })()}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium">Ventana de entrega</span>
            <select
              value={VENTANAS_PREDEFINIDAS.includes(datos.ventanaEntrega as never) ? datos.ventanaEntrega : datos.ventanaEntrega ? "Otra (especificar)" : "Flexible (sin preferencia)"}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "Otra (especificar)") actualizar("ventanaEntrega", "Otra: ");
                else actualizar("ventanaEntrega", v);
              }}
              className="rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm"
            >
              {VENTANAS_PREDEFINIDAS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            {(() => {
              const sel = VENTANAS_PREDEFINIDAS.includes(datos.ventanaEntrega as never) ? datos.ventanaEntrega : datos.ventanaEntrega ? "Otra (especificar)" : "Flexible (sin preferencia)";
              if (sel !== "Otra (especificar)") return null;
              const valorCustom = VENTANAS_PREDEFINIDAS.includes(datos.ventanaEntrega as never) ? "" : datos.ventanaEntrega.replace(/^Otra:\s*/, "");
              return (
                <input
                  placeholder="Ej. Mismo día por la tarde"
                  value={valorCustom}
                  onChange={(e) => actualizar("ventanaEntrega", `Otra: ${e.target.value}`)}
                  className="mt-2 rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm"
                />
              );
            })()}
          </label>
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
                {previsualizacion.motivo ? previsualizacion.motivo.replace("Torre de Control", "nuestro equipo") : "Nuestro equipo aplicará la tarifa correspondiente antes de enviarte la cotización."}
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
            <p className="mt-2 flex flex-wrap items-center gap-2 font-body text-xs text-ink/45">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700">✓ Conductores certificados</span>
              <span>★ 4.8/5 · +2,340 traslados verificados este mes</span>
              <span className="rounded-full bg-mist border border-ink/10 px-2 py-0.5">🔒 Pago seguro Stripe</span>
            </p>
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
            <p className="text-center font-body text-xs leading-4 text-ink/40">Visa · Mastercard · Amex · SPEI · 3-D Secure</p>
          </div>
        </div>
      </section>
    </div>
  );
}
