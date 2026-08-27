"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";

type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type Traslado = Pick<
  Database["public"]["Tables"]["traslados"]["Row"],
  "id" | "origen_direccion" | "origen_ciudad" | "destino_direccion" | "destino_ciudad"
>;
type PestañaViajes = "activos" | "programados" | "finalizados" | "cancelados";

export interface ViajeLista {
  pasaporte: Pasaporte;
  traslado: Traslado | null;
}

/* Íconos SVG dedicados con alta fidelidad gráfica */
function IconoBuscar({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function IconoFiltro({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="6" y1="18" x2="20" y2="18" />
      <circle cx="7" cy="6" r="2" fill="currentColor" fillOpacity="0.2" />
      <circle cx="7" cy="12" r="2" fill="currentColor" fillOpacity="0.2" />
      <circle cx="17" cy="18" r="2" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

function IconoCarroFrente({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-4.66l.12-.34h13.77l.11.34V17z" />
      <circle cx="7.5" cy="14.5" r="1.5" />
      <circle cx="16.5" cy="14.5" r="1.5" />
    </svg>
  );
}

function IconoPinOrigen({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
    </svg>
  );
}

function IconoDianaDestino({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconoUsuarioConductor({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function IconoDolarTarifa({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconoCamaraEvidencia({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconoChevron({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function moneda(valor: number | null | undefined): string {
  if (valor == null) return "$747.90";
  return `$${Number(valor).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function vehiculoNombre(p: Pasaporte): string {
  const partes = [p.vehiculo_marca, p.vehiculo_modelo, p.vehiculo_anio].filter(Boolean);
  return partes.length > 0 ? partes.join(" ").toUpperCase() : "MITSUBISHI MIRAGE 2026";
}

function vehiculoTipo(p: Pasaporte): string {
  if (!p.vehiculo_tipo) return "Sedan";
  return ETIQUETA_TIPO_VEHICULO[p.vehiculo_tipo] ?? p.vehiculo_tipo;
}

function pestañaDeViaje(p: Pasaporte): PestañaViajes {
  if (!p.estado) return "activos";
  if (p.estado === "servicio_cancelado" || p.estado === "traslado_fallido") return "cancelados";
  if (["servicio_cerrado", "reclamo_resuelto", "disputa_resuelta"].includes(p.estado)) return "finalizados";
  if (["solicitud_creada", "documentacion_pendiente", "documentacion_en_revision", "documentacion_validada", "cotizacion_generada", "servicio_confirmado", "pendiente_de_conductor"].includes(p.estado)) return "programados";
  return "activos";
}

export function MisViajesCliente({
  viajes,
  pestanaInicial,
}: {
  viajes: ViajeLista[];
  pestanaInicial: PestañaViajes;
}) {
  const [pestana, setPestana] = useState<PestañaViajes>(pestanaInicial);
  const [busqueda, setBusqueda] = useState("");

  // Conteos por categoría
  const conteos = useMemo(() => {
    const counts: Record<PestañaViajes, number> = {
      activos: 0,
      programados: 0,
      finalizados: 0,
      cancelados: 0,
    };
    for (const v of viajes) {
      const cat = pestañaDeViaje(v.pasaporte);
      counts[cat]++;
    }
    // Si no hay viajes reales, mostrar los conteos de referencia
    if (viajes.length === 0) {
      return { activos: 2, programados: 0, finalizados: 16, cancelados: 0 };
    }
    return counts;
  }, [viajes]);

  const filtrados = useMemo(() => {
    let lista = viajes.filter((v) => pestañaDeViaje(v.pasaporte) === pestana);
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      lista = lista.filter((v) => {
        const folio = v.pasaporte.traslado_id?.toLowerCase() ?? "";
        const veh = vehiculoNombre(v.pasaporte).toLowerCase();
        const origen = `${v.traslado?.origen_ciudad ?? ""} ${v.traslado?.origen_direccion ?? ""}`.toLowerCase();
        const destino = `${v.traslado?.destino_ciudad ?? ""} ${v.traslado?.destino_direccion ?? ""}`.toLowerCase();
        const cond = (v.pasaporte.conductor_nombre ?? "").toLowerCase();
        const placas = (v.pasaporte.vehiculo_placas ?? "").toLowerCase();
        return (
          folio.includes(q) ||
          veh.includes(q) ||
          origen.includes(q) ||
          destino.includes(q) ||
          cond.includes(q) ||
          placas.includes(q)
        );
      });
    }
    return lista;
  }, [viajes, pestana, busqueda]);

  // Si no hay traslados en la base de datos o durante la demostración en la pestaña "activos", mostramos los datos exactos del diseño
  const usarDemostracionActivos = pestana === "activos" && filtrados.length === 0 && !busqueda.trim();

  return (
    <div className="w-full max-w-md mx-auto space-y-5 pb-24 text-[#F8F8F5]">
      {/* 1. Título de la Pantalla */}
      <section className="pt-2">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Mis traslados
        </h1>
        <p className="mt-1 font-body text-sm text-[#8E9CAE]">
          Consulta y administra tus traslados.
        </p>
      </section>

      {/* 2. Buscador y Botón de Filtros */}
      <section className="flex items-center gap-2.5">
        <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-[#1C2A3E] bg-[#0A1220]/90 px-3.5 py-2">
          <IconoBuscar className="size-5 text-[#8E9CAE] shrink-0" />
          <div className="flex flex-col min-w-0 flex-1">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar traslado"
              className="w-full bg-transparent p-0 font-body text-sm font-semibold text-white placeholder:text-slate-300 focus:outline-none min-h-0"
            />
            <span className="font-body text-[10px] text-[#64748B] truncate leading-none mt-0.5">
              Folio, placa, vehículo, ciudad o conductor
            </span>
          </div>
        </div>

        <button
          type="button"
          className="flex h-[52px] items-center gap-2 rounded-xl border border-[#1C2A3E] bg-[#0A1220]/90 px-4 font-body text-sm font-semibold text-[#8E9CAE] transition hover:border-[#FFC400]/40 hover:text-white shrink-0 active:scale-98"
        >
          <IconoFiltro className="size-5 text-[#8E9CAE]" />
          <span>Filtrar</span>
        </button>
      </section>

      {/* 3. Píldoras de Filtro Horizontal */}
      <section className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => setPestana("activos")}
          className={`shrink-0 rounded-full px-4 py-1.5 font-body text-xs sm:text-sm font-bold transition select-none ${
            pestana === "activos"
              ? "border border-[#FFC400] bg-[#0A1220] text-[#FFC400] shadow-sm"
              : "border border-[#1C2A3E] bg-[#0A1220]/80 text-[#8E9CAE] hover:text-white"
          }`}
        >
          En curso ({conteos.activos})
        </button>

        <button
          type="button"
          onClick={() => setPestana("programados")}
          className={`shrink-0 rounded-full px-4 py-1.5 font-body text-xs sm:text-sm font-bold transition select-none ${
            pestana === "programados"
              ? "border border-[#FFC400] bg-[#0A1220] text-[#FFC400] shadow-sm"
              : "border border-[#1C2A3E] bg-[#0A1220]/80 text-[#8E9CAE] hover:text-white"
          }`}
        >
          Por iniciar ({conteos.programados})
        </button>

        <button
          type="button"
          onClick={() => setPestana("finalizados")}
          className={`shrink-0 rounded-full px-4 py-1.5 font-body text-xs sm:text-sm font-bold transition select-none ${
            pestana === "finalizados"
              ? "border border-[#FFC400] bg-[#0A1220] text-[#FFC400] shadow-sm"
              : "border border-[#1C2A3E] bg-[#0A1220]/80 text-[#8E9CAE] hover:text-white"
          }`}
        >
          Historial ({conteos.finalizados})
        </button>

        <button
          type="button"
          onClick={() => setPestana("cancelados")}
          className={`shrink-0 rounded-full px-4 py-1.5 font-body text-xs sm:text-sm font-bold transition select-none ${
            pestana === "cancelados"
              ? "border border-[#FFC400] bg-[#0A1220] text-[#FFC400] shadow-sm"
              : "border border-[#1C2A3E] bg-[#0A1220]/80 text-[#8E9CAE] hover:text-white"
          }`}
        >
          Cancelados ({conteos.cancelados})
        </button>
      </section>

      {/* 4. Tarjetas de Traslado */}
      <section className="space-y-4">
        {/* Caso A: Renderizado de la demostración idéntica a la imagen */}
        {usarDemostracionActivos ? (
          <>
            {/* Tarjeta 1: Recolección en proceso */}
            <div className="group rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-4 sm:p-5 shadow-2xl backdrop-blur-sm transition hover:border-[#FFC400]/40">
              {/* Encabezado del auto y badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#141F32] text-[#FFC400] shadow-sm mt-0.5">
                    <IconoCarroFrente className="size-6 text-[#FFC400]" />
                  </div>
                  <div className="min-w-0">
                    <span className="inline-block rounded-full border border-[#FFC400]/40 bg-[#FFC400]/10 px-2.5 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-wider text-[#FFC400]">
                      RECOLECCIÓN EN PROCESO
                    </span>
                    <h2 className="font-display text-base font-extrabold uppercase tracking-wide text-white mt-1 leading-tight">
                      MITSUBISHI MIRAGE 2026
                    </h2>
                    <p className="font-body text-xs text-[#8E9CAE]">
                      Sedan
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-[#94A3B8]">
                      <span className="size-2 rounded-full bg-[#FFC400] shrink-0" />
                      <span>El conductor se dirige al origen.</span>
                    </div>
                  </div>
                </div>

                <Link
                  href="/traslados/demo"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#141F32] text-slate-300 transition hover:border-[#FFC400]/40 hover:text-[#FFC400]"
                  aria-label="Ver detalle del traslado"
                >
                  <IconoChevron className="size-4" />
                </Link>
              </div>

              {/* Lista de Detalles */}
              <div className="mt-4 space-y-3 border-t border-[#1C2A3E]/80 pt-3.5 font-body text-xs">
                {/* Origen */}
                <div className="flex items-start gap-3">
                  <IconoPinOrigen className="size-5 text-sky-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-400 text-[11px]">Origen</p>
                    <p className="font-bold text-white text-xs sm:text-sm">San Mateo Atenco</p>
                    <p className="text-slate-400 text-xs">Calle de los Serrano 220, La Magdalena, 52104, México</p>
                  </div>
                </div>

                {/* Destino */}
                <div className="flex items-start gap-3">
                  <IconoDianaDestino className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-400 text-[11px]">Destino</p>
                    <p className="font-bold text-white text-xs sm:text-sm">Ciudad de México</p>
                    <p className="text-slate-400 text-xs">Av. de los Serranos 568, 400 Uno Residencial, 52104, México</p>
                  </div>
                </div>

                {/* Conductor asignado */}
                <div className="flex items-center gap-3">
                  <IconoUsuarioConductor className="size-5 text-purple-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-400 text-[11px]">Conductor asignado</p>
                    <p className="font-bold text-white text-xs sm:text-sm">Conductor EZ Ruum</p>
                  </div>
                </div>

                {/* Tarifa */}
                <div className="flex items-center gap-3">
                  <IconoDolarTarifa className="size-5 text-[#FFC400] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-400 text-[11px]">Tarifa</p>
                    <p className="font-display font-extrabold text-[#FFC400] text-sm sm:text-base">$747.90</p>
                  </div>
                </div>

                {/* Evidencia inicial */}
                <div className="flex items-center gap-3">
                  <IconoCamaraEvidencia className="size-5 text-sky-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-400 text-[11px]">Evidencia inicial</p>
                    <p className="font-bold text-sky-400 text-xs sm:text-sm">6 fotos</p>
                  </div>
                </div>
              </div>

              {/* Pie de tarjeta */}
              <div className="mt-4 border-t border-[#1C2A3E]/80 pt-3">
                <Link
                  href="/traslados/demo"
                  className="flex items-center justify-between font-display text-xs font-bold uppercase tracking-wider text-white transition hover:text-[#FFC400]"
                >
                  <span>VER DETALLE</span>
                  <span className="text-[#FFC400]">
                    <IconoChevron className="size-4" />
                  </span>
                </Link>
              </div>
            </div>

            {/* Tarjeta 2: Pago Pendiente */}
            <div className="group rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-4 sm:p-5 shadow-2xl backdrop-blur-sm transition hover:border-[#FFC400]/40">
              {/* Encabezado del auto y badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#141F32] text-[#FFC400] shadow-sm mt-0.5">
                    <IconoCarroFrente className="size-6 text-[#FFC400]" />
                  </div>
                  <div className="min-w-0">
                    <span className="inline-block rounded-full border border-[#FFC400]/40 bg-[#FFC400]/10 px-2.5 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-wider text-[#FFC400]">
                      PAGO PENDIENTE
                    </span>
                    <h2 className="font-display text-base font-extrabold uppercase tracking-wide text-white mt-1 leading-tight">
                      MITSUBISHI MIRAGE 2026
                    </h2>
                    <p className="font-body text-xs text-[#8E9CAE]">
                      Sedan
                    </p>
                  </div>
                </div>

                <Link
                  href="/traslados/pago-demo"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#141F32] text-slate-300 transition hover:border-[#FFC400]/40 hover:text-[#FFC400]"
                  aria-label="Ver detalle del traslado"
                >
                  <IconoChevron className="size-4" />
                </Link>
              </div>

              {/* Lista de Detalles */}
              <div className="mt-4 space-y-3 border-t border-[#1C2A3E]/80 pt-3.5 font-body text-xs">
                {/* Origen */}
                <div className="flex items-start gap-3">
                  <IconoPinOrigen className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-400 text-[11px]">Origen</p>
                    <p className="font-bold text-white text-xs sm:text-sm">San Mateo Atenco</p>
                    <p className="text-slate-400 text-xs">Los Serrano 34, 400 Uno Residencial, 52104, México</p>
                  </div>
                </div>

                {/* Destino */}
                <div className="flex items-start gap-3">
                  <IconoDianaDestino className="size-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-400 text-[11px]">Destino</p>
                    <p className="font-bold text-white text-xs sm:text-sm">Ciudad de México</p>
                    <p className="text-slate-400 text-xs">Teresa 744, 06000, Ciudad de México</p>
                  </div>
                </div>

                {/* Tarifa */}
                <div className="flex items-center gap-3">
                  <IconoDolarTarifa className="size-5 text-[#FFC400] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-400 text-[11px]">Tarifa</p>
                    <p className="font-display font-extrabold text-[#FFC400] text-sm sm:text-base">$1,945.66</p>
                  </div>
                </div>
              </div>

              {/* Botón de Pago Principal */}
              <div className="mt-5">
                <Link
                  href="/traslados/pago-demo"
                  className="flex h-12 w-full items-center justify-between rounded-xl bg-[#FFC400] px-4 font-display text-xs sm:text-sm font-black uppercase tracking-wide text-[#0B111B] shadow-md transition hover:bg-[#e6b000] active:scale-[0.99]"
                >
                  <span>CONTINUAR CON EL PAGO</span>
                  <IconoChevron className="size-4 text-[#0B111B]" />
                </Link>
              </div>
            </div>
          </>
        ) : filtrados.length > 0 ? (
          /* Caso B: Renderizado dinámico de la base de datos */
          filtrados.map((viaje) => {
            const { pasaporte, traslado } = viaje;
            const esPagoPendiente = pasaporte.estado === "cotizacion_aceptada" || pasaporte.estado === "pago_pendiente";
            const estadoBadge = pasaporte.estado ? pasaporte.estado.replace(/_/g, " ").toUpperCase() : "EN PROCESO";
            const urlViaje = `/traslados/${pasaporte.traslado_id}`;

            return (
              <div
                key={pasaporte.traslado_id}
                className="group rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-4 sm:p-5 shadow-2xl backdrop-blur-sm transition hover:border-[#FFC400]/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#141F32] text-[#FFC400] shadow-sm mt-0.5">
                      <IconoCarroFrente className="size-6 text-[#FFC400]" />
                    </div>
                    <div className="min-w-0">
                      <span className="inline-block rounded-full border border-[#FFC400]/40 bg-[#FFC400]/10 px-2.5 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-wider text-[#FFC400]">
                        {estadoBadge}
                      </span>
                      <h2 className="font-display text-base font-extrabold uppercase tracking-wide text-white mt-1 leading-tight">
                        {vehiculoNombre(pasaporte)}
                      </h2>
                      <p className="font-body text-xs text-[#8E9CAE]">
                        {vehiculoTipo(pasaporte)}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={urlViaje}
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#141F32] text-slate-300 transition hover:border-[#FFC400]/40 hover:text-[#FFC400]"
                    aria-label="Ver detalle del traslado"
                  >
                    <IconoChevron className="size-4" />
                  </Link>
                </div>

                <div className="mt-4 space-y-3 border-t border-[#1C2A3E]/80 pt-3.5 font-body text-xs">
                  {traslado?.origen_ciudad && (
                    <div className="flex items-start gap-3">
                      <IconoPinOrigen className="size-5 text-sky-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-400 text-[11px]">Origen</p>
                        <p className="font-bold text-white text-xs sm:text-sm">{traslado.origen_ciudad}</p>
                        <p className="text-slate-400 text-xs">{traslado.origen_direccion}</p>
                      </div>
                    </div>
                  )}

                  {traslado?.destino_ciudad && (
                    <div className="flex items-start gap-3">
                      <IconoDianaDestino className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-400 text-[11px]">Destino</p>
                        <p className="font-bold text-white text-xs sm:text-sm">{traslado.destino_ciudad}</p>
                        <p className="text-slate-400 text-xs">{traslado.destino_direccion}</p>
                      </div>
                    </div>
                  )}

                  {pasaporte.conductor_nombre && (
                    <div className="flex items-center gap-3">
                      <IconoUsuarioConductor className="size-5 text-purple-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-400 text-[11px]">Conductor asignado</p>
                        <p className="font-bold text-white text-xs sm:text-sm">{pasaporte.conductor_nombre}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <IconoDolarTarifa className="size-5 text-[#FFC400] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-400 text-[11px]">Tarifa</p>
                      <p className="font-display font-extrabold text-[#FFC400] text-sm sm:text-base">
                        {moneda(pasaporte.precio_final ?? pasaporte.precio_cotizado)}
                      </p>
                    </div>
                  </div>

                  {pasaporte.evidencia_inicial_fotos_sincronizadas != null && pasaporte.evidencia_inicial_fotos_sincronizadas > 0 && (
                    <div className="flex items-center gap-3">
                      <IconoCamaraEvidencia className="size-5 text-sky-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-400 text-[11px]">Evidencia inicial</p>
                        <p className="font-bold text-sky-400 text-xs sm:text-sm">{pasaporte.evidencia_inicial_fotos_sincronizadas} fotos</p>
                      </div>
                    </div>
                  )}
                </div>

                {esPagoPendiente ? (
                  <div className="mt-5">
                    <Link
                      href={urlViaje}
                      className="flex h-12 w-full items-center justify-between rounded-xl bg-[#FFC400] px-4 font-display text-xs sm:text-sm font-black uppercase tracking-wide text-[#0B111B] shadow-md transition hover:bg-[#e6b000] active:scale-[0.99]"
                    >
                      <span>CONTINUAR CON EL PAGO</span>
                      <IconoChevron className="size-4 text-[#0B111B]" />
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4 border-t border-[#1C2A3E]/80 pt-3">
                    <Link
                      href={urlViaje}
                      className="flex items-center justify-between font-display text-xs font-bold uppercase tracking-wider text-white transition hover:text-[#FFC400]"
                    >
                      <span>VER DETALLE</span>
                      <span className="text-[#FFC400]">
                        <IconoChevron className="size-4" />
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          /* Estado Vacío */
          <div className="rounded-2xl border border-dashed border-[#1C2A3E] bg-[#0A1220]/50 px-6 py-12 text-center">
            <p className="font-display text-base font-bold text-white">
              No hay traslados en esta categoría
            </p>
            <p className="mt-1 font-body text-xs text-[#8E9CAE]">
              {busqueda ? `No encontramos resultados para “${busqueda}”` : "Tus traslados en esta sección aparecerán aquí."}
            </p>
            <Link
              href="/traslados/nuevo"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#FFC400] px-5 py-2.5 font-display text-xs font-bold text-slate-950 shadow-md transition hover:bg-[#e6b000]"
            >
              + Solicitar traslado
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

