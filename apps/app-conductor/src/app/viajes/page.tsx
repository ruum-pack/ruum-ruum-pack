"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Aviso, PassportCard, EstadoBadge, EstatusBadgeEconomico } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO, MOTIVOS_RECHAZO, type EstatusEconomico, type MotivoRechazo } from "@ruum/shared/constants";
import { esElegibleParaViaje } from "@ruum/shared/rules";
import type { Database, Conductor } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import {
  listarViajesDisponibles,
  listarViajesAceptados,
  aceptarViaje,
  obtenerConductorActual,
  listarHistorialViajesConductor,
  registrarEvento
} from "@ruum/api/services";
import { ESTADOS_QUE_REQUIEREN_EVIDENCIA, ETIQUETA_SIGUIENTE_PASO } from "./[id]/AccionesViaje";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
type Pestana = "solicitados" | "aceptados";

interface DetalleOperativo {
  origen: string;
  destino: string;
  fechaHora: string;
  tipoServicio: string;
  requisitos: string;
  montoConductor: number;
}

type RechazoPendiente = {
  viaje: PasaporteRow;
  motivo: MotivoRechazo;
};

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: "solicitados", etiqueta: "Traslados esta semana" },
  { id: "aceptados", etiqueta: "Ganancias esta semana" }
];

function detalleFallback(viaje: PasaporteRow): DetalleOperativo {
  return {
    origen: "Origen por confirmar",
    destino: "Destino por confirmar",
    fechaHora: viaje.creado_en,
    tipoServicio: "Traslado estándar",
    requisitos: viaje.vehiculo_tipo ? `Nivel compatible con ${ETIQUETA_TIPO_VEHICULO[viaje.vehiculo_tipo]}.` : "Sin requisitos especiales.",
    montoConductor: Math.round(Number(viaje.precio_final ?? viaje.precio_cotizado ?? 0) * 0.4)
  };
}

function formatearFecha(fecha: string) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(fecha));
}

function formatearDiaCalendario(fecha: Date, esCompacto: boolean) {
  if (!esCompacto) return formatearFecha(fecha.toISOString());
  const iniciales = ["D", "L", "M", "X", "J", "V", "S"];
  return `${iniciales[fecha.getDay()]} ${fecha.getDate()}`;
}

function formatearHora(fecha: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City"
  }).format(new Date(fecha));
}

function formatearMoneda(monto: number) {
  return `$${monto.toLocaleString("es-MX")}`;
}

function inicioSemanaDomingo(fecha = new Date()) {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - inicio.getDay());
  return inicio;
}

function estaSemanaActual(fechaIso: string) {
  const inicio = inicioSemanaDomingo();
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 7);
  const fecha = new Date(fechaIso);
  return fecha >= inicio && fecha < fin;
}

function diasSemanaActual() {
  const inicio = inicioSemanaDomingo();
  return Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    return dia;
  });
}

function mismoDia(a: string, b: Date) {
  const fecha = new Date(a);
  return (
    fecha.getFullYear() === b.getFullYear() &&
    fecha.getMonth() === b.getMonth() &&
    fecha.getDate() === b.getDate()
  );
}

function nombreVehiculo(viaje: PasaporteRow) {
  return [viaje.vehiculo_marca, viaje.vehiculo_modelo, viaje.vehiculo_anio].filter(Boolean).join(" ") || "Vehículo";
}

function estatusEconomicoDeViaje(viaje: PasaporteRow): EstatusEconomico {
  if (viaje.estado === "servicio_cerrado") return "pagado";
  if (viaje.estado === "servicio_cancelado" || viaje.estado === "traslado_fallido") return "revocado";
  return "pendiente";
}

function useIsMobile() {
  const [esMobile, setEsMobile] = useState(false);

  useEffect(() => {
    function actualizar() {
      setEsMobile(window.innerWidth < 640);
    }

    actualizar();
    window.addEventListener("resize", actualizar);
    return () => window.removeEventListener("resize", actualizar);
  }, []);

  return esMobile;
}

