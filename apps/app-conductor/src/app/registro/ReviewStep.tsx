import { enmascararUltimos } from "../cuenta/datos-sensibles";
import { formatoTelefonoNacional } from "./registration-validation";
import { TIPOS_DOCUMENTO, type DocumentoKey } from "./registration-types";
import { ReviewSummary, DocumentoPreview } from "./ReviewSummary";

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
  return (
    <fieldset className="grid gap-4">
      <legend className="font-display text-xl font-bold text-text-primary">Revisa tu información</legend>
      <p className="font-body text-sm leading-6 text-text-secondary">Verifica que todo sea correcto antes de enviar tu registro.</p>
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 font-body text-sm">
        <ReviewSummary titulo="Cuenta" valores={[formatoTelefonoNacional(telefono), email.trim().toLowerCase(), sesionAutenticada ? "Cuenta verificada" : "Cuenta pendiente de verificación"]} onEditar={() => onEditar(0)} />
        <ReviewSummary titulo="Identidad" valores={[nombreCompleto, `CURP ${enmascararUltimos(curp.trim().toUpperCase())}`, `${calle} ${numero}`, `${colonia}, ${ciudad}`, `${estado}, C.P. ${codigoPostal}`, referencias, `Emergencia: contacto registrado · ${enmascararUltimos(contactoEmergenciaTelefono)}`]} onEditar={() => onEditar(1)} />
        <ReviewSummary titulo="Licencia" valores={[`Licencia ${enmascararUltimos(numeroLicencia)}`, `Tipo ${tipoLicencia}`, `Vigente hasta ${vigenciaLicencia}`, autorizaVerificacion ? "Autoriza verificación de antecedentes" : "Verificación pendiente", declaraSinSuspensiones ? "Sin suspensiones ni procesos activos declarados" : "Declaración pendiente"]} onEditar={() => onEditar(2)} />

        {/* Documentos con miniaturas (thumbnails) en lugar de texto plano */}
        <div className="border-t border-border pt-3 first:border-t-0 first:pt-0">
          <div className="flex items-center justify-between gap-3">
            <p className="font-body text-sm font-semibold text-text-primary">Documentos</p>
            <button
              type="button"
              onClick={() => onEditar(3)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-3 font-body text-sm font-semibold text-route-action underline-offset-4 hover:underline hover:bg-route-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action"
              aria-label="Editar documentos"
            >
              Editar
            </button>
          </div>
          <ul className="mt-2 grid gap-2.5">
            {documentos.licenciaFrente ? (
              <li><DocumentoPreview archivo={documentos.licenciaFrente} /></li>
            ) : (
              <li className="font-body text-sm text-text-secondary">
                {documentosRemotos.has(TIPOS_DOCUMENTO.licenciaFrente) ? "Licencia frente guardada" : "Licencia frente pendiente"}
              </li>
            )}
            {documentos.licenciaReverso ? (
              <li><DocumentoPreview archivo={documentos.licenciaReverso} /></li>
            ) : (
              <li className="font-body text-sm text-text-secondary">
                {documentosRemotos.has(TIPOS_DOCUMENTO.licenciaReverso) ? "Licencia reverso guardada" : "Licencia reverso pendiente"}
              </li>
            )}
            {documentos.identificacionOficial ? (
              <li><DocumentoPreview archivo={documentos.identificacionOficial} /></li>
            ) : (
              <li className="font-body text-sm text-text-secondary">
                {documentosRemotos.has(TIPOS_DOCUMENTO.identificacionOficial) ? "Identificación guardada" : "Identificación pendiente"}
              </li>
            )}
          </ul>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-route-action/20 bg-route-soft p-4 font-body text-sm leading-6 text-text-tertiary">
        <input
          type="checkbox"
          checked={aceptaTerminos}
          onChange={(e) => {
            setAceptaTerminos(e.target.checked);
            limpiarErrorCampo("aceptaTerminos");
          }}
          className="mt-0.5 size-5 accent-route-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action"
          aria-required="true"
        />
        <span>
          He leído y acepto los{" "}
          <a href="/legal/terminos" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold text-route-action underline underline-offset-2 hover:no-underline">
            términos y condiciones
          </a>{" "}
          de ruum ruum by Moviliax.
        </span>
      </label>
      {erroresCampos.aceptaTerminos && <p className="font-body text-sm font-medium text-danger-action">{erroresCampos.aceptaTerminos}</p>}
      <label className="flex items-start gap-3 rounded-xl border border-route-action/20 bg-route-soft p-4 font-body text-sm leading-6 text-text-tertiary">
        <input
          type="checkbox"
          checked={confirmaPrivacidad}
          onChange={(e) => {
            setConfirmaPrivacidad(e.target.checked);
            limpiarErrorCampo("confirmaPrivacidad");
          }}
          className="mt-0.5 size-5 accent-route-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action"
          aria-required="true"
        />
        <span>
          Confirmo que he leído el{" "}
          <a href="/legal/privacidad" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold text-route-action underline underline-offset-2 hover:no-underline">
            aviso de privacidad
          </a>{" "}
          de ruum ruum by Moviliax.
        </span>
      </label>
      {erroresCampos.confirmaPrivacidad && <p className="font-body text-sm font-medium text-danger-action">{erroresCampos.confirmaPrivacidad}</p>}
    </fieldset>
  );
}
