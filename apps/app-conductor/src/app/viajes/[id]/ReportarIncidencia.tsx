"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Button, Field } from "@ruum/ui";
import { ETIQUETA_TIPO_INCIDENCIA } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { reportarIncidencia } from "@ruum/api/services";
import { crearClienteNavegador } from "../../../lib/supabase-browser";

type TipoIncidencia = Database["public"]["Enums"]["tipo_incidencia"];
type MomentoIncidencia = Database["public"]["Enums"]["momento_incidencia"];

const TIPOS: TipoIncidencia[] = [
  "vehiculo_no_enciende",
  "contacto_no_localizado",
  "documentacion_incompleta",
  "dano_previo_relevante",
  "colision_robo_asalto",
  "emergencia_medica_conductor",
  "descompostura_en_ruta",
  "infraccion_autoridad_vial",
  "perdida_conectividad",
  "dano_no_reportado"
];

const MOMENTOS: { valor: MomentoIncidencia; etiqueta: string }[] = [
  { valor: "recoleccion", etiqueta: "Recolección" },
  { valor: "durante_traslado", etiqueta: "Durante el traslado" },
  { valor: "entrega", etiqueta: "Entrega" },
  { valor: "post_cierre", etiqueta: "Post cierre" }
];

export function ReportarIncidencia({ trasladoId }: { trasladoId: string }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoIncidencia>("contacto_no_localizado");
  const [momento, setMomento] = useState<MomentoIncidencia>("durante_traslado");
  const [descripcion, setDescripcion] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "peligro"; texto: string } | null>(null);

  async function enviar() {
    setProcesando(true);
    setMensaje(null);
    try {
      const cliente = crearClienteNavegador();
      await reportarIncidencia(cliente, trasladoId, tipo, momento, descripcion);
      setMensaje({ tono: "info", texto: "Incidencia reportada. Operación dará seguimiento." });
      setDescripcion("");
      router.refresh();
    } catch (err) {
      setMensaje({ tono: "peligro", texto: err instanceof Error ? err.message : "No pudimos reportar la incidencia." });
    } finally {
      setProcesando(false);
    }
  }

  return (
    <details className="group mt-6 overflow-hidden rounded-lg border border-ink/10 bg-mist">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 font-body text-sm font-semibold transition-colors hover:bg-signal-soft/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-dark [&::-webkit-details-marker]:hidden">
        <span>Reportar incidencia</span>
        <span className="font-mono-ruum text-lg leading-none text-ink/45 transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <div className="border-t border-ink/10 px-4 pb-4 pt-4">
        {mensaje && (
          <div role="status" aria-live="polite" aria-atomic="true">
            <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
          </div>
        )}
        <div className="mt-4 grid gap-3">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoIncidencia)} className="rounded-lg border border-ink/50 bg-mist px-3 py-2 font-body text-sm">
            {TIPOS.map((opcion) => (
              <option key={opcion} value={opcion}>
                {ETIQUETA_TIPO_INCIDENCIA[opcion]}
              </option>
            ))}
          </select>
          <select value={momento} onChange={(e) => setMomento(e.target.value as MomentoIncidencia)} className="rounded-lg border border-ink/50 bg-mist px-3 py-2 font-body text-sm">
            {MOMENTOS.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
          <Field etiqueta="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Describe qué ocurrió y qué apoyo necesitas" />
          <Button onClick={enviar} disabled={procesando || descripcion.trim().length < 10}>
            {procesando ? "Reportando..." : "Reportar incidencia"}
          </Button>
        </div>
      </div>
    </details>
  );
}
