"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Aviso, PassportCard, EstadoBadge } from "@ruum/ui";
import type { Conductor } from "@ruum/shared/types";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import {
  guardarDisponibilidadConductor,
  listarViajesAceptados,
  listarViajesDisponibles,
  obtenerDisponibilidadConductor,
  obtenerConductorActual
} from "@ruum/api/services";
import { RegistroViajeActivo, viajePermiteFabEmergencia } from "./ViajeActivoContext";
import { ConfirmarDisponibilidad } from "./ConfirmarDisponibilidad";

type Disponibilidad = "disponible" | "no_disponible" | "en_viaje";
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

const ESTADOS_DISPONIBILIDAD: Record<Disponibilidad, { etiqueta: string; descripcion: string }> = {
  disponible: {
    etiqueta: "Disponible",
    descripcion: "Puedes recibir y aceptar viajes compatibles con tu perfil operativo."
  },
  no_disponible: {
    etiqueta: "No disponible",
    descripcion: "No aparecerás como candidato para nuevos viajes hasta que actives tu disponibilidad."
  },
  en_viaje: {
    etiqueta: "En viaje",
    descripcion: "Estado automático mientras tienes un traslado activo; termina al cerrar la operación."
  }
};

const ESTILO_DISPONIBILIDAD: Record<Disponibilidad, string> = {
  disponible: "border-control/30 bg-control-soft text-control",
  no_disponible: "border-ink/15 bg-ink/[0.03] text-ink/55",
  en_viaje: "border-route/30 bg-route-soft text-route-dark"
};

const OPCIONES_DISPONIBILIDAD: Disponibilidad[] = ["disponible", "no_disponible"];
const ESTADOS_TERMINALES = ["servicio_cerrado", "servicio_cancelado", "traslado_fallido"];

function inicioSemana(fecha = new Date()) {
  const copia = new Date(fecha);
  const dia = copia.getDay() || 7;
  copia.setHours(0, 0, 0, 0);
  copia.setDate(copia.getDate() - dia + 1);
  return copia;
}

function estaSemana(fechaIso: string) {
  return new Date(fechaIso) >= inicioSemana();
}

function formatearMoneda(valor: number) {
  return `$${valor.toLocaleString("es-MX")}`;
}

function nombreVehiculo(viaje: PasaporteRow) {
  return [viaje.vehiculo_marca, viaje.vehiculo_modelo, viaje.vehiculo_anio].filter(Boolean).join(" ") || "Vehículo";
}

function folioViaje(viaje: PasaporteRow) {
  return viaje.traslado_id.slice(0, 8).toUpperCase();
}

