"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Aviso, PassportCard, EstadoBadge } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import { esElegibleParaViaje } from "@ruum/shared/rules";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { listarViajesDisponibles, listarViajesAceptados, aceptarViaje, obtenerConductorActual } from "@ruum/api/services";
import { CONDUCTOR_DEMO, VIAJES_DISPONIBLES_DEMO, VIAJES_ACEPTADOS_DEMO } from "../../lib/datos-demo";
import type { Conductor } from "@ruum/shared/types";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

const PESTANAS = ["disponibles", "aceptados"] as const;
type Pestana = (typeof PESTANAS)[number];

export default function PaginaViajes() {
  const [pestana, setPestana] = useState<Pestana>("disponibles");
  const [disponibles, setDisponibles] = useState<PasaporteRow[]>([]);
  const [aceptados, setAceptados] = useState<PasaporteRow[]>([]);
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
      setAviso("Viaje aceptado en modo demo. Conecta Supabase para que se guarde de verdad.");
      setDisponibles((prev) => prev.filter((v) => v.traslado_id !== trasladoId));
      setAceptando(null);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      await aceptarViaje(cliente, trasladoId, conductor.id);
      setDisponibles((prev) => prev.filter((v) => v.traslado_id !== trasladoId));
      setAviso("Viaje aceptado.");
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No pudimos aceptar el viaje. Intenta de nuevo.");
    } finally {
      setAceptando(null);
    }
  }

  const lista = pestana === "disponibles" ? disponibles : aceptados;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-2xl font-semibold">Viajes</h1>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no viajes reales.</Aviso>
        </div>
      )}

      <div className="mt-6 flex gap-1 rounded-full bg-ink/5 p-1">
        {PESTANAS.map((p) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            className={[
              "flex-1 rounded-full px-4 py-2 font-body text-sm font-medium capitalize transition-colors",
              pestana === p ? "bg-paper text-ink shadow-sm" : "text-ink/50 hover:text-ink"
            ].join(" ")}
          >
            {p} {p === "disponibles" ? `(${disponibles.length})` : `(${aceptados.length})`}
          </button>
        ))}
      </div>

      {aviso && (
        <div className="mt-4">
          <Aviso tono="info">{aviso}</Aviso>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {cargando ? (
          <p className="font-body text-sm text-ink/50">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="font-body text-sm text-ink/50">
            {pestana === "disponibles" ? "No hay viajes disponibles por ahora." : "Todavía no has aceptado ningún viaje."}
          </p>
        ) : (
          lista.map((viaje) => {
            // Nota: tipoRuta debería calcularse de la distancia real entre
            // origen y destino, pero la geocodificación sigue pendiente (ver
            // README de app-usuario, mismo punto). Mientras origen/destino
            // se capturen como lat/lng=0 (placeholder), se asume "intraurbana"
            // para no inventar una clasificación de ruta sin datos reales.
            const elegibilidad = viaje.vehiculo_tipo
              ? esElegibleParaViaje(conductor, viaje.vehiculo_tipo, "intraurbana")
              : { elegible: true };

            return (
              <PassportCard key={viaje.traslado_id} folio={viaje.traslado_id.slice(0, 8).toUpperCase()}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-body text-xs uppercase tracking-wide text-ink/45">
                      {viaje.vehiculo_marca} {viaje.vehiculo_modelo} {viaje.vehiculo_anio}
                      {viaje.vehiculo_tipo && ` · ${ETIQUETA_TIPO_VEHICULO[viaje.vehiculo_tipo]}`}
                    </p>
                    <p className="mt-1 font-mono-ruum text-sm">
                      ${viaje.precio_cotizado?.toLocaleString("es-MX") ?? "—"} estimado
                    </p>
                  </div>
                  <EstadoBadge estado={viaje.estado} />
                </div>

                {pestana === "disponibles" && !elegibilidad.elegible && (
                  <div className="mt-3">
                    <Aviso tono="atencion">No elegible: {elegibilidad.motivo}</Aviso>
                  </div>
                )}

                <div className="mt-4 flex justify-end gap-3">
                  <Link href={`/viajes/${viaje.traslado_id}`} className="font-body text-sm text-ink/60 hover:text-ink">
                    Ver detalle
                  </Link>
                  {pestana === "disponibles" && (
                    <Button
                      onClick={() => aceptar(viaje.traslado_id)}
                      disabled={!elegibilidad.elegible || aceptando === viaje.traslado_id}
                    >
                      {aceptando === viaje.traslado_id ? "Aceptando…" : "Aceptar"}
                    </Button>
                  )}
                </div>
              </PassportCard>
            );
          })
        )}
      </div>
    </main>
  );
}
