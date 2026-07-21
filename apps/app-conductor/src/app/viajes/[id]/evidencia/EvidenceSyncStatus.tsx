"use client";
import { Aviso } from "@ruum/ui";
import { MENSAJE_EVIDENCIA_SINCRONIZANDO } from "@ruum/shared/constants";
import { useEvidenceWizard } from "./EvidenceContext";

export function EvidenceSyncStatus() {
  const { pendientesSubida, sincronizando, etiquetasFaltantes: missing, registroCompleto: complete } = useEvidenceWizard();

  if (pendientesSubida > 0) {
    return (
      <Aviso tono="atencion">
        {pendientesSubida} foto{pendientesSubida === 1 ? "" : "s"} pendiente{pendientesSubida === 1 ? "" : "s"} de subir.
        {sincronizando ? ` ${MENSAJE_EVIDENCIA_SINCRONIZANDO}.` : " Puedes completar el flujo offline; el envío se habilita al sincronizar."}
      </Aviso>
    );
  }

  if (!complete) {
    return <Aviso tono="atencion">Falta: {missing.join(", ")}.</Aviso>;
  }

  return <Aviso tono="info">Registro completo y sincronizado. Revisa antes de enviar.</Aviso>;
}
