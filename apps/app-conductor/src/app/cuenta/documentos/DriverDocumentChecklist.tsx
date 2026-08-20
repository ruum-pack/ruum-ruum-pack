"use client";

import { ChangeEvent, DragEvent, useState } from "react";
import type { Database } from "@ruum/shared/types";
import {
  estadoVigenciaLicencia,
  vencimientoDocumentoDesdeLicencia
} from "@ruum/shared/validacion";
import type { TipoDocumentoConductor } from "@ruum/api/services";
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
  { tipo: "licencia_frente", etiqueta: "Licencia - Frente", descripcion: "Fotografía clara del frente de tu licencia vigente.", bloqueante: true },
  { tipo: "licencia_reverso", etiqueta: "Licencia - Reverso", descripcion: "Fotografía clara del reverso de tu licencia vigente.", bloqueante: true },
  { tipo: "identificacion_oficial", etiqueta: "Identificación Oficial (INE / Pasaporte)", descripcion: "Identificación oficial vigente por ambos lados o pasaporte.", bloqueante: true },
  { tipo: "constancia_situacion_fiscal", etiqueta: "Constancia de Situación Fiscal (SAT)", descripcion: "Constancia actualizada del SAT en archivo PDF o imagen legible.", bloqueante: false },
  { tipo: "documento_operativo", etiqueta: "Documento Operativo Adicional", descripcion: "Solo si el equipo de operación solicita un respaldo extra.", bloqueante: false }
];

