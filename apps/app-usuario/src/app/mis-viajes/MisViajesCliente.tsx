"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";

type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type Traslado = Pick<
  Database["public"]["Tables"]["traslados"]["Row"],
  "id" | "origen_direccion" | "origen_ciudad" | "destino_direccion" | "destino_ciudad" | "fecha_hora_programada"
>;
type PestañaViajes = "activos" | "programados" | "finalizados" | "cancelados";

export interface ViajeLista {
  pasaporte: Pasaporte;
  traslado: Traslado | null;
}

type TonoEstado = "active" | "pending" | "success" | "error" | "neutral";

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

function IconoCalendario({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M7 3.5v3M17 3.5v3M3.5 9h17" />
    </svg>
  );
}

function IconoReloj({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3 2" />
    </svg>
  );
}

function IconoCarroFrente({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-4.66l.12-.34h13.77l.11.34V17z" />
      <circle cx="7.5" cy="14.5" r="1.5" />
      <circle cx="16.5" cy="14.5" r="1.5" />
    </svg>
  );
}

function IconoPinOrigen({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
    </svg>
  );
}

function IconoDianaDestino({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconoUsuarioConductor({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

function IconoChevron({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function IconoSoporte({ className = "size-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14h2v5H4a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2ZM20 14h-2v5h2a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2Z" />
      <path d="M18 20c-1 .9-2.3 1.5-4 1.5h-1" />
    </svg>
  );
}

function moneda(valor: number | null | undefined): string {
  if (valor == null) return "$0.00";
  return `$${Number(valor).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function vehiculoNombre(p: Pasaporte): string {
  const partes = [p.vehiculo_marca, p.vehiculo_modelo, p.vehiculo_anio].filter(Boolean);
  return partes.length > 0 ? partes.join(" ") : "Vehículo";
}

function vehiculoTipo(p: Pasaporte): string {
  if (!p.vehiculo_tipo) return "Sedán";
  return ETIQUETA_TIPO_VEHICULO[p.vehiculo_tipo] ?? p.vehiculo_tipo;
}

function pestañaDeViaje(p: Pasaporte): PestañaViajes {
  const estado = String(p.estado ?? "");
  if (estado === "servicio_cancelado" || estado === "traslado_fallido") return "cancelados";
  if (["servicio_cerrado", "reclamo_resuelto", "disputa_resuelta"].includes(estado)) return "finalizados";
  if ([
    "solicitud_creada",
    "documentacion_pendiente",
    "documentacion_en_revision",
    "documentacion_validada",
    "cotizacion_generada",
    "cotizacion_aceptada",
    "pago_pendiente",
    "servicio_confirmado",
    "pendiente_de_conductor",
  ].includes(estado)) return "programados";
  return "activos";
}

function estadoVisual(p: Pasaporte): { label: string; tone: TonoEstado } {
  switch (String(p.estado ?? "")) {
    case "pendiente_de_conductor":
      return { label: "Pendiente de conductor", tone: "pending" };
    case "cotizacion_aceptada":
    case "pago_pendiente":
      return { label: "Pago pendiente", tone: "pending" };
    case "servicio_confirmado":
      return { label: "Confirmado", tone: "success" };
    case "servicio_cerrado":
    case "reclamo_resuelto":
    case "disputa_resuelta":
      return { label: "Completado", tone: "success" };
    case "servicio_cancelado":
    case "traslado_fallido":
      return { label: "Cancelado", tone: "error" };
    case "en_ruta":
    case "en_recoleccion":
    case "vehiculo_entregado":
      return { label: "En curso", tone: "active" };
    default:
      return { label: "En proceso", tone: "neutral" };
  }
}

function fechaProgramada(fecha: string | null): { fecha: string; hora: string } {
  if (!fecha) return { fecha: "Fecha pendiente", hora: "Hora pendiente" };
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return { fecha: "Fecha pendiente", hora: "Hora pendiente" };

  const hoy = new Date();
  const esHoy = date.getFullYear() === hoy.getFullYear() && date.getMonth() === hoy.getMonth() && date.getDate() === hoy.getDate();
  const fechaTexto = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(date);
  const horaTexto = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit" }).format(date);
  return { fecha: esHoy ? `Hoy, ${fechaTexto}` : fechaTexto, hora: horaTexto };
}

function direccion(valor: string | null | undefined, fallback: string): string {
  return valor?.trim() || fallback;
}

function FichaVacia({ hayBusqueda, hayFiltro, pestana }: { hayBusqueda: boolean; hayFiltro: boolean; pestana: PestañaViajes }) {
  const titulo = hayBusqueda || hayFiltro ? "No se encontraron traslados" : `Sin traslados ${pestana}`;
  const descripcion = hayBusqueda || hayFiltro
    ? "Prueba con otro término o ajusta el filtro de vehículo."
    : "Tus traslados aparecerán aquí tan pronto como los registres en la plataforma.";

  return (
    <div className="user-v2-card p-8 text-center">
      <div className="user-v2-icon-well mx-auto mb-3 text-[var(--user-color-muted)]">
        <IconoCarroFrente className="size-7" />
      </div>
      <h3 className="user-v2-heading-3">{titulo}</h3>
      <p className="user-v2-caption user-v2-muted mx-auto mt-1 max-w-xs">{descripcion}</p>
      <Link href="/traslados/nuevo" className="user-v2-primary-button mx-auto mt-5 inline-flex items-center justify-center px-4">
        Solicitar traslado
      </Link>
    </div>
  );
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
  const [filtroAbierto, setFiltroAbierto] = useState(false);
  const [tipoVehiculoSeleccionado, setTipoVehiculoSeleccionado] = useState("");

  const conteos = useMemo(() => {
    const counts: Record<PestañaViajes, number> = { activos: 0, programados: 0, finalizados: 0, cancelados: 0 };
    for (const viaje of viajes) counts[pestañaDeViaje(viaje.pasaporte)]++;
    return counts;
  }, [viajes]);

  const tiposVehiculo = useMemo(() => {
    return Array.from(new Set(viajes.map(({ pasaporte }) => vehiculoTipo(pasaporte)))).sort((a, b) => a.localeCompare(b, "es"));
  }, [viajes]);

  const filtrados = useMemo(() => {
    let lista = viajes.filter(({ pasaporte }) => pestañaDeViaje(pasaporte) === pestana);
    if (tipoVehiculoSeleccionado) {
      lista = lista.filter(({ pasaporte }) => vehiculoTipo(pasaporte) === tipoVehiculoSeleccionado);
    }
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      lista = lista.filter(({ pasaporte, traslado }) => {
        const folio = pasaporte.traslado_id?.toLowerCase() ?? "";
        const veh = vehiculoNombre(pasaporte).toLowerCase();
        const origen = `${traslado?.origen_ciudad ?? ""} ${traslado?.origen_direccion ?? ""}`.toLowerCase();
        const destino = `${traslado?.destino_ciudad ?? ""} ${traslado?.destino_direccion ?? ""}`.toLowerCase();
        const conductor = (pasaporte.conductor_nombre ?? "").toLowerCase();
        const placas = (pasaporte.vehiculo_placas ?? "").toLowerCase();
        return folio.includes(q) || veh.includes(q) || origen.includes(q) || destino.includes(q) || conductor.includes(q) || placas.includes(q);
      });
    }
    return lista;
  }, [viajes, pestana, busqueda, tipoVehiculoSeleccionado]);

  function limpiarFiltros() {
    setBusqueda("");
    setTipoVehiculoSeleccionado("");
  }

  return (
    <div className="user-v2-screen">
      <section aria-labelledby="titulo-mis-traslados">
        <h1 id="titulo-mis-traslados" className="user-v2-heading-1">Mis traslados</h1>
        <p className="user-v2-body user-v2-muted mt-1">Consulta y administra tus traslados.</p>
      </section>

      <section aria-label="Buscar y filtrar traslados" className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="user-v2-search" htmlFor="buscar-traslado">
            <IconoBuscar className="size-6 shrink-0 text-[var(--user-color-muted)]" />
            <span className="sr-only">Buscar traslado</span>
            <input
              id="buscar-traslado"
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar traslado"
              className="user-v2-search-input"
            />
          </label>
          <button
            type="button"
            aria-controls="panel-filtros-traslados"
            aria-expanded={filtroAbierto}
            onClick={() => setFiltroAbierto((abierto) => !abierto)}
            className="user-v2-filter-button flex shrink-0 items-center justify-center gap-2 px-4"
          >
            <IconoFiltro className="size-5" />
            <span>Filtrar</span>
          </button>
        </div>
        <p className="user-v2-caption user-v2-muted px-1">Folio, placa, vehículo, ciudad o conductor</p>

        {filtroAbierto && (
          <div id="panel-filtros-traslados" className="user-v2-filter-panel">
            <label className="user-v2-filter-label" htmlFor="tipo-vehiculo">Tipo de vehículo</label>
            <select
              id="tipo-vehiculo"
              value={tipoVehiculoSeleccionado}
              onChange={(event) => setTipoVehiculoSeleccionado(event.target.value)}
              className="user-v2-filter-select"
            >
              <option value="">Todos los vehículos</option>
              {tiposVehiculo.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
            {(busqueda || tipoVehiculoSeleccionado) && (
              <button type="button" onClick={limpiarFiltros} className="user-v2-ghost-button mt-3 w-full px-4">
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </section>

      <section aria-label="Estados de los traslados" className="flex gap-2 overflow-x-auto no-scrollbar py-0.5" role="tablist">
        {([
          ["activos", "En curso"],
          ["programados", "Por iniciar"],
          ["finalizados", "Historial"],
          ["cancelados", "Cancelados"],
        ] as const).map(([id, etiqueta]) => {
          const activo = pestana === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activo}
              aria-controls="lista-traslados"
              onClick={() => setPestana(id)}
              className={`user-v2-ghost-button shrink-0 px-4 ${activo ? "border-[var(--user-color-brand)] bg-[var(--user-color-brand-soft)] text-[var(--user-color-brand-dark)]" : ""}`}
            >
              {etiqueta} ({conteos[id]})
            </button>
          );
        })}
      </section>

      <section id="lista-traslados" aria-live="polite" className="space-y-4">
        {filtrados.length === 0 ? (
          <FichaVacia hayBusqueda={Boolean(busqueda.trim())} hayFiltro={Boolean(tipoVehiculoSeleccionado)} pestana={pestana} />
        ) : (
          filtrados.map(({ pasaporte, traslado }) => {
            const { label, tone } = estadoVisual(pasaporte);
            const fecha = fechaProgramada(traslado?.fecha_hora_programada ?? null);
            const urlViaje = pasaporte.traslado_id ? `/traslados/${pasaporte.traslado_id}` : "/mis-viajes";
            const origenCiudad = pasaporte.origen_ciudad ?? traslado?.origen_ciudad;
            const destinoCiudad = pasaporte.destino_ciudad ?? traslado?.destino_ciudad;
            const esPagoPendiente = pasaporte.estado === "cotizacion_aceptada" || pasaporte.estado === "pago_pendiente";

            return (
              <article key={pasaporte.traslado_id ?? `${pasaporte.creado_en}-${pasaporte.estado}`} className="user-v2-trip-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="user-v2-icon-well mt-0.5 size-11">
                      <IconoCarroFrente className="size-6" />
                    </div>
                    <div className="min-w-0">
                      <span className={`user-v2-status user-v2-status--${tone}`} role="status">{label}</span>
                      <h2 className="user-v2-card-title mt-2 break-words">{vehiculoNombre(pasaporte)}</h2>
                      <p className="user-v2-caption user-v2-muted mt-0.5 break-words">
                        {vehiculoTipo(pasaporte)}{pasaporte.vehiculo_placas ? ` · Placas ${pasaporte.vehiculo_placas}` : ""}
                      </p>
                    </div>
                  </div>
                  <Link href={urlViaje} className="user-v2-ghost-button flex size-11 shrink-0 items-center justify-center px-0" aria-label="Ver detalle del traslado">
                    <IconoChevron />
                  </Link>
                </div>

                <div className="user-v2-trip-meta mt-4">
                  <div className="user-v2-trip-meta-item"><IconoCalendario className="size-5 shrink-0 text-[var(--user-color-action)]" /><span>{fecha.fecha}</span></div>
                  <div className="user-v2-trip-meta-item"><IconoReloj className="size-5 shrink-0 text-[var(--user-color-action)]" /><span>{fecha.hora}</span></div>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="user-v2-route-row">
                    <div className="user-v2-route-icon text-[var(--user-color-action)]"><IconoPinOrigen /></div>
                    <div className="min-w-0">
                      <p className="user-v2-caption user-v2-muted">Origen</p>
                      <p className="user-v2-card-title break-words">{direccion(origenCiudad, "Origen pendiente")}</p>
                      <p className="user-v2-caption user-v2-muted mt-0.5 break-words">{direccion(traslado?.origen_direccion ?? pasaporte.origen_direccion, "Dirección registrada")}</p>
                    </div>
                  </div>
                  <div className="user-v2-route-row">
                    <div className="user-v2-route-icon text-[var(--user-color-brand-dark)]"><IconoDianaDestino /></div>
                    <div className="min-w-0">
                      <p className="user-v2-caption user-v2-muted">Destino</p>
                      <p className="user-v2-card-title break-words">{direccion(destinoCiudad, "Destino pendiente")}</p>
                      <p className="user-v2-caption user-v2-muted mt-0.5 break-words">{direccion(traslado?.destino_direccion ?? pasaporte.destino_direccion, "Dirección registrada")}</p>
                    </div>
                  </div>
                  {pasaporte.conductor_nombre && (
                    <div className="user-v2-route-row">
                      <div className="user-v2-route-icon text-[var(--user-color-primary)]"><IconoUsuarioConductor /></div>
                      <div className="min-w-0"><p className="user-v2-caption user-v2-muted">Conductor asignado</p><p className="user-v2-card-title break-words">{pasaporte.conductor_nombre}</p></div>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center gap-3 border-t border-[var(--user-color-border)] pt-4">
                  <div className="user-v2-route-icon size-11 text-[var(--user-color-primary)]"><IconoDolarTarifa /></div>
                  <div><p className="user-v2-caption user-v2-muted">Tarifa</p><p className="text-xl font-bold text-[var(--user-color-brand-dark)]">{moneda(pasaporte.precio_final ?? pasaporte.precio_cotizado)}</p></div>
                </div>

                <Link href={urlViaje} className="user-v2-secondary-button mt-5 flex items-center justify-between px-4">
                  <span>{esPagoPendiente ? "Completar pago" : "Ver detalles del traslado"}</span>
                  <IconoChevron />
                </Link>
              </article>
            );
          })
        )}
      </section>

      <Link href="/soporte" className="user-v2-support-card user-v2-card-interactive">
        <span className="flex min-w-0 items-center gap-3">
          <IconoSoporte className="size-8 shrink-0" />
          <span className="min-w-0"><span className="user-v2-caption block">¿Dudas o necesitas ayuda con este traslado?</span><span className="user-v2-card-title mt-1 block text-[var(--user-color-action)]">Contactar soporte</span></span>
        </span>
        <IconoChevron className="size-5 shrink-0" />
      </Link>
    </div>
  );
}
