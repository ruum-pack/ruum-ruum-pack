import { Aviso, Field } from "@ruum/ui";
import { DIAS_ADVERTENCIA_VIGENCIA_LICENCIA, diasParaVencerLicencia } from "@ruum/shared/validacion";
import { DatosSensiblesInfo } from "../cuenta/datos-sensibles";
import { formatoFechaIsoParcial } from "./registration-validation";
import { TIPOS_LICENCIA } from "./registration-types";
import { SelectField } from "./SelectField";

export function LicenseStep({
  numeroLicencia,
  setNumeroLicencia,
  tipoLicencia,
  setTipoLicencia,
  vigenciaLicencia,
  setVigenciaLicencia,
  autorizaVerificacion,
  setAutorizaVerificacion,
  declaraSinSuspensiones,
  setDeclaraSinSuspensiones,
  erroresCampos,
  limpiarErrorCampo,
  validarCampo,
  validarVigenciaLicencia
}: {
  numeroLicencia: string;
  setNumeroLicencia: (valor: string) => void;
  tipoLicencia: string;
  setTipoLicencia: (valor: string) => void;
  vigenciaLicencia: string;
  setVigenciaLicencia: (valor: string) => void;
  autorizaVerificacion: boolean;
  setAutorizaVerificacion: (valor: boolean) => void;
  declaraSinSuspensiones: boolean;
  setDeclaraSinSuspensiones: (valor: boolean) => void;
  erroresCampos: Record<string, string>;
  limpiarErrorCampo: (campo: string) => void;
  validarCampo: (campo: string, valor: string) => boolean;
  validarVigenciaLicencia: () => boolean;
}) {
  const diasVigencia = vigenciaLicencia && !erroresCampos.vigenciaLicencia ? diasParaVencerLicencia(vigenciaLicencia) : null;

  return (
    <fieldset className="grid gap-4">
      <legend className="font-display text-xl font-bold text-text-primary">Licencia y experiencia</legend>
      <Field etiqueta="Número de licencia" value={numeroLicencia} onChange={(e) => { setNumeroLicencia(e.target.value); limpiarErrorCampo("numeroLicencia"); }} error={erroresCampos.numeroLicencia || undefined} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField etiqueta="Tipo de licencia" value={tipoLicencia} onChange={(valor) => { setTipoLicencia(valor); limpiarErrorCampo("tipoLicencia"); }} error={erroresCampos.tipoLicencia || undefined} required placeholder="Selecciona el tipo de licencia" opciones={TIPOS_LICENCIA} />
        <Field
          etiqueta="Vigencia"
          value={vigenciaLicencia}
          ayuda="Formato AAAA-MM-DD."
          inputMode="numeric"
          placeholder="2027-07-15"
          pattern="\\d{4}-\\d{2}-\\d{2}"
          maxLength={10}
          onChange={(e) => {
            setVigenciaLicencia(formatoFechaIsoParcial(e.target.value));
            limpiarErrorCampo("vigenciaLicencia");
          }}
          onBlur={() => validarVigenciaLicencia()}
          error={erroresCampos.vigenciaLicencia || undefined}
          required
        />
      </div>
      {diasVigencia !== null && diasVigencia >= 0 && diasVigencia <= DIAS_ADVERTENCIA_VIGENCIA_LICENCIA && (
        <Aviso tono="atencion">
          Tu licencia vence en {diasVigencia} día{diasVigencia === 1 ? "" : "s"}. Puedes continuar, pero procura renovarla pronto para no perder actividad.
        </Aviso>
      )}
      <DatosSensiblesInfo tipo="licencia" compacto />
      <label className="flex gap-3 rounded-xl border border-border bg-surface p-4 font-body text-sm leading-6 text-text-secondary">
        <input type="checkbox" checked={autorizaVerificacion} onChange={(e) => { setAutorizaVerificacion(e.target.checked); limpiarErrorCampo("autorizaVerificacion"); }} className="mt-1 size-4 accent-route-dark" />
        <span>Autorizo la verificación de antecedentes y de mi historial de manejo ante las autoridades correspondientes.</span>
      </label>
      {erroresCampos.autorizaVerificacion && <p className="font-body text-sm font-medium text-danger-action">{erroresCampos.autorizaVerificacion}</p>}
      <label className="flex gap-3 rounded-xl border border-border bg-surface p-4 font-body text-sm leading-6 text-text-secondary">
        <input type="checkbox" checked={declaraSinSuspensiones} onChange={(e) => { setDeclaraSinSuspensiones(e.target.checked); limpiarErrorCampo("declaraSinSuspensiones"); }} className="mt-1 size-4 accent-route-dark" />
        <span>Declaro que no tengo suspensiones vigentes de licencia ni procesos legales activos relacionados con el manejo de vehículos.</span>
      </label>
      {erroresCampos.declaraSinSuspensiones && <p className="font-body text-sm font-medium text-danger-action">{erroresCampos.declaraSinSuspensiones}</p>}
    </fieldset>
  );
}
