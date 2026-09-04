"use client";
import { MENSAJE_EVIDENCIA_SINCRONIZANDO } from "@ruum/shared/constants";
import { useEvidenceWizard } from "./EvidenceContext";
import { ConductorFeedback } from "../../../../components/v2/ConductorUI";

export function EvidenceSyncStatus() {
  const { pendientesSubida, sincronizando, etiquetasFaltantes: missing, registroCompleto: complete } = useEvidenceWizard();

  if (pendientesSubida > 0) {
    return (
      <ConductorFeedback tone="warning">
        {pendientesSubida} foto{pendientesSubida === 1 ? "" : "s"} pendiente{pendientesSubida === 1 ? "" : "s"} de subir.
        {sincronizando ? ` ${MENSAJE_EVIDENCIA_SINCRONIZANDO}.` : " Puedes completar el flujo offline; el envío se habilita al sincronizar."}
      </ConductorFeedback>
    );
  }

  if (!complete) {
    return <ConductorFeedback tone="warning">Falta: {missing.join(", ")}.</ConductorFeedback>;
  }

  return <ConductorFeedback tone="success">Registro completo y sincronizado. Revisa antes de enviar.</ConductorFeedback>;
}
