"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso, Button, Card, DriverEarning, FinancialAmount, FinancialCard } from "@ruum/ui";
import type { EstadoEconomicoExplicito } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { obtenerConductorActual, obtenerGananciasConductor, type TrasladoConductorGanancia } from "@ruum/api/services";

type Payout = Database["public"]["Tables"]["payouts_conductor"]["Row"];
type DatosBancarios = Database["public"]["Tables"]["datos_bancarios_conductor"]["Row"];

interface RegistroViajeGanancia {
  id: string;
  fecha: string;
  vehiculo: string;
  origen: string;
  destino: string;
  montoGanado: number;
  gastosAutorizados: number;
  estatusEconomico: EstadoEconomicoExplicito;
  liberacion: string;
  payoutId?: string | null;
}

function estatusPayout(payout: Payout): EstadoEconomicoExplicito {
  if (payout.estado === "procesado") return "pagado";
  if (payout.estado === "pendiente") return "programado";
  return "rechazado";
}

function estatusViaje(traslado: TrasladoConductorGanancia, payoutEnlazado?: Payout | null): EstadoEconomicoExplicito {
  if (payoutEnlazado) return estatusPayout(payoutEnlazado);
  if (traslado.estado === "servicio_cerrado") return "confirmado";
  if (traslado.estado === "entrega_confirmada") return "en_validacion";
  if (
    traslado.estado === "traslado_en_curso" ||
    traslado.estado === "conductor_asignado" ||
    traslado.estado === "conductor_en_camino_al_origen" ||
    traslado.estado === "conductor_en_punto_de_recoleccion"
  ) {
    return "estimado";
  }
  if (traslado.estado === "servicio_cancelado" || traslado.estado === "traslado_fallido") return "rechazado";
  return "sin_calcular";
}

