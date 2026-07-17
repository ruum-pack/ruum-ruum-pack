import { Button, OperationalCard } from "@ruum/ui";
import type { FotoEvidencia } from "@ruum/shared/types";
import type { EvidenceRequirement } from "./evidence-requirements";
import { EvidencePreview } from "./EvidencePreview";

function VehicleSilhouette({ label }: { label: string }) {
  return (
    <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-route-action bg-route-soft">
      <div className="absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-[40px] border-2 border-route-action/70" />
      <div className="absolute left-[25%] top-[calc(50%+22px)] size-8 rounded-full border-2 border-route-action/70 bg-surface" />
      <div className="absolute right-[25%] top-[calc(50%+22px)] size-8 rounded-full border-2 border-route-action/70 bg-surface" />
      <p className="relative max-w-[220px] text-center font-body text-sm font-semibold text-route-action">{label}</p>
    </div>
  );
}

export function EvidenceCaptureStep({
  item,
  step,
  total,
  foto,
  noAplica,
  busy,
  onCapture,
  onGallery,
  onNoAplica
}: {
  item: EvidenceRequirement;
  step: number;
  total: number;
  foto?: FotoEvidencia;
  noAplica: boolean;
  busy: boolean;
  onCapture: () => void;
  onGallery: () => void;
  onNoAplica: (checked: boolean) => void;
}) {
  return (
    <OperationalCard className="mt-5">
      <p className="font-body text-sm font-semibold text-route-action">
        {step} de {total}
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold">{item.titulo}</h2>
      <p className="mt-2 font-body text-base leading-7 text-text-secondary">{item.instruccion}</p>
      <div className="mt-4">
        <VehicleSilhouette label={item.guia} />
      </div>
      <EvidencePreview foto={foto} onRepeat={onCapture} disabled={busy} />
      {item.permiteNoAplica && (
        <label className="mt-4 flex min-h-11 items-center gap-3 rounded-xl border border-border bg-surface-elevated px-3 py-2 font-body text-sm font-semibold">
          <input type="checkbox" checked={noAplica} onChange={(event) => onNoAplica(event.target.checked)} className="size-4 accent-route" />
          No aplica
        </label>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button onClick={onCapture} loading={busy}>
          {foto ? "Repetir foto" : "Tomar foto"}
        </Button>
        <Button variant="secondary" onClick={onGallery} loading={busy}>
          Elegir de galería
        </Button>
      </div>
    </OperationalCard>
  );
}
