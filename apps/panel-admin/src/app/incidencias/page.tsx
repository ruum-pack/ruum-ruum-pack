"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { listarIncidenciasAdmin } from "@ruum/api/services";
import { INCIDENCIAS_DEMO } from "../../lib/datos-demo";

type IncidenciaRow = Database["public"]["Tables"]["incidencias"]["Row"];

const ETIQUETA_TIPO: Record<IncidenciaRow["tipo"], string> = {
  vehiculo_no_enciende: "Vehículo no enciende",
  contacto_no_localizado: "Contacto no localizado",
  documentacion_incompleta: "Documentación incompleta",
  dano_previo_relevante: "Daño previo relevante",
  colision_robo_asalto: "Colisión, robo o asalto",
  emergencia_medica_conductor: "Emergencia médica del conductor",
  descompostura_en_ruta: "Descompostura en ruta",
  infraccion_autoridad_vial: "Infracción de autoridad vial",
  conductor_enfermo: "Conductor enfermo",
  perdida_conectividad: "Pérdida de conectividad",
  dano_no_reportado: "Daño no reportado"
};

export default function PaginaIncidenciasAdmin() {
  const [incidencias, setIncidencias] = useState<IncidenciaRow[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setIncidencias(INCIDENCIAS_DEMO);
        setEsDemo(true);
        setCargando(false);
        return;
      }
      try {
        const cliente = crearClienteNavegador();
        setIncidencias(await listarIncidenciasAdmin(cliente));
        setEsDemo(false);
      } catch {
        setIncidencias(INCIDENCIAS_DEMO);
        setEsDemo(true);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="font-display text-2xl font-semibold">Incidencias</h1>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no incidencias reales.</Aviso>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {cargando ? (
          <p className="font-body text-sm text-ink/50">Cargando…</p>
        ) : incidencias.length === 0 ? (
          <p className="font-body text-sm text-ink/50">No hay incidencias registradas.</p>
        ) : (
          incidencias.map((i) => (
            <Link key={i.id} href={`/viajes/${i.traslado_id}`} className="block">
              <div className="rounded-card border border-ink/10 bg-paper p-4 hover:border-signal/30">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-body text-sm font-medium">{ETIQUETA_TIPO[i.tipo]}</p>
                    <p className="mt-1 font-body text-sm text-ink/60">{i.descripcion}</p>
                  </div>
                  {i.resuelta ? (
                    <Aviso tono="info">Resuelta</Aviso>
                  ) : (
                    <Aviso tono="atencion">Sin resolver</Aviso>
                  )}
                </div>
                <p className="mt-2 font-mono-ruum text-[10px] uppercase tracking-wide text-ink/40">
                  Reportada por {i.reportada_por} · {new Date(i.creada_en).toLocaleString("es-MX")}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