export default function PaginaViajes() {
  const router = useRouter();
  const esMobile = useIsMobile();
  const [pestana, setPestana] = useState<Pestana>("solicitados");
  const [disponibles, setDisponibles] = useState<PasaporteRow[]>([]);
  const [rechazados, setRechazados] = useState<string[]>([]);
  const [aceptados, setAceptados] = useState<PasaporteRow[]>([]);
  const [historial, setHistorial] = useState<PasaporteRow[]>([]);
  const [detalles, setDetalles] = useState<Record<string, DetalleOperativo>>({});
  const [cargando, setCargando] = useState(true);
  const [aceptando, setAceptando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [viajeParaRechazar, setViajeParaRechazar] = useState<PasaporteRow | null>(null);
  const [rechazoPendiente, setRechazoPendiente] = useState<RechazoPendiente | null>(null);
  const timeoutRechazoRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRechazoRef.current) {
        window.clearTimeout(timeoutRechazoRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setAviso("Supabase no está configurado. No se pueden consultar viajes reales.");
        setCargando(false);
        return;
      }

      try {
        const cliente = crearClienteNavegador();
        const real = await obtenerConductorActual(cliente);
        const conductorActual: Conductor | null = real
          ? {
              id: real.id,
              nombre: real.nombre,
              estado: real.estado,
              calificacion_promedio: real.calificacion_promedio,
              traslados_completados: real.traslados_completados,
              suspensiones_activas: real.suspensiones_activas,
              no_presentaciones_6m: real.no_presentaciones_6m,
              cancelaciones_sin_justificacion_count: real.cancelaciones_sin_justificacion_count,
              documentos_vigentes: real.documentos_vigentes,
              certificaciones: [],
              incidencias_graves_6m: real.incidencias_graves_6m,
              incidencias_graves_12m: real.incidencias_graves_12m,
              creado_en: real.creado_en
            }
          : null;

        if (conductorActual) setConductor(conductorActual);

        const [listaDisponibles, listaAceptados, historialViajes] = await Promise.all([
          listarViajesDisponibles(cliente),
          conductorActual ? listarViajesAceptados(cliente, conductorActual.id) : Promise.resolve([]),
          conductorActual ? listarHistorialViajesConductor(cliente, conductorActual.id) : Promise.resolve([])
        ]);

        const todos = [...listaDisponibles, ...listaAceptados];
        if (todos.length > 0) {
          const ids = todos.map((viaje) => viaje.traslado_id);
          const { data } = await cliente
            .from("traslados")
            .select("id, origen_ciudad, origen_direccion, destino_ciudad, destino_direccion, fecha_hora_programada, tipo_servicio, motivo_servicio, instrucciones_especiales, precio_cotizado")
            .in("id", ids);
          const detallesReales = Object.fromEntries(
            (data ?? []).map((fila) => [
              fila.id,
              {
                origen: `${fila.origen_ciudad} · ${fila.origen_direccion}`,
                destino: `${fila.destino_ciudad} · ${fila.destino_direccion}`,
                fechaHora: fila.fecha_hora_programada ?? new Date().toISOString(),
                tipoServicio: fila.motivo_servicio ?? fila.tipo_servicio ?? "Traslado estándar",
                requisitos: fila.instrucciones_especiales ?? "Sin requisitos especiales.",
                montoConductor: Math.round(Number(fila.precio_cotizado ?? 0) * 0.4)
              } satisfies DetalleOperativo
            ])
          );
          setDetalles((prev) => ({ ...prev, ...detallesReales }));
        }

        setDisponibles(listaDisponibles);
        setAceptados(listaAceptados);
        setHistorial(historialViajes);
        if (!conductorActual) {
          setAviso("Inicia sesión como conductor para aceptar y ver tus viajes.");
        }
      } catch (err) {
        setAviso(err instanceof Error ? err.message : "No pudimos cargar los viajes.");
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  async function aceptar(trasladoId: string) {
    setAceptando(trasladoId);
    setAviso(null);

    try {
      if (!conductor) throw new Error("Inicia sesión como conductor para aceptar viajes.");
      const cliente = crearClienteNavegador();
      await aceptarViaje(cliente, trasladoId, conductor.id);
      const aceptado = disponibles.find((v) => v.traslado_id === trasladoId);
      setDisponibles((prev) => prev.filter((v) => v.traslado_id !== trasladoId));
      if (aceptado) setAceptados((prev) => [{ ...aceptado, estado: "conductor_asignado" }, ...prev]);
      setAviso("Viaje aceptado.");
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No pudimos aceptar el viaje. Intenta de nuevo.");
    } finally {
      setAceptando(null);
    }
  }

  async function persistirRechazo(pendiente: RechazoPendiente) {
    if (!conductor) throw new Error("Inicia sesión como conductor para rechazar viajes.");
    const cliente = crearClienteNavegador();
    await registrarEvento(cliente, "modificacion_traslado_activo", "conductor", conductor.id, {
      traslado_id: pendiente.viaje.traslado_id,
      accion: "rechazo_oferta_conductor",
      motivo: pendiente.motivo
    });
    setRechazoPendiente(null);
    setAviso("Rechazo registrado.");
  }

  function confirmarRechazo(motivo: MotivoRechazo) {
    if (!viajeParaRechazar || rechazoPendiente) return;

    const pendiente = { viaje: viajeParaRechazar, motivo };
    setViajeParaRechazar(null);
    setRechazados((prev) => [...prev, viajeParaRechazar.traslado_id]);
    setDisponibles((prev) => prev.filter((viaje) => viaje.traslado_id !== viajeParaRechazar.traslado_id));
    setRechazoPendiente(pendiente);
    setAviso(null);

    timeoutRechazoRef.current = window.setTimeout(() => {
      void persistirRechazo(pendiente).catch((err) => {
        setAviso(err instanceof Error ? err.message : "No pudimos registrar el rechazo.");
      });
    }, 5000);
  }

  function deshacerRechazo() {
    if (!rechazoPendiente) return;
    if (timeoutRechazoRef.current) {
      window.clearTimeout(timeoutRechazoRef.current);
      timeoutRechazoRef.current = null;
    }

    const { viaje } = rechazoPendiente;
    setDisponibles((prev) => prev.some((item) => item.traslado_id === viaje.traslado_id) ? prev : [viaje, ...prev]);
    setRechazados((prev) => prev.filter((id) => id !== viaje.traslado_id));
    setRechazoPendiente(null);
    setAviso("Rechazo deshecho. El viaje volvió a estar disponible.");
  }

  const disponiblesVisibles = disponibles.filter((viaje) => !rechazados.includes(viaje.traslado_id));
  const lista = pestana === "solicitados" ? disponiblesVisibles : aceptados;
  const estadisticasCompletas = useMemo(() => {
    const activos = aceptados.filter((viaje) => !["servicio_cerrado", "servicio_cancelado", "traslado_fallido"].includes(viaje.estado));

    return {
      activos: activos.length,
      pendientes: disponiblesVisibles.length
    };
  }, [aceptados, disponiblesVisibles]);
  const metricasSemana = useMemo(() => {
    const trasladosSemana = aceptados.filter((viaje) =>
      estaSemanaActual((detalles[viaje.traslado_id] ?? detalleFallback(viaje)).fechaHora)
    );
    const gananciasSemana = trasladosSemana.reduce(
      (total, viaje) => total + (detalles[viaje.traslado_id] ?? detalleFallback(viaje)).montoConductor,
      0
    );

    return {
      traslados: trasladosSemana.length,
      ganancias: gananciasSemana
    };
  }, [aceptados, detalles]);
  const calendario = useMemo(() => {
    const todos = [
      ...disponiblesVisibles.map((viaje) => ({ viaje, tipo: "Ofertado" })),
      ...aceptados.map((viaje) => ({ viaje, tipo: "Aceptado" }))
    ];
    return diasSemanaActual().map((dia) => ({
      dia,
      viajes: todos.filter(({ viaje }) => mismoDia((detalles[viaje.traslado_id] ?? detalleFallback(viaje)).fechaHora, dia))
    }));
  }, [aceptados, detalles, disponiblesVisibles]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/panel" className="font-body text-sm text-ink/55 underline-offset-4 hover:underline">
            Panel
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">Traslados</h1>
          <p className="mt-2 font-body text-sm text-ink/60">
            Centro operativo para aceptar viajes, consultar procesos activos y planear tu semana.
          </p>
        </div>
      </header>

      <section className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Calendario semanal</p>
          <h2 className="mt-1 font-display text-xl font-semibold">Semana actual · inicia en domingo</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-7">
            {calendario.map(({ dia, viajes }) => (
              <div
                key={dia.toISOString()}
                className={[
                  "rounded-lg border px-3 py-3 sm:min-h-28",
                  viajes.length > 0 ? "border-signal/50 bg-signal-soft/50" : "border-ink/10 bg-mist"
                ].join(" ")}
              >
                <p className="text-center font-body text-sm font-semibold capitalize sm:text-left sm:text-xs">
                  {formatearDiaCalendario(dia, esMobile)}
                </p>
                <p className="mt-1 text-center font-mono-ruum text-xs text-ink/45 sm:text-left">{viajes.length} viaje(s)</p>
                <div className="mt-3 hidden gap-1 sm:grid">
                  {viajes.slice(0, 2).map(({ viaje, tipo }) => (
                    <span key={`${tipo}-${viaje.traslado_id}`} className="truncate rounded bg-mist px-2 py-1 font-body text-[11px] text-ink/65">
                      {tipo}: {nombreVehiculo(viaje)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PassportCard>
        <details className="mt-4 rounded-xl border border-ink/10 bg-mist">
          <summary className="cursor-pointer px-4 py-3 font-body text-sm font-semibold text-ink/70">
            Ver estadísticas completas
          </summary>
          <div className="grid gap-3 border-t border-ink/10 px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Activos</p>
              <p className="mt-1 font-display text-2xl font-semibold">{estadisticasCompletas.activos}</p>
              <p className="font-body text-xs text-ink/45">en seguimiento</p>
            </div>
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Pendientes</p>
              <p className="mt-1 font-display text-2xl font-semibold">{estadisticasCompletas.pendientes}</p>
              <p className="font-body text-xs text-ink/45">por aceptar</p>
            </div>
          </div>
        </details>
      </section>

      <section className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPestana(p.id)}
              aria-pressed={pestana === p.id}
              className={[
                "relative overflow-hidden rounded-card border border-ink/15 border-l-4 border-l-signal bg-mist p-5 text-left shadow-1",
                "transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-signal/45 hover:shadow-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2",
                pestana === p.id ? "ring-2 ring-signal/45" : ""
              ].join(" ")}
            >
              <svg
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-40 w-full text-ink opacity-[0.04]"
                viewBox="0 0 420 160"
                preserveAspectRatio="none"
              >
                <path
                  d="M-20 112C38 58 82 58 140 112s102 54 160 0 102-54 160 0M-20 86C38 32 82 32 140 86s102 54 160 0 102-54 160 0M-20 138C38 84 82 84 140 138s102 54 160 0 102-54 160 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
              <span className="relative block font-body text-xs font-medium uppercase tracking-wide text-ink/45">{p.etiqueta}</span>
              <span className="relative mt-2 block font-display text-3xl font-bold text-ink">
                {p.id === "solicitados" ? metricasSemana.traslados : formatearMoneda(metricasSemana.ganancias)}
              </span>
              <span className="relative mt-1 block font-body text-xs text-ink/45">
                {p.id === "solicitados" ? "programado(s)" : "monto estimado"}
              </span>
            </button>
          ))}
        </div>

        {aviso && (
          <div className="mt-4" role="status" aria-live="polite" aria-atomic="true">
            <Aviso tono="info">{aviso}</Aviso>
          </div>
        )}

        <div className="mt-6 grid gap-4">
          {cargando ? (
            /* Ítem 9 — skeleton reemplaza "Cargando…" */
            <div aria-label="Cargando viajes" aria-busy="true" className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-card border border-ink/10 p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="h-4 w-36 animate-pulse rounded bg-ink/8" />
                      <div className="h-3 w-20 animate-pulse rounded bg-ink/6" />
                    </div>
                    <div className="h-6 w-20 animate-pulse rounded-full bg-ink/8" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-9 animate-pulse rounded-lg bg-ink/6" />
                    <div className="h-9 animate-pulse rounded-lg bg-ink/8" />
                  </div>
                </div>
              ))}
            </div>
          ) : lista.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ink/15 px-4 py-8 text-center font-body text-sm text-ink/50">
              {pestana === "solicitados" ? "No hay viajes disponibles por ahora." : "Todavía no has aceptado ningún viaje."}
            </p>
          ) : (
            lista.map((viaje) => {
              const detalle = detalles[viaje.traslado_id] ?? detalleFallback(viaje);
              const estadoActual = viaje.estado as EstadoTraslado;
              const requiereEvidencia = ESTADOS_QUE_REQUIEREN_EVIDENCIA.includes(estadoActual);
              const etiquetaSiguientePaso = ETIQUETA_SIGUIENTE_PASO[estadoActual] ?? "Consultar estatus";
              const elegibilidad = viaje.vehiculo_tipo
                ? conductor
                  ? esElegibleParaViaje(conductor, viaje.vehiculo_tipo, "intraurbana")
                  : { elegible: false, motivo: "Inicia sesión como conductor para validar elegibilidad." }
                : { elegible: Boolean(conductor), motivo: "Inicia sesión como conductor para aceptar viajes." };

              return (
                <PassportCard key={viaje.traslado_id} folio={viaje.traslado_id.slice(0, 8).toUpperCase()}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-body text-xs uppercase tracking-wide text-ink/45">
                        {pestana === "solicitados" ? "Viaje ofertado" : "Viaje aceptado"}
                      </p>
                      <h2 className="mt-1 font-display text-xl font-semibold">
                        {nombreVehiculo(viaje)}
                        {viaje.vehiculo_tipo && (
                          <span className="ml-2 font-body text-xs font-normal text-ink/45">
                            · {ETIQUETA_TIPO_VEHICULO[viaje.vehiculo_tipo]}
                          </span>
                        )}
                      </h2>
                    </div>
                    {pestana === "solicitados" ? (
                      <div className="flex flex-col items-stretch gap-3 sm:items-end">
                        <div className="rounded-xl border border-control/20 bg-control-soft px-4 py-2 text-left shadow-sm sm:text-right">
                          <p className="font-display text-lg font-bold text-control">
                            {formatearMoneda(detalle.montoConductor)}
                          </p>
                          <p className="font-body text-xs text-ink/45">tu ganancia estimada</p>
                        </div>
                        <div className="grid gap-4">
                          <Button
                            variant="primario"
                            className="w-full"
                            onClick={() => aceptar(viaje.traslado_id)}
                            disabled={!elegibilidad.elegible || aceptando === viaje.traslado_id || Boolean(rechazoPendiente)}
                          >
                            {aceptando === viaje.traslado_id ? "Aceptando…" : "Aceptar"}
                          </Button>
                          <button
                            type="button"
                            onClick={() => setViajeParaRechazar(viaje)}
                            disabled={Boolean(rechazoPendiente)}
                            className="min-h-9 rounded-lg px-3 py-2 font-body text-sm font-semibold text-route-dark transition-colors hover:bg-route-soft disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <EstadoBadge estado={viaje.estado} />
                    )}
                  </div>

                  {pestana === "solicitados" && !elegibilidad.elegible && (
                    <div className="mt-4">
                      <Aviso tono="atencion">No elegible: {elegibilidad.motivo}</Aviso>
                    </div>
                  )}

                  <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Origen</dt>
                      <dd className="mt-1 font-body text-sm font-medium">{detalle.origen}</dd>
                    </div>
                    <div>
                      <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Destino</dt>
                      <dd className="mt-1 font-body text-sm font-medium">{detalle.destino}</dd>
                    </div>
                    <div>
                      <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Fecha y hora</dt>
                      <dd className="mt-1 font-body text-sm font-medium">
                        {formatearFecha(detalle.fechaHora)} · {formatearHora(detalle.fechaHora)}
                      </dd>
                    </div>
                    {pestana === "aceptados" && (
                      <div>
                        <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Monto conductor</dt>
                        <dd className="mt-1 font-mono-ruum text-sm font-medium">{formatearMoneda(detalle.montoConductor)}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Tipo de vehículo</dt>
                      <dd className="mt-1 font-body text-sm font-medium">
                        {viaje.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[viaje.vehiculo_tipo] : "Por definir"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Tipo de servicio</dt>
                      <dd className="mt-1 font-body text-sm font-medium">{detalle.tipoServicio}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Requisitos especiales</dt>
                      <dd className="mt-1 font-body text-sm font-medium">{detalle.requisitos}</dd>
                    </div>
                  </dl>

                  <div className="mt-5">
                    {pestana === "aceptados" ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-end">
                        <div className="grid w-full gap-3 sm:max-w-xs">
                          <Button
                            variant="primario"
                            className="w-full"
                            onClick={() => router.push(`/viajes/${viaje.traslado_id}`)}
                          >
                            {etiquetaSiguientePaso}
                          </Button>
                          {requiereEvidencia && (
                            <Button
                              variant="secundario"
                              className="w-full"
                              onClick={() => router.push(`/viajes/${viaje.traslado_id}/evidencia`)}
                            >
                              Cargar evidencia
                            </Button>
                          )}
                        </div>
                        <details className="relative self-end">
                          <summary
                            aria-label="Más acciones del viaje"
                            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-xl border border-ink/10 bg-mist font-display text-xl font-bold leading-none text-ink/65 shadow-sm transition hover:border-route-dark hover:bg-route-soft hover:text-route-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-dark [&::-webkit-details-marker]:hidden"
                          >
                            ⋮
                          </summary>
                          <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-ink/10 bg-mist py-1 shadow-[0_14px_40px_rgba(26,31,46,0.16)]">
                            <Link href={`/viajes/${viaje.traslado_id}`} className="block px-4 py-2.5 font-body text-sm font-medium text-ink/70 hover:bg-route-soft hover:text-route-dark">
                              Ver detalles
                            </Link>
                            <Link href={`/viajes/${viaje.traslado_id}`} className="block px-4 py-2.5 font-body text-sm font-medium text-ink/70 hover:bg-route-soft hover:text-route-dark">
                              Reportar incidencia
                            </Link>
                            <Link href={`/viajes/${viaje.traslado_id}`} className="block px-4 py-2.5 font-body text-sm font-medium text-ink/70 hover:bg-route-soft hover:text-route-dark">
                              Confirmar entrega
                            </Link>
                          </div>
                        </details>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <Link href={`/viajes/${viaje.traslado_id}`} className="font-body text-sm font-medium text-ink/60 hover:text-ink">
                          Ver detalles completos
                        </Link>
                      </div>
                    )}
                  </div>
                </PassportCard>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-6">
        <PassportCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Historial de viajes</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Últimos movimientos</h2>
            </div>
            <span className="font-body text-sm font-medium text-ink/45">{historial.length} registro(s)</span>
          </div>
          <div className="mt-4 divide-y divide-ink/10">
            {historial.length === 0 && (
              <p className="py-4 font-body text-sm text-ink/55">No hay traslados reales en tu historial todavía.</p>
            )}
            {historial.map((viaje) => (
              <div
                key={viaje.traslado_id}
                className="grid gap-2 py-3 font-body text-sm sm:grid-cols-[0.8fr_1.4fr_0.9fr_0.8fr_0.8fr] sm:items-center"
              >
                <span className="text-ink/50">{formatearFecha(viaje.actualizado_en)}</span>
                <span className="font-medium">{nombreVehiculo(viaje)}</span>
                <span>{viaje.estado.replaceAll("_", " ")}</span>
                <EstatusBadgeEconomico estatus={estatusEconomicoDeViaje(viaje)} className="justify-self-start" />
                <span className="font-mono-ruum">
                  {formatearMoneda(Number(viaje.precio_final ?? viaje.precio_cotizado ?? 0))}
                </span>
              </div>
            ))}
          </div>
        </PassportCard>
      </section>

      {viajeParaRechazar && (
        <div className="fixed inset-0 z-50 bg-ink/45" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rechazo-viaje-titulo"
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-ink/10 bg-mist p-5 shadow-[0_-24px_70px_rgba(26,31,46,0.22)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="rechazo-viaje-titulo" className="font-display text-lg font-semibold">
                  Motivo de rechazo
                </p>
                <p className="mt-1 font-body text-sm text-ink/55">
                  {nombreVehiculo(viajeParaRechazar)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViajeParaRechazar(null)}
                className="rounded-lg border border-ink/10 px-3 py-2 font-body text-sm font-semibold text-ink/65"
              >
                Cerrar
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {MOTIVOS_RECHAZO.map((motivo) => (
                <button
                  key={motivo}
                  type="button"
                  onClick={() => confirmarRechazo(motivo)}
                  className="rounded-xl border border-ink/10 bg-mist px-4 py-3 text-left font-body text-sm font-semibold text-ink/75 transition-colors hover:border-route-dark hover:bg-route-soft"
                >
                  {motivo}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {rechazoPendiente && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-50 rounded-xl border border-ink/10 bg-ink px-4 py-3 text-mist shadow-[0_18px_50px_rgba(26,31,46,0.28)] sm:left-auto sm:right-6 sm:w-[360px]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-body text-sm font-semibold">Viaje rechazado</p>
              <p className="mt-0.5 font-body text-xs text-mist/65">{rechazoPendiente.motivo}</p>
            </div>
            <button
              type="button"
              onClick={deshacerRechazo}
              className="rounded-lg bg-mist px-3 py-2 font-body text-xs font-bold text-ink"
            >
              Deshacer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
