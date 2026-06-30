"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Aviso, PassportCard, EstadoBadge, LogoMarca } from "@ruum/ui";
import type { Conductor } from "@ruum/shared/types";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import {
  listarViajesAceptados,
  listarViajesDisponibles,
  obtenerConductorActual
} from "@ruum/api/services";
import {
  CONDUCTOR_DEMO,
  GANANCIAS_DEMO,
  RESUMEN_SEMANAL_DEMO,
  VIAJES_ACEPTADOS_DEMO,
  VIAJES_DISPONIBLES_DEMO
} from "../lib/datos-demo";

type Disponibilidad = "disponible" | "no_disponible" | "en_viaje" | "pausado";
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

const ETIQUETA_DISPONIBILIDAD: Record<Disponibilidad, string> = {
  disponible: "Disponible",
  no_disponible: "No disponible",
  en_viaje: "En viaje",
  pausado: "Pausado"
};

const ESTILO_DISPONIBILIDAD: Record<Disponibilidad, string> = {
  disponible: "border-control/30 bg-control-soft text-control",
  no_disponible: "border-ink/15 bg-ink/[0.03] text-ink/55",
  en_viaje: "border-route/30 bg-route-soft text-route",
  pausado: "border-warn/40 bg-warn-soft text-warn"
};

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

function formatearFecha(fecha: string) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(`${fecha}T12:00:00-06:00`));
}

function nombreVehiculo(viaje: PasaporteRow) {
  return [viaje.vehiculo_marca, viaje.vehiculo_modelo, viaje.vehiculo_anio].filter(Boolean).join(" ") || "Vehículo";
}

