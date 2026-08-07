import { Aviso, Field } from "@ruum/ui";
import { DIAS_ADVERTENCIA_VIGENCIA_LICENCIA, diasParaVencerLicencia } from "@ruum/shared/validacion";
import type { CampoRegistroConductor } from "@ruum/shared/validacion";
import { DatosSensiblesTooltip } from "../cuenta/datos-sensibles";
import { formatoLicenciaMask, soloAlfanumericoMayusculas } from "./registration-validation";
import { TIPOS_LICENCIA } from "./registration-types";
import { SelectField } from "./SelectField";
import { useEffect, useState } from "react";

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
  validarCampo: (campo: CampoRegistroConductor, valor: string) => boolean;
  validarVigenciaLicencia: () => boolean;
}) {
  const diasVigencia = vigenciaLicencia && !erroresCampos.vigenciaLicencia ? diasParaVencerLicencia(vigenciaLicencia) : null;
  const [numeroLicenciaValido, setNumeroLicenciaValido] = useState(false);

  // Fecha mínima: hoy (la licencia debe estar vigente)
  const hoyIso = new Date().toISOString().split("T")[0];

  // Validación activa del número de licencia
  useEffect(() => {
    const valorLimpio = numeroLicencia.trim();
    if (valorLimpio.length >= 3 && /^[A-Z0-9]+$/.test(valorLimpio)) {
      setNumeroLicenciaValido(true);
    } else {
      setNumeroLicenciaValido(false);
    }
  }, [numeroLicencia]);

  const manejarCambioNumeroLicencia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setNumeroLicencia(soloAlfanumericoMayusculas(valor));
    limpiarErrorCampo("numeroLicencia");
  };

  return (
    <fieldset className="grid gap-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field
            etiqueta="Número de licencia"
            value={formatoLicenciaMask(numeroLicencia)}
            onChange={manejarCambioNumeroLicencia}
            error={erroresCampos.numeroLicencia || undefined}
            required
            aria-required="true"
          />
          {/* Indicador de validación activa del número de licencia */}
          {numeroLicencia.length > 0 && (
            <div className="mt-1 flex items-center gap-1.5 font-body text-xs" aria-live="polite">
              {numeroLicenciaValido ? (
                <>
                  <span className="flex size-3.5 items-center justify-center rounded-full bg-emerald-500 text-white" aria-hidden>
                    ✓
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Formato válido</span>
                </>
              ) : (
                <>
                  <span className="flex size-3.5 items-center justify-center rounded-full border border-text-tertiary text-text-tertiary" aria-hidden>
                    ○
                  </span>
                  <span className="text-text-secondary">Formato inválido</span>
                </>
              )}
            </div>
          )}
        </div>
        <DatosSensiblesTooltip tipo="licencia" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          etiqueta="Tipo de licencia"
          value={tipoLicencia}
          onChange={(valor) => {
            setTipoLicencia(valor);
            limpiarErrorCampo("tipoLicencia");
          }}
          error={erroresCampos.tipoLicencia || undefined}
          required
          placeholder="Selecciona el tipo de licencia"
          opciones={TIPOS_LICENCIA}
          aria-required="true"
        />
        <Field
          etiqueta="Vigencia"
          value={vigenciaLicencia}
          ayuda={
            <span className="flex items-center justify-between">
              <span className="text-text-secondary">Formato AAAA-MM-DD</span>
              {vigenciaLicencia && (
                <span className="text-text-secondary font-medium">
                  {diasVigencia !== null && diasVigencia >= 0 && `${diasVigencia} días restantes`}
                </span>
              )}
            </span>
          }
          type="date"
          min={hoyIso}
          onChange={(e) => {
            const valor = e.target.value;
            setVigenciaLicencia(valor);
            limpiarErrorCampo("vigenciaLicencia");
          }}
          onBlur={() => validarVigenciaLicencia()}
          error={erroresCampos.vigenciaLicencia || undefined}
          required
          aria-required="true"
          className="cursor-pointer"
        />
      </div>

      {diasVigencia !== null && diasVigencia >= 0 && diasVigencia <= DIAS_ADVERTENCIA_VIGENCIA_LICENCIA && (
        <Aviso tono="atencion">
          Tu licencia vence en {diasVigencia} día{diasVigencia === 1 ? "" : "s"}. Puedes continuar, pero procura renovarla pronto para no perder actividad.
        </Aviso>
      )}

      <label className="flex items-start gap-3 rounded-xl border border-border bg-surface/50 p-4 font-body text-sm leading-6 text-text-secondary transition-all hover:border-route-action hover:bg-surface">
        <input
          type="checkbox"
          checked={autorizaVerificacion}
          onChange={(e) => {
            setAutorizaVerificacion(e.target.checked);
            limpiarErrorCampo("autorizaVerificacion");
          }}
          className="mt-0.5 size-4 accent-route-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action"
          aria-required="true"
        />
        <span className="flex-1">
          <span className="font-medium text-route-action">Autorizo la verificación de antecedentes</span>
          <span className="block">y de mi historial de manejo ante las autoridades correspondientes.</span>
        </span>
      </label>
      {erroresCampos.autorizaVerificacion && <p className="font-body text-sm font-medium text-danger-action">{erroresCampos.autorizaVerificacion}</p>}

      <label className="flex items-start gap-3 rounded-xl border border-border bg-surface/50 p-4 font-body text-sm leading-6 text-text-secondary transition-all hover:border-route-action hover:bg-surface">
        <input
          type="checkbox"
          checked={declaraSinSuspensiones}
          onChange={(e) => {
            setDeclaraSinSuspensiones(e.target.checked);
            limpiarErrorCampo("declaraSinSuspensiones");
          }}
          className="mt-0.5 size-4 accent-route-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action"
          aria-required="true"
        />
        <span className="flex-1">
          <span className="font-medium text-route-action">Declaro no tener suspensiones vigentes</span>
          <span className="block">de licencia ni procesos legales activos relacionados con el manejo de vehículos.</span>
        </span>
      </label>
      {erroresCampos.declaraSinSuspensiones && <p className="font-body text-sm font-medium text-danger-action">{erroresCampos.declaraSinSuspensiones}</p>}
    </fieldset>
  );
}
