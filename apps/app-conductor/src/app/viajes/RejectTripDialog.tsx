import { MOTIVOS_RECHAZO, type MotivoRechazo } from "@ruum/shared/constants";
import { nombreVehiculo, type PasaporteRow } from "./trips-utils";

export function RejectTripDialog({
  viaje,
  onClose,
  onConfirm
}: {
  viaje: PasaporteRow | null;
  onClose: () => void;
  onConfirm: (motivo: MotivoRechazo) => void;
}) {
  if (!viaje) return null;

  return (
    <div className="fixed inset-0 z-50 bg-surface-strong" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rechazo-viaje-titulo"
        className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface p-5 shadow-[0_-24px_70px_rgba(26,31,46,0.22)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p id="rechazo-viaje-titulo" className="font-display text-lg font-semibold">
              Motivo de rechazo
            </p>
            <p className="mt-1 font-body text-sm text-text-secondary">
              {nombreVehiculo(viaje)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-border px-3 py-2 font-body text-sm font-semibold text-text-secondary"
          >
            Cerrar
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          {MOTIVOS_RECHAZO.map((motivo) => (
            <button
              key={motivo}
              type="button"
              onClick={() => onConfirm(motivo)}
              className="min-h-11 rounded-xl border border-border bg-surface px-4 py-3 text-left font-body text-sm font-semibold text-text-secondary transition-colors hover:border-route-action hover:bg-route-soft"
            >
              {motivo}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
