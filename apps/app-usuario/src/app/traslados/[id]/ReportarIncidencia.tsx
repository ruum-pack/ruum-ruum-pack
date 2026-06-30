"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Button, Field } from "@ruum/ui";
import { ETIQUETA_TIPO_INCIDENCIA } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { reportarIncidencia } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";

type TipoIncidencia = Database["public"]["Enums"]["tipo_incidencia"];
type MomentoIncidencia = Database["public"]["Enums"]["momento_incidencia"];

const TIPOS: TipoIncidencia[] = [
  "contacto_no_localizado",
  "documentacion_incompleta",
  "dano_previo_relevante",
  "dano_no_reportado",
  "perdida_conectividad"
];

const MOMENTOS: { valor: MomentoIncidencia; etiqueta: string }[] = [
  { valor: "recoleccion", etiqueta: "Recolección" },
  { valor: "durante_traslado", etiqueta: "Durante el traslado" },
  { valor: "entrega", etiqueta: "Entrega" },
  { valor: "post_cierre", etiqueta: "Post cierre" }
];

export function ReportarIncidenciaUsuario({ trasladoId, esDemo }: { trasladoId: string; esDemo: boolean }) {
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
      if (esDemo || !tieneSupabaseConfigurado()) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setMensaje({ tono: "info", texto: "Incidencia registrada en modo demo." });
        setDescripcion("");
        return;
      }
      const cliente = crearClienteNavegador();
      await reportarIncidencia(cliente, trasladoId, tipo, momento, descripcion);
      setMensaje({ tono: "info", texto: "Incidencia reportada. Soporte dará seguimiento." });
      setDescripcion("");
      router.refresh();
    } catch (err) {
      setMensaje({ tono: "peligro", texto: err instanceof Error ? err.message : "No pudimos reportar la incidencia." });
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-ink/10 px-4 py-4">
      <p className="font-body text-sm font-semibold">Reportar problema con este viaje</p>
      {mensaje && (
        <div className="mt-3">
          <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
        </div>
      )}
      <div className="mt-4 grid gap-3">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoIncidencia)} className="rounded-lg border border-ink/15 bg-mist px-3 py-2 font-body text-sm">
          {TIPOS.map((opcion) => (
            <option key={opcion} value={opcion}>
              {ETIQUETA_TIPO_INCIDENCIA[opcion]}
            </option>
          ))}
        </select>
        <select value={momento} onChange={(e) => setMomento(e.target.value as MomentoIncidencia)} className="rounded-lg border border-ink/15 bg-mist px-3 py-2 font-body text-sm">
          {MOMENTOS.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
        <Field etiqueta="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Cuéntanos qué ocurrió" />
        <Button onClick={enviar} disabled={procesando || descripcion.trim().length < 10}>
          {procesando ? "Reportando..." : "Reportar incidencia"}
        </Button>
      </div>
    </div>
  );
}
