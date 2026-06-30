"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Aviso, PassportCard, EstadoBadge } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import { esElegibleParaViaje } from "@ruum/shared/rules";
import type { Database, Conductor } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { listarViajesDisponibles, listarViajesAceptados, aceptarViaje, obtenerConductorActual } from "@ruum/api/services";
import { CONDUCTOR_DEMO, VIAJES_DISPONIBLES_DEMO, VIAJES_ACEPTADOS_DEMO } from "../../lib/datos-demo";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type Pestana = "solicitados" | "aceptados";

interface DetalleOperativo {
  origen: string;
  destino: string;
  fechaHora: string;
  tipoServicio: string;
  requisitos: string;
  montoConductor: number;
}

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: "solicitados", etiqueta: "Viajes solicitados" },
  { id: "aceptados", etiqueta: "Viajes aceptados" }
];

const DETALLES_DEMO: Record<string, DetalleOperativo> = {
  "demo-disponible-001": {
    origen: "Polanco, CDMX",
    destino: "Santa Fe, CDMX",
    fechaHora: new Date(Date.now() + 1000 * 60 * 90).toISOString(),
    tipoServicio: "Entrega a cliente",
    requisitos: "SUV, evidencia inicial completa, contacto en agencia.",
    montoConductor: 720
  },
  "demo-disponible-002": {
    origen: "Roma Norte, CDMX",
    destino: "Narvarte, CDMX",
    fechaHora: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
    tipoServicio: "Traslado personal",
    requisitos: "Sedán manual, llamada al llegar al origen.",
    montoConductor: 410
  },
  "demo-aceptado-001": {
    origen: "Condesa, CDMX",
    destino: "Naucalpan, Edo. Méx.",
    fechaHora: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    tipoServicio: "Recuperación",
    requisitos: "Mantener chat activo y reportar llegada a destino.",
    montoConductor: 650
  },
  "demo-aceptado-002": {
    origen: "Del Valle, CDMX",
    destino: "Coyoacán, CDMX",
    fechaHora: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
    tipoServicio: "Traslado especial",
    requisitos: "Capturar evidencia inicial antes de mover la unidad.",
    montoConductor: 520
  }
};

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

