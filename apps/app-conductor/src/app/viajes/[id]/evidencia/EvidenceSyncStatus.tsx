import { Aviso } from "@ruum/ui";
import { MENSAJE_EVIDENCIA_SINCRONIZANDO } from "@ruum/shared/constants";

export function EvidenceSyncStatus({
  pendientesSubida,
  sincronizando,
  missing,
  complete
}: {
  pendientesSubida: number;
  sincronizando: boolean;
  missing: string[];
  complete: boolean;
}) {
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
