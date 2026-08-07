import { useMemo, useEffect } from "react";
import { enmascararNombreArchivo } from "../cuenta/datos-sensibles";

export function ReviewSummary({ titulo, valores, onEditar }: { titulo: string; valores: Array<string | undefined>; onEditar?: () => void }) {
  return (
    <div className="border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-sm font-semibold text-text-primary">{titulo}</p>
        {onEditar && (
          <button
            type="button"
            onClick={onEditar}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-3 font-body text-sm font-semibold text-route-action underline-offset-4 hover:underline hover:bg-route-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action"
            aria-label={`Editar ${titulo.toLowerCase()}`}
          >
            Editar
          </button>
        )}
      </div>
      <ul className="mt-2 grid gap-1">
        {valores.filter(Boolean).map((valor) => (
          <li key={valor} className="font-body text-sm text-text-secondary">
            {valor}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DocumentoPreview({ archivo }: { archivo: File | null }) {
  const previewUrl = useMemo(() => {
    if (!archivo) return null;
    if (archivo.type.startsWith("image/")) {
      return URL.createObjectURL(archivo);
    }
    return null;
  }, [archivo]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!archivo) return null;

  return (
    <div className="flex items-center gap-2">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- preview local de un File antes de subir, next/image no soporta blob: directamente
        <img
          src={previewUrl}
          alt=""
          className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-border"
          loading="lazy"
        />
      ) : (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated font-body text-xs font-semibold text-text-secondary" aria-hidden>
          PDF
        </div>
      )}
      <span className="truncate font-body text-sm text-text-primary" title={archivo.name}>
        {enmascararNombreArchivo(archivo.name)}
      </span>
    </div>
  );
}
