"use client";

import { useRef, useState } from "react";
import { Button, Aviso, LogoMarca } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../lib/supabase-browser";
import { subirDocumentoConductor, subirDocumentoSolicitudConductor, type TipoDocumentoConductor } from "@ruum/api/services";

type DocumentoConductorRow = Database["public"]["Tables"]["documentos_conductor"]["Row"];

const ESTADO_DOCUMENTO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente de carga", clase: "border-ink/15 bg-ink/[0.04] text-ink/60" },
  en_revision: { texto: "En revisión", clase: "border-route/30 bg-route-soft text-route-dark" },
  aprobado: { texto: "Aprobado", clase: "border-control/30 bg-control-soft text-control" },
  rechazado: { texto: "Rechazado", clase: "border-danger/25 bg-danger-soft text-danger" },
  reemplazado: { texto: "Reemplazado", clase: "border-ink/15 bg-ink/[0.04] text-ink/55" },
  vencido: { texto: "Vencido", clase: "border-danger/25 bg-danger-soft text-danger" },
};

const TIPOS_DOCUMENTO: { valor: TipoDocumentoConductor; etiqueta: string }[] = [
  { valor: "licencia_frente", etiqueta: "Licencia - frente" },
  { valor: "licencia_reverso", etiqueta: "Licencia - reverso" },
  { valor: "identificacion_oficial", etiqueta: "Identificación oficial" }
];

interface Props {
  conductorId?: string;
  solicitudId?: string;
  nombre: string;
  documentosIniciales: DocumentoConductorRow[];
  onSalir: () => void;
}

/**
 * Fase 2 — reemplaza el callejón sin salida de "Solicitud en revisión → volver al acceso".
 * Muestra el estado real de cada documento (incluida la nota del admin si fue rechazado o
 * requiere corrección) y permite reemplazar solo ese documento específico, sin reiniciar
 * el resto del expediente.
 */
export function EstadoRevisionConductor({ conductorId, solicitudId, nombre, documentosIniciales, onSalir }: Props) {
  const [documentos, setDocumentos] = useState(documentosIniciales);
  const [subiendo, setSubiendo] = useState<TipoDocumentoConductor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  function documentoDe(tipo: TipoDocumentoConductor) {
    // El más reciente de ese tipo, por si hubo reemplazo previo.
    return documentos
      .filter((d) => d.tipo === tipo)
      .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())[0];
  }

  async function reemplazar(tipo: TipoDocumentoConductor, archivo: File) {
    setSubiendo(tipo);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const documentoAnteriorId = documentoDe(tipo)?.id;
      if (solicitudId) await subirDocumentoSolicitudConductor(cliente, solicitudId, tipo, archivo, documentoAnteriorId);
      else if (conductorId) await subirDocumentoConductor(cliente, conductorId, tipo, archivo, documentoAnteriorId);
      else throw new Error("No encontramos el expediente asociado.");
      // El nuevo documento entra como "en_revision"; lo reflejamos localmente sin recargar todo.
      setDocumentos((prev) => [
        {
          id: `temp-${Date.now()}`,
          conductor_id: conductorId ?? null,
          solicitud_id: solicitudId ?? null,
          tipo,
          nombre_archivo: archivo.name,
          url: "",
          estado: "en_revision",
          notas_admin: null,
          version: (documentoDe(tipo)?.version ?? 0) + 1,
          documento_anterior_id: documentoAnteriorId ?? null,
          es_actual: true,
          reemplazado_en: null,
          revisado_por: null,
          revisado_en: null,
          motivo_rechazo: null,
          creado_en: new Date().toISOString(),
          actualizado_en: new Date().toISOString()
        },
        ...prev
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos subir el documento. Intenta de nuevo.");
    } finally {
      setSubiendo(null);
    }
  }

  const todosAprobados = TIPOS_DOCUMENTO.every((t) => documentoDe(t.valor)?.estado === "aprobado");

  return (
    <div className="conductor-auth-shell flex items-center justify-center px-4 py-10 sm:px-6">
      <section className="conductor-auth-card p-6 sm:p-8" aria-labelledby="titulo-estado-revision">
        <div className="flex items-center gap-3">
          <LogoMarca tamano={34} color="signal" />
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight text-ink">
              ruum<span className="text-signal">ruum</span>
            </p>
            <p className="font-mono-ruum text-[10px] uppercase tracking-[0.14em] text-ink/50">ruum by Movilia</p>
          </div>
        </div>

        <h1 id="titulo-estado-revision" className="mt-8 font-display text-2xl font-bold text-ink">
          Hola, {nombre}
        </h1>
        <p className="mt-2 font-body text-sm leading-6 text-ink/65">
          {todosAprobados
            ? "Tus documentos ya están aprobados. Tu cuenta se activará en cuanto el equipo confirme el alta."
            : "Tu cuenta está en revisión. Aquí puedes ver el estado de cada documento y reemplazarlo si te pedimos una corrección."}
        </p>

        {error && (
          <div className="mt-4" role="status" aria-live="polite" aria-atomic="true">
            <Aviso tono="peligro">{error}</Aviso>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {TIPOS_DOCUMENTO.map((t) => {
            const doc = documentoDe(t.valor);
            const estadoInfo = ESTADO_DOCUMENTO[doc?.estado ?? "pendiente"];
            const requiereAccion = doc?.estado === "rechazado" || doc?.estado === "vencido";

            return (
              <div key={t.valor} className="rounded-xl border border-ink/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-body text-sm font-semibold text-ink">{t.etiqueta}</p>
                  <span className={`rounded-full border px-2.5 py-1 font-body text-xs font-medium ${estadoInfo.clase}`}>
                    {estadoInfo.texto}
                  </span>
                </div>

                {doc?.notas_admin && (
                  <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 font-body text-xs text-warn">
                    {doc.notas_admin}
                  </p>
                )}

                {requiereAccion && (
                  <div className="mt-3">
                    <input
                      ref={(el) => { inputsRef.current[t.valor] = el; }}
                      type="file"
                      accept="image/*,.pdf"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const archivo = e.target.files?.[0];
                        if (archivo) void reemplazar(t.valor, archivo);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="secundario"
                      onClick={() => inputsRef.current[t.valor]?.click()}
                      disabled={subiendo === t.valor}
                    >
                      {subiendo === t.valor ? "Subiendo…" : "Reemplazar documento"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Button variant="fantasma" className="mt-7" onClick={onSalir}>
          Cerrar sesión
        </Button>
      </section>
    </div>
  );
}