export default function PaginaViajes() {
  const [pestana, setPestana] = useState<Pestana>("solicitados");
  const [disponibles, setDisponibles] = useState<PasaporteRow[]>([]);
  const [rechazados, setRechazados] = useState<string[]>([]);
  const [aceptados, setAceptados] = useState<PasaporteRow[]>([]);
  const [detalles, setDetalles] = useState<Record<string, DetalleOperativo>>(DETALLES_DEMO);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [aceptando, setAceptando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conductor, setConductor] = useState<Conductor>(CONDUCTOR_DEMO);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setDisponibles(VIAJES_DISPONIBLES_DEMO);
        setAceptados(VIAJES_ACEPTADOS_DEMO);
        setEsDemo(true);
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

        const [listaDisponibles, listaAceptados] = await Promise.all([
          listarViajesDisponibles(cliente),
          conductorActual ? listarViajesAceptados(cliente, conductorActual.id) : Promise.resolve([])
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
        setEsDemo(!conductorActual);
      } catch {
        setDisponibles(VIAJES_DISPONIBLES_DEMO);
        setAceptados(VIAJES_ACEPTADOS_DEMO);
        setEsDemo(true);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  async function aceptar(trasladoId: string) {
    setAceptando(trasladoId);
    setAviso(null);

    if (esDemo) {
      await new Promise((r) => setTimeout(r, 400));
      const aceptado = disponibles.find((v) => v.traslado_id === trasladoId);
      setAviso("Viaje aceptado en modo demo. Conecta Supabase para que se guarde de verdad.");
      setDisponibles((prev) => prev.filter((v) => v.traslado_id !== trasladoId));
      if (aceptado) setAceptados((prev) => [{ ...aceptado, estado: "conductor_asignado" }, ...prev]);
      setAceptando(null);
      return;
    }

    try {
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

  function rechazar(trasladoId: string) {
    setRechazados((prev) => [...prev, trasladoId]);
    setDisponibles((prev) => prev.filter((viaje) => viaje.traslado_id !== trasladoId));
    setAviso("Viaje rechazado para esta vista. En producción se registrará el motivo operativo.");
  }

  const disponiblesVisibles = disponibles.filter((viaje) => !rechazados.includes(viaje.traslado_id));
  const lista = pestana === "solicitados" ? disponiblesVisibles : aceptados;
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
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="font-body text-sm text-ink/55 underline-offset-4 hover:underline">
            Panel
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">Viajes</h1>
          <p className="mt-2 font-body text-sm text-ink/60">
            Centro operativo para aceptar viajes, consultar procesos activos y planear tu semana.
          </p>
        </div>
        <Link href="/ganancias">
          <Button variant="secundario">Mis ganancias</Button>
        </Link>
      </header>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no viajes reales.</Aviso>
        </div>
      )}

      <section className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Calendario semanal</p>
          <h2 className="mt-1 font-display text-xl font-semibold">Semana actual · inicia en domingo</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-7">
            {calendario.map(({ dia, viajes }) => (
              <div
                key={dia.toISOString()}
                className={[
                  "min-h-28 rounded-lg border px-3 py-3",
                  viajes.length > 0 ? "border-signal/30 bg-signal-soft/40" : "border-ink/10 bg-paper"
                ].join(" ")}
              >
                <p className="font-body text-xs font-semibold capitalize">{formatearFecha(dia.toISOString())}</p>
                <p className="mt-1 font-mono-ruum text-xs text-ink/45">{viajes.length} viaje(s)</p>
                <div className="mt-3 grid gap-1">
                  {viajes.slice(0, 2).map(({ viaje, tipo }) => (
                    <span key={`${tipo}-${viaje.traslado_id}`} className="truncate rounded bg-paper px-2 py-1 font-body text-[11px] text-ink/65">
                      {tipo}: {nombreVehiculo(viaje)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PassportCard>
      </section>

      <section className="mt-6">
        <div className="grid gap-2 sm:grid-cols-2">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              className={[
                "rounded-lg border px-4 py-3 text-left font-body text-sm transition-colors",
                pestana === p.id ? "border-signal bg-signal-soft text-signal" : "border-ink/10 text-ink/60 hover:border-ink/25"
              ].join(" ")}
            >
              <span className="font-semibold">{p.etiqueta}</span>
              <span className="ml-2 font-mono-ruum text-xs">
                {p.id === "solicitados" ? disponiblesVisibles.length : aceptados.length}
              </span>
            </button>
          ))}
        </div>

        {aviso && (
          <div className="mt-4">
            <Aviso tono="info">{aviso}</Aviso>
          </div>
        )}

        <div className="mt-6 grid gap-4">
          {cargando ? (
            <p className="font-body text-sm text-ink/50">Cargando…</p>
          ) : lista.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ink/15 px-4 py-8 text-center font-body text-sm text-ink/50">
              {pestana === "solicitados" ? "No hay viajes disponibles por ahora." : "Todavía no has aceptado ningún viaje."}
            </p>
          ) : (
            lista.map((viaje) => {
              const detalle = detalles[viaje.traslado_id] ?? detalleFallback(viaje);
              const elegibilidad = viaje.vehiculo_tipo
                ? esElegibleParaViaje(conductor, viaje.vehiculo_tipo, "intraurbana")
                : { elegible: true };

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
                    <EstadoBadge estado={viaje.estado} />
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
                    <div>
                      <dt className="font-body text-xs uppercase tracking-wide text-ink/45">Monto conductor</dt>
                      <dd className="mt-1 font-mono-ruum text-sm font-medium">{formatearMoneda(detalle.montoConductor)}</dd>
                    </div>
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

                  <div className="mt-5 flex flex-wrap justify-end gap-3">
                    <Link href={`/viajes/${viaje.traslado_id}`} className="font-body text-sm font-medium text-ink/60 hover:text-ink">
                      Ver detalles completos
                    </Link>
                    {pestana === "aceptados" && (
                      <>
                        <Link href={`/viajes/${viaje.traslado_id}`} className="font-body text-sm font-medium text-signal">
                          Iniciar / consultar estatus
                        </Link>
                        <Link href={`/viajes/${viaje.traslado_id}/evidencia`} className="font-body text-sm font-medium text-signal">
                          Cargar evidencia
                        </Link>
                        <Link href={`/viajes/${viaje.traslado_id}`} className="font-body text-sm font-medium text-ink/60 hover:text-ink">
                          Reportar incidencia
                        </Link>
                        <Link href={`/viajes/${viaje.traslado_id}`} className="font-body text-sm font-medium text-ink/60 hover:text-ink">
                          Confirmar entrega
                        </Link>
                      </>
                    )}
                    {pestana === "solicitados" && (
                      <>
                        <Button
                          onClick={() => aceptar(viaje.traslado_id)}
                          disabled={!elegibilidad.elegible || aceptando === viaje.traslado_id}
                        >
                          {aceptando === viaje.traslado_id ? "Aceptando…" : "Aceptar"}
                        </Button>
                        <Button variant="fantasma" onClick={() => rechazar(viaje.traslado_id)}>
                          Rechazar
                        </Button>
                      </>
                    )}
                  </div>
                </PassportCard>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
