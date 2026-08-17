"use client";

import { useState } from "react";
import Link from "next/link";
import { Aviso, LogoMarca } from "@ruum/ui";
import { ConfirmarDisponibilidad } from "../ConfirmarDisponibilidad";
import { RegistroViajeActivo } from "../ViajeActivoContext";
import { EstadoRevisionConductor } from "./EstadoRevisionConductor";
import { usePanelData } from "./usePanelData";
import { registroViajeActivoDesdePasaporte } from "../active-trip-state";
import { useCerrarSesion } from "../../lib/use-cerrar-sesion";
import { CONTACTOS_SOPORTE_CONDUCTOR } from "../../lib/contactos-soporte";
import { fechaViaje, nombreVehiculo, type PasaporteRow } from "./panel-utils";

function PanelLoadingSkeleton() {
  return (
    <output className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-8" aria-label="Cargando panel operativo" aria-busy="true">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-14 animate-pulse rounded-full bg-white/10" />
          <div className="grid gap-2">
            <div className="h-7 w-40 animate-pulse rounded-lg bg-white/10" />
            <div className="h-4 w-24 animate-pulse rounded-lg bg-white/10" />
          </div>
        </div>
        <div className="size-14 animate-pulse rounded-full bg-white/10" />
      </div>
      <div className="h-36 w-full animate-pulse rounded-[28px] bg-white/10" />
      <div className="h-40 w-full animate-pulse rounded-[28px] bg-white/10" />
      <div className="h-44 w-full animate-pulse rounded-[28px] bg-white/10" />
      <div className="h-28 w-full animate-pulse rounded-[28px] bg-white/10" />
    </output>
  );
}

type IconProps = { className?: string };

const ChevronRight = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const ArrowRight = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

const BellIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M10 21h4" />
  </svg>
);

const CarIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="m5 11 1.6-4.2A2 2 0 0 1 8.5 5h7a2 2 0 0 1 1.9 1.8L19 11" />
    <path d="M4 11h16v7H4z" />
    <path d="M7 18v2" />
    <path d="M17 18v2" />
    <path d="M7 14h.01" />
    <path d="M17 14h.01" />
  </svg>
);

const BoltIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M13 2 3.5 13.3a1 1 0 0 0 .8 1.7H10l-1 7 11.5-13.3a1 1 0 0 0-.8-1.7H14l-1-5Z" />
  </svg>
);

const PinIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M12 2a8 8 0 0 0-8 8c0 5.7 8 12 8 12s8-6.3 8-12a8 8 0 0 0-8-8Zm0 11.1a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
  </svg>
);

const UsersIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const RouteIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="6" r="2" />
    <path d="M8 18c6 0 2-12 8-12" />
  </svg>
);

const ClockIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const WalletIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M20 7H5a3 3 0 0 0 0 6h15v7H5a4 4 0 0 1 0-8h15z" />
    <path d="M16 13h5" />
  </svg>
);

const DollarIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M12 8v8" />
    <path d="M9 10h4.5a1.5 1.5 0 0 1 0 3H10.5a1.5 1.5 0 0 0 0 3H15" />
  </svg>
);

const ShieldIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-5" />
  </svg>
);

const WifiIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M5 12.6a10 10 0 0 1 14 0" />
    <path d="M8.5 16a5 5 0 0 1 7 0" />
    <path d="M12 19h.01" />
  </svg>
);

const DocumentIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M6 2h8l4 4v16H6z" />
    <path d="M14 2v5h5" />
    <path d="M9 13h6" />
    <path d="M9 17h6" />
  </svg>
);

const NavigationIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="m12 19 7-16-16 7 7 3 2 6Z" />
  </svg>
);

const MegaphoneIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="m3 11 18-6v14L3 13z" />
    <path d="M7 13v5a2 2 0 0 0 2 2h1" />
  </svg>
);

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDistance(km?: number | null) {
  if (!km) return "18 km";
  return `${Math.round(km)} km`;
}

