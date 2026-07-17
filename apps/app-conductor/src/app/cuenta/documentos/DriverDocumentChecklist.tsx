"use client";

import { ChangeEvent } from "react";
import type { Database } from "@ruum/shared/types";
import {
  estadoVigenciaLicencia,
  vencimientoDocumentoDesdeLicencia
} from "@ruum/shared/validacion";
import type { TipoDocumentoConductor } from "@ruum/api/services";
import { Button } from "@ruum/ui";
import { fechaCuenta, type ConductorCuenta } from "../cuenta-utils";
import { enmascararNombreArchivo } from "../datos-sensibles";

type Documento = Database["public"]["Tables"]["documentos_conductor"]["Row"];

type EstadoChecklist = "falta" | "cargado" | "en_revision" | "aprobado" | "rechazado" | "por_vencer" | "vencido";

type DocumentoRequerido = {
  tipo: TipoDocumentoConductor;
  etiqueta: string;
  descripcion: string;
  bloqueante: boolean;
};

const DOCUMENTOS_REQUERIDOS: DocumentoRequerido[] = [
  { tipo: "licencia_frente", etiqueta: "Licencia - frente", descripcion: "Foto clara del frente de tu licencia vigente.", bloqueante: true },
  { tipo: "licencia_reverso", etiqueta: "Licencia - reverso", descripcion: "Foto clara del reverso de tu licencia vigente.", bloqueante: true },
  { tipo: "identificacion_oficial", etiqueta: "Identificación oficial", descripcion: "INE, pasaporte u otra identificación oficial vigente.", bloqueante: true },
  { tipo: "documento_operativo", etiqueta: "Documento operativo adicional", descripcion: "Solo si operación lo solicita para tu expediente.", bloqueante: false }
];

const ESTILO_ESTADO: Record<EstadoChecklist, { texto: string; clase: string }> = {
  falta: { texto: "Falta", clase: "border-danger-action bg-danger-soft text-danger-action" },
  cargado: { texto: "Cargado", clase: "border-route-action bg-route-soft text-route-action" },
  en_revision: { texto: "En revisión", clase: "border-route-action bg-route-soft text-route-action" },
  aprobado: { texto: "Aprobado", clase: "border-success bg-control-soft text-success" },
  rechazado: { texto: "Rechazado", clase: "border-danger-action bg-danger-soft text-danger-action" },
  por_vencer: { texto: "Por vencer", clase: "border-warning bg-warn-soft text-warning" },
  vencido: { texto: "Vencido", clase: "border-danger-action bg-danger-soft text-danger-action" }
};

function documentoActual(documentos: Documento[], tipo: TipoDocumentoConductor) {
  return documentos
    .filter((documento) => documento.tipo === tipo && documento.es_actual)
    .sort((a, b) => b.version - a.version || new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())[0] ?? null;
}

function vencimientoDocumento(conductor: ConductorCuenta | null, tipo: TipoDocumentoConductor) {
  return vencimientoDocumentoDesdeLicencia(tipo, conductor?.licencia_vigencia);
}

function estadoDocumento(documento: Documento | null, vencimiento: string | null): EstadoChecklist {
  const estadoVigencia = estadoVigenciaLicencia(vencimiento);
  if (estadoVigencia === "vencida") return "vencido";
  if (documento?.estado === "rechazado") return "rechazado";
  if (documento?.estado === "aprobado" && estadoVigencia === "por_vencer") return "por_vencer";
  if (documento?.estado === "aprobado") return "aprobado";
  if (documento?.estado === "en_revision") return "en_revision";
  if (documento) return "cargado";
  return "falta";
}

function prioridad(estado: EstadoChecklist, bloqueante: boolean) {
  const pesoEstado: Record<EstadoChecklist, number> = {
    vencido: 0,
    rechazado: 1,
    falta: 2,
    por_vencer: 3,
    cargado: 4,
    en_revision: 5,
    aprobado: 6
  };
  return (bloqueante ? 0 : 10) + pesoEstado[estado];
}

