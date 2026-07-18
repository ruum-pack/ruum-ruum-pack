import { Button } from "@ruum/ui";
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
    <section className="mt-5 rounded-2xl border border-[rgba(122,162,214,0.28)] bg-[#101A2C] p-6 text-[#E8EDF6] shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
      <p className="font-body text-sm font-semibold text-[#8EC5FF]">Revisión final</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-[#E8EDF6]">Confirma el registro completo</h2>
      <div className="mt-4">
        <EvidenceSyncStatus pendientesSubida={pendientesSubida} sincronizando={sincronizando} missing={missingLabels} complete={resultado.completa} />
      </div>
      <div className="mt-5 grid gap-3">
        {items.map((item) => {
          const foto = fotos.find((candidate) => candidate.angulo === item.angulo);
          const omitted = noAplica.has(item.angulo);
          return (
            <div key={item.angulo} className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(122,162,214,0.24)] bg-[#0D1626] px-3 py-3">
              <div>
                <p className="font-body text-sm font-semibold text-[#E8EDF6]">{item.titulo}</p>
                <p className="font-body text-xs text-[#B7C2D4]">{item.obligatorio ? "Obligatoria" : "Opcional"}</p>
              </div>
              {foto ? <BadgeSincronizacion sincronizada={Boolean(foto.sincronizada)} /> : <span className="font-body text-xs text-[#B7C2D4]">{omitted ? "No aplica" : "Falta"}</span>}
            </div>
          );
        })}
      </div>
      <details className="mt-5 rounded-xl border border-[rgba(122,162,214,0.24)] bg-[#0D1626]">
        <summary className="cursor-pointer px-4 py-3 font-body text-sm font-semibold text-[#E8EDF6]">Datos de inspección</summary>
        <dl className="grid gap-2 border-t border-[rgba(122,162,214,0.18)] px-4 py-3 font-body text-sm sm:grid-cols-2">
          <div><dt className="text-[#B7C2D4]">Combustible</dt><dd className="text-[#E8EDF6]">{inspeccion.combustible || "Sin capturar"}</dd></div>
          <div><dt className="text-[#B7C2D4]">Kilometraje</dt><dd className="text-[#E8EDF6]">{inspeccion.kilometraje || "Sin capturar"}</dd></div>
          <div><dt className="text-[#B7C2D4]">Llaves</dt><dd className="text-[#E8EDF6]">{inspeccion.llavesRecibidas || "Sin capturar"}</dd></div>
          <div><dt className="text-[#B7C2D4]">Notas</dt><dd className="text-[#E8EDF6]">{inspeccion.notas || "Sin notas"}</dd></div>
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
    </section>
  );
}