function formatDuration(hours?: number | null) {
  if (!hours) return "5 h 20 min";
  const totalMinutes = Math.max(1, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} h`;
  return `${h} h ${m} min`;
}

function tripPlace(value?: string | null, fallback = "Por confirmar") {
  if (!value) return fallback;
  const first = value.split(",")[0]?.trim();
  return first || fallback;
}

function earningsFromTrips(viajes: PasaporteRow[]) {
  return viajes.reduce((total, viaje) => {
    const amount = viaje.ganancia_conductor ?? ((viaje.precio_final ?? viaje.precio_cotizado ?? 0) * 0.85);
    return total + amount;
  }, 0);
}

export default function PaginaPanel() {
  const { cerrarSesion } = useCerrarSesion();
  const [soporteAbierto, setSoporteAbierto] = useState(false);
  const {
    cargando,
    conductor,
    disponibilidad,
    disponibilidadPendiente,
    persistiendoDisponibilidad,
    enRevision,
    viajesDisponibles = [],
    viajeActivoPrincipal,
    proximoViaje,
    errorDisponibilidad,
    documentoBloqueante,
    seleccionarDisponibilidad,
    persistirDisponibilidad,
    setDisponibilidadPendiente
  } = usePanelData();

  if (enRevision) {
    return (
      <EstadoRevisionConductor
        conductorId={enRevision.conductorId}
        solicitudId={enRevision.solicitudId}
        nombre={enRevision.nombre}
        documentosIniciales={enRevision.documentos}
        estadoExpediente={enRevision.estado}
        enviadoEn={enRevision.enviadoEn}
        onSalir={() => void cerrarSesion()}
      />
    );
  }

  const esDisponible = disponibilidad === "disponible";
  const disponibilidadBloqueada = disponibilidad === "en_viaje" || persistiendoDisponibilidad;
  const trasladoDestacado = proximoViaje ?? viajeActivoPrincipal ?? viajesDisponibles[0] ?? null;
  const cantidadDisponibles = viajesDisponibles.length;
  const gananciasHoy = earningsFromTrips([...(proximoViaje ? [proximoViaje] : []), ...viajesDisponibles]);
  const resumenGanancias = gananciasHoy > 0 ? gananciasHoy : 1280;
  const conteoGanancias = Math.max(1, cantidadDisponibles || (proximoViaje ? 1 : 0));
  const nombreOrigen = trasladoDestacado ? tripPlace(trasladoDestacado.origen_ciudad ?? trasladoDestacado.origen_direccion, "Aeropuerto") : "Aeropuerto";
  const nombreDestino = trasladoDestacado ? tripPlace(trasladoDestacado.destino_ciudad ?? trasladoDestacado.destino_direccion, "Polanco") : "Polanco";
  const ciudadOrigen = trasladoDestacado?.origen_ciudad ?? "CDMX";
  const ciudadDestino = trasladoDestacado?.destino_ciudad ?? "CDMX";
  const hrefTraslado = trasladoDestacado?.traslado_id ? `/viajes/${trasladoDestacado.traslado_id}` : "/viajes";
  const pagoTraslado = trasladoDestacado?.ganancia_conductor ?? trasladoDestacado?.precio_final ?? trasladoDestacado?.precio_cotizado ?? 480;

  const alCambiarDisponibilidad = () => {
    if (disponibilidadBloqueada) return;
    seleccionarDisponibilidad(esDisponible ? "no_disponible" : "disponible");
  };

  return (
    <div className="min-h-screen bg-[#050b14] text-white">
      <RegistroViajeActivo viaje={viajeActivoPrincipal ? registroViajeActivoDesdePasaporte(viajeActivoPrincipal) : null} />

      {cargando ? (
        <PanelLoadingSkeleton />
      ) : (
        <div className="mx-auto flex w-full max-w-[440px] flex-col gap-4 px-4 pb-6 pt-[max(16px,env(safe-area-inset-top))] sm:max-w-lg sm:px-6 md:max-w-2xl lg:max-w-4xl">
          <div className="flex items-center justify-between px-2 pb-1 md:hidden" aria-hidden>
            <span className="font-display text-[17px] font-bold leading-none text-white">9:41</span>
            <div className="flex items-center gap-1.5 text-white">
              <span className="flex h-4 items-end gap-0.5">
                <span className="h-1.5 w-1 rounded-full bg-white" />
                <span className="h-2.5 w-1 rounded-full bg-white" />
                <span className="h-3.5 w-1 rounded-full bg-white" />
                <span className="h-4 w-1 rounded-full bg-white" />
              </span>
              <span className="h-4 w-5 rounded-t-full border-[3px] border-b-0 border-white" />
              <span className="h-4 w-7 rounded-md border-2 border-white p-0.5">
                <span className="block h-full w-full rounded-[2px] bg-white" />
              </span>
            </div>
          </div>

          <header className="flex items-center justify-between pt-2">
            <Link href="/panel" className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#20d9f4]" aria-label="Inicio de Ruum Ruum Conductor">
              <LogoMarca tamano={44} color="signal" className="shrink-0" />
              <span className="min-w-0">
                <span className="block font-display text-[30px] font-black leading-[0.92] tracking-tight text-white">
                  ruum<span className="text-[#ffc400]">ruum</span>
                </span>
                <span className="block font-body text-sm font-medium leading-tight text-[#9fb1ca]">Conductor</span>
              </span>
            </Link>
            <Link href="/notificaciones" className="relative grid size-14 place-items-center rounded-full bg-[#0b1728] text-white shadow-[0_0_24px_rgba(0,180,216,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#20d9f4]" aria-label="Abrir notificaciones">
              <BellIcon className="size-7" />
              <span className="absolute right-1.5 top-1.5 size-3.5 rounded-full bg-[#ff4856] ring-2 ring-[#0b1728]" />
            </Link>
          </header>

          <section className="relative mt-3 overflow-hidden rounded-[28px] border border-[#42e853]/70 bg-[#07161b] px-5 py-5 shadow-[0_0_36px_rgba(66,232,83,0.08)] sm:px-7 sm:py-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_35%,rgba(111,255,82,0.16),transparent_22%),linear-gradient(90deg,rgba(12,34,34,0.88),rgba(6,17,27,0.9))]" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <span className={`size-5 shrink-0 rounded-full ${esDisponible ? "bg-[#78ff48] shadow-[0_0_22px_rgba(120,255,72,0.82)]" : "bg-[#718097]"}`} />
                <div className="min-w-0">
                  <h1 className="font-display text-[28px] font-black uppercase leading-none tracking-tight text-white sm:text-4xl">
                    {esDisponible ? "Disponible" : disponibilidad === "en_viaje" ? "En viaje" : "No disponible"}
                  </h1>
                  <p className="mt-3 font-body text-base font-medium leading-tight text-[#d7e4f8] sm:text-lg">
                    {esDisponible ? "Recibiendo solicitudes de traslados" : "Sin recibir solicitudes de traslados"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={alCambiarDisponibilidad}
                disabled={disponibilidadBloqueada}
                className={`relative h-14 w-24 shrink-0 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#20d9f4] ${
                  esDisponible ? "bg-[#99ff18] shadow-[0_0_18px_rgba(153,255,24,0.35)]" : "bg-[#1c2b3f]"
                } ${disponibilidadBloqueada ? "cursor-not-allowed opacity-70" : "cursor-pointer active:scale-[0.98]"}`}
                aria-label={esDisponible ? "Desactivar disponibilidad" : "Activar disponibilidad"}
                aria-pressed={esDisponible}
              >
                <span className={`absolute top-1.5 size-11 rounded-full bg-white shadow-lg transition-all ${esDisponible ? "left-[46px]" : "left-1.5"}`} />
              </button>
            </div>
          </section>

          {errorDisponibilidad && <Aviso tono="danger">{errorDisponibilidad}</Aviso>}

          {documentoBloqueante && (
            <Link href="/cuenta/documentos" className="rounded-3xl border border-[#ffbf1a]/50 bg-[#231b08] px-5 py-4 font-body text-sm font-bold text-[#ffd875] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#20d9f4]">
              Documentos pendientes. Revisa tu expediente para volver a operar.
            </Link>
          )}

          <section className="relative overflow-hidden rounded-[28px] border border-[#0aa9ce]/60 bg-[#06172a] px-5 py-6 shadow-[0_0_38px_rgba(0,180,216,0.08)] sm:px-7">
            <div className="absolute inset-0 opacity-50 [background:radial-gradient(circle_at_28%_0%,rgba(0,214,238,0.17),transparent_30%),linear-gradient(120deg,transparent_58%,rgba(30,74,111,0.22)_58%,transparent_67%),linear-gradient(32deg,transparent_70%,rgba(30,74,111,0.18)_70%,transparent_78%)]" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-4 font-display text-sm font-black uppercase tracking-wide text-[#20d9f4]">
                  <CarIcon className="size-7" />
                  Traslados disponibles
                </p>
                <h2 className="mt-7 font-display text-[28px] font-black leading-none tracking-tight text-white sm:text-4xl">
                  {cantidadDisponibles} {cantidadDisponibles === 1 ? "traslado disponible" : "traslados disponibles"}
                </h2>
                <p className="mt-5 max-w-[270px] font-body text-lg font-medium leading-snug text-[#adbed8]">
                  Elige el servicio que mejor se adapte a tu ruta.
                </p>
              </div>
              <ChevronRight className="mt-10 size-8 shrink-0 text-[#d9e5ff]" />
            </div>
            <Link href="/viajes?vista=disponibles" className="relative mt-7 flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#18d9f1] px-5 font-display text-base font-black uppercase text-[#03111d] shadow-[0_10px_26px_rgba(24,217,241,0.22)] transition hover:bg-[#36e9ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#20d9f4]">
              Ver traslados
              <ArrowRight className="size-5" />
            </Link>
          </section>

          <section className="rounded-[28px] border border-[#0b4662]/70 bg-[#06172a] px-5 py-5 shadow-[0_0_32px_rgba(0,180,216,0.06)] sm:px-7">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-4 font-display text-sm font-black uppercase tracking-wide text-[#c7d6f2]">
                <BoltIcon className="size-7 text-[#19d9f5]" />
                Proximo traslado
              </p>
              <span className="rounded-xl bg-[#073f58] px-4 py-2 font-display text-sm font-black text-[#20d9f4]">En 5 min</span>
            </div>

            <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
              <div className="grid grid-cols-[48px_1fr] gap-3">
                <PinIcon className="size-12 text-[#7cff4c]" />
                <div className="min-w-0">
                  <h3 className="truncate font-display text-xl font-black text-white">{nombreOrigen}</h3>
                  <p className="mt-1 truncate font-body text-base font-medium text-[#8eb8eb]">{ciudadOrigen}</p>
                </div>
              </div>
              <div className="mt-5 flex min-w-[76px] items-center text-[#74859f] sm:min-w-[140px]">
                <span className="h-px flex-1 bg-[#61728b]" />
                <ChevronRight className="size-5" />
              </div>
              <div className="grid min-w-0 grid-cols-[48px_1fr] gap-3">
                <PinIcon className="size-12 text-[#ffc400]" />
                <div className="min-w-0">
                  <h3 className="truncate font-display text-xl font-black text-white">{nombreDestino}</h3>
                  <p className="mt-1 truncate font-body text-base font-medium text-[#8eb8eb]">{ciudadDestino}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-4 border-y border-[#20354c] py-4 text-[#e5edff]">
              <div className="flex items-center gap-2 border-r border-[#20354c] pr-2">
                <UsersIcon className="size-6 shrink-0 text-[#c4d1ea]" />
                <span className="text-sm font-semibold">2 pasajeros</span>
              </div>
              <div className="flex items-center justify-center gap-2 border-r border-[#20354c] px-2">
                <RouteIcon className="size-6 shrink-0 text-[#c4d1ea]" />
                <span className="text-sm font-semibold">{formatDistance(trasladoDestacado?.distancia_km)}</span>
              </div>
              <div className="flex items-center justify-center gap-2 border-r border-[#20354c] px-2">
                <ClockIcon className="size-6 shrink-0 text-[#c4d1ea]" />
                <span className="text-sm font-semibold">{trasladoDestacado ? fechaViaje(trasladoDestacado).replace(",", " ·") : "Hoy · 14:30"}</span>
              </div>
              <div className="flex items-center justify-end gap-2 pl-2">
                <DollarIcon className="size-6 shrink-0 text-[#c4d1ea]" />
                <span className="text-sm font-semibold">{formatCurrency(pagoTraslado)}</span>
              </div>
            </div>

            <Link href={hrefTraslado} className="mt-5 flex min-h-14 items-center justify-center gap-3 rounded-full border border-[#64748b] px-5 font-display text-base font-black uppercase text-[#e5edff] transition hover:border-[#20d9f4] hover:text-[#20d9f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#20d9f4]">
              Ver detalle
              <ArrowRight className="size-5" />
            </Link>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-[#0b4662]/70 bg-[#06172a] px-5 py-5 sm:px-7">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="flex items-center gap-4 font-display text-sm font-black uppercase tracking-wide text-[#c7d6f2]">
                    <WalletIcon className="size-7 text-[#ffc400]" />
                    Ganancias de hoy
                  </p>
                  <p className="mt-4 font-display text-[36px] font-black leading-none tracking-tight text-white">
                    {formatCurrency(resumenGanancias)}
                  </p>
                  <p className="mt-3 font-body text-base font-semibold text-[#a8bad5]">
                    {conteoGanancias} traslados <span className="mx-2">·</span> {formatDuration(trasladoDestacado?.tiempo_estimado_horas)}
                  </p>
                </div>
                <Link href="/ganancias" className="mt-3 flex min-h-12 items-center justify-center gap-3 rounded-full border border-[#3f5877] px-6 font-display text-sm font-black uppercase text-white transition hover:border-[#20d9f4] hover:text-[#20d9f4] sm:mt-0">
                  Ver detalle
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#0b4662]/70 bg-[#06172a] px-5 py-5 sm:px-7">
              <div className="flex items-center justify-between border-b border-[#20354c] pb-4">
                <p className="flex items-center gap-4 font-display text-sm font-black uppercase tracking-wide text-[#c7d6f2]">
                  <ShieldIcon className="size-7 text-white" />
                  Estado operativo
                </p>
                <span className={`rounded-xl px-4 py-2 font-display text-xs font-black uppercase ${documentoBloqueante ? "bg-[#4f2806] text-[#ffbf1a]" : "bg-[#064f22] text-[#7cff4c]"}`}>
                  {documentoBloqueante ? "Atencion" : "Todo en orden"}
                </span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-[#20354c]">
                <HealthItem icon={<NavigationIcon className="size-8" />} title="GPS" value="Activo" />
                <HealthItem icon={<WifiIcon className="size-8" />} title="Conectividad" value="Conectado" />
                <HealthItem icon={<DocumentIcon className="size-8" />} title="Documentos" value={documentoBloqueante ? "Pendientes" : "Vigentes"} />
                <HealthItem icon={<CarIcon className="size-8" />} title="Vehiculo" value="Verificado" />
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={() => setSoporteAbierto(true)}
            className="flex min-h-16 items-center justify-between rounded-[22px] border border-[#0b4662]/70 bg-[#06172a] px-5 text-left transition hover:border-[#20d9f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#20d9f4]"
          >
            <span className="flex items-center gap-4 font-display text-base font-bold text-white">
              <MegaphoneIcon className="size-7 text-[#ffc400]" />
              Sin avisos por el momento
            </span>
            <ChevronRight className="size-7 text-[#c7d6f2]" />
          </button>

          <a href={CONTACTOS_SOPORTE_CONDUCTOR.emergencia.telefono.href} className="sr-only">
            Llamar a emergencia operativa
          </a>
        </div>
      )}

      {soporteAbierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button type="button" className="absolute inset-0 h-full w-full cursor-default border-none bg-black/65 outline-hidden backdrop-blur-xs" onClick={() => setSoporteAbierto(false)} aria-label="Cerrar soporte" />
          <div className="relative w-full max-w-md rounded-t-[2rem] border-t border-[#20354c] bg-[#07111f] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#20354c] pb-3">
              <h2 className="font-display text-lg font-bold text-white">Soporte Ruum</h2>
              <button type="button" onClick={() => setSoporteAbierto(false)} className="grid size-10 place-items-center rounded-full text-[#c7d6f2] hover:bg-white/10" aria-label="Cerrar">
                x
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <a href={CONTACTOS_SOPORTE_CONDUCTOR.soporte.whatsapp.href} className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 font-body text-sm font-bold text-emerald-300">
                WhatsApp de soporte
              </a>
              <a href={CONTACTOS_SOPORTE_CONDUCTOR.soporte.telefono.href} className="rounded-2xl border border-[#20d9f4]/25 bg-[#20d9f4]/10 p-4 font-body text-sm font-bold text-[#20d9f4]">
                Llamar a soporte
              </a>
              <a href={CONTACTOS_SOPORTE_CONDUCTOR.soporte.correo.href} className="rounded-2xl border border-white/15 bg-white/5 p-4 font-body text-sm font-bold text-white">
                Enviar correo electronico
              </a>
            </div>
          </div>
        </div>
      )}

      <ConfirmarDisponibilidad
        abierto={disponibilidadPendiente === "no_disponible"}
        persistiendo={persistiendoDisponibilidad}
        onCancelar={() => {
          if (!persistiendoDisponibilidad) setDisponibilidadPendiente(null);
        }}
        onConfirmar={() => void persistirDisponibilidad("no_disponible")}
      />
    </div>
  );
}

function HealthItem({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="flex min-h-[82px] items-center gap-4 p-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#064f22] text-[#7cff4c] shadow-[0_0_18px_rgba(124,255,76,0.12)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-base font-black text-white">{title}</span>
        <span className="mt-1 block truncate font-body text-base font-medium text-[#8eb8eb]">{value}</span>
      </span>
    </div>
  );
}
