"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso, Button, Card, FinancialAmount, FinancialCard } from "@ruum/ui";
import type { EstadoEconomicoExplicito } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { obtenerConductorActual, obtenerGananciasConductor, type TrasladoConductorGanancia } from "@ruum/api/services";
import { PanelSupportSheet } from "../panel/PanelSupportSheet";

type Payout = Database["public"]["Tables"]["payouts_conductor"]["Row"];
type DatosBancarios = Database["public"]["Tables"]["datos_bancarios_conductor"]["Row"];

type PeriodoActivo = "semana" | "mes" | "anio";

interface RegistroViajeGanancia {
  id: string;
  fecha: string;
  fechaDate: Date;
  vehiculo: string;
  origen: string;
  destino: string;
  montoGanado: number;
  precioBase: number;
  comisionRuum: number;
  gastosAutorizados: number;
  bonos: number;
  ajuste: number;
  estatusEconomico: EstadoEconomicoExplicito;
  liberacion: string;
  payoutId?: string | null;
  estadoTraslado: string;
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

function formatearFechaCorta(fechaIso: string) {
  if (!fechaIso || !fechaIso.includes("-")) return fechaIso || "—";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      timeZone: "America/Mexico_City"
    }).format(new Date(fechaIso.length === 10 ? `${fechaIso}T12:00:00-06:00` : fechaIso));
  } catch {
    return fechaIso;
  }
}

function formatearMoneda(valor: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(valor);
}

function toDateSafe(fechaIso: string | null | undefined): Date | null {
  if (!fechaIso) return null;
  const d = new Date(fechaIso.length === 10 ? `${fechaIso}T12:00:00-06:00` : fechaIso);
  return isNaN(d.getTime()) ? null : d;
}

// Helpers de periodo — semana inicia Domingo termina Sábado (America/Mexico_City lógica sobre fecha local)
function inicioDeSemana(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(12, 0, 0, 0);
  const dia = d.getDay(); // 0 Domingo
  d.setDate(d.getDate() - dia);
  d.setHours(0, 0, 0, 0);
  return d;
}
function finDeSemana(fecha: Date): Date {
  const inicio = inicioDeSemana(fecha);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);
  fin.setHours(23, 59, 59, 999);
  return fin;
}
function inicioDeMes(fecha: Date): Date {
  const d = new Date(fecha);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function finDeMes(fecha: Date): Date {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}
function inicioDeAnio(fecha: Date): Date {
  const d = new Date(fecha);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function finDeAnio(fecha: Date): Date {
  const d = new Date(fecha);
  d.setMonth(11, 31);
  d.setHours(23, 59, 59, 999);
  return d;
}

function obtenerRangoPeriodo(periodo: PeriodoActivo, referencia: Date, offset: number) {
  const base = new Date(referencia);
  if (periodo === "semana") {
    base.setDate(base.getDate() + offset * 7);
    return { inicio: inicioDeSemana(base), fin: finDeSemana(base) };
  }
  if (periodo === "mes") {
    base.setMonth(base.getMonth() + offset);
    return { inicio: inicioDeMes(base), fin: finDeMes(base) };
  }
  base.setFullYear(base.getFullYear() + offset);
  return { inicio: inicioDeAnio(base), fin: finDeAnio(base) };
}

function formatearRango(periodo: PeriodoActivo, inicio: Date, fin: Date) {
  const fmt = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City" });
  const fmtMes = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "America/Mexico_City" });
  const fmtAnio = new Intl.DateTimeFormat("es-MX", { year: "numeric", timeZone: "America/Mexico_City" });
  if (periodo === "semana") {
    // Ej: 08 dic – 14 dic 2025
    const a = fmt.format(inicio);
    const b = fmt.format(fin);
    return `${a} – ${b}`;
  }
  if (periodo === "mes") return fmtMes.format(inicio);
  return fmtAnio.format(inicio);
}

function estaEnRango(fecha: Date | null, inicio: Date, fin: Date) {
  if (!fecha) return false;
  return fecha.getTime() >= inicio.getTime() && fecha.getTime() <= fin.getTime();
}

