import { Button } from "@ruum/ui";
import type { FotoEvidencia } from "@ruum/shared/types";
import type { EvidenceRequirement } from "./evidence-requirements";
import { EvidencePreview } from "./EvidencePreview";

function VehicleSilhouette({ label }: { label: string }) {
  return (
    <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[rgba(77,163,255,0.55)] bg-[#0D1626]">
      <div className="absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-[40px] border-2 border-[#4DA3FF]/70" />
      <div className="absolute left-[25%] top-[calc(50%+22px)] size-8 rounded-full border-2 border-[#4DA3FF]/70 bg-[#101A2C]" />
      <div className="absolute right-[25%] top-[calc(50%+22px)] size-8 rounded-full border-2 border-[#4DA3FF]/70 bg-[#101A2C]" />
      <p className="relative max-w-[220px] text-center font-body text-sm font-semibold text-[#8EC5FF]">{label}</p>
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
    <section className="mt-5 rounded-2xl border border-[rgba(122,162,214,0.28)] bg-[#101A2C] p-6 text-[#E8EDF6] shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
      <p className="font-body text-sm font-semibold text-[#8EC5FF]">
        {step} de {total}
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-[#E8EDF6]">{item.titulo}</h2>
      <p className="mt-2 font-body text-base leading-7 text-[#B7C2D4]">{item.instruccion}</p>
      <div className="mt-4">
        <VehicleSilhouette label={item.guia} />
      </div>
      <EvidencePreview foto={foto} onRepeat={onCapture} disabled={busy} />
      {item.permiteNoAplica && (
        <label className="mt-4 flex min-h-11 items-center gap-3 rounded-xl border border-[rgba(122,162,214,0.24)] bg-[#0D1626] px-3 py-2 font-body text-sm font-semibold text-[#B7C2D4]">
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
    </section>
  );
}
