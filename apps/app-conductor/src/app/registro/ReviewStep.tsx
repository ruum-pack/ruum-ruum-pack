import { enmascararNombreArchivo, enmascararUltimos } from "../cuenta/datos-sensibles";
import { formatoTelefonoNacional } from "./registration-validation";
import { TIPOS_DOCUMENTO, type DocumentoKey } from "./registration-types";
import { ReviewSummary } from "./ReviewSummary";

export function ReviewStep({
  telefono,
  email,
  sesionAutenticada,
  nombreCompleto,
  curp,
  calle,
  numero,
  colonia,
  ciudad,
  estado,
  codigoPostal,
  referencias,
  contactoEmergenciaTelefono,
  numeroLicencia,
  tipoLicencia,
  vigenciaLicencia,
  autorizaVerificacion,
  declaraSinSuspensiones,
  documentos,
  documentosRemotos,
  aceptaTerminos,
  setAceptaTerminos,
  confirmaPrivacidad,
  setConfirmaPrivacidad,
  erroresCampos,
  limpiarErrorCampo,
  onEditar
}: {
  telefono: string;
  email: string;
  sesionAutenticada: boolean;
  nombreCompleto: string;
  curp: string;
  calle: string;
  numero: string;
  colonia: string;
  ciudad: string;
  estado: string;
  codigoPostal: string;
  referencias: string;
  contactoEmergenciaTelefono: string;
  numeroLicencia: string;
  tipoLicencia: string;
  vigenciaLicencia: string;
  autorizaVerificacion: boolean;
  declaraSinSuspensiones: boolean;
  documentos: Record<DocumentoKey, File | null>;
  documentosRemotos: Set<string>;
  aceptaTerminos: boolean;
  setAceptaTerminos: (valor: boolean) => void;
  confirmaPrivacidad: boolean;
  setConfirmaPrivacidad: (valor: boolean) => void;
  erroresCampos: Record<string, string>;
  limpiarErrorCampo: (campo: string) => void;
  onEditar: (paso: number) => void;
}) {
  const textoDocumento = (campo: DocumentoKey, cargado: string, pendiente: string) =>
    documentos[campo]?.name
      ? enmascararNombreArchivo(documentos[campo].name)
      : documentosRemotos.has(TIPOS_DOCUMENTO[campo])
        ? cargado
        : pendiente;

  return (
    <fieldset className="grid gap-4">
      <legend className="font-display text-xl font-bold text-text-primary">Revisa tu información</legend>
      <p className="font-body text-sm leading-6 text-text-secondary">Verifica que todo sea correcto antes de enviar tu registro.</p>
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 font-body text-sm text-text-secondary">
        <ReviewSummary titulo="Cuenta" valores={[formatoTelefonoNacional(telefono), email.trim().toLowerCase(), sesionAutenticada ? "Cuenta verificada" : "Cuenta pendiente de verificación"]} onEditar={() => onEditar(0)} />
        <ReviewSummary titulo="Identidad" valores={[nombreCompleto, `CURP ${enmascararUltimos(curp.trim().toUpperCase())}`, `${calle} ${numero}`, `${colonia}, ${ciudad}`, `${estado}, C.P. ${codigoPostal}`, referencias, `Emergencia: contacto registrado · ${enmascararUltimos(contactoEmergenciaTelefono)}`]} onEditar={() => onEditar(1)} />
        <ReviewSummary titulo="Licencia" valores={[`Licencia ${enmascararUltimos(numeroLicencia)}`, `Tipo ${tipoLicencia}`, `Vigente hasta ${vigenciaLicencia}`, autorizaVerificacion ? "Autoriza verificación de antecedentes" : "Verificación pendiente", declaraSinSuspensiones ? "Sin suspensiones ni procesos activos declarados" : "Declaración pendiente"]} onEditar={() => onEditar(2)} />
        <ReviewSummary
          titulo="Documentos"
          valores={[
            textoDocumento("licenciaFrente", "Licencia frente guardada", "Licencia frente pendiente"),
            textoDocumento("licenciaReverso", "Licencia reverso guardada", "Licencia reverso pendiente"),
            textoDocumento("identificacionOficial", "Identificación guardada", "Identificación pendiente")
          ]}
          onEditar={() => onEditar(3)}
        />
      </div>
      <label className="flex gap-3 rounded-xl border border-route-action/20 bg-route-soft p-4 font-body text-sm leading-6 text-text-secondary">
        <input type="checkbox" checked={aceptaTerminos} onChange={(e) => { setAceptaTerminos(e.target.checked); limpiarErrorCampo("aceptaTerminos"); }} className="mt-1 size-4 accent-route-dark" />
        <span>
          He leído y acepto los{" "}
          <a href="/legal/terminos" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold text-route-action underline underline-offset-2 hover:no-underline">
            términos y condiciones
          </a>{" "}
          de ruum ruum by Movilia.
        </span>
      </label>
      {erroresCampos.aceptaTerminos && <p className="font-body text-sm font-medium text-danger-action">{erroresCampos.aceptaTerminos}</p>}
      <label className="flex gap-3 rounded-xl border border-route-action/20 bg-route-soft p-4 font-body text-sm leading-6 text-text-secondary">
        <input type="checkbox" checked={confirmaPrivacidad} onChange={(e) => { setConfirmaPrivacidad(e.target.checked); limpiarErrorCampo("confirmaPrivacidad"); }} className="mt-1 size-4 accent-route-dark" />
        <span>
          Confirmo que he leído el{" "}
          <a href="/legal/privacidad" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold text-route-action underline underline-offset-2 hover:no-underline">
            aviso de privacidad
          </a>{" "}
          de ruum ruum by Movilia.
        </span>
      </label>
      {erroresCampos.confirmaPrivacidad && <p className="font-body text-sm font-medium text-danger-action">{erroresCampos.confirmaPrivacidad}</p>}
    </fieldset>
  );
}