function etiquetaEstadoUnica(estatus: EstadoEconomicoExplicito): { texto: string; clase: string } {
  switch (estatus) {
    case "pagado":
      return { texto: "💳 Pago Transferido", clase: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
    case "programado":
      return { texto: "🗓️ Depósito Programado", clase: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" };
    case "confirmado":
      return { texto: "✓ Viaje Concluido", clase: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
    case "en_validacion":
      return { texto: "🔍 En Validación", clase: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" };
    case "estimado":
      return { texto: "⏳ En Curso / Estimado", clase: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400" };
    case "rechazado":
    case "retenido":
      return { texto: "⚠️ En Revisión / Retenido", clase: "border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-400" };
    default:
      return { texto: "Sin calcular", clase: "border-border bg-surface-elevated text-text-tertiary" };
  }
}

function formatearFecha(fechaIso: string) {
  if (!fechaIso || !fechaIso.includes("-")) return fechaIso || "—";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeZone: "America/Mexico_City"
    }).format(new Date(fechaIso.length === 10 ? `${fechaIso}T12:00:00-06:00` : fechaIso));
  } catch {
    return fechaIso;
  }
}

export default function PaginaGanancias() {
  const [datosBancarios, setDatosBancarios] = useState<DatosBancarios | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [traslados, setTraslados] = useState<TrasladoConductorGanancia[]>([]);
  const [vistaActiva, setVistaActiva] = useState<"viajes" | "payouts">("viajes");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setError("Supabase no está configurado. No se pueden consultar ganancias reales.");
        setCargando(false);
        return;
      }
      try {
        const cliente = crearClienteNavegador();
        const conductor = await obtenerConductorActual(cliente);
        if (!conductor) {
          setCargando(false);
          return;
        }

        const datos = await obtenerGananciasConductor(cliente, conductor.id);
        setDatosBancarios(datos.datosBancarios);
        setPayouts(datos.payouts);
        setTraslados(datos.traslados);
      } catch (err) {
        setError(traducirErrorOperativo(err, "No pudimos cargar tus ganancias."));
      } finally {
        setCargando(false);
      }
    }
    void cargar();
  }, []);

  const mapaPayouts = useMemo(() => {
    const mapa = new Map<string, Payout>();
    payouts.forEach((p) => mapa.set(p.id, p));
    return mapa;
  }, [payouts]);

  const registrosViajes = useMemo<RegistroViajeGanancia[]>(() => {
    return traslados.map((t) => {
      const payoutEnlazado = t.payout_id ? mapaPayouts.get(t.payout_id) : null;
      const vehiculoNombre = t.vehiculos
        ? `${t.vehiculos.marca} ${t.vehiculos.modelo} ${t.vehiculos.anio}`
        : "Vehículo trasladado";
      const montoEstimadoOGanado = Number(
        t.ganancia_conductor_congelada ?? ((t.precio_final ?? t.precio_cotizado ?? 0) * 0.85)
      );

      return {
        id: t.id,
        fecha: t.cerrado_en ?? t.actualizado_en ?? t.creado_en,
        vehiculo: vehiculoNombre,
        origen: t.origen_ciudad,
        destino: t.destino_ciudad,
        montoGanado: montoEstimadoOGanado,
        gastosAutorizados: 0,
        estatusEconomico: estatusViaje(t, payoutEnlazado),
        liberacion: payoutEnlazado?.procesado_en ? payoutEnlazado.procesado_en.slice(0, 10) : "Pendiente de corte",
        payoutId: t.payout_id
      };
    });
  }, [traslados, mapaPayouts]);

  const resumen = useMemo(() => {
    const gananciasBrutas = registrosViajes.reduce((tot, v) => tot + v.montoGanado, 0);
    const gastosAutorizados = registrosViajes.reduce((tot, v) => tot + v.gastosAutorizados, 0);
    const retenciones = registrosViajes
      .filter((v) => v.estatusEconomico === "rechazado" || v.estatusEconomico === "retenido")
      .reduce((tot, v) => tot + v.montoGanado, 0);
    const depositoFinal = Math.max(0, gananciasBrutas - gastosAutorizados - retenciones);

    return {
      totalViajes: registrosViajes.length,
      gananciasBrutas,
      gastosAutorizados,
      retenciones,
      depositoFinal
    };
  }, [registrosViajes]);

  const ultimoPayout = payouts[0] ?? null;
  const tieneDatosBancarios = Boolean(datosBancarios?.clabe || datosBancarios?.numero_tarjeta);
  const sinViajesNiPayouts = !cargando && traslados.length === 0 && payouts.length === 0 && !error;
  const tieneContenido = !cargando && (traslados.length > 0 || payouts.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:px-6 sm:py-12 sm:pb-12">
      {/* Encabezado con Información Bancaria Agrupada y Botón Simplificado */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/panel" className="font-body text-xs text-text-tertiary hover:underline">
              ← Volver al Panel
            </Link>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-text-primary">Mis ganancias y pagos</h1>
          <p className="mt-1 font-body text-sm text-text-tertiary">
            Consulta las ganancias reales generadas por tus traslados y el estado de tus depósitos bancarios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {datosBancarios && (
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-surface-elevated px-3 py-2 font-body text-xs text-text-tertiary">
              <span>🏦 Cuenta de Depósito:</span>
              <strong className="text-text-primary font-semibold">{datosBancarios.banco} ({datosBancarios.clabe.slice(-4)})</strong>
            </span>
          )}
          <Link href="/cuenta/datos-bancarios">
            <Button variant="secondary" className="text-xs">
              💳 Datos Bancarios
            </Button>
          </Link>
          <Link href="/viajes">
            <Button className="text-xs">🚘 Buscar Traslados</Button>
          </Link>
        </div>
      </header>

      {/* Alertas */}
      {error && (
        <div className="mt-6">
          <Aviso tono="danger">{error}</Aviso>
        </div>
      )}

      {!cargando && !tieneDatosBancarios && (
        <div className="mt-6">
          <Aviso tono="atencion">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-amber-600 dark:text-amber-400">⚠️ No tienes una cuenta bancaria registrada</p>
                <p className="text-xs text-text-primary mt-0.5">
                  Registra tu CLABE o número de tarjeta para poder recibir la transferencia semanal de tus ganancias.
                </p>
              </div>
              <Link href="/cuenta/datos-bancarios" className="shrink-0">
                <Button variant="secondary" className="text-xs">
                  Configurar cuenta CLABE
                </Button>
              </Link>
            </div>
          </Aviso>
        </div>
      )}

      {/* Cargando */}
      {cargando && (
        <FinancialCard className="mt-6" padding="lg">
          <p className="font-body text-sm font-semibold text-text-secondary">Cargando expediente de ganancias...</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="h-20 animate-pulse rounded-xl bg-surface-elevated" />
            <div className="h-20 animate-pulse rounded-xl bg-surface-elevated" />
            <div className="h-20 animate-pulse rounded-xl bg-surface-elevated" />
            <div className="h-20 animate-pulse rounded-xl bg-surface-elevated" />
          </div>
        </FinancialCard>
      )}

      {/* Estado vacío */}
      {sinViajesNiPayouts && (
        <FinancialCard className="mt-6 border-route-action/35 bg-surface-elevated" padding="lg">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full border border-signal/40 bg-signal/10 font-display text-2xl text-signal" aria-hidden>
              💵
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold text-text-primary">Aún no hay ganancias registradas</h2>
            <p className="mt-2 font-body text-sm leading-6 text-text-tertiary">
              Completa tu primer traslado para comenzar a acumular ganancias. Al finalizar cada viaje, verás aquí el desglose detallado y el estatus de tu depósito bancario.
            </p>
            <Link href="/viajes" className="mt-5">
              <Button>🚘 Buscar Traslados</Button>
            </Link>
          </div>
        </FinancialCard>
      )}

      {/* Contenido Principal con Datos Reales */}
      {tieneContenido && (
        <>
          {/* Métricas Generales con Diseño de Estructura Vertical Unificada */}
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="flex flex-col justify-between p-4">
              <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">Vehículos Trasladados</p>
              <div className="mt-2">
                <p className="font-display text-2xl font-bold text-text-primary">{resumen.totalViajes}</p>
                <p className="font-body text-[11px] font-semibold text-text-tertiary">viajes concluidos</p>
              </div>
            </Card>

            <FinancialCard className="flex flex-col justify-between p-4">
              <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">Ganancias Brutas</p>
              <DriverEarning
                amount={resumen.gananciasBrutas}
                status={resumen.totalViajes > 0 ? "confirmado" : "sin_calcular"}
                currency="MXN"
                className="mt-2"
                amountClassName="font-display text-2xl font-bold"
              />
            </FinancialCard>

            <FinancialCard className="flex flex-col justify-between p-4">
              <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">Gastos Autorizados</p>
              <FinancialAmount
                amount={resumen.gastosAutorizados}
                status="confirmado"
                currency="MXN"
                className="mt-2"
                amountClassName="font-display text-2xl font-bold"
              />
            </FinancialCard>

            <FinancialCard className="border-signal/40 bg-signal/5 flex flex-col justify-between p-4">
              <p className="font-body text-xs font-bold uppercase tracking-wider text-signal">Depósito Acumulado Net</p>
              <FinancialAmount
                amount={resumen.depositoFinal}
                status={ultimoPayout ? estatusPayout(ultimoPayout) : "confirmado"}
                currency="MXN"
                className="mt-2"
                amountClassName="font-display text-2xl font-extrabold text-signal"
              />
            </FinancialCard>
          </section>

          {/* Pestañas de Vista - scroll horizontal en móvil */}
          <div className="mt-8 flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setVistaActiva("viajes")}
              className={[
                "shrink-0 rounded-xl px-4 py-2.5 font-display text-xs font-bold transition min-h-11",
                vistaActiva === "viajes"
                  ? "bg-signal text-slate-950 shadow-xs"
                  : "border border-border bg-surface text-text-tertiary hover:border-signal/60 hover:text-text-primary"
              ].join(" ")}
            >
              🚘 Desglose por Viaje ({registrosViajes.length})
            </button>
            <button
              type="button"
              onClick={() => setVistaActiva("payouts")}
              className={[
                "shrink-0 rounded-xl px-4 py-2.5 font-display text-xs font-bold transition min-h-11",
                vistaActiva === "payouts"
                  ? "bg-signal text-slate-950 shadow-xs"
                  : "border border-border bg-surface text-text-tertiary hover:border-signal/60 hover:text-text-primary"
              ].join(" ")}
            >
              🏦 Depósitos ({payouts.length})
            </button>
          </div>

          {/* Vista 1: Desglose por Viaje Realizado (Con Affordance, Alto Contraste y Badges Sin Duplicidad) */}
          {vistaActiva === "viajes" && (
            <section className="mt-4 grid gap-3" aria-label="Desglose por viaje realizado">
              {registrosViajes.length === 0 ? (
                <div className="rounded-2xl border border-border bg-surface p-8 text-center font-body text-sm text-text-tertiary">
                  No hay viajes asignados a tu cuenta en este momento.
                </div>
              ) : (
                registrosViajes.map((viaje) => {
                  const badgeEstado = etiquetaEstadoUnica(viaje.estatusEconomico);

                  return (
                    <Link
                      key={viaje.id}
                      href={`/viajes/${viaje.id}`}
                      className="group block rounded-2xl border border-border bg-surface p-4 transition-all duration-150 hover:border-signal hover:bg-surface-elevated active:scale-[0.99]"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        {/* Vehículo, Origen/Destino de Alto Contraste y Fecha */}
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-elevated font-display text-xl text-route-action shadow-2xs group-hover:border-signal group-hover:bg-signal/10 transition">
                            🚘
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-display text-base font-bold text-text-primary truncate">
                              {viaje.vehiculo}
                            </h3>
                            {/* Ruta en Alto Contraste y Mayor Peso */}
                            <p className="mt-1 font-body text-xs font-semibold text-text-primary flex items-center gap-1.5 flex-wrap">
                              <span>{viaje.origen}</span>
                              <span className="text-signal font-bold">➔</span>
                              <span>{viaje.destino}</span>
                              <span className="text-text-tertiary font-normal">•</span>
                              <span className="text-text-tertiary font-normal">{formatearFecha(viaje.fecha)}</span>
                            </p>
                          </div>
                        </div>

                        {/* Ganancia y Única Etiqueta Consolidada sin Duplicaciones + Affordance */}
                        <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 border-t border-border/40 sm:border-t-0 pt-3 sm:pt-0">
                          <div className="text-left sm:text-right">
                            <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">
                              Ganancia Conductor
                            </p>
                            <p className="font-display text-base font-bold text-emerald-500 dark:text-emerald-400 mt-0.5">
                              ${viaje.montoGanado.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                            </p>
                          </div>

                          <span className={`inline-flex items-center rounded-full border px-3 py-1.5 font-body text-xs font-bold shrink-0 ${badgeEstado.clase}`}>
                            {badgeEstado.texto}
                          </span>

                          {/* Affordance de Acción (Flecha Direccional) */}
                          <div className="flex items-center gap-1 font-display text-xs font-bold text-route-action group-hover:text-signal group-hover:translate-x-1 transition-all">
                            <span className="hidden md:inline">Ver detalle</span>
                            <span className="text-base">→</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </section>
          )}

          {/* Vista 2: Depósitos y Payouts Semanales */}
          {vistaActiva === "payouts" && (
            <section className="mt-4 grid gap-4" aria-label="Historial de depósitos semanales">
              {payouts.length === 0 ? (
                <div className="rounded-2xl border border-border bg-surface p-8 text-center font-body text-sm text-text-tertiary">
                  Aún no se han generado cortes semanales de pago en tu cuenta. Los pagos se procesan al cierre de cada periodo operativo.
                </div>
              ) : (
                payouts.map((payout) => (
                  <FinancialCard key={payout.id} className="p-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
                        <div>
                          <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">
                            Periodo Operativo
                          </p>
                          <h3 className="font-display text-base font-bold text-text-primary">
                            {formatearFecha(payout.periodo_inicio)} ➔ {formatearFecha(payout.periodo_fin)}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-body text-xs font-semibold text-text-tertiary">
                            {payout.referencia_pago ? `SPEI: ${payout.referencia_pago}` : "Depósito SPEI"}
                          </span>
                          <FinancialAmount amount={null} status={estatusPayout(payout)} currency="MXN" />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 font-body text-xs">
                        <div className="rounded-xl border border-border/40 bg-surface-elevated p-3">
                          <p className="text-text-tertiary font-semibold uppercase">Monto Bruto</p>
                          <p className="mt-1 font-display text-sm font-bold text-text-primary">
                            ${Number(payout.monto_bruto ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                          </p>
                        </div>

                        <div className="rounded-xl border border-border/40 bg-surface-elevated p-3">
                          <p className="text-text-tertiary font-semibold uppercase">Ajustes / Retenciones</p>
                          <p className="mt-1 font-display text-sm font-bold text-text-primary">
                            ${Number(payout.ajustes ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                          </p>
                        </div>

                        <div className="rounded-xl border border-signal/40 bg-signal/10 p-3">
                          <p className="text-signal font-bold uppercase">Monto Neto Transferido</p>
                          <p className="mt-1 font-display text-sm font-extrabold text-signal">
                            ${Number(payout.monto_neto ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                          </p>
                        </div>
                      </div>
                    </div>
                  </FinancialCard>
                ))
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