export default function PaginaGanancias() {
  const [datosBancarios, setDatosBancarios] = useState<DatosBancarios | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [traslados, setTraslados] = useState<TrasladoConductorGanancia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [periodoActivo, setPeriodoActivo] = useState<PeriodoActivo>("semana");
  const [offsetPeriodo, setOffsetPeriodo] = useState(0);
  const [viajeExpandido, setViajeExpandido] = useState<string | null>(null);
  const [soporteAbierto, setSoporteAbierto] = useState(false);
  const [hoy] = useState(() => new Date());

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
      const vehiculoNombre = t.vehiculos ? `${t.vehiculos.marca} ${t.vehiculos.modelo} ${t.vehiculos.anio}` : "Vehículo trasladado";
      const montoEstimadoOGanado = Number(t.ganancia_conductor_congelada ?? ((t.precio_final ?? t.precio_cotizado ?? 0) * 0.85));
      const precioBase = Number(t.precio_final ?? t.precio_cotizado ?? 0);
      const comision = precioBase > 0 ? Math.max(0, precioBase - montoEstimadoOGanado) : 0;
      const fechaStr = t.cerrado_en ?? t.actualizado_en ?? t.creado_en;
      const fechaDate = toDateSafe(fechaStr) ?? new Date(fechaStr);
      return {
        id: t.id,
        fecha: fechaStr,
        fechaDate,
        vehiculo: vehiculoNombre,
        origen: t.origen_ciudad,
        destino: t.destino_ciudad,
        montoGanado: montoEstimadoOGanado,
        precioBase,
        comisionRuum: comision,
        gastosAutorizados: 0,
        bonos: 0,
        ajuste: 0,
        estatusEconomico: estatusViaje(t, payoutEnlazado),
        liberacion: payoutEnlazado?.procesado_en ? payoutEnlazado.procesado_en.slice(0, 10) : "Pendiente de corte",
        payoutId: t.payout_id,
        estadoTraslado: t.estado
      };
    });
  }, [traslados, mapaPayouts]);

  const rangoActual = useMemo(() => obtenerRangoPeriodo(periodoActivo, hoy, offsetPeriodo), [periodoActivo, hoy, offsetPeriodo]);

  const viajesFiltrados = useMemo(() => {
    return registrosViajes.filter((v) => estaEnRango(v.fechaDate, rangoActual.inicio, rangoActual.fin));
  }, [registrosViajes, rangoActual]);

  const payoutsFiltrados = useMemo(() => {
    return payouts.filter((p) => {
      const inicio = toDateSafe(p.periodo_inicio);
      const fin = toDateSafe(p.periodo_fin);
      // si el payout solapa con el rango, lo incluimos
      if (!inicio || !fin) return false;
      return fin.getTime() >= rangoActual.inicio.getTime() && inicio.getTime() <= rangoActual.fin.getTime();
    });
  }, [payouts, rangoActual]);

  // Resumen filtrado por periodo activo
  const resumen = useMemo(() => {
    const gananciasBrutas = viajesFiltrados.reduce((tot, v) => tot + v.montoGanado, 0);
    const precioBase = viajesFiltrados.reduce((tot, v) => tot + v.precioBase, 0);
    const bonos = viajesFiltrados.reduce((tot, v) => tot + v.bonos, 0);
    // Ajuste viene de payouts del periodo (ajustes puede ser positivo o negativo)
    const ajuste = payoutsFiltrados.reduce((tot, p) => tot + Number(p.ajustes ?? 0), 0);
    const comisionRuum = viajesFiltrados.reduce((tot, v) => tot + v.comisionRuum, 0);
    const gananciaNeta = gananciasBrutas + bonos + ajuste - comisionRuum;
    const reembolsoGastos = viajesFiltrados.reduce((tot, v) => tot + v.gastosAutorizados, 0);
    // Retenciones de viajes rechazados/retenidos no suman al depósito
    const retenciones = viajesFiltrados
      .filter((v) => v.estatusEconomico === "rechazado" || v.estatusEconomico === "retenido")
      .reduce((tot, v) => tot + v.montoGanado, 0);
    const depositoAcumulado = Math.max(0, gananciaNeta + reembolsoGastos - retenciones);
    const totalVehiculos = new Set(viajesFiltrados.map((v) => v.vehiculo)).size;
    return {
      totalViajes: viajesFiltrados.length,
      totalVehiculos: viajesFiltrados.length === 0 ? 0 : totalVehiculos,
      gananciasBrutas,
      precioBase,
      bonos,
      ajuste,
      comisionRuum,
      gananciaNeta,
      reembolsoGastos,
      retenciones,
      depositoAcumulado
    };
  }, [viajesFiltrados, payoutsFiltrados]);
  const tieneDatosBancarios = Boolean(datosBancarios?.clabe || datosBancarios?.numero_tarjeta);
  const sinDatosTotales = !cargando && traslados.length === 0 && payouts.length === 0 && !error;

  // Cambiar periodo resetea offset y acordeón
  const cambiarPeriodo = (nuevo: PeriodoActivo) => {
    setPeriodoActivo(nuevo);
    setOffsetPeriodo(0);
    setViajeExpandido(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-12">
      {/* Header — con icono de ayuda, sin botón Buscar Traslados */}
      <header className="flex items-start justify-between gap-3 border-b border-border/40 pb-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href="/panel" className="font-body text-xs text-text-tertiary hover:underline">
              ← Volver al Panel
            </Link>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">Mis ganancias y pagos</h1>
          <p className="mt-1 font-body text-sm text-text-secondary">Evidencia financiera de cada traslado. Trazabilidad y cierre documentado.</p>
          <div className="conductor-ruta-divider mt-3 max-w-[280px]" aria-hidden />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setSoporteAbierto(true)}
            aria-label="Ayuda y soporte operativo"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border/20 bg-surface-elevated text-text-primary hover:text-signal hover:border-signal/30 transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
          >
            <span className="font-display text-sm font-black" aria-hidden>
              ?
            </span>
          </button>
        </div>
      </header>

      {/* Fila secundaria: cuenta de depósito + CTA datos bancarios (sin Buscar Traslados) */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {datosBancarios && (
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-surface-elevated px-3 py-2 font-body text-xs text-text-tertiary">
            <span>🏦 Cuenta de Depósito:</span>
            <strong className="text-text-primary font-semibold">
              {datosBancarios.banco} ({datosBancarios.clabe.slice(-4)})
            </strong>
          </span>
        )}
        <Link href="/cuenta/datos-bancarios">
          <Button variant="secondary" className="text-xs">
            💳 Datos Bancarios
          </Button>
        </Link>
      </div>

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
                <p className="text-xs text-text-primary mt-0.5">Registra tu CLABE o número de tarjeta para poder recibir la transferencia semanal de tus ganancias.</p>
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

      {sinDatosTotales && (
        <FinancialCard className="mt-6 border-route-action/35 bg-surface-elevated" padding="lg">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full border border-signal/40 bg-signal/10 font-display text-2xl text-signal" aria-hidden>
              💵
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold text-text-primary">Aún no hay ganancias registradas</h2>
            <p className="mt-2 font-body text-sm leading-6 text-text-tertiary">
              Completa tu primer traslado para comenzar a acumular ganancias. Al finalizar cada viaje, verás aquí el desglose detallado y el estatus de tu depósito bancario.
            </p>
          </div>
        </FinancialCard>
      )}

      {!cargando && !sinDatosTotales && (
        <>
          {/* Pestañas Semana / Mes / Año */}
          <div className="mt-6 flex flex-col gap-3">
            <div
              role="tablist"
              aria-label="Periodo de ganancias"
              className="flex w-full rounded-2xl border border-border/20 bg-surface-elevated p-1"
            >
              {(
                [
                  { id: "semana" as const, label: "Semana" },
                  { id: "mes" as const, label: "Mes" },
                  { id: "anio" as const, label: "Año" }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={periodoActivo === tab.id}
                  onClick={() => cambiarPeriodo(tab.id)}
                  className={[
                    "flex-1 rounded-xl px-3 py-2.5 font-display text-xs sm:text-sm font-bold transition min-h-11 flex items-center justify-center",
                    periodoActivo === tab.id
                      ? "bg-signal text-slate-950 shadow-md"
                      : "text-text-secondary hover:text-text-primary"
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Navegación de periodo */}
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/40 bg-surface px-3 py-2.5">
              <button
                type="button"
                onClick={() => setOffsetPeriodo((o) => o - 1)}
                aria-label="Periodo anterior"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-elevated text-text-primary hover:border-signal/40 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
              >
                ‹
              </button>
              <div className="text-center min-w-0">
                <p className="font-display text-sm font-bold text-text-primary truncate capitalize">{formatearRango(periodoActivo, rangoActual.inicio, rangoActual.fin)}</p>
                <p className="font-body text-[11px] font-semibold text-text-tertiary">
                  {periodoActivo === "semana" ? "Dom – Sáb" : periodoActivo === "mes" ? "Mes completo" : "Año completo"} · {resumen.totalViajes} viaje(s)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOffsetPeriodo((o) => o + 1)}
                aria-label="Periodo siguiente"
                disabled={offsetPeriodo >= 0 && (() => { const r = obtenerRangoPeriodo(periodoActivo, hoy, offsetPeriodo + 1); return r.inicio.getTime() > hoy.getTime(); })()}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-elevated text-text-primary hover:border-signal/40 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
              >
                ›
              </button>
            </div>
          </div>

          {/* Resumen en ventanas solicitadas — mismo nivel #Traslados / #Vehículos + Depósito + Ganancia neta */}
          <section className="mt-5 grid gap-4" aria-label="Resumen financiero del periodo">
            {/* Fila 1: #Traslados | #Vehículos — mismo nivel */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Card className="flex flex-col p-4 sm:p-5 border-border/40" padding="none">
                <div className="p-4 sm:p-5">
                  <p className="font-body text-[11px] font-bold uppercase tracking-widest text-text-tertiary">#Traslados</p>
                  <p className="mt-2 font-display text-3xl sm:text-4xl font-black tracking-tight text-text-primary tabular-nums">{resumen.totalViajes}</p>
                  <p className="mt-1 font-body text-xs font-semibold text-text-tertiary">viajes en el periodo</p>
                </div>
              </Card>
              <Card className="flex flex-col p-4 sm:p-5 border-border/40" padding="none">
                <div className="p-4 sm:p-5">
                  <p className="font-body text-[11px] font-bold uppercase tracking-widest text-text-tertiary">#Vehículos</p>
                  <p className="mt-2 font-display text-3xl sm:text-4xl font-black tracking-tight text-text-primary tabular-nums">{resumen.totalVehiculos}</p>
                  <p className="mt-1 font-body text-xs font-semibold text-text-tertiary">vehículos trasladados</p>
                </div>
              </Card>
            </div>

            {/* Ventana: Depósito acumulado */}
            <FinancialCard className="overflow-hidden p-0 border-signal/30" padding="none">
              <div className="px-4 sm:px-6 pt-5 sm:pt-6">
                <h2 className="font-display text-xl sm:text-2xl font-black tracking-tight text-text-primary">Depósito acumulado</h2>
                <p className="mt-2 font-display text-3xl sm:text-4xl font-black tracking-tight text-signal tabular-nums">{formatearMoneda(resumen.depositoAcumulado)}</p>
                <div className="mt-1 h-1 w-full max-w-[220px] rounded-full bg-signal/20 overflow-hidden" aria-hidden>
                  <div className="h-full bg-signal" style={{ width: "100%" }} />
                </div>
              </div>
              <div className="mt-4 mx-4 sm:mx-6 mb-4 sm:mb-6 rounded-2xl border border-border/40 bg-surface-elevated overflow-hidden">
                <div className="grid divide-y divide-border/30">
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <span className="font-body text-sm font-semibold text-text-secondary">Ganancia neta</span>
                    <span className="font-display text-sm font-bold text-text-primary tabular-nums">{formatearMoneda(resumen.gananciaNeta)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <span className="font-body text-sm font-semibold text-text-secondary">Reembolso gtos.</span>
                    <span className="font-display text-sm font-bold text-text-primary tabular-nums">{formatearMoneda(resumen.reembolsoGastos)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-signal/5 border-t border-signal/20">
                  <span className="font-body text-xs font-bold uppercase tracking-wider text-signal">Depósito = Ganancia neta + Reembolso</span>
                  <span className="font-display text-sm font-black text-signal tabular-nums">{formatearMoneda(resumen.depositoAcumulado)}</span>
                </div>
                {resumen.retenciones > 0 && (
                  <p className="px-4 py-2 font-body text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/5 border-t border-amber-500/20">
                    Retenciones en revisión descontadas: {formatearMoneda(resumen.retenciones)}
                  </p>
                )}
              </div>
            </FinancialCard>

            {/* Ventana: Ganancia neta */}
            <FinancialCard className="overflow-hidden p-0" padding="none">
              <div className="px-4 sm:px-6 pt-5 sm:pt-6">
                <h2 className="font-display text-xl sm:text-2xl font-black tracking-tight text-text-primary">Ganancia neta</h2>
                <p className="mt-2 font-display text-3xl sm:text-4xl font-black tracking-tight text-text-primary tabular-nums">{formatearMoneda(resumen.gananciaNeta)}</p>
              </div>
              <div className="mt-4 mx-4 sm:mx-6 mb-4 sm:mb-6 rounded-2xl border border-border/40 bg-surface-elevated overflow-hidden">
                <div className="grid divide-y divide-border/30">
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <span className="font-body text-sm font-semibold text-text-secondary">Precio base</span>
                    <span className="font-display text-sm font-bold text-text-primary tabular-nums">{formatearMoneda(resumen.precioBase)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <span className="font-body text-sm font-semibold text-text-secondary">Bonos (+)</span>
                    <span className="font-display text-sm font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">{formatearMoneda(resumen.bonos)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <span className="font-body text-sm font-semibold text-text-secondary">Ajuste (+)</span>
                    <span className={`font-display text-sm font-bold tabular-nums ${resumen.ajuste < 0 ? "text-red-500" : "text-text-primary"}`}>{formatearMoneda(resumen.ajuste)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-danger/5">
                    <span className="font-body text-sm font-semibold text-red-500">Comisión (−)</span>
                    <span className="font-display text-sm font-bold text-red-500 tabular-nums">− {formatearMoneda(resumen.comisionRuum)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-surface border-t border-border/30">
                  <span className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">Fórmula: Precio base + Bonos + Ajuste − Comisión</span>
                  <span className="font-display text-sm font-black text-text-primary tabular-nums">{formatearMoneda(resumen.gananciaNeta)}</span>
                </div>
              </div>
            </FinancialCard>
          </section>

          {/* Desglose por viaje — acordeón colapsable */}
          <section className="mt-6" aria-label="Desglose por viaje">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-text-primary">Desglose por viaje</h2>
              <span className="rounded-full bg-surface-elevated border border-border px-2.5 py-1 font-body text-xs font-bold text-text-tertiary tabular-nums">
                {viajesFiltrados.length} traslado(s)
              </span>
            </div>

            {viajesFiltrados.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-border bg-surface p-8 text-center font-body text-sm text-text-tertiary">
                No hay traslados en este periodo ({formatearRango(periodoActivo, rangoActual.inicio, rangoActual.fin)}).
              </div>
            ) : (
              <div className="mt-3 grid gap-3">
                {viajesFiltrados.map((viaje) => {
                  const badge = etiquetaEstadoUnica(viaje.estatusEconomico);
                  const expandido = viajeExpandido === viaje.id;
                  return (
                    <div
                      key={viaje.id}
                      className={[
                        "rounded-2xl border bg-surface overflow-hidden transition-all",
                        expandido ? "border-signal/40 shadow-sm" : "border-border hover:border-signal/30"
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => setViajeExpandido(expandido ? null : viaje.id)}
                        aria-expanded={expandido}
                        aria-controls={`acordeon-${viaje.id}`}
                        className="w-full flex items-center gap-3 p-4 text-left focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
                      >
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-elevated text-route-action text-xl">🚘</div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display text-sm font-bold text-text-primary truncate">{viaje.vehiculo}</h3>
                          <p className="mt-0.5 font-body text-xs font-semibold text-text-primary flex items-center gap-1.5 flex-wrap">
                            <span>{viaje.origen}</span>
                            <span className="text-signal font-bold">➔</span>
                            <span>{viaje.destino}</span>
                            <span className="text-text-tertiary font-normal">•</span>
                            <span className="text-text-tertiary font-normal">{formatearFechaCorta(viaje.fecha)}</span>
                          </p>
                        </div>
                        <div className="hidden sm:block text-right shrink-0">
                          <p className="font-body text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Ganancia</p>
                          <p className="font-display text-sm font-bold text-emerald-500 dark:text-emerald-400">{formatearMoneda(viaje.montoGanado)}</p>
                        </div>
                        <span className={`hidden sm:inline-flex items-center rounded-full border px-2.5 py-1 font-body text-[11px] font-bold shrink-0 ${badge.clase}`}>{badge.texto}</span>
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full border bg-surface-elevated text-text-tertiary transition-transform ${expandido ? "rotate-180 border-signal/40 text-signal" : "border-border"}`}
                          aria-hidden
                        >
                          ⌄
                        </span>
                      </button>

                      {/* Vista colapsable */}
                      <div
                        id={`acordeon-${viaje.id}`}
                        className={`grid transition-all duration-200 ${expandido ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                      >
                        <div className="overflow-hidden">
                          <div className="border-t border-border/40 bg-surface-elevated/50 p-4 space-y-4">
                            {/* Resumen rápido visible en móvil */}
                            <div className="sm:hidden flex items-center justify-between gap-2">
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-body text-xs font-bold ${badge.clase}`}>{badge.texto}</span>
                              <span className="font-display text-sm font-bold text-emerald-500 dark:text-emerald-400">{formatearMoneda(viaje.montoGanado)}</span>
                            </div>

                            {/* Desglose fórmula por viaje */}
                            <div className="grid gap-2 rounded-xl border border-border/40 bg-surface p-3">
                              <p className="font-body text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Desglose del viaje</p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-body text-xs">
                                <div className="rounded-lg bg-surface-elevated border border-border/30 p-2.5">
                                  <p className="text-text-tertiary font-semibold uppercase text-[10px]">Precio base</p>
                                  <p className="font-display text-sm font-bold text-text-primary tabular-nums">{formatearMoneda(viaje.precioBase)}</p>
                                </div>
                                <div className="rounded-lg bg-surface-elevated border border-border/30 p-2.5">
                                  <p className="text-text-tertiary font-semibold uppercase text-[10px]">Ganancia bruta</p>
                                  <p className="font-display text-sm font-bold text-text-primary tabular-nums">{formatearMoneda(viaje.montoGanado)}</p>
                                </div>
                                <div className="rounded-lg bg-danger/5 border border-danger/20 p-2.5">
                                  <p className="text-red-500 font-bold uppercase text-[10px]">Comisión Ruum</p>
                                  <p className="font-display text-sm font-bold text-red-500 tabular-nums">{formatearMoneda(viaje.comisionRuum)}</p>
                                </div>
                                <div className="rounded-lg bg-signal/10 border border-signal/30 p-2.5">
                                  <p className="text-signal font-bold uppercase text-[10px]">Ganancia neta</p>
                                  <p className="font-display text-sm font-extrabold text-signal tabular-nums">{formatearMoneda(viaje.montoGanado - viaje.comisionRuum + viaje.bonos + viaje.ajuste)}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 text-[11px] font-body">
                                <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated border border-border px-2.5 py-1">
                                  <span className="text-text-tertiary">Bonos:</span> <strong className="text-text-primary">{formatearMoneda(viaje.bonos)}</strong>
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated border border-border px-2.5 py-1">
                                  <span className="text-text-tertiary">Ajuste:</span> <strong className="text-text-primary">{formatearMoneda(viaje.ajuste)}</strong>
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated border border-border px-2.5 py-1">
                                  <span className="text-text-tertiary">Reembolso:</span> <strong className="text-text-primary">{formatearMoneda(viaje.gastosAutorizados)}</strong>
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-signal border-signal/30 bg-signal/10">
                                  <span>Depósito:</span> <strong>{formatearMoneda(viaje.montoGanado - viaje.comisionRuum + viaje.gastosAutorizados)}</strong>
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 font-body text-xs">
                              <span className="rounded-full border border-border bg-surface px-3 py-1.5">
                                <span className="text-text-tertiary">Fecha:</span> <strong className="text-text-primary">{formatearFecha(viaje.fecha)}</strong>
                              </span>
                              <span className="rounded-full border border-border bg-surface px-3 py-1.5">
                                <span className="text-text-tertiary">Liberación:</span> <strong className="text-text-primary">{viaje.liberacion}</strong>
                              </span>
                              <span className="rounded-full border border-border bg-surface px-3 py-1.5">
                                <span className="text-text-tertiary">Estado:</span> <strong className="text-text-primary capitalize">{viaje.estadoTraslado.replace(/_/g, " ")}</strong>
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <Link
                                href={`/viajes/${viaje.id}`}
                                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-signal px-4 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-signal/90 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-signal"
                              >
                                Ver detalle del traslado →
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Depósitos del periodo (si existen) */}
            {payoutsFiltrados.length > 0 && (
              <div className="mt-8">
                <h3 className="font-display text-sm font-bold text-text-primary">Depósitos del periodo</h3>
                <div className="mt-3 grid gap-3">
                  {payoutsFiltrados.map((payout) => (
                    <Card key={payout.id} className="p-4" padding="none">
                      <div className="p-4 flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
                          <div>
                            <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">Periodo Operativo</p>
                            <h4 className="font-display text-sm font-bold text-text-primary">
                              {formatearFecha(payout.periodo_inicio)} ➔ {formatearFecha(payout.periodo_fin)}
                            </h4>
                          </div>
                          <FinancialAmount amount={null} status={estatusPayout(payout)} currency="MXN" />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3 font-body text-xs">
                          <div className="rounded-xl border border-border/40 bg-surface-elevated p-3">
                            <p className="text-text-tertiary font-semibold uppercase">Monto Bruto</p>
                            <p className="mt-1 font-display text-sm font-bold text-text-primary">{formatearMoneda(Number(payout.monto_bruto ?? 0))}</p>
                          </div>
                          <div className="rounded-xl border border-border/40 bg-surface-elevated p-3">
                            <p className="text-text-tertiary font-semibold uppercase">Ajustes</p>
                            <p className="mt-1 font-display text-sm font-bold text-text-primary">{formatearMoneda(Number(payout.ajustes ?? 0))}</p>
                          </div>
                          <div className="rounded-xl border border-signal/40 bg-signal/10 p-3">
                            <p className="text-signal font-bold uppercase">Monto Neto</p>
                            <p className="mt-1 font-display text-sm font-extrabold text-signal">{formatearMoneda(Number(payout.monto_neto ?? 0))}</p>
                          </div>
                        </div>
                        {payout.referencia_pago && (
                          <p className="font-body text-xs text-text-tertiary">SPEI: {payout.referencia_pago}</p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <PanelSupportSheet abierto={soporteAbierto} onCerrar={() => setSoporteAbierto(false)} />
    </div>
  );
}
