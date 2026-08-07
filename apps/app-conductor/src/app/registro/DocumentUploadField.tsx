"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB
const FORMATOS_PERMITIDOS = ["JPG", "PNG", "PDF"];

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
  const [progreso, setProgreso] = useState<number | null>(null);

  const previewUrl = useMemo(() => {
    if (!archivo || !archivo.type.startsWith("image/")) return null;
    return URL.createObjectURL(archivo);
  }, [archivo]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const colorTexto = estado === "error" ? "text-danger-action" : estado === "subido" ? "text-success" : "text-text-tertiary/80";

  const abrirSelectorArchivo = () => {
    inputRef.current?.click();
  };

  const manejarSeleccionArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivoSeleccionado = e.target.files?.[0] ?? null;
    e.target.value = "";

    if (archivoSeleccionado) {
      // Validar tamaño
      if (archivoSeleccionado.size > TAMANO_MAXIMO_BYTES) {
        onSeleccionar(null);
        return;
      }
      // Validar tipo
      const tipoValido =
        archivoSeleccionado.type.startsWith("image/") ||
        archivoSeleccionado.type === "application/pdf";
      if (!tipoValido) {
        onSeleccionar(null);
        return;
      }
    }

    onSeleccionar(archivoSeleccionado);
    setProgreso(null);
  };

  const handleEliminar = () => {
    onSeleccionar(null);
    setProgreso(null);
  };

  const IconoCamera = () => (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0 text-text-tertiary/80"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22.3 19a2 2 0 0 1-2.1.3l-1.2-0.6a1 1 0 0 0-.4-1.3l2.5-3.8a1 1 0 0 0-1.1-1.5L15 13.1" />
      <path d="M6 9V5a3 3 0 1 1 6 0v4" />
      <path d="M6 9V4a3 3 0 0 0-6 0v15a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-4" />
      <circle cx="9" cy="12" r="3" />
    </svg>
  );

  const IconoNube = () => (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0 text-text-tertiary/80"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 18A4 4 0 0 0 18 11.5 6 6 0 0 0 6 11c0 2.5-2 4.5-2 4.5h14z" />
      <path d="M12 17v4" />
      <path d="M8 13l4-4 4 4" />
    </svg>
  );

  const IconoCheck = () => (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0 text-success"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-4-4" />
    </svg>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-body text-sm font-semibold text-text-primary">
        {etiqueta}
        <span className="ml-1 text-danger-action" aria-hidden> *</span>
      </label>

      {/* Especificaciones del archivo */}
      <p className="font-body text-xs text-text-tertiary/80">
        Formatos: {FORMATOS_PERMITIDOS.join(", ")} · Máximo 5 MB
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        capture="environment"
        className="hidden"
        aria-label={etiqueta}
        onChange={manejarSeleccionArchivo}
      />

      {archivo && estado !== "subido" ? (
        <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-border-strong bg-surface-elevated/30 px-3.5 py-3 transition-all hover:border-route-action">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview local de un File antes de subir, next/image no soporta blob: directamente
            <img src={previewUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover ring-1 ring-border" />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-elevated font-body text-xs font-semibold text-text-tertiary/80" aria-hidden>
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
            {/* Barra de progreso durante la subida */}
            {estado === "subiendo" && progreso === null && (
              <div className="mt-1 h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-surface-elevated">
                <div className="h-full w-1/2 animate-pulse bg-signal" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={abrirSelectorArchivo}
              className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 font-body text-xs font-semibold text-text-tertiary/80 hover:bg-surface-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action"
              aria-label="Reemplazar documento"
            >
              Reemplazar
            </button>
            <button
              type="button"
              onClick={handleEliminar}
                className="inline-flex size-7 items-center justify-center rounded-lg text-text-tertiary/80 hover:bg-surface-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action"
              aria-label="Eliminar documento"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : estado === "subido" ? (
        <div className="rounded-[10px] border border-success bg-control-soft px-3.5 py-3">
          <div className="flex items-center gap-2">
            <IconoCheck />
            <p className="font-body text-sm font-semibold text-success">Documento guardado en tu expediente</p>
          </div>
          <p className="mt-1 font-body text-sm text-text-tertiary/80">
            No necesitas volver a cargarlo en este dispositivo.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={abrirSelectorArchivo}
          className={[
            "flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border-2 border-dashed",
            "border-border-strong bg-surface-elevated/30 px-4 py-3.5",
            "font-body text-sm font-semibold text-text-tertiary/80 transition-all",
            "hover:border-route-action hover:bg-surface hover:text-route-action",
            "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
          ].join(" ")}
          aria-label={`Seleccionar archivo para ${etiqueta}`}
        >
          <IconoNube />
          <span>Elegir o tomar foto</span>
        </button>
      )}

      {error ? (
        <p role="alert" className="font-body text-sm font-medium leading-5 text-danger-action">
          {error}
        </p>
      ) : null}
    </div>
  );
}
