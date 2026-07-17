import { Aviso } from "@ruum/ui";
import { DatosSensiblesInfo } from "../cuenta/datos-sensibles";
import { DocumentUploadField } from "./DocumentUploadField";
import type { DocumentoKey, EstadoDocumento } from "./registration-types";

export function DocumentsStep({
  sesionAutenticada,
  documentos,
  estadoDocumentos,
  erroresCampos,
  cambiarDocumento
}: {
  sesionAutenticada: boolean;
  documentos: Record<DocumentoKey, File | null>;
  estadoDocumentos: Record<DocumentoKey, EstadoDocumento>;
  erroresCampos: Record<string, string>;
  cambiarDocumento: (campo: DocumentoKey, archivo: File | null) => void;
}) {
  return (
    <fieldset className="grid gap-4">
      <legend className="font-display text-xl font-bold text-text-primary">Documentos</legend>
      <DatosSensiblesInfo tipo="documentos" compacto />
      {!sesionAutenticada ? (
        <Aviso tono="atencion">
          Primero confirma tu cuenta. Después podrás cargar documentos y continuar desde cualquier dispositivo.
        </Aviso>
      ) : (
        <>
          <DocumentUploadField
            etiqueta="Foto de tu licencia (frente)"
            archivo={documentos.licenciaFrente}
            estado={estadoDocumentos.licenciaFrente}
            error={erroresCampos.licenciaFrente || undefined}
            onSeleccionar={(archivo) => cambiarDocumento("licenciaFrente", archivo)}
          />
          <DocumentUploadField
            etiqueta="Foto de tu licencia (reverso)"
            archivo={documentos.licenciaReverso}
            estado={estadoDocumentos.licenciaReverso}
            error={erroresCampos.licenciaReverso || undefined}
            onSeleccionar={(archivo) => cambiarDocumento("licenciaReverso", archivo)}
          />
          <DocumentUploadField
            etiqueta="Foto de tu Identificación oficial (INE/pasaporte)"
            archivo={documentos.identificacionOficial}
            estado={estadoDocumentos.identificacionOficial}
            error={erroresCampos.identificacionOficial || undefined}
            onSeleccionar={(archivo) => cambiarDocumento("identificacionOficial", archivo)}
          />
        </>
      )}
      {erroresCampos.cuentaVerificada && <p className="font-body text-xs font-medium text-danger-action">{erroresCampos.cuentaVerificada}</p>}
    </fieldset>
  );
}