const ESTILO_ESTADO: Record<EstadoChecklist, { texto: string; clase: string; icono: string }> = {
  falta: { texto: "Falta documento", clase: "border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-400", icono: "⚠️" },
  cargado: { texto: "Cargado", clase: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400", icono: "⏳" },
  en_revision: { texto: "En revisión", clase: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400", icono: "🔍" },
  aprobado: { texto: "Aprobado", clase: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icono: "✓" },
  rechazado: { texto: "Rechazado", clase: "border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-400", icono: "❌" },
  por_vencer: { texto: "Por vencer", clase: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400", icono: "⏰" },
  vencido: { texto: "Vencido", clase: "border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-400", icono: "🚨" }
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

export function DriverDocumentChecklist({
  conductor,
  documentos,
  subiendo,
  onUpload
}: {
  conductor: ConductorCuenta | null;
  documentos: Documento[];
  subiendo: TipoDocumentoConductor | null;
  onUpload: (tipo: TipoDocumentoConductor, file: File, documentoAnteriorId?: string) => void;
}) {
  const [arrastrandoSobre, setArrastrandoSobre] = useState<TipoDocumentoConductor | null>(null);
  const [actualizarAbierto, setActualizarAbierto] = useState<Record<string, boolean>>({});

  const items = DOCUMENTOS_REQUERIDOS.map((requerido) => {
    const documento = documentoActual(documentos, requerido.tipo);
    const vencimiento = vencimientoDocumento(conductor, requerido.tipo);
    const estado = estadoDocumento(documento, vencimiento);
    return { requerido, documento, vencimiento, estado };
  });

  const requeridosOAccion = items.filter((i) => i.estado !== "aprobado");
  const aprobados = items.filter((i) => i.estado === "aprobado");

  function alternarFormActualizar(tipo: TipoDocumentoConductor) {
    setActualizarAbierto((prev) => ({ ...prev, [tipo]: !prev[tipo] }));
  }

  function manejarDragOver(e: DragEvent<HTMLElement>, tipo: TipoDocumentoConductor) {
    e.preventDefault();
    e.stopPropagation();
    setArrastrandoSobre(tipo);
  }

  function manejarDragLeave(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setArrastrandoSobre(null);
  }

  function manejarDrop(e: DragEvent<HTMLElement>, tipo: TipoDocumentoConductor, documentoAnteriorId?: string) {
    e.preventDefault();
    e.stopPropagation();
    setArrastrandoSobre(null);

    const archivo = e.dataTransfer.files?.[0];
    if (archivo) {
      onUpload(tipo, archivo, documentoAnteriorId);
    }
  }

  function manejarSeleccionArchivo(e: ChangeEvent<HTMLInputElement>, tipo: TipoDocumentoConductor, documentoAnteriorId?: string) {
    const archivo = e.target.files?.[0];
    if (archivo) {
      onUpload(tipo, archivo, documentoAnteriorId);
      e.target.value = "";
    }
  }

  function renderizarZonaCaptura(tipo: TipoDocumentoConductor, estaSubiendo: boolean, documentoAnteriorId?: string) {
    return (
      <section
        onDragOver={(e) => manejarDragOver(e, tipo)}
        onDragLeave={manejarDragLeave}
        onDrop={(e) => manejarDrop(e, tipo, documentoAnteriorId)}
        aria-label={`Zona de carga para ${tipo}`}
        className={[
          "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition-all duration-150",
          arrastrandoSobre === tipo
            ? "border-signal bg-signal/10 scale-[1.01] shadow-md"
            : "border-signal/50 bg-surface-elevated/40 hover:border-signal hover:bg-signal/5"
        ].join(" ")}
      >
        <p className="font-display text-xs font-bold text-text-primary mb-3">
          {estaSubiendo ? "⏳ Registrando documento..." : "Captura o selecciona el nuevo archivo para actualizar"}
        </p>

        {/* Doble Opción: Cámara Móvil (📸) vs Selector de Archivos (📁) */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full">
          {/* Opción 1: Cámara Móvil */}
          <label className="inline-flex items-center justify-center gap-2 rounded-xl bg-signal/15 border border-signal/40 px-4 py-2.5 font-display text-xs font-bold text-signal transition hover:bg-signal hover:text-slate-950 active:scale-95 cursor-pointer">
            <span>📸 Tomar foto con cámara</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={estaSubiendo}
              className="sr-only"
              onChange={(e) => manejarSeleccionArchivo(e, tipo, documentoAnteriorId)}
            />
          </label>

          {/* Opción 2: Archivo de Galería / PDF */}
          <label className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 font-display text-xs font-bold text-text-primary transition hover:border-signal hover:bg-surface-elevated active:scale-95 cursor-pointer">
            <span>📁 Subir imagen o PDF</span>
            <input
              type="file"
              accept="image/*,.pdf"
              disabled={estaSubiendo}
              className="sr-only"
              onChange={(e) => manejarSeleccionArchivo(e, tipo, documentoAnteriorId)}
            />
          </label>
        </div>

        <p className="mt-2.5 font-body text-[11px] text-text-tertiary">
          Formatos JPG, PNG, WEBP o PDF hasta 10 MB. También puedes arrastrar el archivo desde tu escritorio.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-8">
      {/* 1. Sección: Documentos pendientes o requeridos de atención */}
      <section className="grid gap-4" aria-label="Documentos pendientes de atención">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-text-primary flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-500">
              {requeridosOAccion.length}
            </span>
            Atención requerida y pendientes
          </h2>
          {requeridosOAccion.some((i) => i.requerido.bloqueante && ["falta", "rechazado", "vencido"].includes(i.estado)) && (
            <span className="rounded-full bg-red-500/15 border border-red-500/30 px-3 py-1 font-body text-xs font-bold text-red-500">
              🚨 Bloquea recepción de viajes
            </span>
          )}
        </div>

        <div className="grid gap-4">
          {requeridosOAccion.map(({ requerido, documento, vencimiento, estado }) => {
            const visual = ESTILO_ESTADO[estado];
            const rechazo = documento?.motivo_rechazo ?? documento?.notas_admin;
            const esBloqueanteAccion = requerido.bloqueante && ["falta", "rechazado", "vencido"].includes(estado);
            const estaSubiendo = subiendo === requerido.tipo;

            return (
              <article
                key={requerido.tipo}
                className={[
                  "relative rounded-2xl border p-5 transition-all duration-200",
                  esBloqueanteAccion
                    ? "border-red-500/40 bg-red-500/5 shadow-xs"
                    : "border-border bg-surface"
                ].join(" ")}
              >
                <div className="flex flex-col gap-4">
                  {/* Encabezado del documento */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-bold text-text-primary">{requerido.etiqueta}</h3>
                        {requerido.bloqueante ? (
                          <span className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-body text-[11px] font-bold text-red-500">
                            Bloqueante
                          </span>
                        ) : (
                          <span className="rounded-md border border-border bg-surface-elevated px-2 py-0.5 font-body text-[11px] font-semibold text-text-tertiary">
                            Opcional / Requerido
                          </span>
                        )}
                        {documento?.version && (
                          <span className="rounded-md border border-border bg-surface-elevated px-2 py-0.5 font-body text-[10px] font-bold text-text-tertiary">
                            v{documento.version}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-body text-xs leading-5 text-text-tertiary">{requerido.descripcion}</p>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-body text-xs font-bold ${visual.clase}`}>
                      <span>{visual.icono}</span>
                      {visual.texto}
                    </span>
                  </div>

                  {/* Metadatos */}
                  <div className="grid gap-3 rounded-xl border border-border/40 bg-surface-elevated/50 p-3.5 sm:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface font-display text-lg text-route-action shadow-2xs">
                        📎
                      </div>
                      <div className="min-w-0">
                        <dt className="font-body text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                          Archivo registrado
                        </dt>
                        <dd className="truncate font-body text-xs font-bold text-text-primary">
                          {documento?.nombre_archivo ? enmascararNombreArchivo(documento.nombre_archivo) : "— Sin registrar"}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface font-display text-lg text-signal shadow-2xs">
                        📅
                      </div>
                      <div>
                        <dt className="font-body text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                          Fecha de Vencimiento
                        </dt>
                        <dd className="font-body text-xs font-bold text-text-primary">
                          {vencimiento ? fechaCuenta(vencimiento) : "—"}
                        </dd>
                      </div>
                    </div>
                  </div>

                  {/* Motivo de rechazo */}
                  {rechazo && estado === "rechazado" && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 font-body text-xs text-red-500">
                      <p className="font-bold text-red-600 dark:text-red-400">Motivo de rechazo por operación:</p>
                      <p className="mt-1 text-text-primary">{rechazo}</p>
                    </div>
                  )}

                  {/* Captura / Carga de Archivo para Actualización */}
                  {renderizarZonaCaptura(requerido.tipo, estaSubiendo, documento?.id)}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 2. Sección: Documentos Aprobados con opción para actualizar/reemplazar */}
      {aprobados.length > 0 && (
        <section className="grid gap-4 pt-4 border-t border-border/40" aria-label="Documentos aprobados">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-text-primary flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-500">
                ✓
              </span>
              Documentos Aprobados ({aprobados.length})
            </h2>
            <span className="font-body text-xs text-text-tertiary">
              Puedes subir una nueva versión cuando renueves tu documento
            </span>
          </div>

          <div className="grid gap-3">
            {aprobados.map(({ requerido, documento, vencimiento }) => {
              const estaAbierto = Boolean(actualizarAbierto[requerido.tipo]);
              const estaSubiendo = subiendo === requerido.tipo;

              return (
                <article key={requerido.tipo} className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 transition">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-bold text-emerald-500">
                          ✓
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-sm font-bold text-text-primary">{requerido.etiqueta}</h3>
                            {documento?.version && (
                              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-body text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                v{documento.version}
                              </span>
                            )}
                          </div>
                          <p className="font-body text-xs text-text-tertiary">
                            {documento?.nombre_archivo ? enmascararNombreArchivo(documento.nombre_archivo) : "Documento validado"}
                            {vencimiento ? ` • Vence: ${fechaCuenta(vencimiento)}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Botón Habilitador para Actualizar / Reemplazar Documento Aprobado */}
                        <button
                          type="button"
                          onClick={() => alternarFormActualizar(requerido.tipo)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 font-display text-xs font-bold text-route-action shadow-2xs transition hover:border-signal hover:bg-surface-elevated"
                        >
                          ✏️ {estaAbierto ? "Cancelar actualización" : "Actualizar / Reemplazar"}
                        </button>

                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-body text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Aprobado
                        </span>
                      </div>
                    </div>

                    {/* Desplegable de Captura/Carga para Documento Aprobado */}
                    {estaAbierto && (
                      <div className="mt-2 pt-3 border-t border-emerald-500/20">
                        {renderizarZonaCaptura(requerido.tipo, estaSubiendo, documento?.id)}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