function ctaTexto(estado: EstadoChecklist) {
  if (estado === "aprobado") return "Aprobado";
  if (estado === "en_revision" || estado === "cargado") return "Esperando revisión";
  if (estado === "rechazado") return "Reemplazar documento";
  if (estado === "vencido") return "Subir documento vigente";
  if (estado === "por_vencer") return "Reemplazar antes del vencimiento";
  return "Subir documento";
}

export function DriverDocumentChecklist({
  conductor,
  documentos,
  subiendo,
  onUpload
}: {
  conductor: ConductorCuenta | null;
  documentos: Documento[];
  subiendo: TipoDocumentoConductor | null;
  onUpload: (tipo: TipoDocumentoConductor, event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const items = DOCUMENTOS_REQUERIDOS.map((requerido) => {
    const documento = documentoActual(documentos, requerido.tipo);
    const vencimiento = vencimientoDocumento(conductor, requerido.tipo);
    const estado = estadoDocumento(documento, vencimiento);
    return { requerido, documento, vencimiento, estado };
  }).sort((a, b) => prioridad(a.estado, a.requerido.bloqueante) - prioridad(b.estado, b.requerido.bloqueante));

  return (
    <section className="grid gap-3" aria-label="Checklist documental">
      {items.map(({ requerido, documento, vencimiento, estado }) => {
        const visual = ESTILO_ESTADO[estado];
        const rechazo = documento?.motivo_rechazo ?? documento?.notas_admin;
        const permiteReemplazo = estado !== "aprobado" && estado !== "en_revision" && estado !== "cargado";
        return (
          <article
            key={requerido.tipo}
            className={[
              "rounded-xl border px-4 py-4",
              requerido.bloqueante && ["falta", "rechazado", "vencido"].includes(estado)
                ? "border-danger-action bg-danger-soft"
                : "border-border bg-surface"
            ].join(" ")}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-semibold">{requerido.etiqueta}</h2>
                  {requerido.bloqueante && (
                    <span className="rounded-full border border-danger-action bg-surface px-2.5 py-1 font-body text-sm font-bold text-danger-action">
                      Bloqueante
                    </span>
                  )}
                </div>
                <p className="mt-1 font-body text-sm leading-6 text-text-secondary">{requerido.descripcion}</p>
                <dl className="mt-3 grid gap-2 font-body text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-text-tertiary">Archivo</dt>
                    <dd className="mt-1 font-semibold">{documento?.nombre_archivo ? enmascararNombreArchivo(documento.nombre_archivo) : "Sin archivo cargado"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-text-tertiary">Vencimiento</dt>
                    <dd className="mt-1 font-semibold">{vencimiento ? fechaCuenta(vencimiento) : "No registrado"}</dd>
                  </div>
                </dl>
                {rechazo && estado === "rechazado" && (
                  <div className="mt-3 rounded-lg border border-danger-action bg-surface px-3 py-3">
                    <p className="font-body text-sm font-semibold text-danger-action">Motivo de rechazo</p>
                    <p className="mt-1 font-body text-sm text-text-secondary">{rechazo}</p>
                    <p className="mt-2 font-body text-sm font-semibold text-danger-action">Siguiente acción: reemplaza este documento con una versión corregida.</p>
                  </div>
                )}
              </div>
              <div className="grid gap-2 sm:min-w-56">
                <span className={`rounded-full border px-3 py-1.5 text-center font-body text-xs font-semibold ${visual.clase}`}>
                  {visual.texto}
                </span>
                {permiteReemplazo ? (
                  <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-signal bg-signal px-4 py-2 text-center font-body text-sm font-semibold text-text-primary">
                    {subiendo === requerido.tipo ? "Subiendo..." : ctaTexto(estado)}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="sr-only"
                      disabled={subiendo !== null}
                      onChange={(event) => onUpload(requerido.tipo, event)}
                    />
                  </label>
                ) : (
                  <Button variant="quiet" disabled>{ctaTexto(estado)}</Button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