export default function PaginaPanel() {
  const router = useRouter();
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad>("disponible");
  const [disponibilidadPendiente, setDisponibilidadPendiente] = useState<Disponibilidad | null>(null);
  const [persistiendoDisponibilidad, setPersistiendoDisponibilidad] = useState(false);
  const [errorDisponibilidad, setErrorDisponibilidad] = useState<string | null>(null);
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [viajesAceptados, setViajesAceptados] = useState<PasaporteRow[]>([]);
  const [viajesDisponibles, setViajesDisponibles] = useState<PasaporteRow[]>([]);
  const ultimoTriggerDisponibilidadRef = useRef(0);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) return;
      try {
        const cliente = crearClienteNavegador();
        const real = await obtenerConductorActual(cliente);
        if (!real) return;

        setConductor({
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
        });

        const [aceptados, disponibles, disponibilidadOperativa] = await Promise.all([
          listarViajesAceptados(cliente, real.id),
          listarViajesDisponibles(cliente),
          obtenerDisponibilidadConductor(cliente, real.id)
        ]);
        setViajesAceptados(aceptados);
        setViajesDisponibles(disponibles);
        if (aceptados.some((viaje) => viaje.estado === "traslado_en_curso")) {
          setDisponibilidad("en_viaje");
        } else {
          setDisponibilidad(disponibilidadOperativa);
        }
      } catch (err) {
        setErrorDisponibilidad(err instanceof Error ? err.message : "No pudimos cargar tu información operativa.");
      }
    }
    cargar();
  }, []);

  const resumen = useMemo(() => {
    const viajesSemana = viajesAceptados.filter((viaje) => estaSemana(viaje.actualizado_en));
    const activos = viajesAceptados.filter(
      (viaje) => !ESTADOS_TERMINALES.includes(viaje.estado)
    );
    const realizados = viajesAceptados.filter((viaje) => viaje.estado === "servicio_cerrado" && estaSemana(viaje.actualizado_en)).length;

    return {
      realizados,
      viajesSemana: viajesSemana.length,
      activos: activos.length,
      pendientes: viajesDisponibles.length,
      gananciasSemana: viajesSemana.reduce((total, viaje) => total + Number(viaje.precio_final ?? viaje.precio_cotizado ?? 0), 0)
    };
  }, [viajesAceptados, viajesDisponibles]);
  const viajeActivoFab = useMemo(
    () => viajesAceptados.find((viaje) => viajePermiteFabEmergencia(viaje.estado)) ?? null,
    [viajesAceptados]
  );
  const viajesActivos = useMemo(
    () => viajesAceptados.filter((viaje) => !ESTADOS_TERMINALES.includes(viaje.estado)),
    [viajesAceptados]
  );
  const viajeActivoPrincipal = viajesActivos[0] ?? null;

  const mensajes = useMemo(
    () => [
      {
        titulo: viajesDisponibles.length > 0 ? "Viajes disponibles" : "Sin viajes nuevos",
        cuerpo:
          viajesDisponibles.length > 0
            ? `Hay ${viajesDisponibles.length} viaje(s) pendiente(s) de aceptación.`
            : "Te avisaremos cuando haya viajes compatibles con tu perfil."
      },
      {
        titulo: "Pago semanal",
        cuerpo: "Consulta tus depósitos y payouts registrados en la sección de ganancias."
      },
      {
        titulo: "Operación",
        cuerpo:
          disponibilidad === "en_viaje"
            ? "Tienes un traslado activo. Mantén evidencia y comunicación al día."
            : "Activa tu disponibilidad para aparecer en la asignación de viajes."
      }
    ],
    [disponibilidad, viajesDisponibles.length]
  );

  const persistirDisponibilidad = useCallback(
    async (nuevaDisponibilidad: Exclude<Disponibilidad, "en_viaje">) => {
      const anterior = disponibilidad;
      setDisponibilidad(nuevaDisponibilidad);
      setPersistiendoDisponibilidad(true);
      setErrorDisponibilidad(null);

      try {
        if (!conductor) throw new Error("Inicia sesión como conductor para cambiar tu disponibilidad.");
        const cliente = crearClienteNavegador();
        await guardarDisponibilidadConductor(cliente, conductor.id, nuevaDisponibilidad);
      } catch (err) {
        setDisponibilidad(anterior);
        setErrorDisponibilidad(
          err instanceof Error
            ? err.message
            : "No pudimos actualizar tu disponibilidad. Restauramos el estado anterior."
        );
      } finally {
        setPersistiendoDisponibilidad(false);
        setDisponibilidadPendiente(null);
      }
    },
    [disponibilidad, conductor]
  );

  const seleccionarDisponibilidad = useCallback(
    (nuevaDisponibilidad: Disponibilidad) => {
      const ahora = Date.now();
      if (ahora - ultimoTriggerDisponibilidadRef.current < 500) return;
      ultimoTriggerDisponibilidadRef.current = ahora;

      if (disponibilidad === "en_viaje" || nuevaDisponibilidad === "en_viaje" || persistiendoDisponibilidad) return;
      if (disponibilidad === nuevaDisponibilidad) return;

      if (nuevaDisponibilidad === "no_disponible") {
        setDisponibilidadPendiente(nuevaDisponibilidad);
        return;
      }

      void persistirDisponibilidad(nuevaDisponibilidad);
    },
    [disponibilidad, persistiendoDisponibilidad, persistirDisponibilidad]
  );

  async function cerrarSesion() {
    const cliente = crearClienteNavegador();
    await cliente.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <RegistroViajeActivo
        viaje={
          viajeActivoFab
            ? {
                trasladoId: viajeActivoFab.traslado_id,
                estado: viajeActivoFab.estado
              }
            : null
        }
      />
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight">Panel</h1>
          <p className="mt-1 font-body text-sm text-ink/55">Hola, {conductor?.nombre ?? "conductor"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/configuracion">
            <Button variant="fantasma">Configuración</Button>
          </Link>
          {conductor ? (
            <button onClick={cerrarSesion} className="font-body text-sm text-ink/60 hover:text-ink">
              Cerrar sesión
            </button>
          ) : (
            <Link href="/login" className="font-body text-sm font-medium text-ink/70 hover:text-ink">
              Iniciar sesión
            </Link>
          )}
        </div>
      </header>

      {errorDisponibilidad && (
        <div className="mt-4">
          <Aviso tono="peligro">{errorDisponibilidad}</Aviso>
        </div>
      )}

      <section className="mt-8">
        <PassportCard>
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Zona A · Disponibilidad</p>
              <h2 className="mt-2 font-display text-2xl font-semibold">
                {viajeActivoPrincipal ? "Tienes un viaje activo" : "Listo para operar"}
              </h2>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span
                  title={ESTADOS_DISPONIBILIDAD[disponibilidad].descripcion}
                  aria-describedby="descripcion-disponibilidad"
                  className={[
                    "inline-flex items-center rounded-full border px-3 py-1.5 font-body text-sm font-semibold",
                    ESTILO_DISPONIBILIDAD[disponibilidad]
                  ].join(" ")}
                  aria-busy={persistiendoDisponibilidad || undefined}
                >
                  {persistiendoDisponibilidad && (
                    <span className="mr-2 size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                  )}
                  {ESTADOS_DISPONIBILIDAD[disponibilidad].etiqueta}
                </span>
                <div
                  role="radiogroup"
                  aria-label="Disponibilidad para recibir viajes"
                  aria-describedby="descripcion-disponibilidad"
                  className="inline-flex rounded-xl border border-ink/10 bg-mist p-1"
                >
                  {OPCIONES_DISPONIBILIDAD.map((opcion) => {
                    const activo = disponibilidad === opcion;
                    return (
                      <button
                        key={opcion}
                        type="button"
                        role="radio"
                        aria-checked={activo}
                        title={ESTADOS_DISPONIBILIDAD[opcion].descripcion}
                        disabled={disponibilidad === "en_viaje" || persistiendoDisponibilidad}
                        onClick={() => seleccionarDisponibilidad(opcion)}
                        className={[
                          "min-h-10 rounded-lg px-3 py-2 font-body text-sm font-semibold transition",
                          activo
                            ? "bg-route-dark text-mist shadow-sm"
                            : "text-ink/65 hover:bg-ink/[0.05] hover:text-ink",
                          disponibilidad === "en_viaje" || persistiendoDisponibilidad ? "cursor-not-allowed opacity-55" : ""
                        ].join(" ")}
                      >
                        {ESTADOS_DISPONIBILIDAD[opcion].etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p id="descripcion-disponibilidad" className="mt-3 font-body text-sm text-ink/55">
                {ESTADOS_DISPONIBILIDAD[disponibilidad].descripcion}
              </p>
            </div>
            <div className="grid gap-3">
              {viajeActivoPrincipal ? (
                <Link href={`/viajes/${viajeActivoPrincipal.traslado_id}`}>
                  <Button variant="primario" className="min-h-14 w-full text-base">
                    Continuar viaje {folioViaje(viajeActivoPrincipal)}
                  </Button>
                </Link>
              ) : (
                <Link href="/viajes">
                  <Button variant="primario" className="min-h-14 w-full text-base">
                    Ver viajes disponibles ({viajesDisponibles.length})
                  </Button>
                </Link>
              )}
              <p className="font-body text-sm text-ink/55">
                {viajeActivoPrincipal
                  ? `${nombreVehiculo(viajeActivoPrincipal)} · mantén evidencia y comunicación al día.`
                  : "Revisa solicitudes compatibles y acepta solo las que puedas cubrir."}
              </p>
            </div>
          </div>
        </PassportCard>
      </section>

      <section className="mt-6">
        <p className="mb-3 font-body text-xs uppercase tracking-wide text-ink/45">Zona B · Stats</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <PassportCard acento>
            <p className="font-body text-xs font-medium uppercase tracking-wide text-ink/45">Viajes esta semana</p>
            <div className="mt-2 flex items-baseline gap-2">
            <p className="font-display text-3xl font-bold">{resumen.viajesSemana}</p>
            </div>
            <p className="font-body text-xs text-ink/45">{resumen.realizados} completado(s)</p>
          </PassportCard>
          <PassportCard acento>
            <p className="font-body text-xs font-medium uppercase tracking-wide text-ink/45">Ganancias esta semana</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="font-display text-3xl font-bold">{formatearMoneda(resumen.gananciasSemana)}</p>
            </div>
            <Link href="/ganancias" className="font-body text-xs font-semibold text-route-dark">
              Ver desglose
            </Link>
          </PassportCard>
        </div>
        <details className="mt-4 rounded-xl border border-ink/10 bg-mist">
          <summary className="cursor-pointer px-4 py-3 font-body text-sm font-semibold text-ink/70">
            Ver estadísticas completas
          </summary>
          <div className="grid gap-3 border-t border-ink/10 px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Activos</p>
              <p className="mt-1 font-display text-2xl font-semibold">{resumen.activos}</p>
              <p className="font-body text-xs text-ink/45">en seguimiento</p>
            </div>
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Pendientes</p>
              <p className="mt-1 font-display text-2xl font-semibold">{resumen.pendientes}</p>
              <p className="font-body text-xs text-ink/45">por aceptar</p>
            </div>
          </div>
        </details>
      </section>

      <section className="mt-6">
        <PassportCard>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Zona C · Feed</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Actividad operativa</h2>
            </div>
            <Link href="/viajes">
              <Button variant="secundario">Ver todos</Button>
            </Link>
          </div>
          <div className="mt-5 divide-y divide-ink/10">
            {viajesDisponibles.slice(0, 2).map((viaje) => (
              <Link
                key={`pendiente-${viaje.traslado_id}`}
                href="/viajes"
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="font-body text-sm font-semibold">{nombreVehiculo(viaje)}</p>
                  <p className="mt-0.5 font-body text-xs text-ink/45">Pendiente de aceptación · Folio {folioViaje(viaje)}</p>
                </div>
                <span className="rounded-full border border-signal/30 bg-signal-soft px-2.5 py-1 font-body text-xs font-semibold text-ink">
                  Nuevo
                </span>
              </Link>
            ))}
            {viajesActivos.slice(0, 2).map((viaje) => (
              <Link
                key={`activo-${viaje.traslado_id}`}
                href={`/viajes/${viaje.traslado_id}`}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="font-body text-sm font-semibold">{nombreVehiculo(viaje)}</p>
                  <p className="mt-0.5 font-body text-xs text-ink/45">Viaje activo · Folio {folioViaje(viaje)}</p>
                </div>
                <EstadoBadge estado={viaje.estado} conTexto={false} />
              </Link>
            ))}
            {mensajes.map((mensaje) => (
              <div key={mensaje.titulo} className="py-3">
                <p className="font-body text-sm font-semibold">{mensaje.titulo}</p>
                <p className="mt-1 font-body text-sm text-ink/60">{mensaje.cuerpo}</p>
              </div>
            ))}
          </div>
        </PassportCard>
      </section>

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
