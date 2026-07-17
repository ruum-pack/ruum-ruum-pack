import { Button, OperationalCard } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { evidenciaCompleta } from "@ruum/shared/rules";
import type { AnguloEvidencia, FotoEvidencia } from "@ruum/shared/types";
import { BadgeSincronizacion } from "./EvidencePreview";
import { EvidenceSyncStatus } from "./EvidenceSyncStatus";
import type { EvidenceRequirement, InspeccionEvidencia } from "./evidence-requirements";
import { ETIQUETA_ANGULO } from "./evidence-requirements";

export function EvidenceReview({
  items,
  fotos,
  noAplica,
  resultado,
  pendientesSubida,
  sincronizando,
  inspeccion,
  enviando,
  onBackToMissing,
  onConfirm
}: {
  items: EvidenceRequirement[];
  fotos: FotoEvidencia[];
  noAplica: Set<AnguloEvidencia>;
  resultado: ReturnType<typeof evidenciaCompleta>;
  pendientesSubida: number;
  sincronizando: boolean;
  inspeccion: InspeccionEvidencia;
  enviando: boolean;
  onBackToMissing: () => void;
  onConfirm: () => void;
}) {
  const missingLabels = resultado.angulosFaltantes.map((angulo) => ETIQUETA_ANGULO[angulo as AnguloEvidencia] ?? angulo);
  const blocked = !resultado.completa || pendientesSubida > 0;

  return (
    <OperationalCard className="mt-5">
      <p className="font-body text-sm font-semibold text-route-action">Revisión final</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">Confirma el registro completo</h2>
      <div className="mt-4">
        <EvidenceSyncStatus pendientesSubida={pendientesSubida} sincronizando={sincronizando} missing={missingLabels} complete={resultado.completa} />
      </div>
      <div className="mt-5 grid gap-3">
        {items.map((item) => {
          const foto = fotos.find((candidate) => candidate.angulo === item.angulo);
          const omitted = noAplica.has(item.angulo);
          return (
            <div key={item.angulo} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated px-3 py-3">
              <div>
                <p className="font-body text-sm font-semibold">{item.titulo}</p>
                <p className="font-body text-xs text-text-tertiary">{item.obligatorio ? "Obligatoria" : "Opcional"}</p>
              </div>
              {foto ? <BadgeSincronizacion sincronizada={Boolean(foto.sincronizada)} /> : <span className="font-body text-xs text-text-tertiary">{omitted ? "No aplica" : "Falta"}</span>}
            </div>
          );
        })}
      </div>
      <details className="mt-5 rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer px-4 py-3 font-body text-sm font-semibold">Datos de inspección</summary>
        <dl className="grid gap-2 border-t border-border px-4 py-3 font-body text-sm sm:grid-cols-2">
          <div><dt className="text-text-tertiary">Combustible</dt><dd>{inspeccion.combustible || "Sin capturar"}</dd></div>
          <div><dt className="text-text-tertiary">Kilometraje</dt><dd>{inspeccion.kilometraje || "Sin capturar"}</dd></div>
          <div><dt className="text-text-tertiary">Llaves</dt><dd>{inspeccion.llavesRecibidas || "Sin capturar"}</dd></div>
          <div><dt className="text-text-tertiary">Notas</dt><dd>{inspeccion.notas || "Sin notas"}</dd></div>
        </dl>
      </details>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={onBackToMissing}>
          Revisar faltantes
        </Button>
        <Button onClick={onConfirm} disabled={blocked} loading={enviando}>
          {enviando ? TEXTOS_CARGANDO.confirmando : "Enviar registro"}
        </Button>
      </div>
    </OperationalCard>
  );
}