export default function PaginaPanel() {
  const router = useRouter();
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad>("disponible");
  const [conductor, setConductor] = useState<Conductor>(CONDUCTOR_DEMO);
  const [sesionReal, setSesionReal] = useState(false);
  const [viajesAceptados, setViajesAceptados] = useState<PasaporteRow[]>(VIAJES_ACEPTADOS_DEMO);
  const [viajesDisponibles, setViajesDisponibles] = useState<PasaporteRow[]>(VIAJES_DISPONIBLES_DEMO);

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
        setSesionReal(true);

        const [aceptados, disponibles] = await Promise.all([
          listarViajesAceptados(cliente, real.id),
          listarViajesDisponibles(cliente)
        ]);
        setViajesAceptados(aceptados);
        setViajesDisponibles(disponibles);
        if (aceptados.some((viaje) => viaje.estado === "traslado_en_curso")) {
          setDisponibilidad("en_viaje");
        }
      } catch {
        // Sigue en modo demo si algo falla al consultar la sesión.
      }
    }
    cargar();
  }, []);

  const resumen = useMemo(() => {
    const viajesSemana = viajesAceptados.filter((viaje) => estaSemana(viaje.actualizado_en));
    const activos = viajesAceptados.filter(
      (viaje) => !["servicio_cerrado", "servicio_cancelado", "traslado_fallido"].includes(viaje.estado)
    );
    const realizados = sesionReal
      ? viajesAceptados.filter((viaje) => viaje.estado === "servicio_cerrado" && estaSemana(viaje.actualizado_en)).length
      : GANANCIAS_DEMO.length;

    return {
      realizados,
      activos: activos.length,
      pendientes: viajesDisponibles.length,
      vehiculosTrasladados: sesionReal ? viajesSemana.length : GANANCIAS_DEMO.length,
      gananciasSemana: sesionReal
        ? viajesSemana.reduce((total, viaje) => total + Number(viaje.precio_final ?? viaje.precio_cotizado ?? 0), 0)
        : RESUMEN_SEMANAL_DEMO.ganancias_generadas
    };
  }, [sesionReal, viajesAceptados, viajesDisponibles]);

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
        cuerpo: `Próximo pago programado para ${formatearFecha(RESUMEN_SEMANAL_DEMO.fecha_pago)}.`
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

  function alternarDisponibilidad() {
    setDisponibilidad((prev) => (prev === "disponible" ? "no_disponible" : "disponible"));
  }

  async function cerrarSesion() {
    const cliente = crearClienteNavegador();
    await cliente.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="flex items-center gap-2">
            <LogoMarca tamano={24} color="signal" />
            <span className="font-display text-lg font-semibold tracking-tight">Ruum Ruum Conductor</span>
          </span>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">Panel</h1>
          <p className="mt-1 font-body text-sm text-ink/55">Hola, {conductor.nombre}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/configuracion">
            <Button variant="fantasma">Configuración</Button>
          </Link>
          {sesionReal ? (
            <button onClick={cerrarSesion} className="font-body text-sm text-ink/60 hover:text-ink">
              Cerrar sesión
            </button>
          ) : (
            tieneSupabaseConfigurado() && (
              <Link href="/login" className="font-body text-sm font-medium text-ink/70 hover:text-ink">
                Iniciar sesión
              </Link>
            )
          )}
        </div>
      </header>

      {!sesionReal && tieneSupabaseConfigurado() && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo. Inicia sesión para ver los tuyos.</Aviso>
        </div>
      )}

      <section className="mt-8">
        <PassportCard>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Disponibilidad</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className={[
                    "inline-flex items-center rounded-full border px-3 py-1.5 font-body text-sm font-semibold",
                    ESTILO_DISPONIBILIDAD[disponibilidad]
                  ].join(" ")}
                >
                  {ETIQUETA_DISPONIBILIDAD[disponibilidad]}
                </span>
                <Button
                  variant={disponibilidad === "disponible" ? "primario" : "secundario"}
                  onClick={alternarDisponibilidad}
                  disabled={disponibilidad === "en_viaje"}
                >
                  {disponibilidad === "disponible" ? "Pasar a no disponible" : "Activar disponibilidad"}
                </Button>
              </div>
              <p className="mt-3 font-body text-sm text-ink/55">
                Estados posibles: Disponible, No disponible, En viaje y Pausado.
              </p>
            </div>
            <div className="rounded-lg border border-ink/10 px-4 py-4">
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Siguiente acción</p>
              <p className="mt-1 font-body text-sm font-medium">
                {disponibilidad === "en_viaje"
                  ? "Continúa el traslado activo y mantén evidencia actualizada."
                  : "Revisa viajes disponibles o ajusta tu disponibilidad."}
              </p>
            </div>
          </div>
        </PassportCard>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Viajes realizados</p>
          <p className="mt-2 font-display text-3xl font-semibold">{resumen.realizados}</p>
          <p className="font-body text-xs text-ink/45">esta semana</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Activos</p>
          <p className="mt-2 font-display text-3xl font-semibold">{resumen.activos}</p>
          <p className="font-body text-xs text-ink/45">en seguimiento</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Pendientes</p>
          <p className="mt-2 font-display text-3xl font-semibold">{resumen.pendientes}</p>
          <p className="font-body text-xs text-ink/45">por aceptar</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Ganancias</p>
          <p className="mt-2 font-display text-3xl font-semibold">{formatearMoneda(resumen.gananciasSemana)}</p>
          <p className="font-body text-xs text-ink/45">acumuladas de la semana</p>
        </PassportCard>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Vehículos trasladados</p>
          <div className="mt-4 flex items-end gap-4">
            <p className="font-display text-5xl font-semibold leading-none">{resumen.vehiculosTrasladados}</p>
            <div className="mb-1 h-16 w-full rounded-lg bg-ink/[0.04]">
              <div
                className="h-full rounded-lg bg-signal"
                style={{ width: `${Math.min(100, Math.max(18, resumen.vehiculosTrasladados * 18))}%` }}
              />
            </div>
          </div>
          <p className="mt-3 font-body text-sm text-ink/55">Indicador semanal de unidades movidas.</p>
        </PassportCard>

        <PassportCard>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Fecha de próximo pago</p>
              <p className="mt-2 font-display text-2xl font-semibold">{formatearFecha(RESUMEN_SEMANAL_DEMO.fecha_pago)}</p>
              <p className="mt-1 font-body text-xs text-ink/45">{RESUMEN_SEMANAL_DEMO.metodo}</p>
            </div>
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Depósito esperado</p>
              <p className="mt-2 font-display text-2xl font-semibold">
                {formatearMoneda(RESUMEN_SEMANAL_DEMO.deposito_final)}
              </p>
              <p className="mt-1 font-body text-xs text-ink/45">
                Incluye gastos autorizados y ajustes: {formatearMoneda(RESUMEN_SEMANAL_DEMO.gastos_autorizados)}
              </p>
            </div>
          </div>
          <Link href="/ganancias" className="mt-5 inline-block font-body text-sm font-medium text-signal">
            Ver desglose de ganancias
          </Link>
        </PassportCard>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <PassportCard>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Viajes en curso</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Actividad próxima</h2>
            </div>
            <Link href="/viajes">
              <Button variant="secundario">Ver viajes</Button>
            </Link>
          </div>
          <div className="mt-5 divide-y divide-ink/10">
            {viajesAceptados.slice(0, 3).map((viaje) => (
              <Link
                key={viaje.traslado_id}
                href={`/viajes/${viaje.traslado_id}`}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="font-body text-sm font-medium">{nombreVehiculo(viaje)}</p>
                  <p className="mt-0.5 font-mono-ruum text-xs text-ink/45">
                    Folio {viaje.traslado_id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <EstadoBadge estado={viaje.estado} conTexto={false} />
              </Link>
            ))}
            {viajesAceptados.length === 0 && (
              <p className="py-4 font-body text-sm text-ink/55">No tienes viajes aceptados en este momento.</p>
            )}
          </div>
        </PassportCard>

        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Mensajes</p>
          <h2 className="mt-1 font-display text-xl font-semibold">Comunicación operativa</h2>
          <div className="mt-5 grid gap-3">
            {mensajes.map((mensaje) => (
              <div key={mensaje.titulo} className="rounded-lg border border-ink/10 px-4 py-3">
                <p className="font-body text-sm font-semibold">{mensaje.titulo}</p>
                <p className="mt-1 font-body text-sm text-ink/60">{mensaje.cuerpo}</p>
              </div>
            ))}
          </div>
        </PassportCard>
      </section>
    </main>
  );
}
