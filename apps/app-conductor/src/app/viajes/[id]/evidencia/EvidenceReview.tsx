import { Button } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { evidenciaCompleta } from "@ruum/shared/rules";
import type { AnguloEvidencia, FotoEvidencia } from "@ruum/shared/types";
import { BadgeSincronizacion } from "./EvidencePreview";
import { EvidenceSyncStatus } from "./EvidenceSyncStatus";
import type { EvidenceRequirement, InspeccionEvidencia } from "./evidence-requirements";
import { CAMPOS_INSPECCION, CAMPOS_INSPECCION_OBLIGATORIOS, totalCamposInspeccionCompletados } from "./evidence-requirements";

export function EvidenceReview({
  items,
  fotos,
  noAplica,
  resultado,
  registroCompleto,
  etiquetasFaltantes,
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
  registroCompleto: boolean;
  etiquetasFaltantes: string[];
  pendientesSubida: number;
  sincronizando: boolean;
  inspeccion: InspeccionEvidencia;
  enviando: boolean;
  onBackToMissing: () => void;
  onConfirm: () => void;
}) {
  const blocked = !registroCompleto || pendientesSubida > 0;
  const inspeccionCompletada = totalCamposInspeccionCompletados(inspeccion);

  return (
    <section className="mt-5 rounded-2xl border border-border/28 bg-surface p-6 text-text-primary shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
      <p className="font-body text-sm font-semibold text-[#8EC5FF]">Revisión final</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-text-primary">Confirma el registro completo</h2>
      <div className="mt-4">
        <EvidenceSyncStatus pendientesSubida={pendientesSubida} sincronizando={sincronizando} missing={etiquetasFaltantes} complete={registroCompleto} />
      </div>
      <div className="mt-5 grid gap-3">
        {items.map((item) => {
          const foto = fotos.find((candidate) => candidate.angulo === item.angulo);
          const omitted = noAplica.has(item.angulo);
          return (
            <div key={item.angulo} className="flex items-center justify-between gap-3 rounded-xl border border-border/24 bg-[var(--ruum-surface-subtle)] px-3 py-3">
              <div>
                <p className="font-body text-sm font-semibold text-text-primary">{item.titulo}</p>
                <p className="font-body text-xs text-text-secondary">{item.obligatorio ? "Obligatoria" : "Opcional"}</p>
              </div>
              {foto ? <BadgeSincronizacion sincronizada={Boolean(foto.sincronizada)} /> : <span className="font-body text-xs text-text-secondary">{omitted ? "No aplica" : "Falta"}</span>}
            </div>
          );
        })}
      </div>
      <section className="mt-5 rounded-xl border border-border/24 bg-[var(--ruum-surface-subtle)] p-4" aria-labelledby="revision-inspeccion-titulo">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="revision-inspeccion-titulo" className="font-body text-sm font-semibold text-text-primary">Datos de inspección</h3>
            <p className="mt-1 font-body text-xs text-text-secondary">
              {inspeccionCompletada} de {CAMPOS_INSPECCION_OBLIGATORIOS.length} obligatorios
            </p>
          </div>
        </div>
        <dl className="mt-3 grid gap-2 border-t border-border/18 pt-3 font-body text-sm sm:grid-cols-2">
          {CAMPOS_INSPECCION.map(({ campo, etiqueta, obligatorio }) => (
            <div key={campo}>
              <dt className="text-text-secondary">{etiqueta} {obligatorio ? "*" : "(opcional)"}</dt>
              <dd className="text-text-primary">{inspeccion[campo] || (obligatorio ? "Sin capturar" : "Sin notas")}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={onBackToMissing}>
          Revisar faltantes
        </Button>
        <Button onClick={onConfirm} disabled={blocked} loading={enviando}>
          {enviando ? TEXTOS_CARGANDO.confirmando : "Enviar registro"}
        </Button>
      </div>
    </section>
  );
}
