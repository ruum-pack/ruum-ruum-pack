"use client";

import { useEffect, useMemo, useRef } from "react";
import { Button } from "@ruum/ui";
import { enmascararNombreArchivo } from "../cuenta/datos-sensibles";
import type { EstadoDocumento } from "./registration-types";

function textoEstadoDocumento(estado: EstadoDocumento, nombreArchivo: string) {
  const nombreProtegido = enmascararNombreArchivo(nombreArchivo);
  return {
    pendiente: "",
    listo: `Listo para subir: ${nombreProtegido}`,
    subiendo: `Subiendo: ${nombreProtegido}`,
    subido: `Subido correctamente: ${nombreProtegido}`,
    error: nombreArchivo ? `Error al subir: ${nombreProtegido}` : "Error en el archivo seleccionado"
  }[estado];
}

export function DocumentUploadField({
  etiqueta,
  archivo,
  estado,
  error,
  onSeleccionar
}: {
  etiqueta: string;
  archivo: File | null;
  estado: EstadoDocumento;
  error?: string;
  onSeleccionar: (archivo: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(() => {
    if (!archivo || !archivo.type.startsWith("image/")) return null;
    return URL.createObjectURL(archivo);
  }, [archivo]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const colorTexto = estado === "error" ? "text-danger-action" : estado === "subido" ? "text-success" : "text-text-secondary";

  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-body text-sm font-semibold text-text-primary">
        {etiqueta}
        <span className="ml-1 text-danger-action" aria-hidden> *</span>
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onSeleccionar(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {archivo ? (
        <div
          className={[
            "flex items-center gap-3 rounded-[10px] border bg-surface px-3.5 py-2.5",
            error ? "border-danger-action bg-danger-soft/20" : "border-border-strong"
          ].join(" ")}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview local de un File antes de subir, next/image no soporta blob: directamente
            <img src={previewUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-elevated font-body text-xs font-semibold text-text-tertiary" aria-hidden>
              PDF
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-body text-sm text-text-primary">{enmascararNombreArchivo(archivo.name)}</p>
            {estado !== "pendiente" && (
              <p className={`font-body text-sm font-medium leading-5 ${colorTexto}`}>
                {textoEstadoDocumento(estado, archivo.name)}
              </p>
            )}
          </div>
          <Button type="button" variant="quiet" onClick={() => inputRef.current?.click()}>
            Tomar otra foto
          </Button>
        </div>
      ) : estado === "subido" ? (
        <div className="rounded-[10px] border border-success bg-control-soft px-3.5 py-3">
          <p className="font-body text-sm font-semibold text-success">Documento guardado en tu expediente</p>
          <p className="mt-1 font-body text-sm text-text-secondary">No necesitas volver a cargarlo en este dispositivo.</p>
        </div>
      ) : (
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          Elegir o tomar foto
        </Button>
      )}

      {error ? (
        <p role="alert" className="font-body text-sm font-medium leading-5 text-danger-action">{error}</p>
      ) : null}
    </div>
  );
}
